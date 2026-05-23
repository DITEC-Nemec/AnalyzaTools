import React, { useMemo, useState } from 'react';
import { VariableAssignList } from './VariableAssignList';
import { AffectedEntitiesEditor } from '../components/AffectedEntitiesEditor';
import { ActorRefsEditor } from '../components/ActorRefsEditor';
import { ErrorEventsEditor } from '../components/ErrorEventsEditor';
import type {
  ActorRef,
  EntityImpact,
  ParameterMap,
  ReferenceAttribute,
  ReferenceEntity,
  ReferenceEntityFunction,
  ReferenceEvent,
  ReferenceOperation,
  ReferenceSqd,
  SqdStep,
  StepCondition
} from '../types/sqd';
import { label } from '../ui-labels';

interface Props {
  step: SqdStep;
  depth?: number;
  actions?: React.ReactNode;
  modelAliases?: string[];
  sqdAliases?: string[];
  getEntitiesForAlias?: (alias: string) => string[];
  getAttributesForEntity?: (entityName: string, alias?: string) => string[];
  getFunctionsForEntity?: (alias: string, entity: string) => string[];
  getEventsForAlias?: (alias: string) => string[];
  getActorsForAlias?: (alias?: string) => string[];
  onChange: (updated: SqdStep) => void;
}

const TYPE_LABELS: Record<string, string> = {
  step:      label('algorithm.stepTypeLabels.step', 'Krok'),
  operation: label('algorithm.stepTypeLabels.operation', 'Operacia'),
  decision:  label('algorithm.stepTypeLabels.decision', 'Rozhodnutie'),
  loop:      label('algorithm.stepTypeLabels.loop', 'Smycka'),
  foreach:   label('algorithm.stepTypeLabels.foreach', 'Pre kazde'),
  return:    label('algorithm.stepTypeLabels.return', 'Navrat'),
  stop:      label('algorithm.stepTypeLabels.stop', 'Zastavenie'),
  block:     label('algorithm.stepTypeLabels.block', 'Blok'),
};

const CONDITION_KINDS: Array<NonNullable<StepCondition['kind']>> = ['attributeRef', 'variable', 'operationRef', 'waitEvent', 'simple'];
const CONDITION_CHECKS: StepCondition['check'][] = [
  'exists',
  'is null',
  'is not null',
  'equals',
  'not equals',
  'greater than',
  'less than'
];
const IMPACT_TYPES: EntityImpact['impact'][] = ['read', 'write', 'affect'];
const OPERATION_KINDS: ReferenceOperation['callType'][] = ['entityFunction', 'sqd', 'step', 'event'];

const defaultCondition = (): StepCondition => ({
  kind: 'simple',
  description: '',
  check: 'exists'
});

const normalizeOperation = (step: SqdStep): ReferenceOperation | null => {
  if (!step.operationRef || typeof step.operationRef === 'string') {
    return null;
  }
  return step.operationRef;
};

const summaryOperation = (operation: ReferenceOperation | null): string => {
  if (!operation) {
    return label('algorithm.steps.simpleText', 'simple text');
  }
  if (operation.callType === 'step') {
    return `step:${operation.stepRef ?? '-'}`;
  }
  if (operation.callType === 'entityFunction') {
    return `entityFunction:${operation.entityFunctionRef?.entity ?? '-'}:${operation.entityFunctionRef?.function ?? '-'}`;
  }
  if (operation.callType === 'sqd') {
    return `sqd:${operation.sqdRef?.namespaceAlias ?? '-'}`;
  }
  return `event:${operation.emitEventRef?.namespaceAlias ?? '-'}:${operation.emitEventRef?.event ?? '-'}`;
};

const summaryCondition = (condition: StepCondition | undefined): string => {
  if (!condition) {
    return label('algorithm.steps.conditionNone', 'bez podmienky');
  }
  const kind = condition.kind ?? 'simple';
  const check = condition.check ?? 'exists';
  const desc = condition.description?.trim();
  return `${kind} | ${check}${desc ? ` | ${desc}` : ''}`;
};

const summaryEventRef = (emitEventRef: ReferenceEvent | null): string => {
  if (!emitEventRef) {
    return label('algorithm.steps.eventRefNone', 'nepridany');
  }
  return `event:${emitEventRef.namespaceAlias ?? '-'}:${emitEventRef.event ?? '-'}`;
};

const normalizeParameterMap = (
  ref?: { parameterMapList?: ParameterMap[]; mapInput?: ParameterMap[]; mapOutput?: ParameterMap[] }
): ParameterMap[] => {
  if (!ref) {
    return [];
  }

  if ((ref.parameterMapList ?? []).length > 0) {
    return (ref.parameterMapList ?? []).map(item => ({
      parameter: item.parameter ?? item.variable ?? '',
      value: item.value ?? ''
    }));
  }

  return [
    ...(ref.mapInput ?? []),
    ...(ref.mapOutput ?? [])
  ].map(item => ({
    parameter: item.parameter ?? item.variable ?? '',
    value: item.value ?? ''
  }));
};

