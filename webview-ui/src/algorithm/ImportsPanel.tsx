import React, { useMemo, useState } from 'react';
import type { NamespaceEntity } from '../types/sqd';
import { label as rawLabel } from '../ui-labels';

const L = (path: string, fallback: string) => rawLabel(`algorithm.importsPanel.${path}`, fallback);

interface ImportsPanelProps {
  imports: string[];
  availableNamespaces: NamespaceEntity[];
  onChange: (imports: string[]) => void;
}

/**
 * ImportsPanel - allows users to select which namespaces to import
 * Shows available namespaces from meta.namespaceRefList and lets user toggle them
 */
export const ImportsPanel: React.FC<ImportsPanelProps> = ({
  imports: currentImports,
  availableNamespaces,
  onChange
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [filter, setFilter] = useState('');

  // Local is always imported
  const imports = currentImports.includes('local') 
    ? currentImports 
    : ['local', ...currentImports];

  const removeImport = (alias: string) => {
    if (alias === 'local') {
      // Cannot remove 'local'
      return;
    }

    const updated = imports.filter(a => a !== alias);
    onChange(updated);
  };

  const availableByAlias = useMemo(
    () => new Map(availableNamespaces.map(ns => [ns.alias, ns])),
    [availableNamespaces]
  );

  // Get aliases NOT yet imported
  const unimportedAliases = useMemo(
    () => availableNamespaces
      .map(ns => ns.alias)
      .filter(alias => !imports.includes(alias)),
    [availableNamespaces, imports]
  );

  const filteredAliases = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) {
      return unimportedAliases;
    }

    return unimportedAliases.filter((alias) => {
      const namespace = availableByAlias.get(alias);
      const haystack = `${alias} ${namespace?.filePath ?? ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [availableByAlias, filter, unimportedAliases]);

  const addImport = (alias: string) => {
    if (!alias || alias === 'local' || imports.includes(alias)) {
      return;
    }

    onChange([...imports, alias]);
    setFilter('');
    setShowPicker(false);
  };

  return (
    <div className="imports-panel">
      <div className="imports-header">
        <h4>{L('title', 'Namespace Imports')}</h4>
        <span className="imports-hint">
          {L('hint', 'Select namespaces to import (local always included)')}
        </span>
      </div>

      <table className="dm-table">
        <thead>
          <tr>
            <th>{L('columns.alias', 'Alias')}</th>
            <th>{L('columns.path', 'Path')}</th>
            <th>{L('columns.actions', 'Actions')}</th>
          </tr>
        </thead>
        <tbody>
          {imports.map(alias => {
            const namespace = availableByAlias.get(alias);
            return (
              <tr key={alias}>
                <td>{alias === 'local' ? `${alias} (default)` : alias}</td>
                <td>{namespace?.filePath || 'current file'}</td>
                <td>
                  {alias !== 'local' && (
                    <button
                      className="icon-btn"
                      onClick={() => removeImport(alias)}
                      title={L('remove', 'Remove this import')}
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {unimportedAliases.length > 0 && (
        <div className="imports-add">
          <div className="imports-picker">
            <button
              className="add-import-btn"
              onClick={() => setShowPicker((prev) => !prev)}
            >
              {L('add', '+ Add Namespace')}
            </button>

            {showPicker && (
              <div className="imports-picker-menu">
                <input
                  className="field-input"
                  placeholder={L('search', 'Search alias...')}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
                <div className="imports-picker-list">
                  {filteredAliases.map(alias => {
                    const namespace = availableByAlias.get(alias);
                    return (
                      <button
                        key={alias}
                        className="imports-picker-item"
                        onClick={() => addImport(alias)}
                      >
                        <span>{alias}</span>
                        <span>{namespace?.filePath}</span>
                      </button>
                    );
                  })}
                </div>
                {filteredAliases.length === 0 && (
                  <div className="muted">{L('noResults', 'No aliases found')}</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
