import React from 'react';
import * as yaml from 'js-yaml';
import { ImportsPanel } from './ImportsPanel';
import { ParametersEditor } from '../components/ParametersEditor';
import { ActorRefsEditor } from '../components/ActorRefsEditor';
import type { ActorRef, AlgorithmDef, AlgorithmMeta, NamespaceEntity, Parameter, SqdAlgorithm, SqdStep, StepCondition } from '../types/sqd';
import { StepCard } from './StepCard';
import { label } from '../ui-labels';
import { vscodeApi } from './main';
import { BehaviorDefinitionEditor } from '../components/BehaviorDefinitionEditor';

interface Props {
  model: SqdAlgorithm;
  onChange: (updated: SqdAlgorithm) => void;
  globalNamespaces?: NamespaceEntity[];
}

type StepType = SqdStep['stepType'];
type TopTab = 'imports' | 'algorithms';
type AlgorithmSubTab = 'algorithm' | 'parameters' | 'steps';

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
  businessRules?: Array<{ code?: string }>;
  algorithms?: Array<{ name?: string }>;
};

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const toNamespaceReferencedModel = (parsed: unknown): NamespaceReferencedModel => {
  const root = asObject(parsed) ?? {};
  const domain = asObject(root.domain);
  const dictionary = asObject(root.dictionary);
  const algorithmModule = asObject(root.algorithm);

  const legacyEntities = Array.isArray(root.entityList) ? root.entityList : Array.isArray(root.entities) ? root.entities : [];
  const unifiedEntities = Array.isArray(domain?.entityList) ? domain.entityList : [];
  const entitiesSource = (legacyEntities.length > 0 ? legacyEntities : unifiedEntities) as Array<Record<string, unknown>>;

  const legacyEvents = Array.isArray(root.eventGlossaryList) ? root.eventGlossaryList : Array.isArray(root.eventGlossary) ? root.eventGlossary : [];
  const unifiedEvents = Array.isArray(domain?.eventGlossaryList) ? domain.eventGlossaryList : [];
  const eventsSource = (legacyEvents.length > 0 ? legacyEvents : unifiedEvents) as Array<Record<string, unknown>>;

  const legacyActors = Array.isArray(root.actorList) ? root.actorList : Array.isArray(root.actors) ? root.actors : [];
  const unifiedActors = Array.isArray(dictionary?.actorList) ? dictionary.actorList : [];
  const actorsSource = (legacyActors.length > 0 ? legacyActors : unifiedActors) as Array<Record<string, unknown>>;

  const legacyRules = Array.isArray(root.businessRuleList) ? root.businessRuleList : [];
  const unifiedRules = Array.isArray(dictionary?.businessRuleList) ? dictionary.businessRuleList : [];
  const rulesSource = (legacyRules.length > 0 ? legacyRules : unifiedRules) as Array<Record<string, unknown>>;

  const algorithmList = Array.isArray(algorithmModule?.algorithmList)
    ? (algorithmModule?.algorithmList as Array<Record<string, unknown>>)
    : [];
  const topLevelAlgorithm = asObject(root.algorithm);
  const topLevelAlgorithmName = typeof topLevelAlgorithm?.name === 'string' ? topLevelAlgorithm.name : undefined;

  return {
    entities: entitiesSource.map((item) => ({
      name: typeof item.name === 'string' ? item.name : undefined,
      functions: (Array.isArray(item.functionList) ? item.functionList : Array.isArray(item.functions) ? item.functions : [])
        .map((fn) => ({ name: typeof (fn as Record<string, unknown>)?.name === 'string' ? String((fn as Record<string, unknown>).name) : undefined })),
      attributes: (Array.isArray(item.attributeList) ? item.attributeList : Array.isArray(item.attributes) ? item.attributes : []) as Array<{ name?: string; namedType?: { name?: string } } | string>
    })),
    eventGlossary: eventsSource.map((item) => ({
      code: typeof item.code === 'string' ? item.code : undefined,
      title: typeof item.title === 'string' ? item.title : undefined
    })),
    actors: actorsSource.map((item) => ({
      code: typeof item.code === 'string' ? item.code : undefined
    })),
    businessRules: rulesSource.map((item) => ({
      code: typeof item.code === 'string' ? item.code : undefined
    })),
    algorithms: [
      ...(topLevelAlgorithmName ? [{ name: topLevelAlgorithmName }] : []),
      ...algorithmList.map((item) => ({ name: typeof item.name === 'string' ? item.name : undefined }))
    ]
  };
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

const getStepChildren = (step: SqdStep): SqdStep[] => step.subStepList ?? step.stepList ?? [];

const setStepChildren = (step: SqdStep, children: SqdStep[]): SqdStep => {
  if (step.stepList) {
    return { ...step, subStepList: children, stepList: children };
  }
  return { ...step, subStepList: children };
};

const normalizeAlgorithmParameters = (algorithm: AlgorithmDef | AlgorithmMeta | undefined): Parameter[] => {
  if (!algorithm) {
    return [];
  }

  return (algorithm.parameterList ?? []).map((param) => ({
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

export const NarrativePanel: React.FC<Props> = ({ model, onChange, globalNamespaces = [] }) => {
  const L = (path: string, fallback: string) => label(`algorithm.${path}`, fallback);

  const [tab, setTab] = React.useState<TopTab>('algorithms');
  const [algorithmTab, setAlgorithmTab] = React.useState<AlgorithmSubTab>('algorithm');
  const [selectedAlgorithmIndex, setSelectedAlgorithmIndex] = React.useState<number | null>(null);
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

        if (step.branchList) {
          for (const branch of step.branchList) {
            walk(branch.then ?? []);
          }
        }
      }
    };

    walk(model.stepList);
    return String(maxId + 1);
  };

  const createStep = (type: StepType): SqdStep => {
    const base: SqdStep = { id: nextStepId(), stepType: type, description: '' };

    if (type === 'decision') {
      return {
        ...base,
        condition: defaultCondition(),
        branchList: [
          { when: true, then: [] },
          { when: false, then: [] }
        ]
      };
    }

    if (type === 'loop') {
      return {
        ...base,
        condition: defaultCondition(),
        subStepList: []
      };
    }

    if (type === 'foreach') {
      return {
        ...base,
        sourceCollectionRef: '',
        iteratorItemName: '',
        subStepList: []
      };
    }

    if (type === 'operation') {
      return { ...base, operationRef: '' };
    }

    if (type === 'return') {
      return base;
    }

    if (type === 'stop') {
      return base;
    }

    if (type === 'block') {
      return { ...base, subStepList: [] };
    }

    return base;
  };

  const updateAlgorithm = (idx: number, patch: Partial<AlgorithmDef>) => {
    const list = [...(model.algorithmList ?? [])];
    list[idx] = { ...list[idx], ...patch };
    onChange({ ...model, algorithmList: list });
  };

  const updateAlgorithmMeta = (patch: Partial<AlgorithmMeta>) => {
    onChange({ ...model, algorithm: { ...(model.algorithm ?? { name: '' }), ...patch } });
  };

  const updateGovernance = (patch: Partial<Pick<SqdAlgorithm, 'name' | 'description' | 'version' | 'status'>>) => {
    onChange({ ...model, metadata: { ...(model.metadata ?? { name: '' }), ...patch } });
  };

  const namespaceItems = (model.namespaceRefList ?? []).map((item) => ({
    alias: item.alias ?? '',
    filePath: item.filePath ?? '',
    sourceType: item.sourceType ?? (item.alias === 'local' ? 'current' : 'model')
  }));

  const importNamespaceOptions = globalNamespaces.length > 0 ? globalNamespaces : namespaceItems;

  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'filePicked') {
        return;
      }

      if (msg.type === 'modelContent' && typeof msg.content === 'string' && typeof msg.requestKey === 'string') {
        const alias = pendingNamespaceByRequestKey.current.get(msg.requestKey);
        pendingNamespaceByRequestKey.current.delete(msg.requestKey);
        if (!alias) {
          return;
        }

        try {
          const parsed = yaml.load(msg.content);
          const normalized = toNamespaceReferencedModel(parsed);
          if (!normalized) {
            return;
          }

          setNamespaceModels(prev => ({ ...prev, [alias]: normalized }));
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
      return (model.actorList ?? []).map(actor => actor.code).filter((code): code is string => Boolean(code));
    }

    return (namespaceModels[alias]?.actors ?? [])
      .map(actor => actor.code)
      .filter((code): code is string => Boolean(code));
  }, [model.actorList, namespaceModels]);

  const getBusinessRulesForAlias = React.useCallback((alias: string): string[] => {
    return (namespaceModels[alias]?.businessRules ?? [])
      .map(rule => rule.code)
      .filter((code): code is string => Boolean(code));
  }, [namespaceModels]);

  const getAlgorithmsForAlias = React.useCallback((alias: string): string[] => {
    return (namespaceModels[alias]?.algorithms ?? [])
      .map(item => item.name)
      .filter((name): name is string => Boolean(name));
  }, [namespaceModels]);

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

          const branches = step.branchList && step.branchList.length > 0
            ? step.branchList
            : (step.stepType === 'decision'
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
                getBusinessRulesForAlias={getBusinessRulesForAlias}
                getAlgorithmsForAlias={getAlgorithmsForAlias}
                onChange={updateCurrent}
                actions={(
                  <>
                    <AddMenu onAdd={insertAfter} />
                    {!step.behavior && (
                      <button className="icon-btn" title={L('actions.addBehavior', 'Pridat behavior')} onClick={() => updateCurrent({ ...step, behavior: { description: '', preconditionList: [], postconditionList: [], errorEventList: [], entityImpactList: [], outputList: [], businessRuleRefList: [], actorRefList: [] } })}>💬</button>
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
        <button className={tab === 'algorithms' ? 'tab active' : 'tab'} onClick={() => setTab('algorithms')}>
          {L('tabs.algorithms', 'algorithms')}
        </button>
      </div>

      <div className="steps-tree">
        {tab === 'imports' && (
          <ImportsPanel
            imports={(model as any).importList ?? (model as any).imports ?? ['local']}
            availableNamespaces={importNamespaceOptions}
            onChange={(importList) => onChange({ ...model, importList } as any)}
          />
        )}

        {tab === 'algorithms' && selectedAlgorithmIndex === null && (
          <section className="panel">
            <div className="panel-head">
              <h4>{L('algorithmList.title', 'Algorithms')}</h4>
              <button
                className="icon-btn"
                title={L('algorithmList.add', 'Pridat algoritmus')}
                onClick={() => {
                  const list = [...(model.algorithmList ?? [])];
                  list.push({ name: `algorithm${list.length + 1}`, stepList: [] });
                  onChange({ ...model, algorithmList: list });
                  setSelectedAlgorithmIndex(list.length - 1);
                  setAlgorithmTab('algorithm');
                }}
              >+</button>
            </div>
            {(model.algorithmList ?? []).length === 0 && (
              <div className="muted">{L('algorithmList.empty', 'Ziadne algoritmy')}</div>
            )}
            {(model.algorithmList ?? []).length > 0 && (
              <table className="dm-table">
                <thead>
                  <tr>
                    <th>{L('algorithmList.col.name', 'Nazov')}</th>
                    <th>{L('algorithmList.col.version', 'Verzia')}</th>
                    <th>{L('algorithmList.col.steps', 'Kroky')}</th>
                    <th>{L('algorithmList.col.actions', 'Akcie')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(model.algorithmList ?? []).map((alg, idx) => (
                    <tr
                      key={`alg-${idx}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => { setSelectedAlgorithmIndex(idx); setAlgorithmTab('algorithm'); }}
                    >
                      <td><strong>{alg.name}</strong></td>
                      <td>{alg.version ?? '-'}</td>
                      <td>{(alg.stepList ?? []).length}</td>
                      <td onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="icon-btn"
                          title={L('algorithmList.moveUp', 'Posun hore')}
                          disabled={idx === 0}
                          onClick={() => {
                            const list = [...(model.algorithmList ?? [])];
                            [list[idx - 1], list[idx]] = [list[idx], list[idx - 1]];
                            onChange({ ...model, algorithmList: list });
                          }}
                        >↑</button>
                        <button
                          className="icon-btn"
                          title={L('algorithmList.moveDown', 'Posun dole')}
                          disabled={idx === (model.algorithmList ?? []).length - 1}
                          onClick={() => {
                            const list = [...(model.algorithmList ?? [])];
                            [list[idx], list[idx + 1]] = [list[idx + 1], list[idx]];
                            onChange({ ...model, algorithmList: list });
                          }}
                        >↓</button>
                        <button
                          className="icon-btn"
                          title={L('algorithmList.delete', 'Zmazat')}
                          onClick={() => {
                            if (!confirm(`Zmazat algoritmus "${alg.name}"?`)) return;
                            const list = (model.algorithmList ?? []).filter((_, i) => i !== idx);
                            onChange({ ...model, algorithmList: list });
                          }}
                        >🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        {tab === 'algorithms' && selectedAlgorithmIndex !== null && (() => {
          const alg = (model.algorithmList ?? [])[selectedAlgorithmIndex];
          if (!alg) { setSelectedAlgorithmIndex(null); return null; }
          return (
            <div className="item-card">
              <div className="panel-head">
                <button className="btn-link" onClick={() => setSelectedAlgorithmIndex(null)}>← {L('algorithmList.back', 'Algoritmy')}</button>
                <strong style={{ marginLeft: 8 }}>{alg.name}</strong>
              </div>
              <div className="tab-row">
                <button className={algorithmTab === 'algorithm' ? 'tab active' : 'tab'} onClick={() => setAlgorithmTab('algorithm')}>
                  {L('algorithmTabs.algorithm', 'algorithm')}
                </button>
                <button className={algorithmTab === 'parameters' ? 'tab active' : 'tab'} onClick={() => setAlgorithmTab('parameters')}>
                  {L('algorithmTabs.parameters', 'parametre')}
                </button>
                <button className={algorithmTab === 'steps' ? 'tab active' : 'tab'} onClick={() => setAlgorithmTab('steps')}>
                  {L('algorithmTabs.steps', 'kroky')}
                </button>
              </div>

              {algorithmTab === 'algorithm' && (
                <>
                  <label className="field-label">{L('algorithmForm.name', 'name')}</label>
                  <input
                    className="field-input"
                    value={alg.name}
                    onChange={(e) => updateAlgorithm(selectedAlgorithmIndex, { name: e.target.value })}
                  />

                  <label className="field-label">{L('algorithmForm.version', 'version')}</label>
                  <input
                    className="field-input"
                    value={alg.version ?? ''}
                    onChange={(e) => updateAlgorithm(selectedAlgorithmIndex, { version: e.target.value })}
                  />

                  <label className="field-label">{L('algorithmForm.description', 'description')}</label>
                  <textarea
                    className="step-text"
                    rows={4}
                    value={alg.behavior?.description ?? ''}
                    onChange={(e) => updateAlgorithm(selectedAlgorithmIndex, { behavior: { ...(alg.behavior ?? {}), description: e.target.value } })}
                  />

                  <label className="field-label">{L('algorithmForm.preconditions', 'Preconditions')}</label>
                  <textarea
                    className="field-input"
                    rows={3}
                    value={(alg.behavior?.preconditionList ?? []).join('\n')}
                    onChange={(e) => updateAlgorithm(selectedAlgorithmIndex, { behavior: { ...(alg.behavior ?? {}), preconditionList: e.target.value.split('\n').filter(s => s.trim().length > 0) } })}
                  />

                  <label className="field-label">{L('algorithmForm.postconditions', 'Postconditions')}</label>
                  <textarea
                    className="field-input"
                    rows={3}
                    value={(alg.behavior?.postconditionList ?? []).join('\n')}
                    onChange={(e) => updateAlgorithm(selectedAlgorithmIndex, { behavior: { ...(alg.behavior ?? {}), postconditionList: e.target.value.split('\n').filter(s => s.trim().length > 0) } })}
                  />

                  <BehaviorDefinitionEditor
                    errorEventList={alg.behavior?.errorEventList ?? []}
                    entityImpactList={alg.behavior?.entityImpactList ?? []}
                    outputList={alg.behavior?.outputList ?? []}
                    businessRuleRefList={alg.behavior?.businessRuleRefList ?? []}
                    actorRefList={normalizeActorRefs(alg.behavior?.actorRefList ?? (alg.behavior as any)?.actors)}
                    namespaceAliases={(model.namespaceRefList ?? []).map(ns => ns.alias).filter((alias): alias is string => Boolean(alias))}
                    modelAliases={modelAliases}
                    getEntitiesForAlias={getEntitiesForAlias}
                    getAttributesForEntity={getAttributesForEntity}
                    getEventsForAlias={getEventsForAlias}
                    getBusinessRulesForAlias={getBusinessRulesForAlias}
                    getActorsForAlias={getActorsForAlias}
                    onChange={(patch) => updateAlgorithm(selectedAlgorithmIndex, {
                      behavior: {
                        ...(alg.behavior ?? {}),
                        ...(patch.errorEventList ? { errorEventList: patch.errorEventList } : {}),
                        ...(patch.entityImpactList ? { entityImpactList: patch.entityImpactList } : {}),
                        ...(patch.outputList ? { outputList: patch.outputList } : {}),
                        ...(patch.businessRuleRefList ? { businessRuleRefList: patch.businessRuleRefList } : {}),
                        ...(patch.actorRefList ? { actorRefList: patch.actorRefList } : {}),
                        affectedEntityList: undefined
                      }
                    })}
                  />

                  <ActorRefsEditor
                    actorRefs={normalizeActorRefs(alg.behavior?.actorRefList ?? (alg.behavior as any)?.actors)}
                    namespaceAliases={(model.namespaceRefList ?? []).map(ns => ns.alias).filter((alias): alias is string => Boolean(alias))}
                    getAvailableActors={getActorsForAlias}
                    onChange={(actorRefList) => updateAlgorithm(selectedAlgorithmIndex, { behavior: { ...(alg.behavior ?? {}), actorRefList } })}
                    prefix="algorithm"
                  />
                </>
              )}

              {algorithmTab === 'parameters' && (
                <div style={{ marginTop: 8 }}>
                  <ParametersEditor
                    value={normalizeAlgorithmParameters(alg)}
                    onChange={(parameterList) => updateAlgorithm(selectedAlgorithmIndex, { parameterList })}
                    namespaceRef={model.namespaceRefList}
                    vscodeApi={vscodeApi}
                    showDirection
                  />
                </div>
              )}

              {algorithmTab === 'steps' && renderStepList(
                alg.stepList ?? [],
                (stepList) => updateAlgorithm(selectedAlgorithmIndex, { stepList }),
                0
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
};
