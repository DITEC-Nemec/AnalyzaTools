import React from 'react';
import type { NamedType, ParameterDirection, RestrictionDefinition, SimpleTypeDefinition, SimpleTypeRef, Variable } from '../types/sqd';

type VariableItem = Variable & { direction?: ParameterDirection };

interface Props {
  value: VariableItem[];
  onChange: (value: VariableItem[]) => void;
  useSelectsForRefs?: boolean;
  namespaceAliases?: string[];
  getAvailableEntities?: (namespaceAlias?: string) => string[];
  getAvailableAttributes?: (entityName: string, namespaceAlias?: string) => string[];
  getAvailableSimpleTypes?: (namespaceAlias?: string) => string[];
  showDirection?: boolean;
}

const PRIMITIVE_TYPES = [
  'string', 'boolean', 'decimal', 'integer', 'long', 'int', 'short', 'byte',
  'nonNegativeInteger', 'positiveInteger', 'nonPositiveInteger', 'negativeInteger',
  'float', 'double', 'date', 'dateTime', 'time', 'duration',
  'anyURI', 'QName', 'ID', 'IDREF', 'token', 'normalizedString'
];

export const VariableList: React.FC<Props> = ({
  value,
  onChange,
  useSelectsForRefs = false,
  namespaceAliases = [],
  getAvailableEntities = () => [],
  getAvailableAttributes = () => [],
  getAvailableSimpleTypes = () => [],
  showDirection = false
}) => {
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(value.length > 0 ? 0 : null);

  React.useEffect(() => {
    if (value.length === 0) {
      setSelectedIndex(null);
      return;
    }
    if (selectedIndex === null || selectedIndex >= value.length) {
      setSelectedIndex(0);
    }
  }, [value, selectedIndex]);

  const normalizeSimpleTypeRef = (ref: SimpleTypeRef | undefined): SimpleTypeRef => ({
    namespaceAlias: ref?.namespaceAlias ?? '',
    simpleType: ref?.simpleType ?? ''
  });

  const normalizeBaseType = (base: string | SimpleTypeRef | undefined): string | SimpleTypeRef => {
    if (!base) return 'string';
    if (typeof base === 'string') return base;
    return normalizeSimpleTypeRef(base);
  };

  const normalizeBaseTypeArrayItem = (item: string | SimpleTypeRef | undefined): string | SimpleTypeRef => {
    if (!item) return 'string';
    if (typeof item === 'string') return item;
    return normalizeSimpleTypeRef(item);
  };

  const normalizeRestriction = (restriction: RestrictionDefinition | undefined): RestrictionDefinition => ({
    base: restriction?.base ? normalizeBaseType(restriction.base) : 'string',
    enumeration: restriction?.enumeration,
    pattern: restriction?.pattern,
    length: restriction?.length,
    minLength: restriction?.minLength,
    maxLength: restriction?.maxLength,
    minInclusive: restriction?.minInclusive,
    maxInclusive: restriction?.maxInclusive,
    minExclusive: restriction?.minExclusive,
    maxExclusive: restriction?.maxExclusive,
    totalDigits: restriction?.totalDigits,
    fractionDigits: restriction?.fractionDigits,
    whiteSpace: restriction?.whiteSpace
  });

  const normalizeSimpleTypeDefinition = (definition: SimpleTypeDefinition | undefined): SimpleTypeDefinition => ({
    restriction: definition?.restriction ? normalizeRestriction(definition.restriction) : undefined,
    list: definition?.list
      ? {
        itemType: definition.list.itemType ? normalizeBaseTypeArrayItem(definition.list.itemType) : 'string'
      }
      : undefined,
    union: definition?.union
      ? {
        memberTypes: (definition.union.memberTypes ?? []).map(item => normalizeBaseTypeArrayItem(item))
      }
      : undefined
  });

  const parseCsv = (input: string): string[] =>
    input
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);

  const parseScalarValue = (input: string): string | number | boolean => {
    const lowered = input.trim().toLowerCase();
    if (lowered === 'true') {
      return true;
    }
    if (lowered === 'false') {
      return false;
    }
    const asNumber = Number(input.trim());
    if (!Number.isNaN(asNumber) && input.trim() !== '') {
      return asNumber;
    }
    return input.trim();
  };

  const parseEnumerationCsv = (input: string): Array<string | number | boolean> =>
    parseCsv(input).map(item => parseScalarValue(item));

  const simpleTypeRefToText = (ref: SimpleTypeRef): string => `${ref.namespaceAlias}:${ref.simpleType}`;

  const parseSimpleTypeRefsMultiline = (input: string): SimpleTypeRef[] =>
    input
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const separatorIndex = line.indexOf(':');
        if (separatorIndex < 0) {
          return { namespaceAlias: '', simpleType: line };
        }
        return {
          namespaceAlias: line.slice(0, separatorIndex).trim(),
          simpleType: line.slice(separatorIndex + 1).trim()
        };
      });

  const ensureNamedType = (item: Variable): NamedType => ({
    name: item.namedType?.name ?? '',
    type: item.namedType?.type,
    entityRef: {
      namespaceAlias: item.namedType?.entityRef?.namespaceAlias ?? '',
      entity: item.namedType?.entityRef?.entity ?? '',
      attribute: item.namedType?.entityRef?.attribute ?? ''
    },
    typeRef: item.namedType?.typeRef ? normalizeSimpleTypeRef(item.namedType.typeRef) : undefined,
    definition: item.namedType?.definition ? normalizeSimpleTypeDefinition(item.namedType.definition) : undefined,
    nullable: item.namedType?.nullable ?? true,
    readOnly: item.namedType?.readOnly ?? false,
    multiplicity: item.namedType?.multiplicity ?? ''
  });

  const handleAdd = () => {
    const nextItem: VariableItem = {
      direction: showDirection ? 'in' : undefined,
      namedType: {
        name: '',
        type: 'typeRef',
        entityRef: { namespaceAlias: '', entity: '', attribute: '' },
        typeRef: { namespaceAlias: '', simpleType: '' },
        nullable: true,
        readOnly: false,
        multiplicity: ''
      }
    };

    const next: VariableItem[] = [
      ...value,
      nextItem
    ];
    onChange(next);
    setSelectedIndex(next.length - 1);
  };

  const handleRemove = (idx: number) => {
    const next = value.filter((_, i) => i !== idx);
    onChange(next);
    if (next.length === 0) {
      setSelectedIndex(null);
      return;
    }
    if (selectedIndex !== null) {
      setSelectedIndex(Math.min(selectedIndex, next.length - 1));
    }
  };

  const handleNamedTypeChange = (idx: number, patch: Partial<NonNullable<Variable['namedType']>>) => {
    const next: VariableItem[] = value.map((item, i) => {
      if (i !== idx) {
        return item;
      }
      const namedType = ensureNamedType(item);
      const updatedNamedType: NamedType = {
        ...namedType,
        ...patch
      };
      return {
        ...item,
        namedType: updatedNamedType
      };
    });
    onChange(next);
  };

  const handleDirectionChange = (idx: number, direction: ParameterDirection) => {
    const next: VariableItem[] = value.map((item, i) => {
      if (i !== idx) {
        return item;
      }
      return {
        ...item,
        direction
      };
    });
    onChange(next);
  };

  const handleMove = (idx: number, dir: -1 | 1) => {
    const next = [...value];
    const target = idx + dir;
    if (target < 0 || target >= value.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
    if (selectedIndex === idx) {
      setSelectedIndex(target);
    } else if (selectedIndex === target) {
      setSelectedIndex(idx);
    }
  };

  const selectedVariable = selectedIndex === null ? null : value[selectedIndex] ?? null;

  return (
    <div>
      <div className="panel-head compact" style={{ marginBottom: 8 }}>
        <strong>Parametre</strong>
        <button type="button" className="icon-btn" onClick={handleAdd}>+ Pridat parameter</button>
      </div>

      <table className="dm-table">
        <thead>
          <tr>
            <th>Meno</th>
            <th>Typ</th>
            {showDirection && <th>Smer</th>}
            <th>Multiplicita</th>
            <th>Akcie</th>
          </tr>
        </thead>
        <tbody>
          {value.map((item, idx) => (
            <tr
              key={idx}
              className={selectedIndex === idx ? 'selected' : ''}
              onClick={() => setSelectedIndex(idx)}
            >
              <td>{item.namedType?.name ?? ''}</td>
              <td>{item.namedType?.type ?? ''}</td>
              {showDirection && <td>{item.direction ?? 'in'}</td>}
              <td>{item.namedType?.multiplicity ?? ''}</td>
              <td>
                <button type="button" className="icon-btn" onClick={(e) => { e.stopPropagation(); handleMove(idx, -1); }} disabled={idx === 0}>↑</button>
                <button type="button" className="icon-btn" onClick={(e) => { e.stopPropagation(); handleMove(idx, 1); }} disabled={idx === value.length - 1}>↓</button>
                <button type="button" className="icon-btn" onClick={(e) => { e.stopPropagation(); handleRemove(idx); }}>✕</button>
              </td>
            </tr>
          ))}
          {value.length === 0 && (
            <tr>
              <td colSpan={showDirection ? 5 : 4} className="muted">Ziadne parametre</td>
            </tr>
          )}
        </tbody>
      </table>

      {selectedVariable && selectedIndex !== null && (
        <div className="item-card compact" style={{ marginTop: 10 }}>
          <h4>Detail parametra #{selectedIndex + 1}</h4>

          <label className="field-label">name</label>
          <input
            className="field-input"
            placeholder="name"
            value={selectedVariable.namedType?.name ?? ''}
            onChange={e => handleNamedTypeChange(selectedIndex, { name: e.target.value })}
          />

          {showDirection && (
            <>
              <label className="field-label">direction</label>
              <select
                className="field-input"
                value={selectedVariable.direction ?? 'in'}
                onChange={e => handleDirectionChange(selectedIndex, e.target.value as ParameterDirection)}
              >
                <option value="in">in</option>
                <option value="out">out</option>
                <option value="inout">inout</option>
              </select>
            </>
          )}

          <label className="field-label">type</label>
          <select
            className="field-input"
            value={selectedVariable.namedType?.type ?? 'typeRef'}
            onChange={e => handleNamedTypeChange(selectedIndex, { type: e.target.value as NonNullable<Variable['namedType']>['type'] })}
          >
            <option value="definition">definition</option>
            <option value="entityRef">entityRef</option>
            <option value="typeRef">typeRef</option>
          </select>

          {(selectedVariable.namedType?.type ?? 'typeRef') === 'entityRef' && (
            <>
              <label className="field-label">entityRef.namespaceAlias</label>
              {useSelectsForRefs ? (
                <select
                  className="field-input"
                  value={selectedVariable.namedType?.entityRef?.namespaceAlias ?? ''}
                  onChange={e => handleNamedTypeChange(selectedIndex, {
                    entityRef: {
                      ...(selectedVariable.namedType?.entityRef ?? { namespaceAlias: '', entity: '', attribute: '' }),
                      namespaceAlias: e.target.value,
                      entity: '',
                      attribute: ''
                    }
                  })}
                >
                  <option value="">—</option>
                  {namespaceAliases.map(alias => (
                    <option key={alias} value={alias}>{alias}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="field-input"
                  value={selectedVariable.namedType?.entityRef?.namespaceAlias ?? ''}
                  onChange={e => handleNamedTypeChange(selectedIndex, {
                    entityRef: {
                      ...(selectedVariable.namedType?.entityRef ?? { namespaceAlias: '', entity: '', attribute: '' }),
                      namespaceAlias: e.target.value
                    }
                  })}
                />
              )}

              <label className="field-label">entityRef.entity</label>
              {useSelectsForRefs ? (
                <select
                  className="field-input"
                  value={selectedVariable.namedType?.entityRef?.entity ?? ''}
                  onChange={e => handleNamedTypeChange(selectedIndex, {
                    entityRef: {
                      ...(selectedVariable.namedType?.entityRef ?? { namespaceAlias: '', entity: '', attribute: '' }),
                      entity: e.target.value,
                      attribute: ''
                    }
                  })}
                >
                  <option value="">—</option>
                  {getAvailableEntities(selectedVariable.namedType?.entityRef?.namespaceAlias).map(entity => (
                    <option key={entity} value={entity}>{entity}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="field-input"
                  value={selectedVariable.namedType?.entityRef?.entity ?? ''}
                  onChange={e => handleNamedTypeChange(selectedIndex, {
                    entityRef: {
                      ...(selectedVariable.namedType?.entityRef ?? { namespaceAlias: '', entity: '', attribute: '' }),
                      entity: e.target.value
                    }
                  })}
                />
              )}

              <label className="field-label">entityRef.attribute</label>
              {useSelectsForRefs ? (
                <select
                  className="field-input"
                  value={selectedVariable.namedType?.entityRef?.attribute ?? ''}
                  onChange={e => handleNamedTypeChange(selectedIndex, {
                    entityRef: {
                      ...(selectedVariable.namedType?.entityRef ?? { namespaceAlias: '', entity: '', attribute: '' }),
                      attribute: e.target.value
                    }
                  })}
                >
                  <option value="">—</option>
                  {getAvailableAttributes(
                    selectedVariable.namedType?.entityRef?.entity ?? '',
                    selectedVariable.namedType?.entityRef?.namespaceAlias
                  ).map(attribute => (
                    <option key={attribute} value={attribute}>{attribute}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="field-input"
                  value={selectedVariable.namedType?.entityRef?.attribute ?? ''}
                  onChange={e => handleNamedTypeChange(selectedIndex, {
                    entityRef: {
                      ...(selectedVariable.namedType?.entityRef ?? { namespaceAlias: '', entity: '', attribute: '' }),
                      attribute: e.target.value
                    }
                  })}
                />
              )}
            </>
          )}

          {(selectedVariable.namedType?.type ?? 'typeRef') === 'typeRef' && (
            <>
              <label className="field-label">typeRef.namespaceAlias</label>
              {useSelectsForRefs ? (
                <select
                  className="field-input"
                  value={selectedVariable.namedType?.typeRef?.namespaceAlias ?? ''}
                  onChange={e => handleNamedTypeChange(selectedIndex, {
                    typeRef: {
                      ...(selectedVariable.namedType?.typeRef ?? { namespaceAlias: '', simpleType: '' }),
                      namespaceAlias: e.target.value,
                      simpleType: ''
                    }
                  })}
                >
                  <option value="">—</option>
                  {namespaceAliases.map(alias => (
                    <option key={alias} value={alias}>{alias}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="field-input"
                  value={selectedVariable.namedType?.typeRef?.namespaceAlias ?? ''}
                  onChange={e => handleNamedTypeChange(selectedIndex, {
                    typeRef: {
                      ...(selectedVariable.namedType?.typeRef ?? { namespaceAlias: '', simpleType: '' }),
                      namespaceAlias: e.target.value
                    }
                  })}
                />
              )}
              <label className="field-label">typeRef.simpleType</label>
              {useSelectsForRefs ? (
                <select
                  className="field-input"
                  value={selectedVariable.namedType?.typeRef?.simpleType ?? ''}
                  onChange={e => handleNamedTypeChange(selectedIndex, {
                    typeRef: {
                      ...(selectedVariable.namedType?.typeRef ?? { namespaceAlias: '', simpleType: '' }),
                      simpleType: e.target.value
                    }
                  })}
                >
                  <option value="">—</option>
                  {getAvailableSimpleTypes(selectedVariable.namedType?.typeRef?.namespaceAlias).map(simpleType => (
                    <option key={simpleType} value={simpleType}>{simpleType}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="field-input"
                  value={selectedVariable.namedType?.typeRef?.simpleType ?? ''}
                  onChange={e => handleNamedTypeChange(selectedIndex, {
                    typeRef: {
                      ...(selectedVariable.namedType?.typeRef ?? { namespaceAlias: '', simpleType: '' }),
                      simpleType: e.target.value
                    }
                  })}
                />
              )}
            </>
          )}

          {(selectedVariable.namedType?.type ?? 'typeRef') === 'definition' && (
            <>
              <label className="field-label">definition kind</label>
              <select
                className="field-input"
                value={selectedVariable.namedType?.definition?.restriction ? 'restriction' : selectedVariable.namedType?.definition?.list ? 'list' : 'union'}
                onChange={e => {
                  const mode = e.target.value as 'restriction' | 'list' | 'union';
                  const namedType = ensureNamedType(selectedVariable);
                  const nextDefinition: SimpleTypeDefinition =
                    mode === 'restriction'
                      ? { restriction: normalizeRestriction(namedType.definition?.restriction) }
                      : mode === 'list'
                        ? { list: { itemType: namedType.definition?.list?.itemType ?? 'string' } }
                        : { union: { memberTypes: namedType.definition?.union?.memberTypes ?? [] } };
                  handleNamedTypeChange(selectedIndex, { definition: nextDefinition });
                }}
              >
                <option value="restriction">restriction</option>
                <option value="list">list</option>
                <option value="union">union</option>
              </select>

              {(selectedVariable.namedType?.definition?.restriction || (!selectedVariable.namedType?.definition?.list && !selectedVariable.namedType?.definition?.union)) && (
                <>
                  <label className="field-label">restriction.base type</label>
                  <select
                    className="field-input"
                    value={typeof selectedVariable.namedType?.definition?.restriction?.base === 'string' ? 'primitive' : 'reference'}
                    onChange={e => {
                      const isPrimitive = e.target.value === 'primitive';
                      handleNamedTypeChange(selectedIndex, {
                        definition: {
                          restriction: {
                            ...normalizeRestriction(selectedVariable.namedType?.definition?.restriction),
                            base: isPrimitive ? 'string' : { namespaceAlias: '', simpleType: '' }
                          }
                        }
                      });
                    }}
                  >
                    <option value="primitive">Primitiv typ</option>
                    <option value="reference">SimpleType referencia</option>
                  </select>

                  {typeof selectedVariable.namedType?.definition?.restriction?.base === 'string' ? (
                    <>
                      <label className="field-label">base primitiv typ</label>
                      <select
                        className="field-input"
                        value={selectedVariable.namedType?.definition?.restriction?.base as string}
                        onChange={e => handleNamedTypeChange(selectedIndex, {
                          definition: {
                            restriction: {
                              ...normalizeRestriction(selectedVariable.namedType?.definition?.restriction),
                              base: e.target.value
                            }
                          }
                        })}
                      >
                        {PRIMITIVE_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <label className="field-label">restriction.base namespaceAlias</label>
                      {useSelectsForRefs ? (
                        <select
                          className="field-input"
                          value={(selectedVariable.namedType?.definition?.restriction?.base as SimpleTypeRef)?.namespaceAlias ?? ''}
                          onChange={e => handleNamedTypeChange(selectedIndex, {
                            definition: {
                              restriction: {
                                ...normalizeRestriction(selectedVariable.namedType?.definition?.restriction),
                                base: {
                                  ...normalizeSimpleTypeRef(selectedVariable.namedType?.definition?.restriction?.base as SimpleTypeRef),
                                  namespaceAlias: e.target.value,
                                  simpleType: ''
                                }
                              }
                            }
                          })}
                        >
                          <option value="">—</option>
                          {namespaceAliases.map(alias => (
                            <option key={alias} value={alias}>{alias}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="field-input"
                          value={(selectedVariable.namedType?.definition?.restriction?.base as SimpleTypeRef)?.namespaceAlias ?? ''}
                          onChange={e => handleNamedTypeChange(selectedIndex, {
                            definition: {
                              restriction: {
                                ...normalizeRestriction(selectedVariable.namedType?.definition?.restriction),
                                base: {
                                  ...normalizeSimpleTypeRef(selectedVariable.namedType?.definition?.restriction?.base as SimpleTypeRef),
                                  namespaceAlias: e.target.value
                                }
                              }
                            }
                          })}
                        />
                      )}

                      <label className="field-label">restriction.base simpleType</label>
                      {useSelectsForRefs ? (
                        <select
                          className="field-input"
                          value={(selectedVariable.namedType?.definition?.restriction?.base as SimpleTypeRef)?.simpleType ?? ''}
                          onChange={e => handleNamedTypeChange(selectedIndex, {
                            definition: {
                              restriction: {
                                ...normalizeRestriction(selectedVariable.namedType?.definition?.restriction),
                                base: {
                                  ...normalizeSimpleTypeRef(selectedVariable.namedType?.definition?.restriction?.base as SimpleTypeRef),
                                  simpleType: e.target.value
                                }
                              }
                            }
                          })}
                        >
                          <option value="">—</option>
                          {getAvailableSimpleTypes((selectedVariable.namedType?.definition?.restriction?.base as SimpleTypeRef)?.namespaceAlias).map(simpleType => (
                            <option key={simpleType} value={simpleType}>{simpleType}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="field-input"
                          value={(selectedVariable.namedType?.definition?.restriction?.base as SimpleTypeRef)?.simpleType ?? ''}
                          onChange={e => handleNamedTypeChange(selectedIndex, {
                            definition: {
                              restriction: {
                                ...normalizeRestriction(selectedVariable.namedType?.definition?.restriction),
                                base: {
                                  ...normalizeSimpleTypeRef(selectedVariable.namedType?.definition?.restriction?.base as SimpleTypeRef),
                                  simpleType: e.target.value
                                }
                              }
                            }
                          })}
                        />
                      )}
                    </>
                  )}

                  <div style={{ margin: '12px 0', padding: '8px', borderTop: '2px solid #ccc', borderBottom: '2px solid #ccc', backgroundColor: '#f5f5f5' }}>
                    <label className="field-label" style={{ fontWeight: 'bold' }}>restriction.enumeration (CSV)</label>
                    <p style={{ fontSize: '0.85em', marginTop: '0.2em', marginBottom: '0.5em', fontStyle: 'italic', color: '#666' }}>
                      Ak nastavis enumeration, ostatne facety sa ignoruju
                    </p>
                    <input
                      className="field-input"
                      value={(selectedVariable.namedType?.definition?.restriction?.enumeration ?? []).join(', ')}
                      onChange={e => handleNamedTypeChange(selectedIndex, {
                        definition: {
                          restriction: {
                            ...normalizeRestriction(selectedVariable.namedType?.definition?.restriction),
                            enumeration: parseEnumerationCsv(e.target.value)
                          }
                        }
                      })}
                      style={{ width: '100%', padding: '4px' }}
                    />
                  </div>

                  {(!selectedVariable.namedType?.definition?.restriction?.enumeration || selectedVariable.namedType.definition?.restriction?.enumeration?.length === 0) && (
                    <>
                      <label className="field-label">restriction.pattern (regex)</label>
                      <input
                        className="field-input"
                        value={selectedVariable.namedType?.definition?.restriction?.pattern ?? ''}
                        onChange={e => handleNamedTypeChange(selectedIndex, {
                          definition: {
                            restriction: {
                              ...normalizeRestriction(selectedVariable.namedType?.definition?.restriction),
                              pattern: e.target.value
                            }
                          }
                        })}
                      />
                    </>
                  )}

                  <label className="field-label">restriction.length</label>
                  <input
                    className="field-input"
                    type="number"
                    value={selectedVariable.namedType?.definition?.restriction?.length ?? ''}
                    onChange={e => handleNamedTypeChange(selectedIndex, {
                      definition: {
                        restriction: {
                          ...normalizeRestriction(selectedVariable.namedType?.definition?.restriction),
                          length: e.target.value ? parseInt(e.target.value, 10) : undefined
                        }
                      }
                    })}
                  />

                  <label className="field-label">restriction.minLength</label>
                  <input
                    className="field-input"
                    type="number"
                    value={selectedVariable.namedType?.definition?.restriction?.minLength ?? ''}
                    onChange={e => handleNamedTypeChange(selectedIndex, {
                      definition: {
                        restriction: {
                          ...normalizeRestriction(selectedVariable.namedType?.definition?.restriction),
                          minLength: e.target.value ? parseInt(e.target.value, 10) : undefined
                        }
                      }
                    })}
                  />

                  <label className="field-label">restriction.maxLength</label>
                  <input
                    className="field-input"
                    type="number"
                    value={selectedVariable.namedType?.definition?.restriction?.maxLength ?? ''}
                    onChange={e => handleNamedTypeChange(selectedIndex, {
                      definition: {
                        restriction: {
                          ...normalizeRestriction(selectedVariable.namedType?.definition?.restriction),
                          maxLength: e.target.value ? parseInt(e.target.value, 10) : undefined
                        }
                      }
                    })}
                  />

                  <label className="field-label">restriction.minInclusive</label>
                  <input
                    className="field-input"
                    value={selectedVariable.namedType?.definition?.restriction?.minInclusive ?? ''}
                    onChange={e => handleNamedTypeChange(selectedIndex, {
                      definition: {
                        restriction: {
                          ...normalizeRestriction(selectedVariable.namedType?.definition?.restriction),
                          minInclusive: e.target.value ? (isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)) : undefined
                        }
                      }
                    })}
                  />

                  <label className="field-label">restriction.maxInclusive</label>
                  <input
                    className="field-input"
                    value={selectedVariable.namedType?.definition?.restriction?.maxInclusive ?? ''}
                    onChange={e => handleNamedTypeChange(selectedIndex, {
                      definition: {
                        restriction: {
                          ...normalizeRestriction(selectedVariable.namedType?.definition?.restriction),
                          maxInclusive: e.target.value ? (isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)) : undefined
                        }
                      }
                    })}
                  />

                  <label className="field-label">restriction.minExclusive</label>
                  <input
                    className="field-input"
                    value={selectedVariable.namedType?.definition?.restriction?.minExclusive ?? ''}
                    onChange={e => handleNamedTypeChange(selectedIndex, {
                      definition: {
                        restriction: {
                          ...normalizeRestriction(selectedVariable.namedType?.definition?.restriction),
                          minExclusive: e.target.value ? (isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)) : undefined
                        }
                      }
                    })}
                  />

                  <label className="field-label">restriction.maxExclusive</label>
                  <input
                    className="field-input"
                    value={selectedVariable.namedType?.definition?.restriction?.maxExclusive ?? ''}
                    onChange={e => handleNamedTypeChange(selectedIndex, {
                      definition: {
                        restriction: {
                          ...normalizeRestriction(selectedVariable.namedType?.definition?.restriction),
                          maxExclusive: e.target.value ? (isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)) : undefined
                        }
                      }
                    })}
                  />

                  <label className="field-label">restriction.totalDigits</label>
                  <input
                    className="field-input"
                    type="number"
                    value={selectedVariable.namedType?.definition?.restriction?.totalDigits ?? ''}
                    onChange={e => handleNamedTypeChange(selectedIndex, {
                      definition: {
                        restriction: {
                          ...normalizeRestriction(selectedVariable.namedType?.definition?.restriction),
                          totalDigits: e.target.value ? parseInt(e.target.value, 10) : undefined
                        }
                      }
                    })}
                  />

                  <label className="field-label">restriction.fractionDigits</label>
                  <input
                    className="field-input"
                    type="number"
                    value={selectedVariable.namedType?.definition?.restriction?.fractionDigits ?? ''}
                    onChange={e => handleNamedTypeChange(selectedIndex, {
                      definition: {
                        restriction: {
                          ...normalizeRestriction(selectedVariable.namedType?.definition?.restriction),
                          fractionDigits: e.target.value ? parseInt(e.target.value, 10) : undefined
                        }
                      }
                    })}
                  />

                  <label className="field-label">restriction.whiteSpace</label>
                  <select
                    className="field-input"
                    value={selectedVariable.namedType?.definition?.restriction?.whiteSpace ?? ''}
                    onChange={e => handleNamedTypeChange(selectedIndex, {
                      definition: {
                        restriction: {
                          ...normalizeRestriction(selectedVariable.namedType?.definition?.restriction),
                          whiteSpace: e.target.value as 'preserve' | 'replace' | 'collapse' | undefined
                        }
                      }
                    })}
                  >
                    <option value="">(default)</option>
                    <option value="preserve">preserve</option>
                    <option value="replace">replace</option>
                    <option value="collapse">collapse</option>
                  </select>
                </>
              )}

              {selectedVariable.namedType?.definition?.list && (
                <>
                  <label className="field-label">list.itemType type</label>
                  <select
                    className="field-input"
                    value={typeof selectedVariable.namedType?.definition?.list?.itemType === 'string' ? 'primitive' : 'reference'}
                    onChange={e => {
                      const isPrimitive = e.target.value === 'primitive';
                      handleNamedTypeChange(selectedIndex, {
                        definition: {
                          list: {
                            itemType: isPrimitive ? 'string' : { namespaceAlias: '', simpleType: '' }
                          }
                        }
                      });
                    }}
                  >
                    <option value="primitive">Primitiv typ</option>
                    <option value="reference">SimpleType referencia</option>
                  </select>

                  {typeof selectedVariable.namedType?.definition?.list?.itemType === 'string' ? (
                    <>
                      <label className="field-label">itemType primitiv typ</label>
                      <select
                        className="field-input"
                        value={selectedVariable.namedType?.definition?.list?.itemType as string}
                        onChange={e => handleNamedTypeChange(selectedIndex, {
                          definition: {
                            list: {
                              itemType: e.target.value
                            }
                          }
                        })}
                      >
                        {PRIMITIVE_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <label className="field-label">list.itemType namespaceAlias</label>
                      {useSelectsForRefs ? (
                        <select
                          className="field-input"
                          value={(selectedVariable.namedType?.definition?.list?.itemType as SimpleTypeRef)?.namespaceAlias ?? ''}
                          onChange={e => handleNamedTypeChange(selectedIndex, {
                            definition: {
                              list: {
                                itemType: {
                                  ...normalizeSimpleTypeRef(selectedVariable.namedType?.definition?.list?.itemType as SimpleTypeRef),
                                  namespaceAlias: e.target.value,
                                  simpleType: ''
                                }
                              }
                            }
                          })}
                        >
                          <option value="">—</option>
                          {namespaceAliases.map(alias => (
                            <option key={alias} value={alias}>{alias}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="field-input"
                          value={(selectedVariable.namedType?.definition?.list?.itemType as SimpleTypeRef)?.namespaceAlias ?? ''}
                          onChange={e => handleNamedTypeChange(selectedIndex, {
                            definition: {
                              list: {
                                itemType: {
                                  ...normalizeSimpleTypeRef(selectedVariable.namedType?.definition?.list?.itemType as SimpleTypeRef),
                                  namespaceAlias: e.target.value
                                }
                              }
                            }
                          })}
                        />
                      )}

                      <label className="field-label">list.itemType simpleType</label>
                      {useSelectsForRefs ? (
                        <select
                          className="field-input"
                          value={(selectedVariable.namedType?.definition?.list?.itemType as SimpleTypeRef)?.simpleType ?? ''}
                          onChange={e => handleNamedTypeChange(selectedIndex, {
                            definition: {
                              list: {
                                itemType: {
                                  ...normalizeSimpleTypeRef(selectedVariable.namedType?.definition?.list?.itemType as SimpleTypeRef),
                                  simpleType: e.target.value
                                }
                              }
                            }
                          })}
                        >
                          <option value="">—</option>
                          {getAvailableSimpleTypes((selectedVariable.namedType?.definition?.list?.itemType as SimpleTypeRef)?.namespaceAlias).map(simpleType => (
                            <option key={simpleType} value={simpleType}>{simpleType}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="field-input"
                          value={(selectedVariable.namedType?.definition?.list?.itemType as SimpleTypeRef)?.simpleType ?? ''}
                          onChange={e => handleNamedTypeChange(selectedIndex, {
                            definition: {
                              list: {
                                itemType: {
                                  ...normalizeSimpleTypeRef(selectedVariable.namedType?.definition?.list?.itemType as SimpleTypeRef),
                                  simpleType: e.target.value
                                }
                              }
                            }
                          })}
                        />
                      )}
                    </>
                  )}
                </>
              )}

              {selectedVariable.namedType?.definition?.union && (
                <>
                  <label className="field-label">union.memberTypes</label>
                  <textarea
                    className="field-input"
                    rows={4}
                    value={(selectedVariable.namedType?.definition?.union?.memberTypes ?? [])
                      .map(item => typeof item === 'string' ? item : simpleTypeRefToText(item))
                      .join('\n')}
                    onChange={e => {
                      const lines = e.target.value.split('\n').filter(Boolean);
                      const memberTypes = lines.map(line => {
                        const trimmed = line.trim();
                        if (PRIMITIVE_TYPES.includes(trimmed)) {
                          return trimmed;
                        }
                        const colonIndex = trimmed.indexOf(':');
                        if (colonIndex > 0) {
                          return {
                            namespaceAlias: trimmed.slice(0, colonIndex).trim(),
                            simpleType: trimmed.slice(colonIndex + 1).trim()
                          };
                        }
                        return trimmed;
                      });

                      handleNamedTypeChange(selectedIndex, {
                        definition: {
                          union: {
                            memberTypes
                          }
                        }
                      });
                    }}
                  />
                </>
              )}
            </>
          )}

          <label className="field-label">multiplicity</label>
          <input
            className="field-input"
            placeholder="1 | 0..1 | 1..* | *"
            value={selectedVariable.namedType?.multiplicity ?? ''}
            onChange={e => handleNamedTypeChange(selectedIndex, { multiplicity: e.target.value })}
          />

          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            <label>
              <input
                type="checkbox"
                checked={selectedVariable.namedType?.nullable ?? true}
                onChange={e => handleNamedTypeChange(selectedIndex, { nullable: e.target.checked })}
              />
              {' '}nullable
            </label>
            <label>
              <input
                type="checkbox"
                checked={selectedVariable.namedType?.readOnly ?? false}
                onChange={e => handleNamedTypeChange(selectedIndex, { readOnly: e.target.checked })}
              />
              {' '}readOnly
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