const normalizeActorRefs = (items: ActorRef[] | undefined): ActorRef[] => {
  return (items ?? []).map((item) => ({
    namespaceAlias: item.namespaceAlias ?? 'local',
    actor: item.actor ?? ''
  }));
};

export const StepCard: React.FC<Props> = ({
  step,
  depth = 0,
  actions,
  modelAliases = [],
  sqdAliases = [],
  getEntitiesForAlias = () => [],
  getAttributesForEntity = () => [],
  getFunctionsForEntity = () => [],
  getEventsForAlias = () => [],
  getActorsForAlias = (_alias?: string) => [],
  onChange
}) => {
  const L = (path: string, fallback: string) => label(`algorithm.${path}`, fallback);

  const [expanded, setExpanded] = useState(true);
  const [showConditionDialog, setShowConditionDialog] = useState(false);
  const [showOperationDialog, setShowOperationDialog] = useState(false);
  const [showEventRefDialog, setShowEventRefDialog] = useState(false);

  const condition = useMemo(() => step.condition ?? defaultCondition(), [step.condition]);
  const operation = useMemo(() => normalizeOperation(step), [step]);
  const emitEventRef = useMemo(() => condition.waitEvent?.emitEventRef ?? null, [condition]);

  const upsertOperationObject = (patch: Partial<ReferenceOperation>) => {
    const next: ReferenceOperation = {
      callType: operation?.callType ?? 'step',
      ...operation,
      ...patch
    };
    onChange({ ...step, operationRef: next });
  };

  const setOperationKind = (callType: string) => {
    if (!callType) {
      onChange({ ...step, operationRef: typeof step.operationRef === 'string' ? step.operationRef : '' });
      return;
    }

    const resolvedKind = callType as ReferenceOperation['callType'];
    const next: ReferenceOperation = {
      callType: resolvedKind,
      ...(resolvedKind === 'step' ? { stepRef: operation?.stepRef ?? '' } : {}),
      ...(resolvedKind === 'entityFunction'
        ? { entityFunctionRef: operation?.entityFunctionRef ?? { namespaceAlias: '', entity: '', function: '' } }
        : {}),
      ...(resolvedKind === 'sqd' ? { sqdRef: operation?.sqdRef ?? { namespaceAlias: '' } } : {}),
      ...(resolvedKind === 'event' ? { emitEventRef: operation?.emitEventRef ?? { namespaceAlias: '', event: '' } } : {})
    };
    onChange({ ...step, operationRef: next });
  };


  const upsertEventRef = (patch: Partial<ReferenceEvent>) => {
    const next: ReferenceEvent = {
      ...emitEventRef,
      ...patch
    };
    onChange({
      ...step,
      condition: {
        ...condition,
        waitEvent: {
          ...(condition.waitEvent ?? { emitEventRef: { namespaceAlias: 'local', event: '' } }),
          emitEventRef: next
        }
      }
    });
  };

  const updateBehavior = (patch: Partial<NonNullable<SqdStep['behavior']>>) => {
    onChange({
      ...step,
      behavior: {
        ...(step.behavior ?? {}),
        ...patch
      }
    });
  };

  return (
    <div className={`step-card step-card--${step.stepType}`} style={{ marginLeft: depth * 22 }}>
      <div className="step-card-header" onClick={() => setExpanded(!expanded)}>
        {depth > 0 && <span className="step-depth-marker">│</span>}
        <span className="step-id">[{step.id}]</span>
        <span className="step-type">{TYPE_LABELS[step.stepType] ?? step.stepType}</span>
        {actions && (
          <span className="step-actions" onClick={(e) => e.stopPropagation()}>
            {actions}
          </span>
        )}
        <span className="step-toggle">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="step-card-body">
          <label className="field-label">{L('steps.text', 'Text:')}</label>
          <textarea
            className="step-text"
            value={step.description ?? ''}
            rows={3}
            onChange={e => onChange({ ...step, description: e.target.value })}
            placeholder="Opíš čo sa deje prirodzeným jazykom…"
          />

          {step.stepType === 'operation' && (
            <div className="step-meta">
              <label className="field-label">{L('steps.operationText', 'Operation text:')}</label>
              <input
                className="field-input"
                value={typeof step.operationRef === 'string' ? step.operationRef : ''}
                onChange={e => onChange({ ...step, operationRef: e.target.value })}
                placeholder="Textový popis operácie"
              />
              <label className="field-label">{L('steps.operationKind', 'Operation kind:')}</label>
              <select
                className="field-input"
                value={operation?.callType ?? ''}
                onChange={(e) => setOperationKind(e.target.value)}
              >
                <option value="">{L('steps.simpleText', 'simple text')}</option>
                {OPERATION_KINDS.map(kind => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
              {operation && (
                <div className="condition-summary">
                  {summaryOperation(operation)}
                  <button className="btn-link" onClick={() => setShowOperationDialog(true)}>
                    [ {L('actions.editDetail', 'Upravit detail...')} ]
                  </button>
                </div>
              )}
            </div>
          )}

          {(step.stepType === 'decision' || step.stepType === 'loop') && (
            <div className="step-meta">
              <label className="field-label">{L('steps.conditionKind', 'Condition kind:')}</label>
              <select
                className="field-input"
                value={condition.kind ?? 'simple'}
                onChange={(e) => onChange({ ...step, condition: { ...condition, kind: e.target.value as StepCondition['kind'] } })}
              >
                {CONDITION_KINDS.map(kind => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
              <label className="field-label">{L('steps.conditionDescription', 'Condition description:')}</label>
              <input
                className="field-input"
                value={condition.description ?? ''}
                onChange={e => onChange({ ...step, condition: { ...condition, description: e.target.value } })}
                placeholder="Biznisový popis podmienky"
              />
              <label className="field-label">{L('steps.conditionCheck', 'Condition check:')}</label>
              <select
                className="field-input"
                value={condition.check ?? 'exists'}
                onChange={(e) => onChange({ ...step, condition: { ...condition, check: e.target.value as StepCondition['check'] } })}
              >
                {CONDITION_CHECKS.map(check => (
                  <option key={check} value={check}>
                    {check}
                  </option>
                ))}
              </select>
              {/* Value editor priamo v strome pod kontrolou podmienky */}
              <label className="field-label">{L('dialogs.value', 'Value')}</label>
              <input
                className="field-input"
                value={condition.value === undefined ? '' : String(condition.value)}
                onChange={(e) => onChange({ ...step, condition: { ...condition, value: e.target.value } })}
                placeholder={L('dialogs.valuePlaceholder', 'Hodnota pre porovnanie (voliteľné)')}
              />
              {condition.kind === 'waitEvent' && (
                <>
                  <label className="field-label">{L('steps.waitUntil', 'Cakat do')}</label>
                  <input
                    className="field-input"
                    value={condition.waitEvent?.waitUntil ?? ''}
                    onChange={e => onChange({
                      ...step,
                      condition: {
                        ...condition,
                        waitEvent: {
                          emitEventRef: condition.waitEvent?.emitEventRef ?? { namespaceAlias: 'local', event: '' },
                          ...condition.waitEvent,
                          waitUntil: e.target.value
                        }
                      }
                    })}
                    placeholder={L('steps.waitUntilPlaceholder', 'napr. max 30s alebo do stavu SpracovanieDokoncene')}
                  />
                  <label className="field-label">{L('steps.timeoutAction', 'Akcia pri timeout-e')}</label>
                  <input
                    className="field-input"
                    value={condition.waitEvent?.timeoutAction ?? ''}
                    onChange={e => onChange({
                      ...step,
                      condition: {
                        ...condition,
                        waitEvent: {
                          emitEventRef: condition.waitEvent?.emitEventRef ?? { namespaceAlias: 'local', event: '' },
                          ...condition.waitEvent,
                          timeoutAction: e.target.value
                        }
                      }
                    })}
                    placeholder={L('steps.timeoutActionPlaceholder', 'napr. retry 3x, inak skoc na step 9')}
                  />
                  <div className="condition-summary">
                    {L('steps.waitEventRef', 'Cakat na udalost')}: {summaryEventRef(emitEventRef)}
                    <button className="btn-link" onClick={() => setShowEventRefDialog(true)}>
                      [{emitEventRef ? ` ${L('steps.editWaitEventRef', 'Upravit udalost...')} ` : ` ${L('steps.addWaitEventRef', 'Pridat udalost...')} `}]
                    </button>
                  </div>
                </>
              )}
              <div className="condition-summary">
                ✱ {summaryCondition(step.condition)}
                <button className="btn-link" onClick={() => setShowConditionDialog(true)}>[ {L('actions.editDetail', 'Upravit detail...')} ]</button>
              </div>
            </div>
          )}


          {step.behavior && (
            <div className="step-meta">
              <label className="field-label">{L('steps.behaviorDescription', 'Behavior description')}</label>
              <textarea
                className="step-text"
                rows={2}
                value={step.behavior.description ?? ''}
                onChange={(e) => updateBehavior({ description: e.target.value })}
              />

              <label className="field-label">{L('steps.preconditions', 'Preconditions')}</label>
              <textarea
                className="field-input"
                rows={3}
                value={(step.behavior.preconditionList ?? []).join('\n')}
                onChange={(e) => updateBehavior({ preconditionList: e.target.value.split('\n').filter(s => s.trim().length > 0) })}
              />

              <label className="field-label">{L('steps.postconditions', 'Postconditions')}</label>
              <textarea
                className="field-input"
                rows={3}
                value={(step.behavior.postconditionList ?? []).join('\n')}
                onChange={(e) => updateBehavior({ postconditionList: e.target.value.split('\n').filter(s => s.trim().length > 0) })}
              />

              <ErrorEventsEditor
                errorEvents={step.behavior.errorEventList ?? []}
                namespaceAliases={Array.from(new Set(['local', ...modelAliases, ...sqdAliases]))}
                getEventsForAlias={getEventsForAlias}
                onChange={(errorEventList) => updateBehavior({ errorEventList })}
              />

              <AffectedEntitiesEditor
                affectedEntities={step.behavior.affectedEntityList ?? []}
                modelAliases={modelAliases}
                sqdAliases={sqdAliases}
                getEntitiesForAlias={getEntitiesForAlias}
                getAttributesForEntity={getAttributesForEntity}
                onChange={affectedEntityList => updateBehavior({ affectedEntityList })}
              />

              <ActorRefsEditor
                actorRefs={normalizeActorRefs(step.behavior.actorRefList)}
                namespaceAliases={Array.from(new Set(['local', ...modelAliases, ...sqdAliases]))}
                getAvailableActors={getActorsForAlias}
                onChange={(actorRefList) => updateBehavior({ actorRefList })}
                prefix="algorithm"
              />

              <button
                type="button"
                className="btn-link"
                onClick={() => {
                  const hasContent = (step.behavior?.description ?? '').trim().length > 0
                    || (step.behavior?.preconditionList?.length ?? 0) > 0
                    || (step.behavior?.postconditionList?.length ?? 0) > 0
                    || (step.behavior?.errorEventList?.length ?? 0) > 0
                    || (step.behavior?.affectedEntityList?.length ?? 0) > 0
                    || (step.behavior?.actorRefList?.length ?? 0) > 0;

                  if (!hasContent) {
                    onChange({ ...step, behavior: undefined });
                  }
                }}
              >
                {L('steps.removeEmptyBehavior', 'Remove empty behavior')}
              </button>
            </div>
          )}

          {step.stepType === 'foreach' && (
            <div className="step-meta">
              <label className="field-label">{L('steps.collection', 'Zbierka:')}</label>
              <input
                className="field-input"
                value={step.sourceCollectionRef ?? ''}
                onChange={e => onChange({ ...step, sourceCollectionRef: e.target.value })}
                placeholder="napr. items, users"
              />
              <label className="field-label">{L('steps.item', 'Polozka:')}</label>
              <input
                className="field-input"
                value={step.iteratorItemName ?? ''}
                onChange={e => onChange({ ...step, iteratorItemName: e.target.value })}
                placeholder="napr. item, user"
              />
            </div>
          )}
        </div>
      )}

      {showConditionDialog && (
        <div className="dialog-overlay" onClick={() => setShowConditionDialog(false)}>
          <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
            <h4>{L('dialogs.condition', 'Condition detail')}</h4>

            {condition.kind === 'attributeRef' && (
              <>
                <label className="field-label">{L('dialogs.namespaceAlias', 'Namespace alias')}</label>
                <select
                  className="field-input"
                  value={condition.attributeRef?.namespaceAlias ?? ''}
                  onChange={(e) => onChange({
                    ...step,
                    condition: {
                      ...condition,
                      attributeRef: { ...condition.attributeRef, namespaceAlias: e.target.value, entity: '', attribute: '' }
                    }
                  })}
                >
                  <option value="">—</option>
                  {modelAliases.map(alias => (
                    <option key={alias} value={alias}>{alias}</option>
                  ))}
                </select>
                <label className="field-label">{L('dialogs.entity', 'Entity')}</label>
                <select
                  className="field-input"
                  value={condition.attributeRef?.entity ?? ''}
                  onChange={(e) => onChange({
                    ...step,
                    condition: { ...condition, attributeRef: { ...condition.attributeRef, entity: e.target.value, attribute: '' } }
                  })}
                  disabled={!condition.attributeRef?.namespaceAlias}
                >
                  <option value="">—</option>
                  {getEntitiesForAlias(condition.attributeRef?.namespaceAlias ?? '').map(entity => (
                    <option key={entity} value={entity}>{entity}</option>
                  ))}
                </select>
                <label className="field-label">{L('dialogs.attribute', 'Attribute')}</label>
                <select
                  className="field-input"
                  value={condition.attributeRef?.attribute ?? ''}
                  onChange={(e) => onChange({
                    ...step,
                    condition: { ...condition, attributeRef: { ...condition.attributeRef, attribute: e.target.value } }
                  })}
                  disabled={!condition.attributeRef?.namespaceAlias || !condition.attributeRef?.entity}
                >
                  <option value="">—</option>
                  {getAttributesForEntity(
                    condition.attributeRef?.entity ?? '',
                    condition.attributeRef?.namespaceAlias
                  ).map(attribute => (
                    <option key={attribute} value={attribute}>{attribute}</option>
                  ))}
                </select>
              </>
            )}

            {condition.kind === 'variable' && (
              <>
                <label className="field-label">{L('dialogs.variable', 'Variable')}</label>
                <input
                  className="field-input"
                  value={condition.variable ?? ''}
                  onChange={(e) => onChange({ ...step, condition: { ...condition, variable: e.target.value } })}
                />
              </>
            )}

            {condition.kind === 'operationRef' && (
              <>
                <label className="field-label">{L('steps.operationKind', 'Operation kind:')}</label>
                <select
                  className="field-input"
                  value={condition.operationRef?.callType ?? 'step'}
                  onChange={(e) =>
                    onChange({
                      ...step,
                      condition: {
                        ...condition,
                        operationRef: { callType: e.target.value as ReferenceOperation['callType'] }
                      }
                    })
                  }
                >
                  {OPERATION_KINDS.map(kind => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>

                {(condition.operationRef?.callType ?? 'step') === 'step' && (
                  <>
                    <label className="field-label">{L('dialogs.stepRef', 'Step ref')}</label>
                    <input
                      className="field-input"
                      value={condition.operationRef?.stepRef ?? ''}
                      onChange={(e) =>
                        onChange({
                          ...step,
                          condition: {
                            ...condition,
                            operationRef: { ...(condition.operationRef ?? { kind: 'step' }), kind: 'step', stepRef: e.target.value }
                          }
                        })
                      }
                    />
                  </>
                )}
                {(condition.operationRef?.callType ?? 'step') === 'entityFunction' && (
                  <>
                    <label className="field-label">EntityFunction namespaceAlias</label>
                    <select
                      className="field-input"
                      value={condition.operationRef?.entityFunctionRef?.namespaceAlias ?? ''}
                      onChange={(e) => {
                        const currentRef: ReferenceEntityFunction = condition.operationRef?.entityFunctionRef ?? {};
                        onChange({
                          ...step,
                          condition: {
                            ...condition,
                            operationRef: {
                              ...(condition.operationRef ?? { kind: 'entityFunction' }),
                              kind: 'entityFunction',
                              entityFunctionRef: { ...currentRef, namespaceAlias: e.target.value, entity: '', function: '' }
                            }
                          }
                        });
                      }}
                    >
                      <option value="">—</option>
                      {modelAliases.map(alias => (
                        <option key={alias} value={alias}>{alias}</option>
                      ))}
                    </select>
                    <label className="field-label">Entity</label>
                    <select
                      className="field-input"
                      value={condition.operationRef?.entityFunctionRef?.entity ?? ''}
                      onChange={(e) => {
                        const currentRef: ReferenceEntityFunction = condition.operationRef?.entityFunctionRef ?? {};
                        onChange({
                          ...step,
                          condition: {
                            ...condition,
                            operationRef: {
                              ...(condition.operationRef ?? { kind: 'entityFunction' }),
                              kind: 'entityFunction',
                              entityFunctionRef: { ...currentRef, entity: e.target.value, function: '' }
                            }
                          }
                        });
                      }}
                    >
                      <option value="">—</option>
                      {getEntitiesForAlias(condition.operationRef?.entityFunctionRef?.namespaceAlias ?? '').map(entity => (
                        <option key={entity} value={entity}>{entity}</option>
                      ))}
                    </select>
                    <label className="field-label">Function</label>
                    <select
                      className="field-input"
                      value={condition.operationRef?.entityFunctionRef?.function ?? ''}
                      onChange={(e) => {
                        const currentRef: ReferenceEntityFunction = condition.operationRef?.entityFunctionRef ?? {};
                        onChange({
                          ...step,
                          condition: {
                            ...condition,
                            operationRef: {
                              ...(condition.operationRef ?? { kind: 'entityFunction' }),
                              kind: 'entityFunction',
                              entityFunctionRef: { ...currentRef, function: e.target.value }
                            }
                          }
                        });
                      }}
                    >
                      <option value="">—</option>
                      {getFunctionsForEntity(
                        condition.operationRef?.entityFunctionRef?.namespaceAlias ?? '',
                        condition.operationRef?.entityFunctionRef?.entity ?? ''
                      ).map(fn => (
                        <option key={fn} value={fn}>{fn}</option>
                      ))}
                    </select>
                    <label className="field-label">parameterMapList</label>
                    <VariableAssignList
                      value={normalizeParameterMap(condition.operationRef?.entityFunctionRef)}
                      onChange={(parameterMapList) => {
                        const currentRef: ReferenceEntityFunction = condition.operationRef?.entityFunctionRef ?? {};
                        onChange({
                          ...step,
                          condition: {
                            ...condition,
                            operationRef: {
                              ...(condition.operationRef ?? { callType: 'entityFunction' }),
                              callType: 'entityFunction',
                              entityFunctionRef: { ...currentRef, parameterMapList }
                            }
                          }
                        });
                      }}
                    />
                  </>
                )}
                {(condition.operationRef?.callType ?? 'step') === 'sqd' && (
                  <>
                    <label className="field-label">SQD namespaceAlias</label>
                    <select
                      className="field-input"
                      value={condition.operationRef?.sqdRef?.namespaceAlias ?? ''}
                      onChange={(e) => {
                        const currentRef: ReferenceSqd = condition.operationRef?.sqdRef ?? {};
                        onChange({
                          ...step,
                          condition: {
                            ...condition,
                            operationRef: {
                              ...(condition.operationRef ?? { kind: 'sqd' }),
                              kind: 'sqd',
                              sqdRef: { ...currentRef, namespaceAlias: e.target.value }
                            }
                          }
                        });
                      }}
                    >
                      <option value="">—</option>
                      {sqdAliases.map(alias => (
                        <option key={alias} value={alias}>{alias}</option>
                      ))}
                    </select>
                    <label className="field-label">parameterMapList</label>
                    <VariableAssignList
                      value={normalizeParameterMap(condition.operationRef?.sqdRef)}
                      onChange={(parameterMapList) => {
                        const currentRef: ReferenceSqd = condition.operationRef?.sqdRef ?? {};
                        onChange({
                          ...step,
                          condition: {
                            ...condition,
                            operationRef: {
                              ...(condition.operationRef ?? { callType: 'sqd' }),
                              callType: 'sqd',
                              sqdRef: { ...currentRef, parameterMapList, mapInput: undefined, mapOutput: undefined }
                            }
                          }
                        });
                      }}
                    />
                  </>
                )}
                {(condition.operationRef?.callType ?? 'step') === 'event' && (
                  <>
                    <label className="field-label">Event namespaceAlias</label>
                    <select
                      className="field-input"
                      value={condition.operationRef?.emitEventRef?.namespaceAlias ?? ''}
                      onChange={(e) => {
                        const currentRef: ReferenceEvent = condition.operationRef?.emitEventRef ?? {};
                        onChange({
                          ...step,
                          condition: {
                            ...condition,
                            operationRef: {
                              ...(condition.operationRef ?? { callType: 'event' }),
                              callType: 'event',
                              emitEventRef: { ...currentRef, namespaceAlias: e.target.value, event: '' }
                            }
                          }
                        });
                      }}
                    >
                      <option value="">—</option>
                      {modelAliases.map(alias => (
                        <option key={alias} value={alias}>{alias}</option>
                      ))}
                    </select>
                    <label className="field-label">Event</label>
                    <select
                      className="field-input"
                      value={condition.operationRef?.emitEventRef?.event ?? ''}
                      onChange={(e) => {
                        const currentRef: ReferenceEvent = condition.operationRef?.emitEventRef ?? {};
                        onChange({
                          ...step,
                          condition: {
                            ...condition,
                            operationRef: {
                              ...(condition.operationRef ?? { callType: 'event' }),
                              callType: 'event',
                              emitEventRef: { ...currentRef, event: e.target.value }
                            }
                          }
                        });
                      }}
                    >
                      <option value="">—</option>
                      {getEventsForAlias(condition.operationRef?.eventRef?.namespaceAlias ?? '').map(event => (
                        <option key={event} value={event}>{event}</option>
                      ))}
                    </select>
                    <label className="field-label">parameterMap</label>
                    <VariableAssignList
                      value={normalizeParameterMap(condition.operationRef?.eventRef)}
                      onChange={(mapParameters) => {
                        const currentRef: ReferenceEvent = condition.operationRef?.eventRef ?? {};
                        onChange({
                          ...step,
                          condition: {
                            ...condition,
                            operationRef: {
                              ...(condition.operationRef ?? { kind: 'event' }),
                              kind: 'event',
                              eventRef: { ...currentRef, mapParameters, mapInput: undefined, mapOutput: undefined }
                            }
                          }
                        });
                      }}
                    />
                  </>
                )}
              </>
            )}

            {condition.kind === 'waitEvent' && (
              <>
                <label className="field-label">{L('dialogs.namespaceAlias', 'Namespace alias')}</label>
                <select
                  className="field-input"
                  value={condition.waitEvent?.eventRef?.namespaceAlias ?? ''}
                  onChange={(e) => onChange({
                    ...step,
                    condition: {
                      ...condition,
                      waitEvent: {
                        ...(condition.waitEvent ?? { eventRef: { namespaceAlias: '', event: '' } }),
                        eventRef: { ...condition.waitEvent?.eventRef, namespaceAlias: e.target.value, event: '' }
                      }
                    }
                  })}
                >
                  <option value="">—</option>
                  {modelAliases.map(alias => (
                    <option key={alias} value={alias}>{alias}</option>
                  ))}
                </select>
                <label className="field-label">{L('dialogs.event', 'Event')}</label>
                <select
                  className="field-input"
                  value={condition.waitEvent?.eventRef?.event ?? ''}
                  onChange={(e) => onChange({
                    ...step,
                    condition: {
                      ...condition,
                      waitEvent: {
                        ...(condition.waitEvent ?? { eventRef: { namespaceAlias: '', event: '' } }),
                        eventRef: { ...condition.waitEvent?.eventRef, event: e.target.value }
                      }
                    }
                  })}
                >
                  <option value="">—</option>
                  {getEventsForAlias(condition.waitEvent?.eventRef?.namespaceAlias ?? '').map(event => (
                    <option key={event} value={event}>{event}</option>
                  ))}
                </select>
                <label className="field-label">parameterMap</label>
                <VariableAssignList
                  value={normalizeParameterMap(condition.waitEvent?.eventRef)}
                  onChange={(mapParameters) => onChange({
                    ...step,
                    condition: {
                      ...condition,
                      waitEvent: {
                        ...(condition.waitEvent ?? { eventRef: {} }),
                        eventRef: { ...condition.waitEvent?.eventRef, mapParameters, mapInput: undefined, mapOutput: undefined }
                      }
                    }
                  })}
                />
              </>
            )}

            <div className="dialog-actions">
              <button className="icon-btn" onClick={() => setShowConditionDialog(false)}>{L('actions.close', 'Zavriet')}</button>
            </div>
          </div>
        </div>
      )}

      {showOperationDialog && operation && (
        <div className="dialog-overlay" onClick={() => setShowOperationDialog(false)}>
          <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
            <h4>{L('dialogs.operation', 'Operation detail')}</h4>

            {operation.kind === 'step' && (
              <>
                <label className="field-label">{L('dialogs.stepRef', 'Step ref')}</label>
                <input
                  className="field-input"
                  value={operation.stepRef ?? ''}
                  onChange={(e) => upsertOperationObject({ kind: 'step', stepRef: e.target.value })}
                />
              </>
            )}

            {operation.kind === 'entityFunction' && (
              <>
                <label className="field-label">{L('dialogs.namespaceAlias', 'Namespace alias')}</label>
                <select
                  className="field-input"
                  value={operation.entityFunctionRef?.namespaceAlias ?? ''}
                  onChange={(e) => upsertOperationObject({
                    kind: 'entityFunction',
                    entityFunctionRef: { ...(operation.entityFunctionRef ?? {}), namespaceAlias: e.target.value, entity: '', function: '' }
                  })}
                >
                  <option value="">—</option>
                  {modelAliases.map(alias => (
                    <option key={alias} value={alias}>{alias}</option>
                  ))}
                </select>
                <label className="field-label">{L('dialogs.entity', 'Entity')}</label>
                <select
                  className="field-input"
                  value={operation.entityFunctionRef?.entity ?? ''}
                  onChange={(e) => upsertOperationObject({
                    kind: 'entityFunction',
                    entityFunctionRef: { ...(operation.entityFunctionRef ?? {}), entity: e.target.value, function: '' }
                  })}
                >
                  <option value="">—</option>
                  {getEntitiesForAlias(operation.entityFunctionRef?.namespaceAlias ?? '').map(entity => (
                    <option key={entity} value={entity}>{entity}</option>
                  ))}
                </select>
                <label className="field-label">{L('dialogs.function', 'Function')}</label>
                <select
                  className="field-input"
                  value={operation.entityFunctionRef?.function ?? ''}
                  onChange={(e) => upsertOperationObject({
                    kind: 'entityFunction',
                    entityFunctionRef: { ...(operation.entityFunctionRef ?? {}), function: e.target.value }
                  })}
                >
                  <option value="">—</option>
                  {getFunctionsForEntity(
                    operation.entityFunctionRef?.namespaceAlias ?? '',
                    operation.entityFunctionRef?.entity ?? ''
                  ).map(fn => (
                    <option key={fn} value={fn}>{fn}</option>
                  ))}
                </select>
                <label className="field-label">parameterMap</label>
                <VariableAssignList
                  value={normalizeParameterMap(operation.entityFunctionRef)}
                  onChange={(mapParameters) => upsertOperationObject({
                    kind: 'entityFunction',
                    entityFunctionRef: {
                      ...(operation.entityFunctionRef ?? {}),
                      mapParameters
                    }
                  })}
                />
              </>
            )}

            {operation.kind === 'sqd' && (
              <>
                <label className="field-label">{L('dialogs.namespaceAlias', 'Namespace alias')}</label>
                <select
                  className="field-input"
                  value={operation.sqdRef?.namespaceAlias ?? ''}
                  onChange={(e) => upsertOperationObject({
                    kind: 'sqd',
                    sqdRef: { ...(operation.sqdRef ?? {}), namespaceAlias: e.target.value }
                  })}
                >
                  <option value="">—</option>
                  {sqdAliases.map(alias => (
                    <option key={alias} value={alias}>{alias}</option>
                  ))}
                </select>
                <label className="field-label">parameterMap</label>
                <VariableAssignList
                  value={normalizeParameterMap(operation.sqdRef)}
                  onChange={(mapParameters) => upsertOperationObject({
                    kind: 'sqd',
                    sqdRef: {
                      ...(operation.sqdRef ?? {}),
                      mapParameters,
                      mapInput: undefined,
                      mapOutput: undefined
                    }
                  })}
                />
              </>
            )}

            {operation.kind === 'event' && (
              <>
                <label className="field-label">{L('dialogs.namespaceAlias', 'Namespace alias')}</label>
                <select
                  className="field-input"
                  value={operation.eventRef?.namespaceAlias ?? ''}
                  onChange={(e) => upsertOperationObject({
                    kind: 'event',
                    eventRef: { ...(operation.eventRef ?? {}), namespaceAlias: e.target.value, event: '' }
                  })}
                >
                  <option value="">—</option>
                  {modelAliases.map(alias => (
                    <option key={alias} value={alias}>{alias}</option>
                  ))}
                </select>
                <label className="field-label">{L('dialogs.event', 'Event')}</label>
                <select
                  className="field-input"
                  value={operation.eventRef?.event ?? ''}
                  onChange={(e) => upsertOperationObject({
                    kind: 'event',
                    eventRef: { ...(operation.eventRef ?? {}), event: e.target.value }
                  })}
                >
                  <option value="">—</option>
                  {getEventsForAlias(operation.eventRef?.namespaceAlias ?? '').map(event => (
                    <option key={event} value={event}>{event}</option>
                  ))}
                </select>
                <label className="field-label">parameterMap</label>
                <VariableAssignList
                  value={normalizeParameterMap(operation.eventRef)}
                  onChange={(mapParameters) => upsertOperationObject({
                    kind: 'event',
                    eventRef: {
                      ...(operation.eventRef ?? {}),
                      mapParameters,
                      mapInput: undefined,
                      mapOutput: undefined
                    }
                  })}
                />
              </>
            )}

            <div className="dialog-actions">
              <button className="icon-btn" onClick={() => setShowOperationDialog(false)}>{L('actions.close', 'Zavriet')}</button>
            </div>
          </div>
        </div>
      )}

      {showEventRefDialog && (
        <div className="dialog-overlay" onClick={() => setShowEventRefDialog(false)}>
          <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
            <h4>{L('dialogs.waitEventRef', 'Detail cakania na udalost')}</h4>

            <label className="field-label">{L('dialogs.namespaceAlias', 'Namespace alias')}</label>
            <select
              className="field-input"
              value={eventRef?.namespaceAlias ?? ''}
              onChange={(e) => upsertEventRef({ namespaceAlias: e.target.value, event: '' })}
            >
              <option value="">—</option>
              {modelAliases.map(alias => (
                <option key={alias} value={alias}>{alias}</option>
              ))}
            </select>
            <label className="field-label">{L('dialogs.event', 'Event')}</label>
            <select
              className="field-input"
              value={eventRef?.event ?? ''}
              onChange={(e) => upsertEventRef({ event: e.target.value })}
            >
              <option value="">—</option>
              {getEventsForAlias(eventRef?.namespaceAlias ?? '').map(event => (
                <option key={event} value={event}>{event}</option>
              ))}
            </select>
            <label className="field-label">parameterMap</label>
            <VariableAssignList
              value={normalizeParameterMap(eventRef ?? undefined)}
              onChange={(mapParameters) => upsertEventRef({
                mapParameters,
                mapInput: undefined,
                mapOutput: undefined
              })}
            />

            <div className="dialog-actions">
              <button className="icon-btn" onClick={() => setShowEventRefDialog(false)}>{L('actions.close', 'Zavriet')}</button>
            </div>
          </div>
        </div>
      )}

      {/* affectedEntities dialog replaced by shared component */}
    </div>
  );
};
