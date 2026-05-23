/**
 * Cascade reference select components for entityRef, entityFunctionRef,
 * sqdRef, eventRef and simpleTypeRef.
 *
 * All components receive `namespaceData` (parsed content from all referenced files)
 * and render a cascade of combobox/select inputs.
 */
import React from 'react';
import type {
  NamespaceData,
  NamespaceDataEntry,
  ReferenceAttribute,
  ReferenceEntity,
  ReferenceEntityFunction,
  ReferenceSqd,
  ReferenceEvent,
  SimpleTypeRef
} from '../types/sqd';

// ─── Helpers ───────────────────────────────────────────────────────────────────

type SourceFilter = 'model' | 'sqd' | 'any';

function aliasOptions(namespaceData: NamespaceData, filter: SourceFilter): string[] {
  return (Object.values(namespaceData) as NamespaceDataEntry[])
    .filter(e => filter === 'any' || e.sourceType === filter || e.sourceType === 'current')
    .map(e => e.alias);
}

interface ComboProps {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
}

const ComboSelect: React.FC<ComboProps> = ({ label: lbl, value, options, onChange, placeholder }) => (
  <div className="ref-field">
    <label className="field-label">{lbl}</label>
    <input
      className="field-input"
      list={`list-${lbl.replace(/\s+/g, '-')}-${Math.random().toString(36).slice(2)}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? lbl}
    />
    <datalist id={`list-${lbl.replace(/\s+/g, '-')}-${Math.random().toString(36).slice(2)}`}>
      {options.map(opt => <option key={opt} value={opt} />)}
    </datalist>
  </div>
);

// ─── AttributeRefSelect ───────────────────────────────────────────────────────────

interface AttributeRefSelectProps {
  value: ReferenceAttribute;
  namespaceData: NamespaceData;
  onChange: (v: ReferenceAttribute) => void;
}

export const AttributeRefSelect: React.FC<AttributeRefSelectProps> = ({ value, namespaceData, onChange }) => {
  const aliases = aliasOptions(namespaceData, 'model');
  const nsEntry = value.namespaceAlias ? namespaceData[value.namespaceAlias] : undefined;
  const entities = nsEntry?.entities?.map((e: { name: string }) => e.name) ?? [];
  const attributes = nsEntry?.entities?.find((e: { name: string }) => e.name === value.entity)?.attributes ?? [];

  return (
    <div className="ref-group">
      <ComboSelect
        label="namespaceAlias"
        value={value.namespaceAlias ?? ''}
        options={aliases}
        onChange={(v) => onChange({ ...value, namespaceAlias: v, entity: '', attribute: '' })}
      />
      <ComboSelect
        label="entity"
        value={value.entity ?? ''}
        options={entities}
        onChange={(v) => onChange({ ...value, entity: v, attribute: '' })}
      />
      <ComboSelect
        label="attribute"
        value={value.attribute ?? ''}
        options={attributes}
        onChange={(v) => onChange({ ...value, attribute: v })}
      />
    </div>
  );
};
// ─── EntityRefSelect ───────────────────────────────────────────────────────────

interface EntityRefSelectProps {
  value: ReferenceEntity;
  namespaceData: NamespaceData;
  onChange: (v: ReferenceEntity) => void;
}

export const EntityRefSelect: React.FC<EntityRefSelectProps> = ({ value, namespaceData, onChange }) => {
  const aliases = aliasOptions(namespaceData, 'model');
  const nsEntry = value.namespaceAlias ? namespaceData[value.namespaceAlias] : undefined;
  const entities = nsEntry?.entities?.map((e: { name: string }) => e.name) ?? [];

  return (
    <div className="ref-group">
      <ComboSelect
        label="namespaceAlias"
        value={value.namespaceAlias ?? ''}
        options={aliases}
        onChange={(v) => onChange({ ...value, namespaceAlias: v, entity: '' })}
      />
      <ComboSelect
        label="entity"
        value={value.entity ?? ''}
        options={entities}
        onChange={(v) => onChange({ ...value, entity: v })}
      />
     
    </div>
  );
};

// ─── EntityFunctionRefSelect ───────────────────────────────────────────────────

interface EntityFunctionRefSelectProps {
  value: ReferenceEntityFunction;
  namespaceData: NamespaceData;
  onChange: (v: ReferenceEntityFunction) => void;
}

export const EntityFunctionRefSelect: React.FC<EntityFunctionRefSelectProps> = ({ value, namespaceData, onChange }) => {
  const aliases = aliasOptions(namespaceData, 'model');
  const nsEntry = value.namespaceAlias ? namespaceData[value.namespaceAlias] : undefined;
  const entities = nsEntry?.entities?.map((e: { name: string }) => e.name) ?? [];
  const functions = nsEntry?.entities?.find((e: { name: string }) => e.name === value.entity)?.functions ?? [];

  return (
    <div className="ref-group">
      <ComboSelect
        label="namespaceAlias"
        value={value.namespaceAlias ?? ''}
        options={aliases}
        onChange={(v) => onChange({ ...value, namespaceAlias: v, entity: '', function: '' })}
      />
      <ComboSelect
        label="entity"
        value={value.entity ?? ''}
        options={entities}
        onChange={(v) => onChange({ ...value, entity: v, function: '' })}
      />
      <ComboSelect
        label="function"
        value={value.function ?? ''}
        options={functions}
        onChange={(v) => onChange({ ...value, function: v })}
      />
    </div>
  );
};

// ─── SqdRefSelect ──────────────────────────────────────────────────────────────

interface SqdRefSelectProps {
  value: ReferenceSqd;
  namespaceData: NamespaceData;
  onChange: (v: ReferenceSqd) => void;
}

export const SqdRefSelect: React.FC<SqdRefSelectProps> = ({ value, namespaceData, onChange }) => {
  const aliases = aliasOptions(namespaceData, 'sqd');
  const nsEntry = value.namespaceAlias ? namespaceData[value.namespaceAlias] : undefined;
  const algorithms = nsEntry?.algorithms ?? [];

  return (
    <div className="ref-group">
      <ComboSelect
        label="namespaceAlias"
        value={value.namespaceAlias ?? ''}
        options={aliases}
        onChange={(v) => onChange({ ...value, namespaceAlias: v, algorithm: '' })}
      />
      <ComboSelect
        label="algorithm"
        value={value.algorithm ?? ''}
        options={algorithms}
        onChange={(v) => onChange({ ...value, algorithm: v })}
      />
    </div>
  );
};

// ─── EventRefSelect ────────────────────────────────────────────────────────────

interface EventRefSelectProps {
  value: ReferenceEvent;
  namespaceData: NamespaceData;
  onChange: (v: ReferenceEvent) => void;
}

export const EventRefSelect: React.FC<EventRefSelectProps> = ({ value, namespaceData, onChange }) => {
  const aliases = aliasOptions(namespaceData, 'model');
  const nsEntry = value.namespaceAlias ? namespaceData[value.namespaceAlias] : undefined;
  const events = nsEntry?.events ?? [];

  return (
    <div className="ref-group">
      <ComboSelect
        label="namespaceAlias"
        value={value.namespaceAlias ?? ''}
        options={aliases}
        onChange={(v) => onChange({ ...value, namespaceAlias: v, event: '' })}
      />
      <ComboSelect
        label="event"
        value={value.event ?? ''}
        options={events}
        onChange={(v) => onChange({ ...value, event: v })}
      />
    </div>
  );
};

// ─── SimpleTypeRefSelect ───────────────────────────────────────────────────────

interface SimpleTypeRefSelectProps {
  value: SimpleTypeRef;
  namespaceData: NamespaceData;
  onChange: (v: SimpleTypeRef) => void;
}

export const SimpleTypeRefSelect: React.FC<SimpleTypeRefSelectProps> = ({ value, namespaceData, onChange }) => {
  const aliases = aliasOptions(namespaceData, 'model');
  const nsEntry = value.namespaceAlias ? namespaceData[value.namespaceAlias] : undefined;
  const simpleTypes = nsEntry?.simpleTypes ?? [];

  return (
    <div className="ref-group">
      <ComboSelect
        label="namespaceAlias"
        value={value.namespaceAlias ?? ''}
        options={aliases}
        onChange={(v) => onChange({ ...value, namespaceAlias: v, simpleType: '' })}
      />
      <ComboSelect
        label="simpleType"
        value={value.simpleType ?? ''}
        options={simpleTypes}
        onChange={(v) => onChange({ ...value, simpleType: v })}
      />
    </div>
  );
};
