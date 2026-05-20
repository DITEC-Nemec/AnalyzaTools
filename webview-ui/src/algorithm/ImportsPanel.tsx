import React, { useState } from 'react';
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
 * Shows available namespaces from meta.namespaceRef and lets user toggle them
 */
export const ImportsPanel: React.FC<ImportsPanelProps> = ({
  imports: currentImports,
  availableNamespaces,
  onChange
}) => {
  const [showDropdown, setShowDropdown] = useState(false);

  // Local is always imported
  const imports = currentImports.includes('local') 
    ? currentImports 
    : ['local', ...currentImports];

  const toggleImport = (alias: string) => {
    if (alias === 'local') {
      // Cannot remove 'local'
      return;
    }

    const updated = imports.includes(alias)
      ? imports.filter(a => a !== alias)
      : [...imports, alias];

    onChange(updated);
  };

  const removeImport = (alias: string) => {
    if (alias === 'local') {
      // Cannot remove 'local'
      return;
    }

    const updated = imports.filter(a => a !== alias);
    onChange(updated);
  };

  // Get aliases NOT yet imported
  const unimportedAliases = availableNamespaces
    .map(ns => ns.alias)
    .filter(alias => !imports.includes(alias));

  return (
    <div className="imports-panel">
      <div className="imports-header">
        <h4>{L('title', 'Namespace Imports')}</h4>
        <span className="imports-hint">
          {L('hint', 'Select namespaces to import (local always included)')}
        </span>
      </div>

      <div className="imports-list">
        {imports.map(alias => {
          const namespace = availableNamespaces.find(ns => ns.alias === alias);
          return (
            <div key={alias} className="import-item">
              <span className="import-alias">
                {alias}
                {alias === 'local' && <span className="badge">default</span>}
              </span>
              <span className="import-path">{namespace?.filePath || 'unknown'}</span>
              {alias !== 'local' && (
                <button
                  className="import-remove"
                  onClick={() => removeImport(alias)}
                  title={L('remove', 'Remove this import')}
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      {unimportedAliases.length > 0 && (
        <div className="imports-add">
          <div className="dropdown-wrapper">
            <button
              className="add-import-btn"
              onClick={() => setShowDropdown(!showDropdown)}
            >
              {L('add', '+ Add Namespace')}
            </button>

            {showDropdown && (
              <div className="dropdown-menu">
                {unimportedAliases.map(alias => {
                  const namespace = availableNamespaces.find(ns => ns.alias === alias);
                  return (
                    <button
                      key={alias}
                      className="dropdown-item"
                      onClick={() => {
                        toggleImport(alias);
                        setShowDropdown(false);
                      }}
                    >
                      <span className="dropdown-alias">{alias}</span>
                      <span className="dropdown-path">{namespace?.filePath}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
