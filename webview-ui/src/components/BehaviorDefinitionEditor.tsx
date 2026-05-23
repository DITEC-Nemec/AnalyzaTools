import React, { useMemo, useState } from 'react';
import type { ActorRef, BusinessRuleRef, EntityImpact, ErrorEvent, ErrorEventAction, Output, ReferenceEvent } from '../types/sqd';
import { label as L } from '../ui-labels';

const ERROR_ACTIONS: ErrorEventAction[] = ['emit', 'fallback', 'return', 'exception', 'retry', 'skip', 'compensate'];

interface Props {
  errorEventList: ErrorEvent[];
  entityImpactList: EntityImpact[];
  outputList: Output[];
  businessRuleRefList: BusinessRuleRef[];
  actorRefList?: ActorRef[];
  namespaceAliases?: string[];
  modelAliases?: string[];
  getEntitiesForAlias?: (alias: string) => string[];
  getAttributesForEntity?: (entityName: string, alias?: string) => string[];
  getEventsForAlias?: (alias: string) => string[];
  getBusinessRulesForAlias?: (alias: string) => string[];
  getActorsForAlias?: (alias: string) => string[];
  onChange: (patch: {
    errorEventList?: ErrorEvent[];
    entityImpactList?: EntityImpact[];
    outputList?: Output[];
    businessRuleRefList?: BusinessRuleRef[];
    actorRefList?: ActorRef[];
  }) => void;
}

type AddKind = 'errorEvent' | 'entityImpact' | 'output' | 'businessRuleRef' | 'actorRef';

const IMPACT_TYPES: EntityImpact['impact'][] = ['read', 'write', 'affect'];

const defaultErrorEvent = (): ErrorEvent => ({
  condition: '',
  emitEventRef: {
    namespaceAlias: 'local',
    event: ''
  } as ReferenceEvent,
  action: 'emit'
});

const defaultEntityImpact = (): EntityImpact => ({
  impact: 'read',
  attributeRef: {
    namespaceAlias: '',
    entity: '',
    attribute: ''
  },
  note: ''
});

const defaultOutput = (): Output => ({
  variable: '',
  description: ''
});

const defaultBusinessRuleRef = (): BusinessRuleRef => ({
  namespaceAlias: '',
  ruleCode: ''
});

const defaultActorRef = (): ActorRef => ({
  namespaceAlias: 'local',
  actor: ''
});

