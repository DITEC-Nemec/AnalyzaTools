import React, { useMemo, useState } from 'react';
import { VariableAssignList } from './VariableAssignList';
import type {
  EntityImpact,
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
  onChange: (updated: SqdStep) => void;
}

const TYPE_LABELS: Record<string, string> = {
  step:      label('algorithm.stepTypeLabels.step', 'Krok'),
  operation: label('algorithm.stepTypeLabels.operation', 'Operacia'),
  decision:  label('algorithm.stepTypeLabels.decision', 'Rozhodnutie'),
  loop:      label('algorithm.stepTypeLabels.loop', 'Smycka'),
  foreach:   label('algorithm.stepTypeLabels.foreach', 'Pre kazde'),
  event:     label('algorithm.stepTypeLabels.event', 'Udalost'),
  return:    label('algorithm.stepTypeLabels.return', 'Navrat'),
  stop:      label('algorithm.stepTypeLabels.stop', 'Zastavenie'),
  block:     label('algorithm.stepTypeLabels.block', 'Blok'),
};

const CONDITION_KINDS: Array<NonNullable<StepCondition['kind']>> = ['entityRef', 'variable', 'operationRef', 'simple'];
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

export const StepCard: React.FC<Props> = ({ step, depth = 0, actions, onChange }) => {
  const L = (path: string, fallback: string) => label(`algorithm.${path}`, fallback);

  const [expanded, setExpanded] = useState(true);
  const [showConditionDialog, setShowConditionDialog] = useState(false);
  const [showOperationDialog, setShowOperationDialog] = useState(false);
  const [showEventRefDialog, setShowEventRefDialog] = useState(false);
  const [showImpactDialog, setShowImpactDialog] = useState(false);

  const condition = useMemo(() => step.condition ?? defaultCondition(), [step.condition]);
  const operation = useMemo(() => normalizeOperation(step), [step]);
  const eventRef = useMemo(() => step.event?.eventRef ?? null, [step.event]);

  const [impactDraft, setImpactDraft] = useState<EntityImpact>({
    entityRef: { namespaceAlias: '', entity: '', attribute: '' },
    impact: 'read',
    note: ''
  });

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

  const addAffectedEntity = () => {
    if (!(impactDraft.entityRef?.entity ?? '').trim()) {
      return;
    }
    const next = [
      ...(step.affectedEntities ?? []),
      {
        ...impactDraft,
        entityRef: {
          namespaceAlias: impactDraft.entityRef?.namespaceAlias ?? '',
          entity: impactDraft.entityRef?.entity?.trim() ?? '',
          attribute: impactDraft.entityRef?.attribute ?? ''
        }
      }
    ];
    onChange({ ...step, affectedEntities: next });
    setImpactDraft({
      entityRef: { namespaceAlias: '', entity: '', attribute: '' },
      impact: 'read',
      note: ''
    });
    setShowImpactDialog(false);
  };

  const upsertEventRef = (patch: Partial<ReferenceOperation>) => {
    const next: ReferenceOperation = {
      kind: eventRef?.kind ?? 'step',
      ...eventRef,
      ...patch
    };
    onChange({
      ...step,
      event: {
        ...step.event,
        eventRef: next
      }
    });
  };

  const setEventRefKind = (kind: string) => {
    const resolvedKind = kind as ReferenceOperation['kind'];
    const next: ReferenceOperation = {
      kind: resolvedKind,
      ...(resolvedKind === 'step' ? { stepRef: eventRef?.stepRef ?? '' } : {}),
      ...(resolvedKind === 'entityFunction'
        ? { entityFunctionRef: eventRef?.entityFunctionRef ?? { namespaceAlias: '', entity: '', function: '' } }
        : {}),
      ...(resolvedKind === 'sqd' ? { sqdRef: eventRef?.sqdRef ?? { namespaceAlias: '' } } : {}),
      ...(resolvedKind === 'event' ? { eventRef: eventRef?.eventRef ?? { namespaceAlias: '', event: '' } } : {})
    };

    onChange({
      ...step,
      event: {
        ...step.event,
        eventRef: next
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

          {step.type === 'event' && (
            <div className="step-meta">
              <label className="field-label">{L('steps.eventCode', 'Kod udalosti:')}</label>
              <input
                className="field-input"
                value={step.event?.code ?? ''}
                onChange={e => onChange({ 
                  ...step, 
                  event: { ...step.event, code: e.target.value } 
                })}
                placeholder="EVT_001"
              />
              <label className="field-label">{L('steps.eventTitle', 'Nazov udalosti:')}</label>
              <input
                className="field-input"
                value={step.event?.title ?? ''}
                onChange={e => onChange({
                  ...step,
                  event: { ...step.event, title: e.target.value }
                })}
                placeholder="Názov udalosti"
              />
              <label className="field-label">{L('steps.eventSeverity', 'Severity:')}</label>
              <select
                className="field-input"
                value={step.event?.severity ?? 'info'}
                onChange={e => onChange({
                  ...step,
                  event: {
                    ...step.event,
                    severity: e.target.value as NonNullable<SqdStep['event']>['severity']
                  }
                })}
              >
                <option value="info">info</option>
                <option value="warning">warning</option>
                <option value="error">error</option>
              </select>
              <label className="field-label">{L('steps.eventDescription', 'Popis udalosti:')}</label>
              <input
                className="field-input"
                value={step.event?.text ?? step.event?.description ?? ''}
                onChange={e => onChange({ 
                  ...step, 
                  event: { ...step.event, text: e.target.value, description: e.target.value }
                })}
                placeholder="Popis udalosti…"
              />

              <div className="condition-summary">
                {L('steps.eventRef', 'eventRef')}: {eventRef ? summaryOperation(eventRef) : L('steps.eventRefNone', 'nepridany')}
                <button className="btn-link" onClick={() => setShowEventRefDialog(true)}>
                  [{eventRef ? ` ${L('steps.editEventRef', 'Upravit eventRef...')} ` : ` ${L('steps.addEventRef', 'Pridat eventRef...')} `}]
                </button>
                {eventRef && (
                  <button
                    className="btn-link"
                    onClick={() => onChange({
                      ...step,
                      event: {
                        ...step.event,
                        eventRef: undefined
                      }
                    })}
                  >
                    [ {L('actions.delete', 'Zmazat')} ]
                  </button>
                )}
              </div>
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
              <div className="condition-summary">
                ✱ {summaryCondition(step.condition)}
                <button className="btn-link" onClick={() => setShowConditionDialog(true)}>[ {L('actions.editDetail', 'Upravit detail...')} ]</button>
              </div>
            </div>
          )}

          <div className="step-meta">
            <div className="panel-head compact">
              <label className="field-label">{L('steps.affectedEntities', 'Affected entities:')}</label>
              <button className="icon-btn" onClick={() => setShowImpactDialog(true)}>+ {L('actions.add', 'Add')}</button>
            </div>
            {(step.affectedEntities ?? []).length === 0 && <span className="muted">{L('steps.affectedNone', 'Ziadne polozky')}</span>}
            {(step.affectedEntities ?? []).map((impact, idx) => (
              <div key={`${impact.entityRef?.namespaceAlias ?? ''}:${impact.entityRef?.entity ?? impact.entity ?? ''}:${impact.entityRef?.attribute ?? ''}-${idx}`} className="condition-summary">
                {(impact.entityRef?.entity ?? impact.entity ?? '-')}
                {impact.entityRef?.attribute ? `.${impact.entityRef.attribute}` : ''}
                {impact.entityRef?.namespaceAlias ? ` @${impact.entityRef.namespaceAlias}` : ''}
                {' | '}{impact.impact}{impact.note ? ` | ${impact.note}` : ''}
                <button
                  className="btn-link"
                  onClick={() => onChange({
                    ...step,
                    affectedEntities: (step.affectedEntities ?? []).filter((_, i) => i !== idx)
                  })}
                >
                  [ {L('actions.delete', 'Zmazat')} ]
                </button>
              </div>
            ))}
          </div>

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
                    <input
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
                              entityFunctionRef: { ...currentRef, namespaceAlias: e.target.value }
                            }
                          }
                        });
                      }}
                    />
                    <label className="field-label">Entity</label>
                    <input
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
                              entityFunctionRef: { ...currentRef, entity: e.target.value }
                            }
                          }
                        });
                      }}
                    />
                    <label className="field-label">Function</label>
                    <input
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
                    />
                    {/* mapInput editor */}
                    <label className="field-label">mapInput</label>
                    <VariableAssignList
                      value={condition.operationRef?.entityFunctionRef?.mapInput ?? []}
                      onChange={(mapInput) => {
                        const currentRef: ReferenceEntityFunction = condition.operationRef?.entityFunctionRef ?? {};
                        onChange({
                          ...step,
                          condition: {
                            ...condition,
                            operationRef: {
                              ...(condition.operationRef ?? { kind: 'entityFunction' }),
                              kind: 'entityFunction',
                              entityFunctionRef: { ...currentRef, mapInput }
                            }
                          }
                        });
                      }}
                    />
                    {/* mapOutput editor */}
                    <label className="field-label">mapOutput</label>
                    <VariableAssignList
                      value={condition.operationRef?.entityFunctionRef?.mapOutput ?? []}
                      onChange={(mapOutput) => {
                        const currentRef: ReferenceEntityFunction = condition.operationRef?.entityFunctionRef ?? {};
                        onChange({
                          ...step,
                          condition: {
                            ...condition,
                            operationRef: {
                              ...(condition.operationRef ?? { kind: 'entityFunction' }),
                              kind: 'entityFunction',
                              entityFunctionRef: { ...currentRef, mapOutput }
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
                    <input
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
                    />
                    {/* mapInput editor */}
                    <label className="field-label">mapInput</label>
                    <VariableAssignList
                      value={condition.operationRef?.sqdRef?.mapInput ?? []}
                      onChange={(mapInput) => {
                        const currentRef: ReferenceSqd = condition.operationRef?.sqdRef ?? {};
                        onChange({
                          ...step,
                          condition: {
                            ...condition,
                            operationRef: {
                              ...(condition.operationRef ?? { kind: 'sqd' }),
                              kind: 'sqd',
                              sqdRef: { ...currentRef, mapInput }
                            }
                          }
                        });
                      }}
                    />
                    {/* mapOutput editor */}
                    <label className="field-label">mapOutput</label>
                    <VariableAssignList
                      value={condition.operationRef?.sqdRef?.mapOutput ?? []}
                      onChange={(mapOutput) => {
                        const currentRef: ReferenceSqd = condition.operationRef?.sqdRef ?? {};
                        onChange({
                          ...step,
                          condition: {
                            ...condition,
                            operationRef: {
                              ...(condition.operationRef ?? { kind: 'sqd' }),
                              kind: 'sqd',
                              sqdRef: { ...currentRef, mapOutput }
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
                    <input
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
                              eventRef: { ...currentRef, namespaceAlias: e.target.value }
                            }
                          }
                        });
                      }}
                    />
                    <label className="field-label">Event</label>
                    <input
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
                    />
                    {/* mapInput editor */}
                    <label className="field-label">mapInput</label>
                    <VariableAssignList
                      value={condition.operationRef?.eventRef?.mapInput ?? []}
                      onChange={(mapInput) => {
                        const currentRef: ReferenceEvent = condition.operationRef?.eventRef ?? {};
                        onChange({
                          ...step,
                          condition: {
                            ...condition,
                            operationRef: {
                              ...(condition.operationRef ?? { kind: 'event' }),
                              kind: 'event',
                              eventRef: { ...currentRef, mapInput }
                            }
                          }
                        });
                      }}
                    />
                  </>
                )}
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
                <input
                  className="field-input"
                  value={operation.entityFunctionRef?.namespaceAlias ?? ''}
                  onChange={(e) => upsertOperationObject({
                    kind: 'entityFunction',
                    entityFunctionRef: { ...(operation.entityFunctionRef ?? {}), namespaceAlias: e.target.value }
                  })}
                />
                <label className="field-label">{L('dialogs.entity', 'Entity')}</label>
                <input
                  className="field-input"
                  value={operation.entityFunctionRef?.entity ?? ''}
                  onChange={(e) => upsertOperationObject({
                    kind: 'entityFunction',
                    entityFunctionRef: { ...(operation.entityFunctionRef ?? {}), entity: e.target.value }
                  })}
                />
                <label className="field-label">{L('dialogs.function', 'Function')}</label>
                <input
                  className="field-input"
                  value={operation.entityFunctionRef?.function ?? ''}
                  onChange={(e) => upsertOperationObject({
                    kind: 'entityFunction',
                    entityFunctionRef: { ...(operation.entityFunctionRef ?? {}), function: e.target.value }
                  })}
                />
              </>
            )}

            {operation.kind === 'sqd' && (
              <>
                <label className="field-label">{L('dialogs.namespaceAlias', 'Namespace alias')}</label>
                <input
                  className="field-input"
                  value={operation.sqdRef?.namespaceAlias ?? ''}
                  onChange={(e) => upsertOperationObject({
                    kind: 'sqd',
                    sqdRef: { ...(operation.sqdRef ?? {}), namespaceAlias: e.target.value }
                  })}
                />
              </>
            )}

            {operation.kind === 'event' && (
              <>
                <label className="field-label">{L('dialogs.namespaceAlias', 'Namespace alias')}</label>
                <input
                  className="field-input"
                  value={operation.eventRef?.namespaceAlias ?? ''}
                  onChange={(e) => upsertOperationObject({
                    kind: 'event',
                    eventRef: { ...(operation.eventRef ?? {}), namespaceAlias: e.target.value }
                  })}
                />
                <label className="field-label">{L('dialogs.event', 'Event')}</label>
                <input
                  className="field-input"
                  value={operation.eventRef?.event ?? ''}
                  onChange={(e) => upsertOperationObject({
                    kind: 'event',
                    eventRef: { ...(operation.eventRef ?? {}), event: e.target.value }
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
            <h4>{L('dialogs.eventRef', 'EventRef detail')}</h4>

            <label className="field-label">{L('dialogs.kind', 'Kind')}</label>
            <select
              className="field-input"
              value={eventRef?.kind ?? 'step'}
              onChange={(e) => setEventRefKind(e.target.value)}
            >
              {OPERATION_KINDS.map(kind => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>

            {(eventRef?.kind ?? 'step') === 'step' && (
              <>
                <label className="field-label">{L('dialogs.stepRef', 'Step ref')}</label>
                <input
                  className="field-input"
                  value={eventRef?.stepRef ?? ''}
                  onChange={(e) => upsertEventRef({ kind: 'step', stepRef: e.target.value })}
                />
              </>
            )}

            {(eventRef?.kind ?? 'step') === 'entityFunction' && (
              <>
                <label className="field-label">{L('dialogs.namespaceAlias', 'Namespace alias')}</label>
                <input
                  className="field-input"
                  value={eventRef?.entityFunctionRef?.namespaceAlias ?? ''}
                  onChange={(e) => upsertEventRef({
                    kind: 'entityFunction',
                    entityFunctionRef: { ...(eventRef?.entityFunctionRef ?? {}), namespaceAlias: e.target.value }
                  })}
                />
                <label className="field-label">{L('dialogs.entity', 'Entity')}</label>
                <input
                  className="field-input"
                  value={eventRef?.entityFunctionRef?.entity ?? ''}
                  onChange={(e) => upsertEventRef({
                    kind: 'entityFunction',
                    entityFunctionRef: { ...(eventRef?.entityFunctionRef ?? {}), entity: e.target.value }
                  })}
                />
                <label className="field-label">{L('dialogs.function', 'Function')}</label>
                <input
                  className="field-input"
                  value={eventRef?.entityFunctionRef?.function ?? ''}
                  onChange={(e) => upsertEventRef({
                    kind: 'entityFunction',
                    entityFunctionRef: { ...(eventRef?.entityFunctionRef ?? {}), function: e.target.value }
                  })}
                />
              </>
            )}

            {(eventRef?.kind ?? 'step') === 'sqd' && (
              <>
                <label className="field-label">{L('dialogs.namespaceAlias', 'Namespace alias')}</label>
                <input
                  className="field-input"
                  value={eventRef?.sqdRef?.namespaceAlias ?? ''}
                  onChange={(e) => upsertEventRef({
                    kind: 'sqd',
                    sqdRef: { ...(eventRef?.sqdRef ?? {}), namespaceAlias: e.target.value }
                  })}
                />
              </>
            )}

            {(eventRef?.kind ?? 'step') === 'event' && (
              <>
                <label className="field-label">{L('dialogs.namespaceAlias', 'Namespace alias')}</label>
                <input
                  className="field-input"
                  value={eventRef?.eventRef?.namespaceAlias ?? ''}
                  onChange={(e) => upsertEventRef({
                    kind: 'event',
                    eventRef: { ...(eventRef?.eventRef ?? {}), namespaceAlias: e.target.value }
                  })}
                />
                <label className="field-label">{L('dialogs.event', 'Event')}</label>
                <input
                  className="field-input"
                  value={eventRef?.eventRef?.event ?? ''}
                  onChange={(e) => upsertEventRef({
                    kind: 'event',
                    eventRef: { ...(eventRef?.eventRef ?? {}), event: e.target.value }
                  })}
                />
              </>
            )}

            <div className="dialog-actions">
              <button className="icon-btn" onClick={() => setShowEventRefDialog(false)}>{L('actions.close', 'Zavriet')}</button>
            </div>
          </div>
        </div>
      )}

      {showImpactDialog && (
        <div className="dialog-overlay" onClick={() => setShowImpactDialog(false)}>
          <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
            <h4>{L('dialogs.addAffected', 'Add affected entity')}</h4>
            <label className="field-label">{L('dialogs.namespaceAlias', 'Namespace alias')}</label>
            <input
              className="field-input"
              value={impactDraft.entityRef?.namespaceAlias ?? ''}
              onChange={(e) =>
                setImpactDraft((prev) => ({
                  ...prev,
                  entityRef: {
                    ...(prev.entityRef ?? { namespaceAlias: '', entity: '', attribute: '' }),
                    namespaceAlias: e.target.value
                  }
                }))
              }
            />
            <label className="field-label">{L('dialogs.entity', 'Entity')}</label>
            <input
              className="field-input"
              value={impactDraft.entityRef?.entity ?? ''}
              onChange={(e) =>
                setImpactDraft((prev) => ({
                  ...prev,
                  entityRef: {
                    ...(prev.entityRef ?? { namespaceAlias: '', entity: '', attribute: '' }),
                    entity: e.target.value
                  }
                }))
              }
            />
            <label className="field-label">{L('dialogs.attribute', 'Attribute')}</label>
            <input
              className="field-input"
              value={impactDraft.entityRef?.attribute ?? ''}
              onChange={(e) =>
                setImpactDraft((prev) => ({
                  ...prev,
                  entityRef: {
                    ...(prev.entityRef ?? { namespaceAlias: '', entity: '', attribute: '' }),
                    attribute: e.target.value
                  }
                }))
              }
            />
            <label className="field-label">{L('dialogs.impact', 'Impact')}</label>
            <select
              className="field-input"
              value={impactDraft.impact}
              onChange={(e) => setImpactDraft((prev) => ({ ...prev, impact: e.target.value as EntityImpact['impact'] }))}
            >
              {IMPACT_TYPES.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <label className="field-label">{L('dialogs.note', 'Poznamka')}</label>
            <input
              className="field-input"
              value={impactDraft.note ?? ''}
              onChange={(e) => setImpactDraft((prev) => ({ ...prev, note: e.target.value }))}
            />
            <div className="dialog-actions">
              <button className="icon-btn" onClick={() => setShowImpactDialog(false)}>{L('actions.cancel', 'Zrusit')}</button>
              <button className="icon-btn" onClick={addAffectedEntity}>{L('actions.add', 'Add')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
