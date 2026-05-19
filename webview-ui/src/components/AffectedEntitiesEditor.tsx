import React, { useState } from 'react';
import type { EntityImpact } from '../types/sqd';
import { label as L } from '../ui-labels';

interface Output {
  variable: string;
  description?: string;
}

type AffectedItem = EntityImpact | Output;

interface Props {
  affectedEntities: AffectedItem[];
  modelAliases?: string[];
  sqdAliases?: string[];
  getEntitiesForAlias?: (alias: string) => string[];
  onChange: (updated: AffectedItem[]) => void;
}

const IMPACT_TYPES: EntityImpact['impact'][] = ['read', 'write', 'affect'];

interface DraftImpact extends EntityImpact {
  _mode: 'entity' | 'variable';
}

interface DraftOutput extends Output {
  _mode: 'output';
}

type DraftItem = DraftImpact | DraftOutput;

const defaultDraftImpact = (): DraftImpact => ({
  _mode: 'entity',
  impact: 'read',
  entityRef: { namespaceAlias: '', entity: '', attribute: '' }
});

const defaultDraftOutput = (): DraftOutput => ({
  _mode: 'output',
  variable: '',
  description: ''
});

const isOutput = (item: AffectedItem): item is Output => {
  return 'variable' in item && !('impact' in item);
};

const isEntityImpact = (item: AffectedItem): item is EntityImpact => {
  return 'impact' in item;
};

const normalizeDraft = (draft: DraftItem): AffectedItem => {
  if (draft._mode === 'output') {
    return {
      variable: draft.variable,
      description: draft.description
    };
  }
  if (draft._mode === 'variable') {
    return {
      variableRef: draft.variableRef,
      impact: draft.impact,
      note: draft.note
    };
  }
  return {
    entityRef: draft.entityRef,
    impact: draft.impact,
    note: draft.note
  };
};

const summaryItem = (item: AffectedItem): string => {
  if (isOutput(item)) {
    return `[OUTPUT] ${item.variable}${item.description ? ' - ' + item.description : ''}`;
  }
  if (item.variableRef) {
    return `$${item.variableRef} | ${item.impact}${item.note ? ' | ' + item.note : ''}`;
  }
  const entity = item.entityRef?.entity ?? item.entity ?? '-';
  const attr = item.entityRef?.attribute ? `.${item.entityRef.attribute}` : '';
  const ns = item.entityRef?.namespaceAlias ? ` @${item.entityRef.namespaceAlias}` : '';
  return `${entity}${attr}${ns} | ${item.impact}${item.note ? ' | ' + item.note : ''}`;
};

