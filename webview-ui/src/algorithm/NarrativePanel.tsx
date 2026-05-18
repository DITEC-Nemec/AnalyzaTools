import React from 'react';
import { VariableList } from './VariableList';
import type { AlgorithmMeta, NamespaceEntity, SqdAlgorithm, SqdStep, StepCondition, Variable } from '../types/sqd';
import { StepCard } from './StepCard';
import { label } from '../ui-labels';

interface Props {
  model: SqdAlgorithm;
  onChange: (updated: SqdAlgorithm) => void;
}

type StepType = SqdStep['type'];
type TopTab = 'algorithm' | 'steps' | 'namespaceRef';
type AlgorithmSubTab = 'detail' | 'inputs' | 'outputs';

interface OwnerContext {
  parentItems: SqdStep[];
  setParentItems: (items: SqdStep[]) => void;
  ownerIndex: number;
}

interface AddMenuProps {
  onAdd: (type: StepType) => void;
}

const AddMenu: React.FC<AddMenuProps> = ({ onAdd }) => {
  const [open, setOpen] = React.useState(false);

  const handleAdd = (type: StepType) => {
    onAdd(type);
    setOpen(false);
  };

  const stepTypeLabels: Record<StepType, string> = {
    step: label('algorithm.stepTypeLabels.step', 'Krok'),
    operation: label('algorithm.stepTypeLabels.operation', 'Operacia'),
    decision: label('algorithm.stepTypeLabels.decision', 'Rozhodnutie'),
    loop: label('algorithm.stepTypeLabels.loop', 'Smycka'),
    foreach: label('algorithm.stepTypeLabels.foreach', 'Pre kazde'),
    event: label('algorithm.stepTypeLabels.event', 'Udalost'),
    return: label('algorithm.stepTypeLabels.return', 'Navrat'),
    stop: label('algorithm.stepTypeLabels.stop', 'Zastavenie'),
    block: label('algorithm.stepTypeLabels.block', 'Blok')
  };

  const allTypes: StepType[] = ['step', 'operation', 'decision', 'loop', 'foreach', 'event', 'return', 'stop', 'block'];

  return (
    <div className="add-menu">
      <button className="icon-btn" title={label('algorithm.actions.addStep', 'Pridat krok')} onClick={() => setOpen((v) => !v)}>
        +
      </button>
      {open && (
        <div className="add-menu-list">
          {allTypes.map((type) => (
            <button key={type} onClick={() => handleAdd(type)}>
              {stepTypeLabels[type]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const defaultCondition = (): StepCondition => ({ kind: 'simple', description: '', check: 'exists' });

const getStepChildren = (step: SqdStep): SqdStep[] => step.body ?? step.steps ?? [];

const setStepChildren = (step: SqdStep, children: SqdStep[]): SqdStep => {
  if (step.steps) {
    return { ...step, body: children, steps: children };
  }
  return { ...step, body: children };
};

const normalizeVariableArray = (items?: Array<Variable | string>): Variable[] =>
  (items ?? []).map((item) => {
    if (typeof item === 'string') {
      return { namedType: { name: item } };
    }
    return {
      namedType: {
        name: item.namedType?.name ?? '',
        type: item.namedType?.type,
        entityRef: item.namedType?.entityRef,
        typeRef: item.namedType?.typeRef,
        definition: item.namedType?.definition,
        nullable: item.namedType?.nullable,
        readOnly: item.namedType?.readOnly,
        multiplicity: item.namedType?.multiplicity
      }
    };
  });

export const NarrativePanel: React.FC<Props> = ({ model, onChange }) => {
  const L = (path: string, fallback: string) => label(`algorithm.${path}`, fallback);

  const [tab, setTab] = React.useState<TopTab>('steps');
  const [algorithmTab, setAlgorithmTab] = React.useState<AlgorithmSubTab>('detail');
  const [selectedNamespaceIndex, setSelectedNamespaceIndex] = React.useState<number | null>(null);

  const nextStepId = (): string => {
    let maxId = 0;

    const walk = (items: SqdStep[]) => {
      for (const step of items) {
        const numeric = Number.parseInt(step.id, 10);
        if (!Number.isNaN(numeric)) {
          maxId = Math.max(maxId, numeric);
        }

        const children = getStepChildren(step);
        if (children.length > 0) {
          walk(children);
        }

        if (step.branches) {
          for (const branch of step.branches) {
            walk(branch.then ?? []);
          }
        }
      }
    };

    walk(model.steps);
    return String(maxId + 1);
  };

  const createStep = (type: StepType): SqdStep => {
    const base: SqdStep = { id: nextStepId(), type, text: '' };

    if (type === 'decision') {
      return {
        ...base,
        condition: defaultCondition(),
        branches: [
          { when: true, then: [] },
          { when: false, then: [] }
        ]
      };
    }

    if (type === 'loop') {
      return {
        ...base,
        condition: defaultCondition(),
        body: []
      };
    }

    if (type === 'foreach') {
      return {
        ...base,
        collection: '',
        item: '',
        body: []
      };
    }

    if (type === 'operation') {
      return { ...base, operation: '' };
    }

    if (type === 'event') {
      return { ...base, event: { code: '', text: '', severity: 'info' } };
    }

    if (type === 'block') {
      return { ...base, body: [] };
    }

    return base;
  };

  const updateAlgorithm = (patch: Partial<AlgorithmMeta>) => {
    onChange({ ...model, algorithm: { ...model.algorithm, ...patch } });
  };

  const namespaceItems = model.namespaceRef ?? [];
  const selectedNamespace =
    selectedNamespaceIndex === null ? null : namespaceItems[selectedNamespaceIndex] ?? null;

  const renderStepList = (
    items: SqdStep[],
    setItems: (updated: SqdStep[]) => void,
    depth: number,
    owner?: OwnerContext
  ): React.ReactNode => {
    return (
      <div className="step-list">
        {items.map((step, index) => {
          const updateCurrent = (updated: SqdStep) => {
            const next = [...items];
            next[index] = updated;
            setItems(next);
          };

          const deleteCurrent = () => {
            const next = items.filter((_, i) => i !== index);
            setItems(next);
          };

          const insertAfter = (type: StepType) => {
            const next = [...items];
            next.splice(index + 1, 0, createStep(type));
            setItems(next);
          };

          const moveRight = () => {
            if (index === 0) {
              return;
            }

            const next = [...items];
            const moving = next[index];
            const previous = next[index - 1];
            const previousChildren = [...getStepChildren(previous), moving];
            next[index - 1] = setStepChildren(previous, previousChildren);
            next.splice(index, 1);
            setItems(next);
          };

          const moveLeft = () => {
            if (!owner) {
              return;
            }

            const nextCurrent = [...items];
            const moving = nextCurrent[index];
            nextCurrent.splice(index, 1);
            setItems(nextCurrent);

            const nextParent = [...owner.parentItems];
            nextParent.splice(owner.ownerIndex + 1, 0, moving);
            owner.setParentItems(nextParent);
          };

          const branches = step.branches && step.branches.length > 0
            ? step.branches
            : (step.type === 'decision'
              ? [{ when: true, then: [] }, { when: false, then: [] }]
              : []);

          return (
            <div className="step-tree-node" key={`${step.id}-${index}`}>
              <StepCard
                step={step}
                depth={depth}
                onChange={updateCurrent}
                actions={(
                  <>
                    <AddMenu onAdd={insertAfter} />
                    <button className="icon-btn" title={L('actions.deleteBranch', 'Vymazat vetvu')} onClick={deleteCurrent}>🗑</button>
                    <button className="icon-btn" title={L('actions.moveUpLevel', 'Posun o uroven vyssie')} onClick={moveLeft}>{'<<'}</button>
                    <button className="icon-btn" title={L('actions.moveDownLevel', 'Posun o uroven nizsie')} onClick={moveRight}>{'>>'}</button>
                  </>
                )}
              />

              {step.type === 'decision' && (
                <div className="nested-blocks" style={{ marginLeft: (depth + 1) * 22 }}>
                  {branches.map((branch, branchIndex) => {
                    const setBranchItems = (branchItems: SqdStep[]) => {
                      const nextBranches = [...branches];
                      nextBranches[branchIndex] = { ...nextBranches[branchIndex], then: branchItems };
                      updateCurrent({ ...step, branches: nextBranches });
                    };

                    return (
                      <div className="branch-block" key={`branch-${branchIndex}`}>
                        <div className="branch-label">{L('steps.branch', 'Vetva')}: {String(branch.when)}</div>
                        {renderStepList(
                          branch.then ?? [],
                          setBranchItems,
                          depth + 1,
                          {
                            parentItems: items,
                            setParentItems: setItems,
                            ownerIndex: index
                          }
                        )}
                        <div className="inline-add-row">
                          <AddMenu onAdd={(type) => setBranchItems([...(branch.then ?? []), createStep(type)])} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {(step.type === 'loop' || step.type === 'foreach' || step.type === 'block' || getStepChildren(step).length > 0) && (
                <div className="nested-blocks" style={{ marginLeft: (depth + 1) * 22 }}>
                  <div className="branch-block">
                    <div className="branch-label">{L('steps.body', 'Body')}</div>
                    {renderStepList(
                      getStepChildren(step),
                      (children) => updateCurrent(setStepChildren(step, children)),
                      depth + 1,
                      {
                        parentItems: items,
                        setParentItems: setItems,
                        ownerIndex: index
                      }
                    )}
                    <div className="inline-add-row">
                      <AddMenu onAdd={(type) => updateCurrent(setStepChildren(step, [...getStepChildren(step), createStep(type)]))} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="inline-add-row">
            <AddMenu onAdd={(type) => setItems([createStep(type)])} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="narrative-panel">
      <div className="panel-title">{L('panelTitle', 'SQD Editor')}</div>
      <div className="tab-row">
        <button className={tab === 'algorithm' ? 'tab active' : 'tab'} onClick={() => setTab('algorithm')}>
          {L('tabs.algorithm', 'algorithm')}
        </button>
        <button className={tab === 'steps' ? 'tab active' : 'tab'} onClick={() => setTab('steps')}>
          {L('tabs.steps', 'steps')}
        </button>
        <button className={tab === 'namespaceRef' ? 'tab active' : 'tab'} onClick={() => setTab('namespaceRef')}>
          {L('tabs.namespaceRef', 'namespaceRef')}
        </button>
      </div>

      <div className="steps-tree">
        {tab === 'algorithm' && (
          <div className="item-card">
            <h4>{L('algorithmForm.title', 'Algorithm')}</h4>
            <div className="tab-row">
              <button className={algorithmTab === 'detail' ? 'tab active' : 'tab'} onClick={() => setAlgorithmTab('detail')}>
                {L('algorithmForm.tabs.detail', 'Detail')}
              </button>
              <button className={algorithmTab === 'inputs' ? 'tab active' : 'tab'} onClick={() => setAlgorithmTab('inputs')}>
                {L('algorithmForm.tabs.inputs', 'Vstupne parametre')}
              </button>
              <button className={algorithmTab === 'outputs' ? 'tab active' : 'tab'} onClick={() => setAlgorithmTab('outputs')}>
                {L('algorithmForm.tabs.outputs', 'Vystupne parametre')}
              </button>
            </div>

            {algorithmTab === 'detail' && (
              <>
                <label className="field-label">{L('algorithmForm.name', 'name')}</label>
                <input
                  className="field-input"
                  value={model.algorithm?.name ?? ''}
                  onChange={(e) => updateAlgorithm({ name: e.target.value })}
                />

                <label className="field-label">{L('algorithmForm.description', 'description')}</label>
                <textarea
                  className="step-text"
                  rows={4}
                  value={model.algorithm?.description ?? ''}
                  onChange={(e) => updateAlgorithm({ description: e.target.value })}
                />

                <label className="field-label">{L('algorithmForm.version', 'version')}</label>
                <input
                  className="field-input"
                  value={model.algorithm?.version ?? ''}
                  onChange={(e) => updateAlgorithm({ version: e.target.value })}
                />
              </>
            )}

            {algorithmTab === 'inputs' && (
              <div style={{ marginTop: 8 }}>
                <VariableList
                  value={normalizeVariableArray(model.algorithm?.inputs as Array<Variable | string> | undefined)}
                  onChange={(inputs) => updateAlgorithm({ inputs })}
                />
              </div>
            )}

            {algorithmTab === 'outputs' && (
              <div style={{ marginTop: 8 }}>
                <VariableList
                  value={normalizeVariableArray(model.algorithm?.outputs as Array<Variable | string> | undefined)}
                  onChange={(outputs) => updateAlgorithm({ outputs })}
                />
              </div>
            )}
          </div>
        )}

        {tab === 'steps' && renderStepList(model.steps, (steps) => onChange({ ...model, steps }), 0)}

        {tab === 'namespaceRef' && (
          <section className="panel">
            <div className="panel-head">
              <h4>{L('namespaceRef.title', 'namespaceRef')}</h4>
              <button
                className="icon-btn"
                onClick={() => {
                  const next = [...namespaceItems, { alias: '', filePath: '' } as NamespaceEntity];
                  onChange({ ...model, namespaceRef: next });
                  setSelectedNamespaceIndex(next.length - 1);
                }}
              >
                + {L('actions.add', 'Add')}
              </button>
            </div>

            <table className="dm-table">
              <thead>
                <tr>
                  <th>{L('namespaceRef.alias', 'Alias')}</th>
                  <th>{L('namespaceRef.filePath', 'File path')}</th>
                  <th>{L('namespaceRef.actions', 'Akcie')}</th>
                </tr>
              </thead>
              <tbody>
                {namespaceItems.map((item, i) => (
                  <tr
                    key={`${item.alias}-${i}`}
                    className={selectedNamespaceIndex === i ? 'selected' : ''}
                    onClick={() => setSelectedNamespaceIndex(i)}
                  >
                    <td>{item.alias || '-'}</td>
                    <td>{item.filePath || '-'}</td>
                    <td>
                      <button
                        className="icon-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = namespaceItems.filter((_, idx) => idx !== i);
                          onChange({ ...model, namespaceRef: next });
                          if (selectedNamespaceIndex === i) {
                            setSelectedNamespaceIndex(next.length ? Math.min(i, next.length - 1) : null);
                          }
                        }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {selectedNamespace && selectedNamespaceIndex !== null && (
              <div className="item-card compact">
                <h4>{L('namespaceRef.detailTitle', 'Detail namespaceRef')}</h4>
                <label className="field-label">{L('namespaceRef.alias', 'Alias')}</label>
                <input
                  className="field-input"
                  value={selectedNamespace.alias}
                  onChange={(e) => {
                    const next = [...namespaceItems];
                    next[selectedNamespaceIndex] = { ...next[selectedNamespaceIndex], alias: e.target.value };
                    onChange({ ...model, namespaceRef: next });
                  }}
                />

                <label className="field-label">{L('namespaceRef.filePath', 'File path')}</label>
                <input
                  className="field-input"
                  value={selectedNamespace.filePath}
                  onChange={(e) => {
                    const next = [...namespaceItems];
                    next[selectedNamespaceIndex] = { ...next[selectedNamespaceIndex], filePath: e.target.value };
                    onChange({ ...model, namespaceRef: next });
                  }}
                />
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};
