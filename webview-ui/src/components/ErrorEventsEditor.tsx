import React, { useState } from 'react';
import type { ErrorEvent, ErrorEventAction } from '../types/sqd';
import { label as L } from '../ui-labels';

interface Props {
  errorEvents: ErrorEvent[];
  namespaceAliases?: string[];
  getEventsForAlias?: (alias: string) => string[];
  onChange: (updated: ErrorEvent[]) => void;
}

const ACTIONS: ErrorEventAction[] = [
  'emit',
  'fallback',
  'return',
  'exception',
  'retry',
  'skip',
  'compensate'
];

const defaultErrorEvent = (): ErrorEvent => ({
  condition: '',
  eventRef: {
    namespaceAlias: 'local',
    event: ''
  },
  action: 'emit'
});

const summary = (item: ErrorEvent): string => {
  const condition = item.condition?.trim() || '-';
  const eventCode = `${item.eventRef?.namespaceAlias ?? '-'}:${item.eventRef?.event ?? '-'}`;
  const action = item.action ?? 'emit';
  return `${condition} -> ${eventCode} [${action}]`;
};

export const ErrorEventsEditor: React.FC<Props> = ({
  errorEvents,
  namespaceAliases = [],
  getEventsForAlias = () => [],
  onChange
}) => {
  const safeItems = Array.isArray(errorEvents) ? errorEvents : [];
  const [showDialog, setShowDialog] = useState(false);
  const [draft, setDraft] = useState<ErrorEvent>(defaultErrorEvent());

  const resetDraft = () => {
    setDraft(defaultErrorEvent());
  };

  const addItem = () => {
    if (!draft.condition?.trim()) {
      alert(L('validation.conditionRequired', 'Condition je povinna'));
      return;
    }

    if (!draft.eventRef?.namespaceAlias?.trim()) {
      alert(L('validation.namespaceRequired', 'Namespace alias je povinny'));
      return;
    }

    onChange([...safeItems, draft]);
    resetDraft();
    setShowDialog(false);
  };

  const removeItem = (idx: number) => {
    onChange(safeItems.filter((_, i) => i !== idx));
  };

  const aliases = Array.from(new Set(['local', ...namespaceAliases.filter(Boolean)]));
  const selectedAlias = draft.eventRef?.namespaceAlias ?? '';

  return (
    <div className="error-events-editor" style={{ marginTop: 12 }}>
      <div className="panel-head compact">
        <label className="field-label">{L('sections.errorEvents', 'Error events:')}</label>
        <button className="icon-btn" onClick={() => setShowDialog(true)}>
          + {L('actions.add', 'Pridat')}
        </button>
      </div>

      {safeItems.length === 0 && <span className="muted">{L('empty.noItems', 'Ziadne polozky')}</span>}

      {safeItems.map((item, idx) => (
        <div key={idx} className="impact-summary">
          {summary(item)}
          <button className="btn-link" onClick={() => removeItem(idx)}>
            [ {L('actions.delete', 'Zmazat')} ]
          </button>
        </div>
      ))}

      {showDialog && (
        <div className="dialog-overlay" onClick={() => setShowDialog(false)}>
          <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
            <h4>{L('dialogs.addErrorEvent', 'Pridat error event')}</h4>

            <label className="field-label">{L('fields.condition', 'Condition')}</label>
            <input
              className="field-input"
              type="text"
              value={draft.condition ?? ''}
              onChange={(e) => setDraft({ ...draft, condition: e.target.value })}
              placeholder={L('placeholders.condition', 'napr. timeout > 5 min')}
            />

            <label className="field-label">{L('fields.namespaceAlias', 'Namespace alias')}</label>
            <select
              className="field-input"
              value={selectedAlias}
              onChange={(e) => setDraft({
                ...draft,
                eventRef: {
                  ...(draft.eventRef ?? { namespaceAlias: 'local', event: '' }),
                  namespaceAlias: e.target.value,
                  event: ''
                }
              })}
            >
              {aliases.map((alias) => (
                <option key={alias} value={alias}>{alias}</option>
              ))}
            </select>

            <label className="field-label">{L('fields.event', 'Event')}</label>
            <select
              className="field-input"
              value={draft.eventRef?.event ?? ''}
              onChange={(e) => setDraft({
                ...draft,
                eventRef: {
                  ...(draft.eventRef ?? { namespaceAlias: 'local', event: '' }),
                  event: e.target.value
                }
              })}
            >
              <option value="">--</option>
              {getEventsForAlias(selectedAlias).map((eventCode) => (
                <option key={eventCode} value={eventCode}>{eventCode}</option>
              ))}
            </select>

            <label className="field-label">{L('fields.action', 'Action')}</label>
            <select
              className="field-input"
              value={draft.action ?? 'emit'}
              onChange={(e) => setDraft({ ...draft, action: e.target.value as ErrorEventAction })}
            >
              {ACTIONS.map((action) => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>

            {draft.action === 'fallback' && (
              <>
                <label className="field-label">{L('fields.fallbackStepRef', 'Fallback step ref')}</label>
                <input
                  className="field-input"
                  type="text"
                  value={draft.fallbackStepRef ?? ''}
                  onChange={(e) => setDraft({ ...draft, fallbackStepRef: e.target.value })}
                />
              </>
            )}

            {draft.action === 'return' && (
              <>
                <label className="field-label">{L('fields.returnValue', 'Return value')}</label>
                <input
                  className="field-input"
                  type="text"
                  value={draft.returnValue ?? ''}
                  onChange={(e) => setDraft({ ...draft, returnValue: e.target.value })}
                />
              </>
            )}

            {draft.action === 'exception' && (
              <>
                <label className="field-label">{L('fields.exceptionMessage', 'Exception message')}</label>
                <input
                  className="field-input"
                  type="text"
                  value={draft.exceptionMessage ?? ''}
                  onChange={(e) => setDraft({ ...draft, exceptionMessage: e.target.value })}
                />
              </>
            )}

            {draft.action === 'retry' && (
              <>
                <label className="field-label">{L('fields.maxAttempts', 'Max attempts')}</label>
                <input
                  className="field-input"
                  type="number"
                  min={1}
                  value={draft.maxAttempts ?? 1}
                  onChange={(e) => setDraft({ ...draft, maxAttempts: Number.parseInt(e.target.value || '1', 10) })}
                />

                <label className="field-label">{L('fields.backoffStrategy', 'Backoff strategy')}</label>
                <select
                  className="field-input"
                  value={draft.backoffStrategy ?? 'fixed'}
                  onChange={(e) => setDraft({ ...draft, backoffStrategy: e.target.value as ErrorEvent['backoffStrategy'] })}
                >
                  <option value="fixed">fixed</option>
                  <option value="linear">linear</option>
                  <option value="exponential">exponential</option>
                </select>

                <label className="field-label">{L('fields.delayMs', 'Delay (ms)')}</label>
                <input
                  className="field-input"
                  type="number"
                  min={0}
                  value={draft.delayMs ?? 0}
                  onChange={(e) => setDraft({ ...draft, delayMs: Number.parseInt(e.target.value || '0', 10) })}
                />
              </>
            )}

            {draft.action === 'skip' && (
              <>
                <label className="field-label">{L('fields.skipToStepRef', 'Skip to step ref')}</label>
                <input
                  className="field-input"
                  type="text"
                  value={draft.skipToStepRef ?? ''}
                  onChange={(e) => setDraft({ ...draft, skipToStepRef: e.target.value })}
                />
              </>
            )}

            {draft.action === 'compensate' && (
              <>
                <label className="field-label">{L('fields.compensationStepRef', 'Compensation step ref')}</label>
                <input
                  className="field-input"
                  type="text"
                  value={draft.compensationStepRef ?? ''}
                  onChange={(e) => setDraft({ ...draft, compensationStepRef: e.target.value })}
                />
              </>
            )}

            <label className="field-label">{L('fields.note', 'Poznamka (volitelne)')}</label>
            <textarea
              className="field-input field-textarea"
              rows={3}
              value={draft.note ?? ''}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            />

            <div className="dialog-actions">
              <button className="btn-secondary" onClick={() => setShowDialog(false)}>{L('actions.cancel', 'Zrusit')}</button>
              <button className="btn-primary" onClick={addItem}>{L('actions.add', 'Pridat')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