export const AffectedEntitiesEditor: React.FC<Props> = ({
  affectedEntities,
  modelAliases,
  sqdAliases,
  getEntitiesForAlias,
  onChange
}) => {
  const safeAffectedEntities = Array.isArray(affectedEntities) ? affectedEntities : [];
  const [showDialog, setShowDialog] = useState(false);
  const [itemType, setItemType] = useState<'impact' | 'output'>('impact');
  const [draft, setDraft] = useState<DraftItem>(defaultDraftImpact());

  const addItem = () => {
    if (draft._mode === 'output') {
      if (!draft.variable?.trim()) {
        alert(L('validation.variableRequired', 'Názov premennej je povinný'));
        return;
      }
    } else if (draft._mode === 'entity') {
      if (!draft.entityRef?.entity || !draft.entityRef?.namespaceAlias) {
        alert(L('validation.entityRequired', 'Entita a namespace alias sú povinné'));
        return;
      }
    } else {
      if (!draft.variableRef?.trim()) {
        alert(L('validation.variableRequired', 'Názov premennej je povinný'));
        return;
      }
    }

    onChange([...safeAffectedEntities, normalizeDraft(draft)]);
    setDraft(defaultDraftImpact());
    setItemType('impact');
    setShowDialog(false);
  };

  const removeItem = (idx: number) => {
    onChange(safeAffectedEntities.filter((_, i) => i !== idx));
  };

  const allAliases = [...(modelAliases ?? []), ...(sqdAliases ?? [])];

  return (
    <div className="affected-entities-editor">
      <div className="panel-head compact">
        <label className="field-label">{L('sections.affectedEntities', 'Ovplyvnené entity a výstupy:')}</label>
        <button className="icon-btn" onClick={() => setShowDialog(true)}>
          + {L('actions.add', 'Pridať')}
        </button>
      </div>

      {safeAffectedEntities.length === 0 && <span className="muted">{L('empty.noItems', 'Žiadne položky')}</span>}

      {safeAffectedEntities.map((item, idx) => (
        <div key={idx} className="impact-summary">
          {summaryItem(item)}
          <button className="btn-link" onClick={() => removeItem(idx)}>
            [ {L('actions.delete', 'Zmazať')} ]
          </button>
        </div>
      ))}

      {showDialog && (
        <div className="dialog-overlay" onClick={() => setShowDialog(false)}>
          <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
            <h4>{L('dialogs.addAffectedEntity', 'Pridať ovplyvnovanú entitu/premennú alebo výstup')}</h4>

            {/* ITEM TYPE SELECTOR */}
            <label className="field-label">{L('affectedEntities.itemType', 'Typ položky')}</label>
            <select
              className="field-input"
              value={itemType}
              onChange={(e) => {
                const type = e.target.value as 'impact' | 'output';
                setItemType(type);
                setDraft(type === 'output' ? defaultDraftOutput() : defaultDraftImpact());
              }}
            >
              <option value="impact">Vplyv na entitu/premennú</option>
              <option value="output">Výstupná premenná</option>
            </select>

            {/* OUTPUT MODE */}
            {itemType === 'output' && draft._mode === 'output' && (
              <>
                <label className="field-label">{L('fields.variableRef', 'Názov výstupnej premennej')}</label>
                <input
                  className="field-input"
                  type="text"
                  value={draft.variable}
                  onChange={(e) => setDraft({ ...draft, variable: e.target.value })}
                  placeholder={L('placeholders.variableRef', 'napr. result, processedId')}
                />

                <label className="field-label">{L('fields.description', 'Popis (voliteľne)')}</label>
                <input
                  className="field-input"
                  type="text"
                  value={draft.description ?? ''}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder={L('placeholders.description', 'Čo táto premenná reprezentuje')}
                />
              </>
            )}

            {/* IMPACT MODE */}
            {itemType === 'impact' && draft._mode !== 'output' && (
              <>
                <label className="field-label">{L('affectedEntities.mode', 'Režim')}</label>
                <select
                  className="field-input"
                  value={draft._mode === 'entity' ? 'entityRef' : 'variable'}
                  onChange={(e) => {
                    const mode = e.target.value;
                    if (mode === 'entityRef') {
                      setDraft(defaultDraftImpact());
                    } else {
                      setDraft({ ...defaultDraftImpact(), _mode: 'variable', entityRef: undefined, variableRef: '' });
                    }
                  }}
                >
                  <option value="entityRef">Entita</option>
                  <option value="variable">Premenná</option>
                </select>

                {/* ENTITY MODE */}
                {draft._mode === 'entity' && (
                  <>
                    <label className="field-label">{L('fields.namespaceAlias', 'Namespace alias')}</label>
                    <select
                      className="field-input"
                      value={draft.entityRef?.namespaceAlias ?? ''}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...(prev as DraftImpact),
                          entityRef: {
                            ...((prev as DraftImpact).entityRef ?? { namespaceAlias: '', entity: '', attribute: '' }),
                            namespaceAlias: e.target.value
                          }
                        }))
                      }
                    >
                      <option value="">{L('select.choose', '-- Zvolte --')}</option>
                      {allAliases.map((alias) => (
                        <option key={alias} value={alias}>
                          {alias}
                        </option>
                      ))}
                    </select>

                    <label className="field-label">{L('fields.entity', 'Entita')}</label>
                    <select
                      className="field-input"
                      value={draft.entityRef?.entity ?? ''}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...(prev as DraftImpact),
                          entityRef: {
                            ...((prev as DraftImpact).entityRef ?? { namespaceAlias: '', entity: '', attribute: '' }),
                            entity: e.target.value
                          }
                        }))
                      }
                      disabled={!draft.entityRef?.namespaceAlias}
                    >
                      <option value="">{L('select.choose', '-- Zvolte --')}</option>
                      {draft.entityRef?.namespaceAlias &&
                        (getEntitiesForAlias?.(draft.entityRef.namespaceAlias) ?? []).map((entity) => (
                          <option key={entity} value={entity}>
                            {entity}
                          </option>
                        ))}
                    </select>

                    <label className="field-label">{L('fields.attribute', 'Atribút (voliteľne)')}</label>
                    <input
                      className="field-input"
                      type="text"
                      value={draft.entityRef?.attribute ?? ''}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...(prev as DraftImpact),
                          entityRef: {
                            ...((prev as DraftImpact).entityRef ?? { namespaceAlias: '', entity: '', attribute: '' }),
                            attribute: e.target.value
                          }
                        }))
                      }
                      placeholder={L('placeholders.attributeName', 'napr. id, status, dátum')}
                    />
                  </>
                )}

                {/* VARIABLE MODE */}
                {draft._mode === 'variable' && (
                  <>
                    <label className="field-label">{L('fields.variableRef', 'Názov premennej')}</label>
                    <input
                      className="field-input"
                      type="text"
                      value={draft.variableRef ?? ''}
                      onChange={(e) => setDraft({ ...draft, variableRef: e.target.value })}
                      placeholder={L('placeholders.variableRef', 'napr. result, processedId, count')}
                    />
                  </>
                )}

                {/* COMMON FIELDS */}
                <label className="field-label">{L('fields.impact', 'Typ vplyvu')}</label>
                <select
                  className="field-input"
                  value={draft.impact}
                  onChange={(e) => setDraft((prev) => ({ ...prev, impact: e.target.value as EntityImpact['impact'] }))}
                >
                  {IMPACT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>

                <label className="field-label">{L('fields.note', 'Poznámka (voliteľne)')}</label>
                <textarea
                  className="field-input field-textarea"
                  value={draft.note ?? ''}
                  onChange={(e) => setDraft((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder={L('placeholders.note', 'Podrobný popis - čo sa číta/změní, prečo, ďalší kontext...')}
                  rows={4}
                />
              </>
            )}

            <div className="dialog-actions">
              <button className="btn-secondary" onClick={() => setShowDialog(false)}>
                {L('actions.cancel', 'Zrušiť')}
              </button>
              <button className="btn-primary" onClick={addItem}>
                {L('actions.add', 'Pridať')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
