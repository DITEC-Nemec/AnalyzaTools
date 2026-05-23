import React from 'react';
import type { NamespaceEntity } from '../types/sqd';
import { vscodeApi } from './main';
import { label } from '../ui-labels';

interface Props {
  namespaceRefList: NamespaceEntity[];
  onChange: (updated: NamespaceEntity[]) => void;
}

export const NamespaceRefPanel: React.FC<Props> = ({ namespaceRefList, onChange }) => {
  const L = (p: string, fallback: string) => label(`algorithm.namespaceRef.${p}`, fallback);

  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(
    namespaceRefList.length > 0 ? 0 : null
  );

  React.useEffect(() => {
    if (namespaceRefList.length === 0) {
      setSelectedIndex(null);
    } else if (selectedIndex === null) {
      setSelectedIndex(0);
    } else if (selectedIndex >= namespaceRefList.length) {
      setSelectedIndex(namespaceRefList.length - 1);
    }
  }, [namespaceRefList, selectedIndex]);

  // Listen for filePicked messages from extension
  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type !== 'filePicked') { return; }
      const newEntry: NamespaceEntity = {
        alias: msg.alias ?? '',
        filePath: msg.filePath ?? '',
        sourceType: msg.sourceType ?? 'model'
      };
      const next = [...namespaceRefList, newEntry];
      onChange(next);
      setSelectedIndex(next.length - 1);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [namespaceRef, onChange]);

  const pickFile = () => {
    vscodeApi.postMessage({ type: 'pickFile' });
  };

  const addManual = () => {
    const next = [...namespaceRefList, { alias: '', filePath: '', sourceType: 'model' as const }];
    onChange(next);
    setSelectedIndex(next.length - 1);
  };

  const remove = (index: number) => {
    const next = namespaceRefList.filter((_, i) => i !== index);
    onChange(next);
    setSelectedIndex(next.length === 0 ? null : Math.min(index, next.length - 1));
  };

  const update = (index: number, patch: Partial<NamespaceEntity>) => {
    const next = namespaceRefList.map((item, i) => i === index ? { ...item, ...patch } : item);
    onChange(next);
  };

  const selected = selectedIndex !== null ? namespaceRefList[selectedIndex] ?? null : null;

  return (
    <div className="namespace-panel">
      <div className="namespace-panel-head">
        <span className="namespace-panel-title">{L('title', 'Menné priestory (namespaceRef)')}</span>
        <div className="namespace-panel-actions">
          <button className="btn-sm" title={L('pickFile', 'Vybrať súbor')} onClick={pickFile}>
            📂 {L('pickFile', 'Vybrať súbor')}
          </button>
          <button className="btn-sm" title={L('addManual', 'Pridať ručne')} onClick={addManual}>
            + {L('addManual', 'Ručne')}
          </button>
        </div>
      </div>

      {namespaceRefList.length === 0 ? (
        <p className="namespace-empty">{L('empty', 'Žiadne menné priestory.')}</p>
      ) : (
        <table className="namespace-table">
          <thead>
            <tr>
              <th>{L('col.alias', 'Alias')}</th>
              <th>{L('col.sourceType', 'Typ')}</th>
              <th>{L('col.filePath', 'Súbor')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {namespaceRefList.map((item, i) => (
              <tr
                key={`${item.alias}-${i}`}
                className={selectedIndex === i ? 'selected' : ''}
                onClick={() => setSelectedIndex(i)}
              >
                <td>{item.alias || '-'}</td>
                <td>{item.sourceType || '-'}</td>
                <td className="ns-filepath">{item.filePath || '-'}</td>
                <td>
                  {item.sourceType !== 'current' && (
                    <button
                      className="btn-icon"
                      title={L('remove', 'Odstrániť')}
                      onClick={(e) => { e.stopPropagation(); remove(i); }}
                    >✕</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selected && selectedIndex !== null && selected.sourceType !== 'current' && (
        <div className="namespace-detail">
          <label>{L('alias', 'Alias')}</label>
          <input
            value={selected.alias}
            onChange={(e) => update(selectedIndex, { alias: e.target.value })}
          />
          <label>{L('sourceType', 'Typ zdroja')}</label>
          <select
            value={selected.sourceType}
            onChange={(e) => update(selectedIndex, { sourceType: e.target.value as NamespaceEntity['sourceType'] })}
          >
            <option value="model">model</option>
            <option value="sqd">sqd</option>
          </select>
          <label>{L('filePath', 'Cesta k súboru (relatívna od workspace)')}</label>
          <input
            value={selected.filePath}
            onChange={(e) => update(selectedIndex, { filePath: e.target.value })}
          />
        </div>
      )}
    </div>
  );
};
