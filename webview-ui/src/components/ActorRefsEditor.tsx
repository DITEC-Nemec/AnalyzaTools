import React from 'react';
import type { ActorRef } from '../types/sqd';
import { label } from '../ui-labels';

interface Props {
  actorRefs: ActorRef[];
  namespaceAliases?: string[];
  getAvailableActors?: (namespaceAlias?: string) => string[];
  onChange: (actorRefs: ActorRef[]) => void;
  prefix: 'algorithm' | 'domain';
}

export const ActorRefsEditor: React.FC<Props> = ({
  actorRefs,
  namespaceAliases = [],
  getAvailableActors,
  onChange,
  prefix
}) => {
  const viewBase = prefix === 'domain' ? 'actors.view' : 'actors';
  const formBase = prefix === 'domain' ? 'actors.form' : 'actors';
  const LV = (key: string, fallback: string) => label(`${prefix}.${viewBase}.${key}`, fallback);
  const LF = (key: string, fallback: string) => label(`${prefix}.${formBase}.${key}`, fallback);

  const addActorRef = () => {
    const defaultAlias = namespaceAliases.includes('local') ? 'local' : (namespaceAliases[0] ?? 'local');
    onChange([...(actorRefs ?? []), { namespaceAlias: defaultAlias, actor: '' }]);
  };

  const updateActorRef = (index: number, patch: Partial<ActorRef>) => {
    const next = [...(actorRefs ?? [])];
    const current = next[index] ?? { namespaceAlias: 'local', actor: '' };
    next[index] = { ...current, ...patch };
    onChange(next);
  };

  const removeActorRef = (index: number) => {
    onChange((actorRefs ?? []).filter((_, i) => i !== index));
  };

  return (
    <div>
      <label className="field-label">{LV('title', 'Actors')}</label>

      {(actorRefs ?? []).length === 0 && (
        <div className="muted">{LV('empty', 'No actors')}</div>
      )}

      {(actorRefs ?? []).map((item, index) => {
        const options = getAvailableActors?.(item.namespaceAlias) ?? [];
        const showSelect = options.length > 0;

        return (
          <div key={`${item.namespaceAlias}-${item.actor}-${index}`} className="impact-summary" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
            <label>{LF('namespaceAlias', 'namespaceAlias')}</label>
            <select
              value={item.namespaceAlias}
              onChange={(e) => updateActorRef(index, { namespaceAlias: e.target.value, actor: '' })}
            >
              <option value="">—</option>
              {namespaceAliases.map(alias => (
                <option key={alias} value={alias}>{alias}</option>
              ))}
            </select>

            <label>{LF('actor', 'actor')}</label>
            {showSelect ? (
              <select
                value={item.actor}
                onChange={(e) => updateActorRef(index, { actor: e.target.value })}
              >
                <option value="">—</option>
                {options.map(actor => (
                  <option key={actor} value={actor}>{actor}</option>
                ))}
              </select>
            ) : (
              <input
                value={item.actor}
                onChange={(e) => updateActorRef(index, { actor: e.target.value })}
              />
            )}

            <button className="btn-link" type="button" onClick={() => removeActorRef(index)}>[ {label(`${prefix}.common.delete`, 'Delete')} ]</button>
          </div>
        );
      })}
    </div>
  );
};
