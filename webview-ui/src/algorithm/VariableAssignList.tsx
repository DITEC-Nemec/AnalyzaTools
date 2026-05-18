import React from 'react';
import type { ParameterMap } from '../types/sqd';

interface Props {
  value: ParameterMap[];
  onChange: (value: ParameterMap[]) => void;
}

export const VariableAssignList: React.FC<Props> = ({ value, onChange }) => {
  const handleAdd = () => {
    onChange([...value, { parameter: '', value: '' }]);
  };
  const handleRemove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };
  const handleChange = (idx: number, field: 'parameter' | 'value', fieldValue: string) => {
    const next = value.map((item, i) =>
      i === idx ? { ...item, [field]: fieldValue, variable: undefined } : item
    );
    onChange(next);
  };
  const handleMove = (idx: number, dir: -1 | 1) => {
    const next = [...value];
    const target = idx + dir;
    if (target < 0 || target >= value.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };
  return (
    <div>
      {value.map((item, idx) => (
        <div key={idx} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 2 }}>
          <input
            style={{ width: 120 }}
            placeholder="parameter"
            value={item.parameter ?? item.variable ?? ''}
            onChange={e => handleChange(idx, 'parameter', e.target.value)}
          />
          <span>=</span>
          <input
            style={{ width: 120 }}
            placeholder="value"
            value={item.value}
            onChange={e => handleChange(idx, 'value', e.target.value)}
          />
          <button type="button" onClick={() => handleMove(idx, -1)} disabled={idx === 0}>↑</button>
          <button type="button" onClick={() => handleMove(idx, 1)} disabled={idx === value.length - 1}>↓</button>
          <button type="button" onClick={() => handleRemove(idx)}>✕</button>
        </div>
      ))}
      <button type="button" onClick={handleAdd}>+ Pridať mapovanie</button>
    </div>
  );
};
