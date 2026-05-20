import React from 'react';
import * as yaml from 'js-yaml';
import { ImportsPanel } from './ImportsPanel';
import { ParametersEditor } from '../components/ParametersEditor';
import { AffectedEntitiesEditor } from '../components/AffectedEntitiesEditor';
import { ActorRefsEditor } from '../components/ActorRefsEditor';
import type { ActorRef, AlgorithmMeta, NamespaceEntity, Parameter, SqdAlgorithm, SqdStep, StepCondition } from '../types/sqd';
import { StepCard } from './StepCard';
import { label } from '../ui-labels';
import { vscodeApi } from './main';

interface Props {
  model: SqdAlgorithm;
  onChange: (updated: SqdAlgorithm) => void;
}

type StepType = SqdStep['type'];
type TopTab = 'imports' | 'algorithm' | 'steps' | 'namespaceRef';
type AlgorithmSubTab = 'detail' | 'parameters';

interface OwnerContext {
  parentItems: SqdStep[];
  setParentItems: (items: SqdStep[]) => void;
  ownerIndex: number;
}

interface AddMenuProps {
  onAdd: (type: StepType) => void;
}

type NamespaceReferencedModel = {
  entities?: Array<{
    name?: string;
    functions?: Array<{ name?: string }>;
    attributes?: Array<{ name?: string; namedType?: { name?: string } } | string>;
  }>;
  eventGlossary?: Array<{ code?: string; title?: string }>;
  actors?: Array<{ code?: string }>;
};

const STEP_TYPE_LABELS: Record<StepType, string> = {
  step: label('algorithm.stepTypeLabels.step', 'Krok'),
  operation: label('algorithm.stepTypeLabels.operation', 'Operacia'),
  decision: label('algorithm.stepTypeLabels.decision', 'Rozhodnutie'),
  loop: label('algorithm.stepTypeLabels.loop', 'Smycka'),
  foreach: label('algorithm.stepTypeLabels.foreach', 'Pre kazde'),
  return: label('algorithm.stepTypeLabels.return', 'Navrat'),
  stop: label('algorithm.stepTypeLabels.stop', 'Zastavenie'),
  block: label('algorithm.stepTypeLabels.block', 'Blok')
};

const ALL_STEP_TYPES: StepType[] = ['step', 'decision', 'loop', 'foreach', 'operation', 'return', 'stop', 'block'];

