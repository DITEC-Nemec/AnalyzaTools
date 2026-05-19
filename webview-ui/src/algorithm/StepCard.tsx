import React, { useMemo, useState } from 'react';
import { VariableAssignList } from './VariableAssignList';
import { AffectedEntitiesEditor } from '../components/AffectedEntitiesEditor';
import { ActorRefsEditor } from '../components/ActorRefsEditor';
import type {
  ActorRef,
  EntityImpact,
  ParameterMap,
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

const CONDITION_KINDS: Array<NonNullable<StepCondition['kind']>> = ['entityRef', 'variable', 'operationRef', 'waitEvent', 'simple'];
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
const OPERATION_KINDS: ReferenceOperation['kind'][] = ['entityFunction', 'sqd', 'step', 'event'];

const defaultCondition = (): StepCondition => ({
  kind: 'simple',
  description: '',
  check: 'exists'
});

const normalizeOperation = (step: SqdStep): ReferenceOperation | null => {
  if (!step.operation || typeof step.operation === 'string') {
    return null;
  }
  return step.operation;
};

const summaryOperation = (operation: ReferenceOperation | null): string => {
  if (!operation) {
    return label('algorithm.steps.simpleText', 'simple text');
  }
  if (operation.kind === 'step') {
    return `step:${operation.stepRef ?? '-'}`;
  }
  if (operation.kind === 'entityFunction') {
    return `entityFunction:${operation.entityFunctionRef?.entity ?? '-'}:${operation.entityFunctionRef?.function ?? '-'}`;
  }
  if (operation.kind === 'sqd') {
    return `sqd:${operation.sqdRef?.namespaceAlias ?? '-'}`;
  }
  return `event:${operation.eventRef?.namespaceAlias ?? '-'}:${operation.eventRef?.event ?? '-'}`;
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

const summaryEventRef = (eventRef: ReferenceEvent | null): string => {
  if (!eventRef) {
    return label('algorithm.steps.eventRefNone', 'nepridany');
  }
  return `event:${eventRef.namespaceAlias ?? '-'}:${eventRef.event ?? '-'}`;
};

const normalizeParameterMap = (
  ref?: { mapParameters?: ParameterMap[]; mapInput?: ParameterMap[]; mapOutput?: ParameterMap[] }
): ParameterMap[] => {
  if (!ref) {
    return [];
  }

  if ((ref.mapParameters ?? []).length > 0) {
    return (ref.mapParameters ?? []).map(item => ({
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
  const eventRef = useMemo(() => condition.waitEvent?.eventRef ?? null, [condition]);

  const upsertOperationObject = (patch: Partial<ReferenceOperation>) => {
    const next: ReferenceOperation = {
      kind: operation?.kind ?? 'step',
      ...operation,
      ...patch
    };
    onChange({ ...step, operation: next });
  };

  const setOperationKind = (kind: string) => {
    if (!kind) {
      onChange({ ...step, operation: typeof step.operation === 'string' ? step.operation : '' });
      return;
    }

    const resolvedKind = kind as ReferenceOperation['kind'];
    const next: ReferenceOperation = {
      kind: resolvedKind,
      ...(resolvedKind === 'step' ? { stepRef: operation?.stepRef ?? '' } : {}),
      ...(resolvedKind === 'entityFunction'
        ? { entityFunctionRef: operation?.entityFunctionRef ?? { namespaceAlias: '', entity: '', function: '' } }
        : {}),
      ...(resolvedKind === 'sqd' ? { sqdRef: operation?.sqdRef ?? { namespaceAlias: '' } } : {}),
      ...(resolvedKind === 'event' ? { eventRef: operation?.eventRef ?? { namespaceAlias: '', event: '' } } : {})
    };
    onChange({ ...step, operation: next });
  };


  const upsertEventRef = (patch: Partial<ReferenceEvent>) => {
    const next: ReferenceEvent = {
      ...eventRef,
      ...patch
    };
    onChange({
      ...step,
      condition: {
        ...condition,
        waitEvent: {
          ...(condition.waitEvent ?? { eventRef: { namespaceAlias: 'local', event: '' } }),
          eventRef: next
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
    <div className={`step-card step-card--${step.type}`} style={{ marginLeft: depth * 22 }}>
      <div className="step-card-header" onClick={() => setExpanded(!expanded)}>
        {depth > 0 && <span className="step-depth-marker">│</span>}
        <span className="step-id">[{step.id}]</span>
        <span className="step-type">{TYPE_LABELS[step.type] ?? step.type}</span>
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
            value={step.text ?? ''}
            rows={3}
            onChange={e => onChange({ ...step, text: e.target.value })}
            placeholder="Opíš čo sa deje prirodzeným jazykom…"
          />

          {step.type === 'operation' && (
            <div className="step-meta">
              <label className="field-label">{L('steps.operationText', 'Operation text:')}</label>
              <input
                className="field-input"
                value={typeof step.operation === 'string' ? step.operation : ''}
                onChange={e => onChange({ ...step, operation: e.target.value })}
                placeholder="Textový popis operácie"
              />
              <label className="field-label">{L('steps.operationKind', 'Operation kind:')}</label>
              <select
                className="field-input"
                value={operation?.kind ?? ''}
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

          {(step.type === 'decision' || step.type === 'loop') && (
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
                          eventRef: condition.waitEvent?.eventRef ?? { namespaceAlias: 'local', event: '' },
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
                          eventRef: condition.waitEvent?.eventRef ?? { namespaceAlias: 'local', event: '' },
                          ...condition.waitEvent,
                          timeoutAction: e.target.value
                        }
                      }
                    })}
                    placeholder={L('steps.timeoutActionPlaceholder', 'napr. retry 3x, inak skoc na step 9')}
                  />
                  <div className="condition-summary">
                    {L('steps.waitEventRef', 'Cakat na udalost')}: {summaryEventRef(eventRef)}
                    <button className="btn-link" onClick={() => setShowEventRefDialog(true)}>
                      [{eventRef ? ` ${L('steps.editWaitEventRef', 'Upravit udalost...')} ` : ` ${L('steps.addWaitEventRef', 'Pridat udalost...')} `}]
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
                value={(step.behavior.preconditions ?? []).join('\n')}
                onChange={(e) => updateBehavior({ preconditions: e.target.value.split('\n').filter(s => s.trim().length > 0) })}
              />

              <label className="field-label">{L('steps.postconditions', 'Postconditions')}</label>
              <textarea
                className="field-input"
                rows={3}
                value={(step.behavior.postconditions ?? []).join('\n')}
                onChange={(e) => updateBehavior({ postconditions: e.target.value.split('\n').filter(s => s.trim().length > 0) })}
              />

              <AffectedEntitiesEditor
                affectedEntities={step.behavior.affectedEntities ?? []}
                modelAliases={modelAliases}
                sqdAliases={sqdAliases}
                getEntitiesForAlias={getEntitiesForAlias}
                onChange={affectedEntities => updateBehavior({ affectedEntities })}
              />

              <ActorRefsEditor
                actorRefs={normalizeActorRefs(step.behavior.actors)}
                namespaceAliases={Array.from(new Set(['local', ...modelAliases, ...sqdAliases]))}
                getAvailableActors={getActorsForAlias}
                onChange={(actors) => updateBehavior({ actors })}
                prefix="algorithm"
              />

              <button
                type="button"
                className="btn-link"
                onClick={() => {
                  const hasContent = (step.behavior?.description ?? '').trim().length > 0
                    || (step.behavior?.preconditions?.length ?? 0) > 0
                    || (step.behavior?.postconditions?.length ?? 0) > 0
                    || (step.behavior?.affectedEntities?.length ?? 0) > 0
                    || (step.behavior?.actors?.length ?? 0) > 0;

                  if (!hasContent) {
                    onChange({ ...step, behavior: undefined });
                  }
                }}
              >
                {L('steps.removeEmptyBehavior', 'Remove empty behavior')}
              </button>
            </div>
          )}

          {step.type === 'foreach' && (
            <div className="step-meta">
              <label className="field-label">{L('steps.collection', 'Zbierka:')}</label>
              <input
                className="field-input"
                value={step.collection ?? ''}
                onChange={e => onChange({ ...step, collection: e.target.value })}
                placeholder="napr. items, users"
              />
              <label className="field-label">{L('steps.item', 'Polozka:')}</label>
              <input
                className="field-input"
                value={step.item ?? ''}
                onChange={e => onChange({ ...step, item: e.target.value })}
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

            {condition.kind === 'entityRef' && (
              <>
                <label className="field-label">{L('dialogs.namespaceAlias', 'Namespace alias')}</label>
                <input
                  className="field-input"
                  value={condition.entityRef?.namespaceAlias ?? ''}
                  onChange={(e) => onChange({
                    ...step,
                    condition: {
                      ...condition,
                      entityRef: { ...condition.entityRef, namespaceAlias: e.target.value }
                    }
                  })}
                />
                <label className="field-label">{L('dialogs.entity', 'Entity')}</label>
                <input
                  className="field-input"
                  value={condition.entityRef?.entity ?? ''}
                  onChange={(e) => onChange({
                    ...step,
                    condition: { ...condition, entityRef: { ...condition.entityRef, entity: e.target.value } }
                  })}
                />
                <label className="field-label">{L('dialogs.attribute', 'Attribute')}</label>
                <input
                  className="field-input"
                  value={condition.entityRef?.attribute ?? ''}
                  onChange={(e) => onChange({
                    ...step,
                    condition: { ...condition, entityRef: { ...condition.entityRef, attribute: e.target.value } }
                  })}
                />
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
                  value={condition.operationRef?.kind ?? 'step'}
                  onChange={(e) =>
                    onChange({
                      ...step,
                      condition: {
                        ...condition,
                        operationRef: { kind: e.target.value as ReferenceOperation['kind'] }
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

                {(condition.operationRef?.kind ?? 'step') === 'step' && (
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
                {(condition.operationRef?.kind ?? 'step') === 'entityFunction' && (
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
                    <label className="field-label">parameterMap</label>
                    <VariableAssignList
                      value={normalizeParameterMap(condition.operationRef?.entityFunctionRef)}
                      onChange={(mapParameters) => {
                        const currentRef: ReferenceEntityFunction = condition.operationRef?.entityFunctionRef ?? {};
                        onChange({
                          ...step,
                          condition: {
                            ...condition,
                            operationRef: {
                              ...(condition.operationRef ?? { kind: 'entityFunction' }),
                              kind: 'entityFunction',
                              entityFunctionRef: { ...currentRef, mapParameters, mapInput: undefined, mapOutput: undefined }
                            }
                          }
                        });
                      }}
                    />
                  </>
                )}
                {(condition.operationRef?.kind ?? 'step') === 'sqd' && (
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
                    <label className="field-label">parameterMap</label>
                    <VariableAssignList
                      value={normalizeParameterMap(condition.operationRef?.sqdRef)}
                      onChange={(mapParameters) => {
                        const currentRef: ReferenceSqd = condition.operationRef?.sqdRef ?? {};
                        onChange({
                          ...step,
                          condition: {
                            ...condition,
                            operationRef: {
                              ...(condition.operationRef ?? { kind: 'sqd' }),
                              kind: 'sqd',
                              sqdRef: { ...currentRef, mapParameters, mapInput: undefined, mapOutput: undefined }
                            }
                          }
                        });
                      }}
                    />
                  </>
                )}
                {(condition.operationRef?.kind ?? 'step') === 'event' && (
                  <>
                    <label className="field-label">Event namespaceAlias</label>
                    <select
                      className="field-input"
                      value={condition.operationRef?.eventRef?.namespaceAlias ?? ''}
                      onChange={(e) => {
                        const currentRef: ReferenceEvent = condition.operationRef?.eventRef ?? {};
                        onChange({
                          ...step,
                          condition: {
                            ...condition,
                            operationRef: {
                              ...(condition.operationRef ?? { kind: 'event' }),
                              kind: 'event',
                              eventRef: { ...currentRef, namespaceAlias: e.target.value, event: '' }
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
                      value={condition.operationRef?.eventRef?.event ?? ''}
                      onChange={(e) => {
                        const currentRef: ReferenceEvent = condition.operationRef?.eventRef ?? {};
                        onChange({
                          ...step,
                          condition: {
                            ...condition,
                            operationRef: {
                              ...(condition.operationRef ?? { kind: 'event' }),
                              kind: 'event',
                              eventRef: { ...currentRef, event: e.target.value }
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
                      mapParameters,
                      mapInput: undefined,
                      mapOutput: undefined
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