export const BehaviorDefinitionEditor: React.FC<Props> = ({
  errorEventList,
  entityImpactList,
  outputList,
  businessRuleRefList,
  actorRefList,
  namespaceAliases = [],
  modelAliases = [],
  getEntitiesForAlias = () => [],
  getAttributesForEntity = () => [],
  getEventsForAlias = () => [],
  getBusinessRulesForAlias = () => [],
  getActorsForAlias = () => [],
  onChange
}) => {
  const [addKind, setAddKind] = useState<AddKind | null>(null);
  const [errorDraft, setErrorDraft] = useState<ErrorEvent>(defaultErrorEvent());
  const [impactDraft, setImpactDraft] = useState<EntityImpact>(defaultEntityImpact());
  const [outputDraft, setOutputDraft] = useState<Output>(defaultOutput());
  const [businessRuleDraft, setBusinessRuleDraft] = useState<BusinessRuleRef>(defaultBusinessRuleRef());
  const [actorDraft, setActorDraft] = useState<ActorRef>(defaultActorRef());

  const allAliases = useMemo(
    () => Array.from(new Set(['local', ...namespaceAliases, ...modelAliases].filter(Boolean))),
    [namespaceAliases, modelAliases]
  );

  const closeDialog = () => {
    setAddKind(null);
    setErrorDraft(defaultErrorEvent());
    setImpactDraft(defaultEntityImpact());
    setOutputDraft(defaultOutput());
    setBusinessRuleDraft(defaultBusinessRuleRef());
    setActorDraft(defaultActorRef());
  };

  const addErrorEvent = () => {
    if (!errorDraft.condition?.trim()) {
      alert(L('validation.conditionRequired', 'Condition je povinna'));
      return;
    }
    if (!errorDraft.emitEventRef?.namespaceAlias?.trim()) {
      alert(L('validation.namespaceRequired', 'Namespace alias je povinny'));
      return;
    }
    onChange({ errorEventList: [...(errorEventList ?? []), errorDraft] });
    closeDialog();
  };

  const addEntityImpact = () => {
    if (!impactDraft.attributeRef?.namespaceAlias?.trim() || !impactDraft.attributeRef?.entity?.trim()) {
      alert(L('validation.entityRequired', 'Entita a namespace alias su povinne'));
      return;
    }
    onChange({ entityImpactList: [...(entityImpactList ?? []), impactDraft] });
    closeDialog();
  };

  const addOutput = () => {
    if (!outputDraft.variable?.trim()) {
      alert(L('validation.variableRequired', 'Nazov premennej je povinny'));
      return;
    }
    onChange({ outputList: [...(outputList ?? []), outputDraft] });
    closeDialog();
  };

  const addBusinessRuleRef = () => {
    if (!businessRuleDraft.namespaceAlias?.trim() || !businessRuleDraft.ruleCode?.trim()) {
      alert(L('validation.businessRuleRequired', 'Alias a business rule su povinne'));
      return;
    }
    onChange({ businessRuleRefList: [...(businessRuleRefList ?? []), businessRuleDraft] });
    closeDialog();
  };

  const addActorRef = () => {
    if (!actorDraft.namespaceAlias?.trim()) {
      alert(L('validation.namespaceRequired', 'Namespace alias je povinny'));
      return;
    }
    onChange({ actorRefList: [...(actorRefList ?? []), actorDraft] });
    closeDialog();
  };

  return (
    <div className="behavior-definition-editor" style={{ marginTop: 12 }}>
      <div className="panel-head compact">
        <label className="field-label">{L('sections.behaviorDefinitions', 'Behavior definitions:')}</label>
        <div className="behavior-add-toolbar" role="toolbar" aria-label="Behavior add toolbar">
          <button className="icon-btn" title="Pridat error event" onClick={() => setAddKind('errorEvent')}>⚠</button>
          <button className="icon-btn" title="Pridat entity impact" onClick={() => setAddKind('entityImpact')}>◎</button>
          <button className="icon-btn" title="Pridat output" onClick={() => setAddKind('output')}>⇢</button>
          <button className="icon-btn" title="Pridat business rule ref" onClick={() => setAddKind('businessRuleRef')}>#</button>
          <button className="icon-btn" title="Pridat aktora" onClick={() => { setActorDraft({ namespaceAlias: allAliases[0] ?? 'local', actor: '' }); setAddKind('actorRef'); }}>👤</button>
        </div>
      </div>

      <label className="field-label">{L('sections.errorEvents', 'Error events')}</label>
      {(errorEventList ?? []).length === 0 && <div className="muted">{L('empty.noItems', 'Ziadne polozky')}</div>}
      {(errorEventList ?? []).map((item, idx) => (
        <div key={`err-${idx}`} className="impact-summary">
          {(item.condition ?? '-')} - {(item.emitEventRef?.namespaceAlias ?? '-') + ':' + (item.emitEventRef?.event ?? '-')}
          <button className="btn-link" onClick={() => onChange({ errorEventList: (errorEventList ?? []).filter((_, i) => i !== idx) })}>
            [ {L('actions.delete', 'Zmazat')} ]
          </button>
        </div>
      ))}

      <label className="field-label">{L('sections.entityImpactList', 'Entity impacts')}</label>
      {(entityImpactList ?? []).length === 0 && <div className="muted">{L('empty.noItems', 'Ziadne polozky')}</div>}
      {(entityImpactList ?? []).map((item, idx) => (
        <div key={`impact-${idx}`} className="impact-summary">
          {(item.attributeRef?.namespaceAlias ?? '-') + ':' + (item.attributeRef?.entity ?? '-') + (item.attributeRef?.attribute ? '.' + item.attributeRef.attribute : '')} [{item.impact}]
          <button className="btn-link" onClick={() => onChange({ entityImpactList: (entityImpactList ?? []).filter((_, i) => i !== idx) })}>
            [ {L('actions.delete', 'Zmazat')} ]
          </button>
        </div>
      ))}

      <label className="field-label">{L('sections.outputList', 'Outputs')}</label>
      {(outputList ?? []).length === 0 && <div className="muted">{L('empty.noItems', 'Ziadne polozky')}</div>}
      {(outputList ?? []).map((item, idx) => (
        <div key={`out-${idx}`} className="impact-summary">
          {item.variable}{item.description ? ` - ${item.description}` : ''}
          <button className="btn-link" onClick={() => onChange({ outputList: (outputList ?? []).filter((_, i) => i !== idx) })}>
            [ {L('actions.delete', 'Zmazat')} ]
          </button>
        </div>
      ))}

      <label className="field-label">{L('sections.businessRuleRefList', 'Business rule refs')}</label>
      {(businessRuleRefList ?? []).length === 0 && <div className="muted">{L('empty.noItems', 'Ziadne polozky')}</div>}
      {(businessRuleRefList ?? []).map((item, idx) => (
        <div key={`br-${idx}`} className="impact-summary">
          {(item.namespaceAlias ?? '-') + ':' + (item.ruleCode ?? '-')}
          <button className="btn-link" onClick={() => onChange({ businessRuleRefList: (businessRuleRefList ?? []).filter((_, i) => i !== idx) })}>
            [ {L('actions.delete', 'Zmazat')} ]
          </button>
        </div>
      ))}

      {addKind && (
        <div className="dialog-overlay" onClick={closeDialog}>
          <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
            {addKind === 'errorEvent' && (
              <>
                <h4>Pridat error event</h4>
                <label className="field-label">Condition</label>
                <input className="field-input" value={errorDraft.condition ?? ''} onChange={(e) => setErrorDraft({ ...errorDraft, condition: e.target.value })} />

                <label className="field-label">Namespace alias</label>
                <select
                  className="field-input"
                  value={errorDraft.emitEventRef?.namespaceAlias ?? 'local'}
                  onChange={(e) => setErrorDraft({
                    ...errorDraft,
                    emitEventRef: {
                      ...(errorDraft.emitEventRef ?? { namespaceAlias: 'local', event: '' }),
                      namespaceAlias: e.target.value,
                      event: ''
                    }
                  })}
                >
                  {allAliases.map((alias) => <option key={`err-alias-${alias}`} value={alias}>{alias}</option>)}
                </select>

                <label className="field-label">Event</label>
                <select
                  className="field-input"
                  value={errorDraft.emitEventRef?.event ?? ''}
                  onChange={(e) => setErrorDraft({
                    ...errorDraft,
                    emitEventRef: {
                      ...(errorDraft.emitEventRef ?? { namespaceAlias: 'local', event: '' }),
                      event: e.target.value
                    }
                  })}
                >
                  <option value="">--</option>
                  {getEventsForAlias(errorDraft.emitEventRef?.namespaceAlias ?? 'local').map((eventCode) => (
                    <option key={`err-event-${eventCode}`} value={eventCode}>{eventCode}</option>
                  ))}
                </select>

                <label className="field-label">Action</label>
                <select
                  className="field-input"
                  value={errorDraft.action ?? 'emit'}
                  onChange={(e) => setErrorDraft({ ...errorDraft, action: e.target.value as ErrorEventAction })}
                >
                  {ERROR_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>

                {errorDraft.action === 'fallback' && (
                  <>
                    <label className="field-label">fallbackStepRef</label>
                    <input className="field-input" value={errorDraft.fallbackStepRef ?? ''} onChange={(e) => setErrorDraft({ ...errorDraft, fallbackStepRef: e.target.value })} />
                  </>
                )}

                {errorDraft.action === 'return' && (
                  <>
                    <label className="field-label">returnValue</label>
                    <input className="field-input" value={errorDraft.returnValue ?? ''} onChange={(e) => setErrorDraft({ ...errorDraft, returnValue: e.target.value })} />
                  </>
                )}

                {errorDraft.action === 'exception' && (
                  <>
                    <label className="field-label">exceptionMessage</label>
                    <input className="field-input" value={errorDraft.exceptionMessage ?? ''} onChange={(e) => setErrorDraft({ ...errorDraft, exceptionMessage: e.target.value })} />
                  </>
                )}

                {errorDraft.action === 'retry' && (
                  <>
                    <label className="field-label">maxAttempts</label>
                    <input className="field-input" type="number" min={1} value={errorDraft.maxAttempts ?? 1} onChange={(e) => setErrorDraft({ ...errorDraft, maxAttempts: Number.parseInt(e.target.value || '1', 10) })} />
                    <label className="field-label">backoffStrategy</label>
                    <select className="field-input" value={errorDraft.backoffStrategy ?? 'fixed'} onChange={(e) => setErrorDraft({ ...errorDraft, backoffStrategy: e.target.value as ErrorEvent['backoffStrategy'] })}>
                      <option value="fixed">fixed</option>
                      <option value="linear">linear</option>
                      <option value="exponential">exponential</option>
                    </select>
                    <label className="field-label">delayMs</label>
                    <input className="field-input" type="number" min={0} value={errorDraft.delayMs ?? 0} onChange={(e) => setErrorDraft({ ...errorDraft, delayMs: Number.parseInt(e.target.value || '0', 10) })} />
                  </>
                )}

                {errorDraft.action === 'skip' && (
                  <>
                    <label className="field-label">skipToStepRef</label>
                    <input className="field-input" value={errorDraft.skipToStepRef ?? ''} onChange={(e) => setErrorDraft({ ...errorDraft, skipToStepRef: e.target.value })} />
                  </>
                )}

                {errorDraft.action === 'compensate' && (
                  <>
                    <label className="field-label">compensationStepRef</label>
                    <input className="field-input" value={errorDraft.compensationStepRef ?? ''} onChange={(e) => setErrorDraft({ ...errorDraft, compensationStepRef: e.target.value })} />
                  </>
                )}

                <label className="field-label">note</label>
                <textarea className="field-input" rows={2} value={errorDraft.note ?? ''} onChange={(e) => setErrorDraft({ ...errorDraft, note: e.target.value })} />

                <div className="dialog-actions">
                  <button className="icon-btn" onClick={closeDialog}>{L('actions.cancel', 'Zrusit')}</button>
                  <button className="icon-btn" onClick={addErrorEvent}>{L('actions.add', 'Pridat')}</button>
                </div>
              </>
            )}

            {addKind === 'entityImpact' && (
              <>
                <h4>Pridat entity impact</h4>
                <label className="field-label">Namespace alias</label>
                <select
                  className="field-input"
                  value={impactDraft.attributeRef?.namespaceAlias ?? ''}
                  onChange={(e) => setImpactDraft({
                    ...impactDraft,
                    attributeRef: {
                      ...(impactDraft.attributeRef ?? { namespaceAlias: '', entity: '', attribute: '' }),
                      namespaceAlias: e.target.value,
                      entity: '',
                      attribute: ''
                    }
                  })}
                >
                  <option value="">--</option>
                  {allAliases.map((alias) => <option key={`impact-alias-${alias}`} value={alias}>{alias}</option>)}
                </select>

                <label className="field-label">Entity</label>
                <select
                  className="field-input"
                  value={impactDraft.attributeRef?.entity ?? ''}
                  onChange={(e) => setImpactDraft({
                    ...impactDraft,
                    attributeRef: {
                      ...(impactDraft.attributeRef ?? { namespaceAlias: '', entity: '', attribute: '' }),
                      entity: e.target.value,
                      attribute: ''
                    }
                  })}
                >
                  <option value="">--</option>
                  {getEntitiesForAlias(impactDraft.attributeRef?.namespaceAlias ?? '').map((entity) => (
                    <option key={`impact-entity-${entity}`} value={entity}>{entity}</option>
                  ))}
                </select>

                <label className="field-label">Attribute</label>
                <select
                  className="field-input"
                  value={impactDraft.attributeRef?.attribute ?? ''}
                  onChange={(e) => setImpactDraft({
                    ...impactDraft,
                    attributeRef: {
                      ...(impactDraft.attributeRef ?? { namespaceAlias: '', entity: '', attribute: '' }),
                      attribute: e.target.value
                    }
                  })}
                >
                  <option value="">--</option>
                  {getAttributesForEntity(impactDraft.attributeRef?.entity ?? '', impactDraft.attributeRef?.namespaceAlias).map((attribute) => (
                    <option key={`impact-attr-${attribute}`} value={attribute}>{attribute}</option>
                  ))}
                </select>

                <label className="field-label">Impact</label>
                <select
                  className="field-input"
                  value={impactDraft.impact}
                  onChange={(e) => setImpactDraft({ ...impactDraft, impact: e.target.value as EntityImpact['impact'] })}
                >
                  {IMPACT_TYPES.map((type) => <option key={`impact-type-${type}`} value={type}>{type}</option>)}
                </select>

                <label className="field-label">Note</label>
                <input className="field-input" value={impactDraft.note ?? ''} onChange={(e) => setImpactDraft({ ...impactDraft, note: e.target.value })} />

                <div className="dialog-actions">
                  <button className="icon-btn" onClick={closeDialog}>{L('actions.cancel', 'Zrusit')}</button>
                  <button className="icon-btn" onClick={addEntityImpact}>{L('actions.add', 'Pridat')}</button>
                </div>
              </>
            )}

            {addKind === 'output' && (
              <>
                <h4>Pridat output</h4>
                <label className="field-label">Variable</label>
                <input className="field-input" value={outputDraft.variable ?? ''} onChange={(e) => setOutputDraft({ ...outputDraft, variable: e.target.value })} />

                <label className="field-label">Description</label>
                <input className="field-input" value={outputDraft.description ?? ''} onChange={(e) => setOutputDraft({ ...outputDraft, description: e.target.value })} />

                <div className="dialog-actions">
                  <button className="icon-btn" onClick={closeDialog}>{L('actions.cancel', 'Zrusit')}</button>
                  <button className="icon-btn" onClick={addOutput}>{L('actions.add', 'Pridat')}</button>
                </div>
              </>
            )}

            {addKind === 'businessRuleRef' && (
              <>
                <h4>Pridat business rule ref</h4>

                <label className="field-label">Namespace alias</label>
                <select
                  className="field-input"
                  value={businessRuleDraft.namespaceAlias ?? ''}
                  onChange={(e) => setBusinessRuleDraft({ namespaceAlias: e.target.value, businessRule: '' })}
                >
                  <option value="">--</option>
                  {modelAliases.map((alias) => <option key={`br-alias-${alias}`} value={alias}>{alias}</option>)}
                </select>

                <label className="field-label">Business rule</label>
                <select
                  className="field-input"
                  value={businessRuleDraft.ruleCode ?? ''}
                  onChange={(e) => setBusinessRuleDraft({ ...businessRuleDraft, ruleCode: e.target.value })}
                  disabled={!businessRuleDraft.namespaceAlias}
                >
                  <option value="">--</option>
                  {getBusinessRulesForAlias(businessRuleDraft.namespaceAlias ?? '').map((ruleCode) => (
                    <option key={`br-rule-${ruleCode}`} value={ruleCode}>{ruleCode}</option>
                  ))}
                </select>

                <div className="dialog-actions">
                  <button className="icon-btn" onClick={closeDialog}>{L('actions.cancel', 'Zrusit')}</button>
                  <button className="icon-btn" onClick={addBusinessRuleRef}>{L('actions.add', 'Pridat')}</button>
                </div>
              </>
            )}

            {addKind === 'actorRef' && (
              <>
                <h4>Pridat aktora</h4>

                <label className="field-label">Namespace alias</label>
                <select
                  className="field-input"
                  value={actorDraft.namespaceAlias ?? ''}
                  onChange={(e) => setActorDraft({ namespaceAlias: e.target.value, actor: '' })}
                >
                  <option value="">--</option>
                  {allAliases.map((alias) => <option key={`actor-alias-${alias}`} value={alias}>{alias}</option>)}
                </select>

                <label className="field-label">Actor</label>
                {getActorsForAlias(actorDraft.namespaceAlias ?? '').length > 0 ? (
                  <select
                    className="field-input"
                    value={actorDraft.actor ?? ''}
                    onChange={(e) => setActorDraft({ ...actorDraft, actor: e.target.value })}
                    disabled={!actorDraft.namespaceAlias}
                  >
                    <option value="">--</option>
                    {getActorsForAlias(actorDraft.namespaceAlias ?? '').map((actor) => (
                      <option key={`actor-${actor}`} value={actor}>{actor}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="field-input"
                    value={actorDraft.actor ?? ''}
                    onChange={(e) => setActorDraft({ ...actorDraft, actor: e.target.value })}
                  />
                )}

                <div className="dialog-actions">
                  <button className="icon-btn" onClick={closeDialog}>{L('actions.cancel', 'Zrusit')}</button>
                  <button className="icon-btn" onClick={addActorRef}>{L('actions.add', 'Pridat')}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