const AddMenu: React.FC<AddMenuProps> = ({ onAdd }) => {
  const [open, setOpen] = React.useState(false);

  const handleAdd = (type: StepType) => {
    onAdd(type);
    setOpen(false);
  };

  return (
    <div className="add-menu">
      <button className="icon-btn" title={label('algorithm.actions.addStep', 'Pridat krok')} onClick={() => setOpen((v) => !v)}>
        +
      </button>
      {open && (
        <div className="add-menu-list">
          {ALL_STEP_TYPES.map((type) => (
            <button key={type} onClick={() => handleAdd(type)}>
              {STEP_TYPE_LABELS[type]}
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

const normalizeAlgorithmParameters = (algorithm: AlgorithmMeta | undefined): Parameter[] => {
  if (!algorithm) {
    return [];
  }

  return (algorithm.parameters ?? []).map((param) => ({
    ...param,
    direction: param.direction ?? 'in'
  }));
};

const normalizeActorRefs = (items: ActorRef[] | undefined): ActorRef[] => {
  return (items ?? []).map((item) => ({
    namespaceAlias: item.namespaceAlias ?? 'local',
    actor: item.actor ?? ''
  }));
};

export const NarrativePanel: React.FC<Props> = ({ model, onChange }) => {
  const L = (path: string, fallback: string) => label(`algorithm.${path}`, fallback);

  const [tab, setTab] = React.useState<TopTab>('steps');
  const [algorithmTab, setAlgorithmTab] = React.useState<AlgorithmSubTab>('detail');
  const [selectedNamespaceIndex, setSelectedNamespaceIndex] = React.useState<number | null>(null);
  const [namespaceModels, setNamespaceModels] = React.useState<Record<string, NamespaceReferencedModel>>({});
  const pendingNamespaceByRequestKey = React.useRef<Map<string, string>>(new Map());

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

    if (type === 'return') {
      return base;
    }

    if (type === 'stop') {
      return base;
    }

    if (type === 'block') {
      return { ...base, body: [] };
    }

    return base;
  };

  const updateAlgorithm = (patch: Partial<AlgorithmMeta>) => {
    onChange({ ...model, algorithm: { ...model.algorithm, ...patch } });
  };

  const namespaceItems = (model.namespaceRef ?? []).map((item) => ({
    alias: item.alias ?? '',
    filePath: item.filePath ?? '',
    sourceType: item.sourceType ?? (item.alias === 'local' ? 'current' : 'model')
  }));
  const selectedNamespace =
    selectedNamespaceIndex === null ? null : namespaceItems[selectedNamespaceIndex] ?? null;

  const applyNamespacePatch = (index: number, patch: Partial<NamespaceEntity>) => {
    const next = [...namespaceItems];
    const merged = { ...next[index], ...patch };

    if (merged.sourceType === 'current') {
      merged.alias = 'local';
    }
    if (merged.alias === 'local' && merged.sourceType !== 'current') {
      merged.sourceType = 'current';
    }

    next[index] = merged;
    onChange({ ...model, namespaceRef: next });
  };

  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'filePicked') {
        const current = model.namespaceRef ?? [];
        const next = [
          ...current,
          {
            alias: msg.alias ?? '',
            filePath: msg.filePath ?? '',
            sourceType: (msg.sourceType ?? 'model') as NamespaceEntity['sourceType']
          }
        ];
        onChange({ ...model, namespaceRef: next });
        setSelectedNamespaceIndex(next.length - 1);
        setTab('namespaceRef');
        return;
      }

      if (msg.type === 'modelContent' && typeof msg.content === 'string' && typeof msg.requestKey === 'string') {
        const alias = pendingNamespaceByRequestKey.current.get(msg.requestKey);
        pendingNamespaceByRequestKey.current.delete(msg.requestKey);
        if (!alias) {
          return;
        }

        try {
          const parsed = yaml.load(msg.content) as NamespaceReferencedModel;
          if (!parsed || typeof parsed !== 'object') {
            return;
          }

          setNamespaceModels(prev => ({ ...prev, [alias]: parsed }));
        } catch {
          setNamespaceModels(prev => {
            const next = { ...prev };
            delete next[alias];
            return next;
          });
        }
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [model, onChange]);

  React.useEffect(() => {
    const aliasesInUse = new Set(
      namespaceItems
        .filter(ns => !!ns.alias)
        .map(ns => ns.alias)
    );

    setNamespaceModels(prev => {
      const next: Record<string, NamespaceReferencedModel> = {};
      Object.entries(prev).forEach(([alias, nsModel]) => {
        if (aliasesInUse.has(alias)) {
          next[alias] = nsModel;
        }
      });
      return next;
    });

    namespaceItems.forEach(ns => {
      if (!ns.alias || !ns.filePath || (ns.sourceType !== 'model' && ns.sourceType !== 'sqd')) {
        return;
      }

      pendingNamespaceByRequestKey.current.set(ns.filePath, ns.alias);
      vscodeApi.postMessage({ type: 'loadModel', path: ns.filePath });
    });
  }, [namespaceItems]);

  const sqdAliases = React.useMemo(
    () => namespaceItems
      .filter(ns => ns.sourceType === 'sqd' && !!ns.alias)
      .map(ns => ns.alias),
    [namespaceItems]
  );

  const modelAliases = React.useMemo(
    () => namespaceItems
      .filter(ns => ns.sourceType === 'model' && !!ns.alias)
      .map(ns => ns.alias),
    [namespaceItems]
  );

  const getEntitiesForAlias = React.useCallback((alias: string): string[] => {
    return (namespaceModels[alias]?.entities ?? [])
      .map(entity => entity.name)
      .filter((name): name is string => Boolean(name));
  }, [namespaceModels]);

  const getFunctionsForEntity = React.useCallback((alias: string, entityName: string): string[] => {
    const entity = (namespaceModels[alias]?.entities ?? []).find(item => item.name === entityName);
    return (entity?.functions ?? [])
      .map(fn => fn.name)
      .filter((name): name is string => Boolean(name));
  }, [namespaceModels]);

  const getAttributesForEntity = React.useCallback((entityName: string, alias?: string): string[] => {
    if (!alias) {
      return [];
    }

    const entity = (namespaceModels[alias]?.entities ?? []).find(item => item.name === entityName);
    return (entity?.attributes ?? [])
      .map((attribute) => {
        if (typeof attribute === 'string') {
          return attribute;
        }
        return attribute.namedType?.name ?? attribute.name;
      })
      .filter((name): name is string => Boolean(name));
  }, [namespaceModels]);

  const getEventsForAlias = React.useCallback((alias: string): string[] => {
    return (namespaceModels[alias]?.eventGlossary ?? [])
      .map(event => event.code ?? event.title)
      .filter((event): event is string => Boolean(event));
  }, [namespaceModels]);

  const getActorsForAlias = React.useCallback((alias: string | undefined): string[] => {
    if (!alias || alias === 'local') {
      return (model.actors ?? []).map(actor => actor.code).filter((code): code is string => Boolean(code));
    }

    return (namespaceModels[alias]?.actors ?? [])
      .map(actor => actor.code)
      .filter((code): code is string => Boolean(code));
  }, [model.actors, namespaceModels]);

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
                modelAliases={modelAliases}
                sqdAliases={sqdAliases}
                getEntitiesForAlias={getEntitiesForAlias}
                getAttributesForEntity={getAttributesForEntity}
                getFunctionsForEntity={getFunctionsForEntity}
                getEventsForAlias={getEventsForAlias}
                getActorsForAlias={getActorsForAlias}
                onChange={updateCurrent}
                actions={(
                  <>
                    <AddMenu onAdd={insertAfter} />
                    {!step.behavior && (
                      <button className="icon-btn" title={L('actions.addBehavior', 'Pridat behavior')} onClick={() => updateCurrent({ ...step, behavior: { description: '', preconditions: [], postconditions: [], affectedEntities: [], actors: [] } })}>💬</button>
                    )}
                    {step.behavior && (
                      <button className="icon-btn" title={L('actions.removeBehavior', 'Odstranit behavior')} onClick={() => { const { behavior, ...rest } = step; updateCurrent(rest); }}>✕</button>
                    )}
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
        <button className={tab === 'imports' ? 'tab active' : 'tab'} onClick={() => setTab('imports')}>
          {L('tabs.imports', 'imports')}
        </button>
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
        {tab === 'imports' && (
          <ImportsPanel
            imports={(model as any).imports ?? ['local']}
            availableNamespaces={namespaceItems}
            onChange={(imports) => onChange({ ...model, imports } as any)}
          />
        )}

        {tab === 'algorithm' && (
          <div className="item-card">
            <h4>{L('algorithmForm.title', 'Algorithm')}</h4>
            <div className="tab-row">
              <button className={algorithmTab === 'detail' ? 'tab active' : 'tab'} onClick={() => setAlgorithmTab('detail')}>
                {L('algorithmForm.tabs.detail', 'Detail')}
              </button>
              <button className={algorithmTab === 'parameters' ? 'tab active' : 'tab'} onClick={() => setAlgorithmTab('parameters')}>
                {L('algorithmForm.tabs.parameters', 'Parametre')}
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
                  value={model.algorithm?.behavior?.description ?? ''}
                  onChange={(e) => updateAlgorithm({
                    behavior: {
                      ...(model.algorithm?.behavior ?? {}),
                      description: e.target.value
                    }
                  })}
                />

                <label className="field-label">{L('algorithmForm.preconditions', 'Preconditions')}</label>
                <textarea
                  className="field-input"
                  rows={4}
                  value={(model.algorithm?.behavior?.preconditions ?? []).join('\n')}
                  onChange={(e) => updateAlgorithm({
                    behavior: {
                      ...(model.algorithm?.behavior ?? {}),
                      preconditions: e.target.value.split('\n').filter(s => s.trim().length > 0)
                    }
                  })}
                />

                <label className="field-label">{L('algorithmForm.postconditions', 'Postconditions')}</label>
                <textarea
                  className="field-input"
                  rows={4}
                  value={(model.algorithm?.behavior?.postconditions ?? []).join('\n')}
                  onChange={(e) => updateAlgorithm({
                    behavior: {
                      ...(model.algorithm?.behavior ?? {}),
                      postconditions: e.target.value.split('\n').filter(s => s.trim().length > 0)
                    }
                  })}
                />

                <div style={{ marginTop: 16 }}>
                  <AffectedEntitiesEditor
                    affectedEntities={model.algorithm?.behavior?.affectedEntities ?? []}
                    modelAliases={modelAliases}
                    sqdAliases={sqdAliases}
                    getEntitiesForAlias={getEntitiesForAlias}
                    getAttributesForEntity={getAttributesForEntity}
                    onChange={(affectedEntities) => updateAlgorithm({
                      behavior: {
                        ...(model.algorithm?.behavior ?? {}),
                        affectedEntities
                      }
                    })}
                  />
                </div>

                <ActorRefsEditor
                  actorRefs={normalizeActorRefs(model.algorithm?.behavior?.actors)}
                  namespaceAliases={(model.namespaceRef ?? []).map(ns => ns.alias).filter((alias): alias is string => Boolean(alias))}
                  getAvailableActors={getActorsForAlias}
                  onChange={(actors) => updateAlgorithm({
                    behavior: {
                      ...(model.algorithm?.behavior ?? {}),
                      actors
                    }
                  })}
                  prefix="algorithm"
                />

                <label className="field-label">{L('algorithmForm.version', 'version')}</label>
                <input
                  className="field-input"
                  value={model.algorithm?.version ?? ''}
                  onChange={(e) => updateAlgorithm({ version: e.target.value })}
                />
              </>
            )}

            {algorithmTab === 'parameters' && (
              <div style={{ marginTop: 8 }}>
                <ParametersEditor
                  value={normalizeAlgorithmParameters(model.algorithm)}
                  onChange={(parameters) => updateAlgorithm({
                    parameters
                  })}
                  namespaceRef={model.namespaceRef}
                  vscodeApi={vscodeApi}
                  showDirection
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
              <div className="inline-actions">
                <button className="icon-btn" onClick={() => vscodeApi.postMessage({ type: 'pickFile' })}>
                  📂 {L('namespaceRef.pickFile', 'Vyber súbor')}
                </button>
                <button
                  className="icon-btn"
                  onClick={() => {
                    const next = [...namespaceItems, { alias: '', filePath: '', sourceType: 'model' } as NamespaceEntity];
                    onChange({ ...model, namespaceRef: next });
                    setSelectedNamespaceIndex(next.length - 1);
                  }}
                >
                  + {L('actions.add', 'Add')}
                </button>
              </div>
            </div>

            <table className="dm-table">
              <thead>
                <tr>
                  <th>{L('namespaceRef.alias', 'Alias')}</th>
                  <th>{L('namespaceRef.sourceType', 'Source type')}</th>
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
                    <td>{item.sourceType || '-'}</td>
                    <td>{item.filePath || '-'}</td>
                    <td>
                      {item.sourceType !== 'current' && (
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
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {selectedNamespace && selectedNamespaceIndex !== null && selectedNamespace.sourceType !== 'current' && (
              <div className="item-card compact">
                <h4>{L('namespaceRef.detailTitle', 'Detail namespaceRef')}</h4>
                <label className="field-label">{L('namespaceRef.alias', 'Alias')}</label>
                <input
                  className="field-input"
                  value={selectedNamespace.alias}
                  onChange={(e) => applyNamespacePatch(selectedNamespaceIndex, { alias: e.target.value })}
                />

                <label className="field-label">{L('namespaceRef.sourceType', 'Source type')}</label>
                <select
                  className="field-input"
                  value={selectedNamespace.sourceType}
                  onChange={(e) => applyNamespacePatch(selectedNamespaceIndex, { sourceType: e.target.value as NamespaceEntity['sourceType'] })}
                >
                  <option value="model">model</option>
                  <option value="sqd">sqd</option>
                  <option value="current">current</option>
                </select>

                <label className="field-label">{L('namespaceRef.filePath', 'File path')}</label>
                <input
                  className="field-input"
                  value={selectedNamespace.filePath}
                  onChange={(e) => applyNamespacePatch(selectedNamespaceIndex, { filePath: e.target.value })}
                />
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};
