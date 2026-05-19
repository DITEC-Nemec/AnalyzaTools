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
  const L = (path: string, fallback: string) => {
    const direct = label(`${prefix}.${path}`, '');
    if (direct) {
      return direct;
    }

    if (!path.startsWith('actors.')) {
      return fallback;
    }

    const rest = path.slice('actors.'.length);
    const view = label(`${prefix}.actors.view.${rest}`, '');
    if (view) {
      return view;
    }

    const form = label(`${prefix}.actors.form.${rest}`, '');
    if (form) {
      return form;
    }

    return fallback;
  };

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <strong>{L('actors.title', 'Actors')}</strong>
        <button type="button" onClick={addActorRef}>{L('actors.add', '+ Actor')}</button>
      </div>

      {(actorRefs ?? []).length === 0 && (
        <p style={{ opacity: 0.75 }}>{L('actors.empty', 'No actors')}</p>
      )}

      {(actorRefs ?? []).map((item, index) => {
        const options = getAvailableActors?.(item.namespaceAlias) ?? [];
        const showSelect = options.length > 0;

        return (
          <div key={`${item.namespaceAlias}-${item.actor}-${index}`} style={{ marginBottom: 16 }}>
            <label>{L('actors.namespaceAlias', 'namespaceAlias')}</label>
            <select
              value={item.namespaceAlias}
              onChange={(e) => updateActorRef(index, { namespaceAlias: e.target.value, actor: '' })}
            >
              <option value="">—</option>
              {namespaceAliases.map(alias => (
                <option key={alias} value={alias}>{alias}</option>
              ))}
            </select>

            <label>{L('actors.actor', 'actor')}</label>
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

            <div style={{ marginTop: 8 }}>
              <button type="button" onClick={() => removeActorRef(index)}>{L('common.delete', 'Delete')}</button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
