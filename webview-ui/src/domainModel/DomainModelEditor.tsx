import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as yaml from 'js-yaml';
import type {
  Attribute,
  CodeLabel,
  DomainFunction,
  Entity,
  SimpleType,
  SimpleTypeRef,
  SimpleTypeDefinition,
  Annotation,
  NamespaceEntity,
  DomainModel,
  Relationship,
  RelationshipRole,
  FunctionEffect,
  StateEntry,
  Parameter,
  Variable,
  EventGlossaryEntry,
  ActorRef
} from '../types/sqd';
import { label as rawLabel } from '../ui-labels';
import { ParametersEditor } from '../components/ParametersEditor';
import { AffectedEntitiesEditor } from '../components/AffectedEntitiesEditor';
import { ActorRefsEditor } from '../components/ActorRefsEditor';
import { displayType, displaySimpleTypeDefinition } from '../utils/displayType';

const PRIMITIVE_TYPES = ['string', 'integer', 'decimal', 'double', 'boolean', 'date', 'time', 'dateTime'];
const ATTRIBUTE_TYPES = ['entityRef', 'definition', 'typeRef'];
const RELATIONSHIP_TYPES = ['references', 'depends', 'inherits'];
const ENTITY_TYPES: NonNullable<Entity['type']>[] = [
  'business_concept',
  'database_table',
  'code_list',
  'conceptual_system',
  'computational_system',
  'other'
];
const ENTITY_AGREGATION_STATUSES: NonNullable<Entity['agregationStatus']>[] = ['root', 'leaf', 'intermediate'];
const L = (path: string, fallback: string) => rawLabel(`domain.${path}`, fallback);
const DL = L;

interface EditorProps {
  value: DomainModel;
  onChange: (value: DomainModel) => void;
  availableModels: Array<{ name: string; path: string }>;
  onModelSwitch: (path: string) => void;
  currentPath: string;
  vscodeApi: { postMessage(msg: unknown): void };
}

const normalizeNamedType = (namedType: any, attrName?: string) => ({
  name: attrName || namedType?.name || '',
  nullable: namedType?.nullable ?? true,
  type: namedType?.type,
  definition: namedType?.definition,
  entityRef: namedType?.entityRef,
  typeRef: namedType?.typeRef,
  simpleType: namedType?.simpleType
});

const normalizeSimpleType = (simpleType: SimpleType): SimpleType => ({
  ...simpleType,
  name: simpleType.name ?? '',
  annotation: simpleType.annotation
    ? {
      title: simpleType.annotation.title ?? '',
      description: simpleType.annotation.description ?? '',
      documentation: simpleType.annotation.documentation ?? ''
    }
    : undefined,
  definition: normalizeSimpleTypeDefinition(simpleType.definition)
});

const normalizeSimpleTypeDefinition = (def: any): SimpleTypeDefinition => ({
  restriction: def?.restriction,
  list: def?.list,
  union: def?.union
});

const normalizeRestriction = (restriction: any) => ({
  base: restriction?.base,
  length: restriction?.length,
  minLength: restriction?.minLength,
  maxLength: restriction?.maxLength,
  pattern: restriction?.pattern,
  enumeration: restriction?.enumeration,
  minInclusive: restriction?.minInclusive,
  maxInclusive: restriction?.maxInclusive,
  minExclusive: restriction?.minExclusive,
  maxExclusive: restriction?.maxExclusive,
  totalDigits: restriction?.totalDigits,
  fractionDigits: restriction?.fractionDigits,
  whiteSpace: restriction?.whiteSpace
});

const normalizeSimpleTypeRef = (ref: any): SimpleTypeRef => ({
  namespaceAlias: ref?.namespaceAlias ?? '',
  simpleType: ref?.simpleType ?? ''
});

const normalizeRole = (role: any): RelationshipRole => ({
  entity: role?.entity ?? role?.entityRef?.entity ?? '',
  nazov: role?.nazov ?? '',
  multiplicity: role?.multiplicity ?? '',
  description: role?.description ?? '',
  entityRef: {
    namespaceAlias: role?.entityRef?.namespaceAlias ?? '',
    entity: role?.entityRef?.entity ?? '',
    attribute: role?.entityRef?.attribute ?? ''
  }
});

const normalizeVariable = (variable: Variable | string): Variable => {
  if (typeof variable === 'string') {
    return { namedType: normalizeNamedType(undefined, variable) };
  }

  return {
    ...variable,
    namedType: normalizeNamedType(variable.namedType)
  };
};

const normalizeVariableArray = (vars: Array<Variable | string> | undefined): Variable[] => {
  return (vars ?? []).map(normalizeVariable);
};

const normalizeFunctionParameters = (fn: DomainFunction | null | undefined): Parameter[] => {
  if (!fn) {
    return [];
  }

  if (fn.parameters && fn.parameters.length > 0) {
    return fn.parameters.map((param) => ({
      ...normalizeVariable(param as Variable),
      direction: param.direction ?? 'in'
    }));
  }

  const legacyInputs = normalizeVariableArray(fn.inputs as Array<Variable | string> | undefined).map((item) => ({
    ...item,
    direction: 'in' as const
  }));

  return legacyInputs;
};

const normalizeActorRefs = (items: ActorRef[] | undefined): ActorRef[] => {
  return (items ?? []).map((item) => ({
    namespaceAlias: item.namespaceAlias ?? 'local',
    actor: item.actor ?? ''
  }));
};

const simpleTypeRefToText = (ref: SimpleTypeRef): string => `${ref.namespaceAlias}:${ref.simpleType}`;

const parseEnumerationCsv = (text: string): (string | number)[] => {
  return text.split(',').map(item => {
    const trimmed = item.trim();
    const num = Number(trimmed);
    return isNaN(num) ? trimmed : num;
  });
};

const parseCsv = (text: string): string[] => text.split(',').map(item => item.trim()).filter(Boolean);

const moveItem = <T,>(arr: T[], from: number, to: number): T[] => {
  const result = [...arr];
  const [moved] = result.splice(from, 1);
  result.splice(to, 0, moved);
  return result;
};

const DomainModelEditor: React.FC<EditorProps> = ({
  value: initialModel,
  onChange,
  availableModels,
  onModelSwitch,
  currentPath,
  vscodeApi
}) => {
  const [model, setModel] = useState<DomainModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentModelPath, setCurrentModelPath] = useState<string>('');
  const [namespaceModels, setNamespaceModels] = useState<Record<string, DomainModel>>({});
  const pendingNamespaceByRequestKey = useRef<Map<string, string>>(new Map());

  // Entity selection
  const [selectedEntityIndex, setSelectedEntityIndex] = useState<number | null>(null);
  
  // Attribute selection
  const [selectedAttributeIndex, setSelectedAttributeIndex] = useState<number | null>(null);
  const [selectedAttributeStateIndex, setSelectedAttributeStateIndex] = useState<number | null>(null);
  
  // Function selection
  const [selectedFunctionIndex, setSelectedFunctionIndex] = useState<number | null>(null);
  const [selectedStateModelIndex, setSelectedStateModelIndex] = useState<number | null>(null);
  
  // SimpleType selection
  const [selectedSimpleTypeIndex, setSelectedSimpleTypeIndex] = useState<number | null>(null);
  
  // Relationship selection
  const [selectedRelationshipIndex, setSelectedRelationshipIndex] = useState<number | null>(null);
  
  // Glossary selection
  const [selectedGlossaryIndex, setSelectedGlossaryIndex] = useState<number | null>(null);
  const [selectedEventGlossaryIndex, setSelectedEventGlossaryIndex] = useState<number | null>(null);
  
  // Actors selection
  const [selectedActorIndex, setSelectedActorIndex] = useState<number | null>(null);
  
  // Namespace selection
  const [selectedNamespaceIndex, setSelectedNamespaceIndex] = useState<number | null>(null);

  // Tab states
  const [topTab, setTopTab] = useState<string>('entities');
  const [entityTab, setEntityTab] = useState<string>('attributes');
  const [functionTab, setFunctionTab] = useState<string>('detail');

  // Initialize model
  useEffect(() => {
    setCurrentModelPath(currentPath ?? '');
    setModel(initialModel);
  }, [initialModel, currentPath]);

  // Message handler for file picker
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, filePath, content, requestKey } = event.data;
      if (type === 'filePicked' && filePath && selectedNamespaceIndex !== null) {
        updateModel(current => {
          const namespaceRef = [...(current.namespaceRef ?? [])];
          namespaceRef[selectedNamespaceIndex] = {
            ...namespaceRef[selectedNamespaceIndex],
            filePath,
            alias: namespaceRef[selectedNamespaceIndex]?.alias || 'newNamespace',
            sourceType: 'model'
          };
          return { ...current, namespaceRef };
        });
        return;
      }

      if (type === 'modelContent' && typeof content === 'string' && typeof requestKey === 'string') {
        const alias = pendingNamespaceByRequestKey.current.get(requestKey);
        pendingNamespaceByRequestKey.current.delete(requestKey);

        if (!alias) {
          return;
        }

        try {
          const parsed = yaml.load(content) as DomainModel;
          if (!parsed || typeof parsed !== 'object') {
            return;
          }

          setNamespaceModels(prev => ({ ...prev, [alias]: parsed }));
        } catch {
          setNamespaceModels(prev => {
            const next = { ...prev };
            delete next[alias];
            return next;
          });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [selectedNamespaceIndex]);

  useEffect(() => {
    if (!vscodeApi || !model) {
      return;
    }

    const aliasesInUse = new Set(
      (model.namespaceRef ?? [])
        .filter(ns => ns.sourceType === 'model' && !!ns.alias)
        .map(ns => ns.alias)
    );

    setNamespaceModels(prev => {
      const next: Record<string, DomainModel> = {};
      Object.entries(prev).forEach(([alias, nsModel]) => {
        if (aliasesInUse.has(alias)) {
          next[alias] = nsModel;
        }
      });
      return next;
    });

    (model.namespaceRef ?? []).forEach(ns => {
      if (ns.sourceType !== 'model' || !ns.alias || !ns.filePath) {
        return;
      }

      pendingNamespaceByRequestKey.current.set(ns.filePath, ns.alias);
      vscodeApi.postMessage({ type: 'loadModel', path: ns.filePath });
    });
  }, [model, vscodeApi]);

  const entities = useMemo(() => model?.entities ?? [], [model]);
  const simpleTypes = useMemo(() => model?.simpleTypes ?? [], [model]);
  const relationships = useMemo(() => model?.relationships ?? [], [model]);
  const glossary = useMemo(() => model?.glossary ?? [], [model]);
  const eventGlossary = useMemo(() => model?.eventGlossary ?? [], [model]);
  const actors = useMemo(() => model?.actors ?? [], [model]);
  const namespaceRef = useMemo(() => model?.namespaceRef ?? [], [model]);

  const selectedEntity = selectedEntityIndex !== null ? entities[selectedEntityIndex] : null;
  const selectedAttribute = selectedAttributeIndex !== null && selectedEntity ? selectedEntity.attributes?.[selectedAttributeIndex] : null;
  const selectedAttributeState = selectedAttributeStateIndex !== null && selectedAttribute ? selectedAttribute.states?.[selectedAttributeStateIndex] : null;
  const selectedFunction = selectedFunctionIndex !== null && selectedEntity ? selectedEntity.functions?.[selectedFunctionIndex] : null;
  const selectedStateModel = selectedStateModelIndex !== null && selectedEntity ? selectedEntity.stateModel?.[selectedStateModelIndex] : null;
  const selectedSimpleType = selectedSimpleTypeIndex !== null ? simpleTypes[selectedSimpleTypeIndex] : null;
  const selectedRelationship = selectedRelationshipIndex !== null ? relationships[selectedRelationshipIndex] : null;
  const selectedGlossary = selectedGlossaryIndex !== null ? glossary[selectedGlossaryIndex] : null;
  const selectedEventGlossary = selectedEventGlossaryIndex !== null ? eventGlossary[selectedEventGlossaryIndex] : null;
  const selectedActor = selectedActorIndex !== null ? actors[selectedActorIndex] : null;
  const selectedNamespace = selectedNamespaceIndex !== null ? namespaceRef[selectedNamespaceIndex] : null;

  const simpleTypeCount = simpleTypes.length;
  const relationshipCount = relationships.length;
  const glossaryCount = glossary.length;
  const eventGlossaryCount = eventGlossary.length;
  const actorCount = actors.length;
  const namespaceCount = namespaceRef.length;

  const updateModel = (updater: (current: DomainModel) => DomainModel) => {
    setModel(current => {
      if (!current) return current;
      const next = updater(current);
      onChange(next);
      return next;
    });
  };

  const updateEntity = (index: number, patch: Partial<Entity>) => {
    updateModel(current => {
      const entities = [...(current.entities ?? [])];
      entities[index] = { ...entities[index], ...patch };
      return { ...current, entities };
    });
  };

  const updateAttribute = (index: number, patch: Partial<Attribute>) => {
    if (selectedEntityIndex === null) return;
    updateEntity(selectedEntityIndex, {
      attributes: (selectedEntity?.attributes ?? []).map((attr, i) =>
        i === index ? { ...attr, ...patch } : attr
      )
    });
  };

  // Helper: Get available namespace aliases
  const getNamespaceAliases = (): string[] => {
    return (model?.namespaceRef ?? []).map(ns => ns.alias).filter((alias): alias is string => Boolean(alias));
  };

  const getModelByAlias = (namespaceAlias?: string): DomainModel | null => {
    if (!namespaceAlias || namespaceAlias === 'local') {
      return model;
    }

    return namespaceModels[namespaceAlias] ?? null;
  };

  // Helper: Get available entities (all, or from specific namespace)
  const getAvailableEntities = (namespaceAlias?: string): string[] => {
    const sourceModel = getModelByAlias(namespaceAlias);
    return (sourceModel?.entities ?? []).map(e => e.name).filter((name): name is string => Boolean(name));
  };

  // Helper: Get available attributes for an entity
  const getAvailableAttributes = (entityName: string, namespaceAlias?: string): string[] => {
    const sourceModel = getModelByAlias(namespaceAlias);
    const entity = (sourceModel?.entities ?? []).find(e => e.name === entityName);
    return (entity?.attributes ?? []).map(a => a.name).filter((name): name is string => Boolean(name));
  };

  // Helper: Get available simpleTypes (all, or from specific namespace)
  const getAvailableSimpleTypes = (namespaceAlias?: string): string[] => {
    const sourceModel = getModelByAlias(namespaceAlias);
    return (sourceModel?.simpleTypes ?? []).map(st => st.name).filter((name): name is string => Boolean(name));
  };

  const getAvailableActors = (namespaceAlias?: string): string[] => {
    const sourceModel = getModelByAlias(namespaceAlias);
    return (sourceModel?.actors ?? []).map(actor => actor.code).filter((code): code is string => Boolean(code));
  };

  const removeAttribute = (attrIndex: number) => {
    if (!selectedEntity || selectedEntityIndex === null) {
      return;
    }

    const attrs = (selectedEntity.attributes ?? []).filter((_, i) => i !== attrIndex);
    updateEntity(selectedEntityIndex, { attributes: attrs });

    if (attrs.length === 0) {
      setSelectedAttributeIndex(null);
      setSelectedAttributeStateIndex(null);
      return;
    }

    setSelectedAttributeIndex(prev => {
      if (prev === null) {
        return null;
      }
      return Math.min(prev, attrs.length - 1);
    });
    setSelectedAttributeStateIndex(null);
  };

  const moveAttribute = (attrIndex: number, direction: -1 | 1) => {
    if (!selectedEntity || selectedEntityIndex === null) {
      return;
    }

    const attrs = moveItem(selectedEntity.attributes ?? [], attrIndex, attrIndex + direction);
    updateEntity(selectedEntityIndex, { attributes: attrs });

    setSelectedAttributeIndex(prev => {
      if (prev === null) {
        return null;
      }
      if (prev === attrIndex) {
        return attrIndex + direction;
      }
      return prev;
    });
  };

  const addAttributeState = () => {
    if (!selectedAttribute || selectedEntityIndex === null || selectedAttributeIndex === null) {
      return;
    }

    const nextStates: CodeLabel[] = [...(selectedAttribute.states ?? []), { code: '', label: '' }];
    updateAttribute(selectedAttributeIndex, { states: nextStates });
    setSelectedAttributeStateIndex(nextStates.length - 1);
  };

  const updateAttributeState = (stateIndex: number, patch: Partial<CodeLabel>) => {
    if (!selectedAttribute || selectedAttributeIndex === null) {
      return;
    }

    const states = [...(selectedAttribute.states ?? [])];
    states[stateIndex] = { ...states[stateIndex], ...patch };
    updateAttribute(selectedAttributeIndex, { states });
  };

  const removeAttributeState = (stateIndex: number) => {
    if (!selectedAttribute || selectedAttributeIndex === null) {
      return;
    }

    const states = (selectedAttribute.states ?? []).filter((_, i) => i !== stateIndex);
    updateAttribute(selectedAttributeIndex, { states });

    if (states.length === 0) {
      setSelectedAttributeStateIndex(null);
      return;
    }

    setSelectedAttributeStateIndex(prev => {
      if (prev === null) {
        return null;
      }
      return Math.min(prev, states.length - 1);
    });
  };

  const moveAttributeState = (stateIndex: number, direction: -1 | 1) => {
    if (!selectedAttribute || selectedAttributeIndex === null) {
      return;
    }

    const states = moveItem(selectedAttribute.states ?? [], stateIndex, stateIndex + direction);
    updateAttribute(selectedAttributeIndex, { states });

    setSelectedAttributeStateIndex(prev => {
      if (prev === null) {
        return null;
      }
      if (prev === stateIndex) {
        return stateIndex + direction;
      }
      return prev;
    });
  };

  const updateFunction = (fnIndex: number, patch: Partial<DomainFunction>) => {
    if (!selectedEntity || selectedEntityIndex === null) {
      return;
    }

    const functions = [...(selectedEntity.functions ?? [])];
    functions[fnIndex] = { ...functions[fnIndex], ...patch };
    updateEntity(selectedEntityIndex, { functions });
  };

  const updateFunctionBehavior = (fnIndex: number, patch: Partial<NonNullable<DomainFunction['behavior']>>) => {
    if (!selectedFunction || selectedFunctionIndex === null) {
      return;
    }

    updateFunction(fnIndex, {
      behavior: {
        ...(selectedFunction.behavior ?? {}),
        ...patch
      }
    });
  };

  const addFunction = () => {
    if (!selectedEntity || selectedEntityIndex === null) {
      return;
    }

    const functions = [
      ...(selectedEntity.functions ?? []),
      {
        name: `funkcia_${(selectedEntity.functions ?? []).length + 1}`,
        parameters: [],
        behavior: {
          description: '',
          preconditions: [],
          postconditions: [],
          affectedEntities: [],
          actors: []
        },
        effects: []
      }
    ];

    updateEntity(selectedEntityIndex, { functions });
    setSelectedFunctionIndex(functions.length - 1);
    setEntityTab('functions');
  };

  const removeFunction = (fnIndex: number) => {
    if (!selectedEntity || selectedEntityIndex === null) {
      return;
    }

    const functions = (selectedEntity.functions ?? []).filter((_, i) => i !== fnIndex);
    updateEntity(selectedEntityIndex, { functions });

    if (functions.length === 0) {
      setSelectedFunctionIndex(null);
      return;
    }

    setSelectedFunctionIndex(prev => {
      if (prev === null) {
        return null;
      }
      return Math.min(prev, functions.length - 1);
    });
  };

  const moveFunction = (fnIndex: number, direction: -1 | 1) => {
    if (!selectedEntity || selectedEntityIndex === null) {
      return;
    }

    const functions = moveItem(selectedEntity.functions ?? [], fnIndex, fnIndex + direction);
    updateEntity(selectedEntityIndex, { functions });

    setSelectedFunctionIndex(prev => {
      if (prev === null) {
        return null;
      }
      if (prev === fnIndex) {
        return fnIndex + direction;
      }
      return prev;
    });
  };

  const updateFunctionEffect = (effectIndex: number, patch: Partial<FunctionEffect>) => {
    if (!selectedFunction || selectedFunctionIndex === null) {
      return;
    }

    const effects = [...(selectedFunction.effects ?? [])];
    effects[effectIndex] = { ...effects[effectIndex], ...patch };
    updateFunction(selectedFunctionIndex, { effects });
  };

  const updateEntityState = (stateIndex: number, patch: Partial<StateEntry>) => {
    if (!selectedEntity || selectedStateModelIndex === null || selectedEntityIndex === null) {
      return;
    }

    const states = [...(selectedEntity.stateModel ?? [])];
    states[stateIndex] = { ...states[stateIndex], ...patch };
    updateEntity(selectedEntityIndex, { stateModel: states });
  };

  const addEntityState = () => {
    if (!selectedEntity || selectedEntityIndex === null) {
      return;
    }

    const stateModel = [...(selectedEntity.stateModel ?? []), { name: '', label: '', description: '', isFinal: false }];
    updateEntity(selectedEntityIndex, { stateModel });
    setSelectedStateModelIndex(stateModel.length - 1);
    setEntityTab('stateModel');
  };

  const removeEntityState = (stateIndex: number) => {
    if (!selectedEntity || selectedEntityIndex === null) {
      return;
    }

    const stateModel = (selectedEntity.stateModel ?? []).filter((_, i) => i !== stateIndex);
    updateEntity(selectedEntityIndex, { stateModel });

    if (stateModel.length === 0) {
      setSelectedStateModelIndex(null);
      return;
    }

    setSelectedStateModelIndex(prev => {
      if (prev === null) {
        return null;
      }
      return Math.min(prev, stateModel.length - 1);
    });
  };

  const moveEntityState = (stateIndex: number, direction: -1 | 1) => {
    if (!selectedEntity || selectedEntityIndex === null) {
      return;
    }

    const stateModel = moveItem(selectedEntity.stateModel ?? [], stateIndex, stateIndex + direction);
    updateEntity(selectedEntityIndex, { stateModel });

    setSelectedStateModelIndex(prev => {
      if (prev === null) {
        return null;
      }
      if (prev === stateIndex) {
        return stateIndex + direction;
      }
      return prev;
    });
  };

  const updateSimpleType = (index: number, patch: Partial<SimpleType>) => {
    updateModel(current => {
      const next = [...(current.simpleTypes ?? [])];
      const currentName = next[index]?.name ?? '';
      next[index] = {
        ...normalizeSimpleType(next[index]),
        ...patch,
        name: patch.name !== undefined ? patch.name : currentName
      };
      return {
        ...current,
        simpleTypes: next
      };
    });
  };

  const addSimpleType = () => {
    updateModel(current => ({
      ...current,
      simpleTypes: [
        ...(current.simpleTypes ?? []),
        {
          name: `simpleType_${(current.simpleTypes ?? []).length + 1}`,
          definition: {
            restriction: {
              base: { namespaceAlias: '', simpleType: '' }
            }
          }
        }
      ]
    }));

    setTopTab('simpleTypes');
    setSelectedSimpleTypeIndex(simpleTypes.length);
  };

  const removeSimpleType = (index: number) => {
    updateModel(current => ({
      ...current,
      simpleTypes: (current.simpleTypes ?? []).filter((_, i) => i !== index)
    }));

    const nextLen = simpleTypes.length - 1;
    if (nextLen <= 0) {
      setSelectedSimpleTypeIndex(null);
      return;
    }

    setSelectedSimpleTypeIndex(prev => {
      if (prev === null) {
        return null;
      }
      return Math.min(prev, nextLen - 1);
    });
  };

  const moveSimpleType = (index: number, direction: -1 | 1) => {
    updateModel(current => ({
      ...current,
      simpleTypes: moveItem(current.simpleTypes ?? [], index, index + direction)
    }));

    setSelectedSimpleTypeIndex(prev => {
      if (prev === null) {
        return null;
      }
      if (prev === index) {
        return index + direction;
      }
      return prev;
    });
  };

  const addRelationship = () => {
    updateModel(current => ({
      ...current,
      relationships: [
        ...(current.relationships ?? []),
        {
          start_role: {
            nazov: '',
            multiplicity: '1',
            description: '',
            entityRef: { namespaceAlias: '', entity: current.entities[0]?.name ?? '', attribute: '' }
          },
          end_role: {
            nazov: '',
            multiplicity: '*',
            description: '',
            entityRef: { namespaceAlias: '', entity: '', attribute: '' }
          },
          type: 'references',
          description: ''
        }
      ]
    }));

    setTopTab('relationships');
    setSelectedRelationshipIndex(relationships.length);
  };

  const updateRelationship = (index: number, patch: Partial<Relationship>) => {
    updateModel(current => {
      const next = [...(current.relationships ?? [])];
      next[index] = { ...next[index], ...patch };
      return { ...current, relationships: next };
    });
  };

  const updateRole = (index: number, side: 'start_role' | 'end_role', patch: Partial<RelationshipRole>) => {
    if (!selectedRelationship) {
      return;
    }

    const currentRole = normalizeRole(selectedRelationship[side]);
    updateRelationship(index, {
      [side]: {
        ...currentRole,
        ...patch,
        entity: patch.entityRef?.entity ?? patch.entity ?? currentRole.entity
      }
    });
  };

  const removeRelationship = (index: number) => {
    updateModel(current => ({
      ...current,
      relationships: (current.relationships ?? []).filter((_, i) => i !== index)
    }));

    const nextLen = relationships.length - 1;
    if (nextLen <= 0) {
      setSelectedRelationshipIndex(null);
      return;
    }

    setSelectedRelationshipIndex(prev => {
      if (prev === null) {
        return null;
      }
      return Math.min(prev, nextLen - 1);
    });
  };

  const moveRelationship = (index: number, direction: -1 | 1) => {
    updateModel(current => ({
      ...current,
      relationships: moveItem(current.relationships ?? [], index, index + direction)
    }));

    setSelectedRelationshipIndex(prev => {
      if (prev === null) {
        return null;
      }
      if (prev === index) {
        return index + direction;
      }
      return prev;
    });
  };

  const addGlossary = () => {
    updateModel(current => {
      const entitiesLocal = current.entities ?? [];
      const fallbackEntity = entitiesLocal[0]?.name ?? '';
      return {
        ...current,
        glossary: [
          ...(current.glossary ?? []),
          {
            term: `pojem_${(current.glossary ?? []).length + 1}`,
            meaning: '',
            relatedEntity: fallbackEntity
          }
        ]
      };
    });

    setTopTab('glossary');
    setSelectedGlossaryIndex(glossary.length);
  };

  const updateGlossary = (index: number, patch: Partial<{ term: string; meaning: string; relatedEntity?: string }>) => {
    updateModel(current => {
      const next = [...(current.glossary ?? [])];
      next[index] = { ...next[index], ...patch };
      return { ...current, glossary: next };
    });
  };

  const removeGlossary = (index: number) => {
    updateModel(current => ({
      ...current,
      glossary: (current.glossary ?? []).filter((_, i) => i !== index)
    }));

    const nextLen = glossary.length - 1;
    if (nextLen <= 0) {
      setSelectedGlossaryIndex(null);
      return;
    }

    setSelectedGlossaryIndex(prev => {
      if (prev === null) {
        return null;
      }
      return Math.min(prev, nextLen - 1);
    });
  };

  const moveGlossary = (index: number, direction: -1 | 1) => {
    updateModel(current => ({
      ...current,
      glossary: moveItem(current.glossary ?? [], index, index + direction)
    }));

    setSelectedGlossaryIndex(prev => {
      if (prev === null) {
        return null;
      }
      if (prev === index) {
        return index + direction;
      }
      return prev;
    });
  };

  const addEventGlossary = () => {
    updateModel(current => ({
      ...current,
      eventGlossary: [
        ...(current.eventGlossary ?? []),
        {
          code: `event-${(current.eventGlossary ?? []).length + 1}`,
          title: '',
          meaning: '',
          severity: 'info',
          recommendedAction: ''
        }
      ]
    }));

    setTopTab('eventGlossary');
    setSelectedEventGlossaryIndex(eventGlossary.length);
  };

  const updateEventGlossary = (index: number, patch: Partial<EventGlossaryEntry>) => {
    updateModel(current => {
      const next = [...(current.eventGlossary ?? [])];
      next[index] = { ...next[index], ...patch };
      return { ...current, eventGlossary: next };
    });
  };

  const removeEventGlossary = (index: number) => {
    updateModel(current => ({
      ...current,
      eventGlossary: (current.eventGlossary ?? []).filter((_, i) => i !== index)
    }));

    const nextLen = eventGlossary.length - 1;
    if (nextLen <= 0) {
      setSelectedEventGlossaryIndex(null);
      return;
    }

    setSelectedEventGlossaryIndex(prev => {
      if (prev === null) {
        return null;
      }
      return Math.min(prev, nextLen - 1);
    });
  };

  const moveEventGlossary = (index: number, direction: -1 | 1) => {
    updateModel(current => ({
      ...current,
      eventGlossary: moveItem(current.eventGlossary ?? [], index, index + direction)
    }));

    setSelectedEventGlossaryIndex(prev => {
      if (prev === null) {
        return null;
      }
      if (prev === index) {
        return index + direction;
      }
      return prev;
    });
  };

  const addActor = () => {
    updateModel(current => {
      return {
        ...current,
        actors: [
          ...(current.actors ?? []),
          {
            code: `actor_${(current.actors ?? []).length + 1}`,
            title: '',
            type: 'user',
            meaning: '',
            responsibilities: []
          }
        ]
      };
    });

    setTopTab('actors');
    setSelectedActorIndex(actors.length);
  };

  const updateActor = (index: number, patch: Partial<{ code: string; title?: string; type?: 'user' | 'system' | 'external_system'; meaning: string; responsibilities?: string[] }>) => {
    updateModel(current => {
      const next = [...(current.actors ?? [])];
      next[index] = { ...next[index], ...patch };
      return { ...current, actors: next };
    });
  };

  const removeActor = (index: number) => {
    updateModel(current => ({
      ...current,
      actors: (current.actors ?? []).filter((_, i) => i !== index)
    }));

    const nextLen = actors.length - 1;
    if (nextLen <= 0) {
      setSelectedActorIndex(null);
      return;
    }

    setSelectedActorIndex(prev => {
      if (prev === null) {
        return null;
      }
      return Math.min(prev, nextLen - 1);
    });
  };

  const moveActor = (index: number, direction: -1 | 1) => {
    updateModel(current => ({
      ...current,
      actors: moveItem(current.actors ?? [], index, index + direction)
    }));

    setSelectedActorIndex(prev => {
      if (prev === null) {
        return null;
      }
      if (prev === index) {
        return index + direction;
      }
      return prev;
    });
  };

  const addNamespace = () => {
    updateModel(current => ({
      ...current,
      namespaceRef: [...(current.namespaceRef ?? []), { alias: '', filePath: '', sourceType: 'model' } as NamespaceEntity]
    }));

    setTopTab('namespaceRef');
    setSelectedNamespaceIndex(namespaceRef.length);
  };

  const updateNamespace = (index: number, patch: Partial<NamespaceEntity>) => {
    updateModel(current => {
      const next = [...(current.namespaceRef ?? [])];
      const merged = { ...next[index], ...patch };

      if (merged.sourceType === 'current') {
        merged.alias = 'local';
      }
      if (merged.alias === 'local') {
        merged.sourceType = 'current';
      }

      next[index] = merged;
      return { ...current, namespaceRef: next };
    });
  };

  const removeNamespace = (index: number) => {
    updateModel(current => ({
      ...current,
      namespaceRef: (current.namespaceRef ?? []).filter((_, i) => i !== index)
    }));

    const nextLen = namespaceRef.length - 1;
    if (nextLen <= 0) {
      setSelectedNamespaceIndex(null);
      return;
    }

    setSelectedNamespaceIndex(prev => {
      if (prev === null) {
        return null;
      }
      return Math.min(prev, nextLen - 1);
    });
  };

  const moveNamespace = (index: number, direction: -1 | 1) => {
    updateModel(current => ({
      ...current,
      namespaceRef: moveItem(current.namespaceRef ?? [], index, index + direction)
    }));

    setSelectedNamespaceIndex(prev => {
      if (prev === null) {
        return null;
      }
      if (prev === index) {
        return index + direction;
      }
      return prev;
    });
  };

  // Entity management functions
  const addEntity = () => {
    updateModel(current => ({
      ...current,
      entities: [
        ...(current.entities ?? []),
        {
          name: `entita_${(current.entities ?? []).length + 1}`,
          label: '',
          attributes: [],
          functions: [],
          stateModel: []
        }
      ]
    }));

    setTopTab('entities');
    setSelectedEntityIndex(entities.length);
  };

  const removeEntity = (index: number) => {
    updateModel(current => ({
      ...current,
      entities: (current.entities ?? []).filter((_, i) => i !== index)
    }));

    const nextLen = entities.length - 1;
    if (nextLen <= 0) {
      setSelectedEntityIndex(null);
      return;
    }

    setSelectedEntityIndex(prev => {
      if (prev === null) {
        return null;
      }
      return Math.min(prev, nextLen - 1);
    });
  };

  const moveEntity = (index: number, direction: -1 | 1) => {
    updateModel(current => ({
      ...current,
      entities: moveItem(current.entities ?? [], index, index + direction)
    }));

    setSelectedEntityIndex(prev => {
      if (prev === null) {
        return null;
      }
      if (prev === index) {
        return index + direction;
      }
      return prev;
    });
  };

  const selectEntity = (index: number) => {
    setSelectedEntityIndex(index);
    setEntityTab('attributes');
  };

  const addAttribute = () => {
    if (!selectedEntity || selectedEntityIndex === null) {
      return;
    }

    const attributes = [
      ...(selectedEntity.attributes ?? []),
      {
        name: `atribut_${(selectedEntity.attributes ?? []).length + 1}`,
        label: '',
        type: 'element',
        nullable: true,
        states: []
      }
    ];

    updateEntity(selectedEntityIndex, { attributes });
    setSelectedAttributeIndex(attributes.length - 1);
  };

  if (error) {
    return <div className="error-banner">{L('common.yamlError', 'YAML chyba')}: {error}</div>;
  }

  if (!model) {
    return <div className="loading">{L('common.loading', 'Nacitavam domain model...')}</div>;
  }

  const handleModelSwitch = (path: string) => {
    onModelSwitch(path);
  };

  const renderRoleEditor = (label: string, side: 'start_role' | 'end_role') => {
    if (selectedRelationshipIndex === null || !selectedRelationship) {
      return null;
    }

    const role = normalizeRole(selectedRelationship[side]);

    return (
      <div className="role-block">
        <h5>{label}</h5>
        <label>{L('relationships.form.role.name', 'Nazov roly')}</label>
        <input
          value={role.nazov ?? ''}
          onChange={(e) => updateRole(selectedRelationshipIndex, side, { nazov: e.target.value })}
        />

        <label>{L('relationships.form.role.multiplicity', 'Multiplicity')}</label>
        <input
          value={role.multiplicity ?? ''}
          onChange={(e) => updateRole(selectedRelationshipIndex, side, { multiplicity: e.target.value })}
        />

        <label>{L('relationships.form.role.entityRefNamespaceAlias', 'EntityRef namespaceAlias')}</label>
        <select
          value={role.entityRef?.namespaceAlias ?? ''}
          onChange={(e) =>
            updateRole(selectedRelationshipIndex, side, {
              entityRef: { ...(role.entityRef ?? { namespaceAlias: '' }), namespaceAlias: e.target.value }
            })
          }
        >
          <option value="">—</option>
          {getNamespaceAliases().map(alias => (
            <option key={alias} value={alias}>{alias}</option>
          ))}
        </select>

        <label>{L('relationships.form.role.entityRefEntity', 'EntityRef entity')}</label>
        <select
          value={role.entityRef?.entity ?? ''}
          onChange={(e) =>
            updateRole(selectedRelationshipIndex, side, {
              entityRef: { ...(role.entityRef ?? { namespaceAlias: '' }), entity: e.target.value }
            })
          }
        >
          <option value="">—</option>
          {getAvailableEntities(role.entityRef?.namespaceAlias).map(entity => (
            <option key={entity} value={entity}>{entity}</option>
          ))}
        </select>

        <label>{L('relationships.form.role.entityRefAttribute', 'EntityRef attribute')}</label>
        <select
          value={role.entityRef?.attribute ?? ''}
          onChange={(e) =>
            updateRole(selectedRelationshipIndex, side, {
              entityRef: { ...(role.entityRef ?? { namespaceAlias: '' }), attribute: e.target.value }
            })
          }
        >
          <option value="">—</option>
          {getAvailableAttributes(role.entityRef?.entity ?? '', role.entityRef?.namespaceAlias).map(attr => (
            <option key={attr} value={attr}>{attr}</option>
          ))}
        </select>

        <label>{L('relationships.form.role.description', 'Popis roly')}</label>
        <input
          value={role.description ?? ''}
          onChange={(e) => updateRole(selectedRelationshipIndex, side, { description: e.target.value })}
        />
      </div>
    );
  };

  return (
    <div className="dm-root">
      <header className="dm-header">
        <div className="header-top">
          <strong>{model.domain?.name ?? 'Domain Model'}</strong>
          <span>
            {entities.length} entit | {simpleTypeCount} simpleTypes | {relationshipCount} relationships | {glossaryCount} glossary | {eventGlossaryCount} eventGlossary | {actorCount} actors | {namespaceCount} namespace
          </span>
        </div>
        {availableModels.length > 1 && (
          <div className="model-selector">
            <label>{DL('header.model', 'Model')}:</label>
            <select value={currentModelPath} onChange={(e) => handleModelSwitch(e.target.value)}>
              {availableModels.map(item => (
                <option key={item.path} value={item.path}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      <main className="dm-detail">
        <div className="tab-row">
          <button className={topTab === 'entities' ? 'tab active' : 'tab'} onClick={() => setTopTab('entities')}>
            {DL('topTabs.entities', 'Entity')}
          </button>
          <button className={topTab === 'simpleTypes' ? 'tab active' : 'tab'} onClick={() => setTopTab('simpleTypes')}>
            {DL('topTabs.simpleTypes', 'simpleTypes')}
          </button>
          <button className={topTab === 'relationships' ? 'tab active' : 'tab'} onClick={() => setTopTab('relationships')}>
            {DL('topTabs.relationships', 'Relationships')}
          </button>
          <button className={topTab === 'glossary' ? 'tab active' : 'tab'} onClick={() => setTopTab('glossary')}>
            {DL('topTabs.glossary', 'Glossary')}
          </button>
          <button className={topTab === 'eventGlossary' ? 'tab active' : 'tab'} onClick={() => setTopTab('eventGlossary')}>
            {DL('topTabs.eventGlossary', 'eventGlossary')}
          </button>
          <button className={topTab === 'actors' ? 'tab active' : 'tab'} onClick={() => setTopTab('actors')}>
            {DL('topTabs.actors', 'Actors')}
          </button>
          <button className={topTab === 'namespaceRef' ? 'tab active' : 'tab'} onClick={() => setTopTab('namespaceRef')}>
            {DL('topTabs.namespaceRef', 'namespaceRef')}
          </button>
        </div>

        {topTab === 'entities' && (
          <section className="panel">
            <div className="panel-head">
              <h3>{DL('entities.view.title', 'Entity')}</h3>
              <button onClick={addEntity}>{DL('entities.view.add', '+ Entita')}</button>
            </div>

            <table className="dm-table">
              <thead>
                <tr>
                  <th>{DL('entities.columns.name', 'Nazov')}</th>
                  <th>{DL('entities.columns.description', 'Popis')}</th>
                  <th>{DL('entities.columns.attributes', 'Atributy')}</th>
                  <th>{DL('entities.columns.functions', 'Funkcie')}</th>
                  <th>{DL('entities.columns.stateModel', 'StateModel')}</th>
                  <th>{DL('entities.columns.actions', 'Akcie')}</th>
                </tr>
              </thead>
              <tbody>
                {entities.map((entity, i) => (
                  <tr key={entity.name + i} className={selectedEntityIndex === i ? 'selected' : ''} onClick={() => selectEntity(i)}>
                    <td>{entity.name}</td>
                    <td>{entity.description ?? '-'}</td>
                    <td>{entity.attributes?.length ?? 0}</td>
                    <td>{entity.functions?.length ?? 0}</td>
                    <td>{entity.stateModel?.length ?? 0}</td>
                    <td>
                      <div className="inline-actions">
                        <button disabled={i === 0} onClick={(e) => { e.stopPropagation(); moveEntity(i, -1); }}>↑</button>
                        <button disabled={i === entities.length - 1} onClick={(e) => { e.stopPropagation(); moveEntity(i, 1); }}>↓</button>
                        <button onClick={(e) => { e.stopPropagation(); removeEntity(i); }}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!selectedEntity && <p className="muted">{DL('entities.view.empty', 'Vyber entitu na editaciu.')}</p>}

            {selectedEntity && selectedEntityIndex !== null && (
              <div className="item-card">
                <h4>{DL('entities.view.detail', 'Detail entity')}</h4>
                <label>{DL('entities.form.name', 'Nazov entity')}</label>
                <input value={selectedEntity.name} onChange={(e) => updateEntity(selectedEntityIndex, { name: e.target.value })} />

                <label>{DL('entities.form.description', 'Popis')}</label>
                <textarea rows={3} value={selectedEntity.description ?? ''} onChange={(e) => updateEntity(selectedEntityIndex, { description: e.target.value })} />

                <label>{DL('entities.form.type', 'Typ')}</label>
                <select
                  value={selectedEntity.type ?? ''}
                  onChange={(e) => updateEntity(selectedEntityIndex, {
                    type: (e.target.value || undefined) as Entity['type']
                  })}
                >
                  <option value="">-</option>
                  {ENTITY_TYPES.map((entityType) => (
                    <option key={entityType} value={entityType}>{entityType}</option>
                  ))}
                </select>

                <label>{DL('entities.form.agregationStatus', 'Agregation status')}</label>
                <select
                  value={selectedEntity.agregationStatus ?? ''}
                  onChange={(e) => updateEntity(selectedEntityIndex, {
                    agregationStatus: (e.target.value || undefined) as Entity['agregationStatus']
                  })}
                >
                  <option value="">-</option>
                  {ENTITY_AGREGATION_STATUSES.map((agregationStatus) => (
                    <option key={agregationStatus} value={agregationStatus}>{agregationStatus}</option>
                  ))}
                </select>

                <label>{DL('entities.form.status', 'Status')}</label>
                <select
                  value={selectedEntity.status ?? 'active'}
                  onChange={(e) => updateEntity(selectedEntityIndex, { status: e.target.value as Entity['status'] })}
                >
                  <option value="active">active</option>
                  <option value="deprecated">deprecated</option>
                </select>

                <div className="tab-row sub">
                  <button className={entityTab === 'attributes' ? 'tab active' : 'tab'} onClick={() => setEntityTab('attributes')}>
                    {DL('entities.view.subTabs.attributes', 'Atributy')}
                  </button>
                  <button className={entityTab === 'functions' ? 'tab active' : 'tab'} onClick={() => setEntityTab('functions')}>
                    {DL('entities.view.subTabs.functions', 'Funkcie')}
                  </button>
                  <button className={entityTab === 'stateModel' ? 'tab active' : 'tab'} onClick={() => setEntityTab('stateModel')}>
                    {DL('entities.view.subTabs.stateModel', 'stateModel')}
                  </button>
                </div>

                {entityTab === 'attributes' && (
                  <section className="panel nested">
                    <div className="panel-head">
                      <h4>{L('attributes.view.title', 'Atributy')}</h4>
                      <button onClick={addAttribute}>{L('attributes.view.add', '+ Atribut')}</button>
                    </div>

                    <table className="dm-table">
                      <thead>
                        <tr>
                          <th>{L('attributes.columns.name', 'Nazov')}</th>
                          <th>{L('attributes.columns.type', 'Typ')}</th>
                          <th>{L('attributes.columns.nullable', 'Nullable')}</th>
                          <th>{L('attributes.columns.states', 'States')}</th>
                          <th>{L('attributes.columns.actions', 'Akcie')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedEntity.attributes ?? []).map((attr, i) => (
                          <tr key={(attr.namedType?.name ?? attr.name ?? 'attr') + i} className={selectedAttributeIndex === i ? 'selected' : ''} onClick={() => { setSelectedAttributeIndex(i); setSelectedAttributeStateIndex(null); }}>
                            <td>{attr.namedType?.name ?? attr.name ?? '-'}</td>
                            <td>{displayType(attr.namedType)}</td>
                            <td>{(attr.namedType?.nullable ?? attr.nullable ?? true) ? 'true' : 'false'}</td>
                            <td>{attr.states?.length ?? 0}</td>
                            <td>
                              <div className="inline-actions">
                                <button disabled={i === 0} onClick={(e) => { e.stopPropagation(); moveAttribute(i, -1); }}>↑</button>
                                <button disabled={i === (selectedEntity.attributes ?? []).length - 1} onClick={(e) => { e.stopPropagation(); moveAttribute(i, 1); }}>↓</button>
                                <button onClick={(e) => { e.stopPropagation(); removeAttribute(i); }}>✕</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {selectedAttribute && selectedAttributeIndex !== null && (
                      <div className="item-card compact">
                        <h4>{L('attributes.view.detail', 'Detail atributu')}</h4>
                        <label>{L('attributes.form.name', 'Nazov')}</label>
                        <input
                          value={selectedAttribute.namedType?.name ?? selectedAttribute.name ?? ''}
                          onChange={(e) => updateAttribute(selectedAttributeIndex, {
                            namedType: {
                              ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.namedType?.name ?? selectedAttribute.name ?? ''),
                              name: e.target.value
                            }
                          })}
                        />

                        <label>{L('attributes.form.type', 'Typ')}</label>
                        <select
                          value={selectedAttribute.namedType?.type ?? selectedAttribute.type ?? ''}
                          onChange={(e) => updateAttribute(selectedAttributeIndex, {
                            namedType: {
                              ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.namedType?.name ?? selectedAttribute.name ?? ''),
                              type: (e.target.value || undefined) as 'entityRef' | 'definition' | 'typeRef' | undefined
                            }
                          })}
                        >
                          <option value="">-</option>
                          {ATTRIBUTE_TYPES.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>

                        {(selectedAttribute.namedType?.type ?? selectedAttribute.type ?? '') === 'entityRef' && (
                          <>
                            <label>{L('attributes.form.entityRefNamespaceAlias', 'EntityRef namespaceAlias')}</label>
                            <select
                              value={selectedAttribute.namedType?.entityRef?.namespaceAlias ?? selectedAttribute.entityRef?.namespaceAlias ?? ''}
                              onChange={(e) => updateAttribute(selectedAttributeIndex, {
                                namedType: {
                                  ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.namedType?.name ?? selectedAttribute.name ?? ''),
                                  entityRef: {
                                    ...(selectedAttribute.namedType?.entityRef ?? { namespaceAlias: '', entity: '', attribute: '' }),
                                    namespaceAlias: e.target.value
                                  }
                                }
                              })}
                            >
                              <option value="">—</option>
                              {getNamespaceAliases().map(alias => (
                                <option key={alias} value={alias}>{alias}</option>
                              ))}
                            </select>

                            <label>{L('attributes.form.entityRefEntity', 'EntityRef entity')}</label>
                            <select
                              value={selectedAttribute.namedType?.entityRef?.entity ?? selectedAttribute.entityRef?.entity ?? ''}
                              onChange={(e) => updateAttribute(selectedAttributeIndex, {
                                namedType: {
                                  ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.namedType?.name ?? selectedAttribute.name ?? ''),
                                  entityRef: {
                                    ...(selectedAttribute.namedType?.entityRef ?? { namespaceAlias: '', entity: '', attribute: '' }),
                                    entity: e.target.value
                                  }
                                }
                              })}
                            >
                              <option value="">—</option>
                              {getAvailableEntities(selectedAttribute.namedType?.entityRef?.namespaceAlias ?? selectedAttribute.entityRef?.namespaceAlias).map(entity => (
                                <option key={entity} value={entity}>{entity}</option>
                              ))}
                            </select>

                            <label>{L('attributes.form.entityRefAttribute', 'EntityRef attribute')}</label>
                            <select
                              value={selectedAttribute.namedType?.entityRef?.attribute ?? selectedAttribute.entityRef?.attribute ?? ''}
                              onChange={(e) => updateAttribute(selectedAttributeIndex, {
                                namedType: {
                                  ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.namedType?.name ?? selectedAttribute.name ?? ''),
                                  entityRef: {
                                    ...(selectedAttribute.namedType?.entityRef ?? { namespaceAlias: '', entity: '', attribute: '' }),
                                    attribute: e.target.value
                                  }
                                }
                              })}
                            >
                              <option value="">—</option>
                              {getAvailableAttributes(
                                selectedAttribute.namedType?.entityRef?.entity ?? selectedAttribute.entityRef?.entity ?? '',
                                selectedAttribute.namedType?.entityRef?.namespaceAlias ?? selectedAttribute.entityRef?.namespaceAlias
                              ).map(attr => (
                                <option key={attr} value={attr}>{attr}</option>
                              ))}
                            </select>
                          </>
                        )}

                        {(selectedAttribute.namedType?.type ?? selectedAttribute.type ?? '') === 'typeRef' && (
                          <>
                            <label>{L('attributes.typeRefNamespaceAlias', 'TypeRef namespaceAlias')}</label>
                            <select
                              value={selectedAttribute.namedType?.typeRef?.namespaceAlias ?? ''}
                              onChange={(e) => updateAttribute(selectedAttributeIndex, {
                                namedType: {
                                  ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.namedType?.name ?? selectedAttribute.name ?? ''),
                                  typeRef: {
                                    ...(selectedAttribute.namedType?.typeRef ?? { namespaceAlias: '', simpleType: '' }),
                                    namespaceAlias: e.target.value
                                  }
                                }
                              })}
                            >
                              <option value="">—</option>
                              {getNamespaceAliases().map(alias => (
                                <option key={alias} value={alias}>{alias}</option>
                              ))}
                            </select>

                            <label>{L('attributes.typeRefSimpleType', 'TypeRef simpleType')}</label>
                            <select
                              value={selectedAttribute.namedType?.typeRef?.simpleType ?? ''}
                              onChange={(e) => updateAttribute(selectedAttributeIndex, {
                                namedType: {
                                  ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.namedType?.name ?? selectedAttribute.name ?? ''),
                                  typeRef: {
                                    ...(selectedAttribute.namedType?.typeRef ?? { namespaceAlias: '', simpleType: '' }),
                                    simpleType: e.target.value
                                  }
                                }
                              })}
                            >
                              <option value="">—</option>
                              {getAvailableSimpleTypes(selectedAttribute.namedType?.typeRef?.namespaceAlias).map(st => (
                                <option key={st} value={st}>{st}</option>
                              ))}
                            </select>
                          </>
                        )}

                        {(selectedAttribute.namedType?.type ?? selectedAttribute.type ?? '') === 'definition' && (
                          <>
                            <label>{L('attributes.definitionKind', 'Definition kind')}</label>
                            <select
                              value={selectedAttribute.namedType?.definition?.restriction ? 'restriction' : selectedAttribute.namedType?.definition?.list ? 'list' : 'union'}
                              onChange={(e) => {
                                const mode = e.target.value as 'restriction' | 'list' | 'union';
                                const currentNamedType = normalizeNamedType(selectedAttribute.namedType, selectedAttribute.namedType?.name ?? selectedAttribute.name ?? '');
                                const nextDefinition: SimpleTypeDefinition =
                                  mode === 'restriction'
                                    ? { restriction: normalizeRestriction(currentNamedType.definition?.restriction) }
                                    : mode === 'list'
                                      ? { list: { itemType: currentNamedType.definition?.list?.itemType ?? 'string' } }
                                      : { union: { memberTypes: currentNamedType.definition?.union?.memberTypes ?? [] } };

                                updateAttribute(selectedAttributeIndex, {
                                  namedType: {
                                    ...currentNamedType,
                                    definition: nextDefinition
                                  }
                                });
                              }}
                            >
                              <option value="restriction">restriction</option>
                              <option value="list">list</option>
                              <option value="union">union</option>
                            </select>

                            {(selectedAttribute.namedType?.definition?.restriction || (!selectedAttribute.namedType?.definition?.list && !selectedAttribute.namedType?.definition?.union)) && (
                              <>
                                <label>{L('attributes.definition.restriction.base', 'restriction.base type')}</label>
                                <select
                                  value={typeof selectedAttribute.namedType?.definition?.restriction?.base === 'string' ? 'primitive' : 'reference'}
                                  onChange={(e) => {
                                    const isPrimitive = e.target.value === 'primitive';
                                    updateAttribute(selectedAttributeIndex, {
                                      namedType: {
                                        ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.namedType?.name ?? selectedAttribute.name ?? ''),
                                        definition: {
                                          restriction: {
                                            ...normalizeRestriction(selectedAttribute.namedType?.definition?.restriction),
                                            base: isPrimitive ? 'string' : { namespaceAlias: '', simpleType: '' }
                                          }
                                        }
                                      }
                                    });
                                  }}
                                >
                                  <option value="primitive">Primitív typ</option>
                                  <option value="reference">SimpleType referencia</option>
                                </select>

                                {typeof selectedAttribute.namedType?.definition?.restriction?.base === 'string' ? (
                                  <>
                                    <label>{L('attributes.definition.restriction.basePrimitive', 'Base primitív typ')}</label>
                                    <select
                                      value={selectedAttribute.namedType?.definition?.restriction?.base as string}
                                      onChange={(e) => updateAttribute(selectedAttributeIndex, {
                                        namedType: {
                                          ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.namedType?.name ?? selectedAttribute.name ?? ''),
                                          definition: {
                                            restriction: {
                                              ...normalizeRestriction(selectedAttribute.namedType?.definition?.restriction),
                                              base: e.target.value
                                            }
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
                                    <label>{L('attributes.definition.restriction.baseNamespaceAlias', 'restriction.base namespaceAlias')}</label>
                                    <select
                                      value={(selectedAttribute.namedType?.definition?.restriction?.base as SimpleTypeRef)?.namespaceAlias ?? ''}
                                      onChange={(e) => updateAttribute(selectedAttributeIndex, {
                                        namedType: {
                                          ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.namedType?.name ?? selectedAttribute.name ?? ''),
                                          definition: {
                                            restriction: {
                                              ...normalizeRestriction(selectedAttribute.namedType?.definition?.restriction),
                                              base: {
                                                ...normalizeSimpleTypeRef(selectedAttribute.namedType?.definition?.restriction?.base as SimpleTypeRef),
                                                namespaceAlias: e.target.value
                                              }
                                            }
                                          }
                                        }
                                      })}
                                    >
                                      <option value="">—</option>
                                      {getNamespaceAliases().map(alias => (
                                        <option key={alias} value={alias}>{alias}</option>
                                      ))}
                                    </select>

                                    <label>{L('attributes.definition.restriction.baseSimpleType', 'restriction.base simpleType')}</label>
                                    <select
                                      value={(selectedAttribute.namedType?.definition?.restriction?.base as SimpleTypeRef)?.simpleType ?? ''}
                                      onChange={(e) => updateAttribute(selectedAttributeIndex, {
                                        namedType: {
                                          ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.namedType?.name ?? selectedAttribute.name ?? ''),
                                          definition: {
                                            restriction: {
                                              ...normalizeRestriction(selectedAttribute.namedType?.definition?.restriction),
                                              base: {
                                                ...normalizeSimpleTypeRef(selectedAttribute.namedType?.definition?.restriction?.base as SimpleTypeRef),
                                                simpleType: e.target.value
                                              }
                                            }
                                          }
                                        }
                                      })}
                                    >
                                      <option value="">—</option>
                                      {getAvailableSimpleTypes((selectedAttribute.namedType?.definition?.restriction?.base as SimpleTypeRef)?.namespaceAlias).map(st => (
                                        <option key={st} value={st}>{st}</option>
                                      ))}
                                    </select>
                                  </>
                                )}


                                <div style={{ margin: '12px 0', padding: '8px', borderTop: '2px solid #ccc', borderBottom: '2px solid #ccc', backgroundColor: '#f5f5f5' }}>
                                  <label style={{ fontWeight: 'bold' }}>{L('attributes.definition.restriction.enumeration', '📋 restriction.enumeration (CSV)')}</label>
                                  <p style={{ fontSize: '0.85em', marginTop: '0.2em', marginBottom: '0.5em', fontStyle: 'italic', color: '#666' }}>
                                    Ak nastavíš enumeration, ostatné facety sa ignorujú — hodnota musí byť z tohto zoznamu
                                  </p>
                                  <input
                                    value={(selectedAttribute.namedType?.definition?.restriction?.enumeration ?? []).join(', ')}
                                    onChange={(e) => updateAttribute(selectedAttributeIndex, {
                                      namedType: {
                                        ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.name ?? ''),
                                        definition: {
                                          restriction: {
                                            ...normalizeRestriction(selectedAttribute.namedType?.definition?.restriction),
                                            enumeration: parseEnumerationCsv(e.target.value)
                                          }
                                        }
                                      }
                                    })}
                                    style={{ width: '100%', padding: '4px' }}
                                  />
                                </div>


                                {(!selectedAttribute.namedType?.definition?.restriction?.enumeration || selectedAttribute.namedType.definition.restriction.enumeration.length === 0) && (
                                  <>
                                    <label>{L('attributes.definition.restriction.pattern', 'restriction.pattern (regex)')}</label>
                                    <input
                                      value={selectedAttribute.namedType?.definition?.restriction?.pattern ?? ''}
                                      onChange={(e) => updateAttribute(selectedAttributeIndex, {
                                        namedType: {
                                          ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.namedType?.name ?? selectedAttribute.name ?? ''),
                                          definition: {
                                            restriction: {
                                              ...normalizeRestriction(selectedAttribute.namedType?.definition?.restriction),
                                              pattern: e.target.value
                                            }
                                          }
                                        }
                                      })}
                                    />
                                    <label>{L('attributes.definition.restriction.length', 'restriction.length')}</label>
                                    <input
                                      type="number"
                                      value={selectedAttribute.namedType?.definition?.restriction?.length ?? ''}
                                      onChange={(e) => updateAttribute(selectedAttributeIndex, {
                                        namedType: {
                                          ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.namedType?.name ?? selectedAttribute.name ?? ''),
                                          definition: {
                                            restriction: {
                                              ...normalizeRestriction(selectedAttribute.namedType?.definition?.restriction),
                                              length: e.target.value ? parseInt(e.target.value, 10) : undefined
                                            }
                                          }
                                        }
                                      })}
                                    />
                                    <label>{L('attributes.definition.restriction.minLength', 'restriction.minLength')}</label>
                                    <input
                                      type="number"
                                      value={selectedAttribute.namedType?.definition?.restriction?.minLength ?? ''}
                                      onChange={(e) => updateAttribute(selectedAttributeIndex, {
                                        namedType: {
                                          ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.namedType?.name ?? selectedAttribute.name ?? ''),
                                          definition: {
                                            restriction: {
                                              ...normalizeRestriction(selectedAttribute.namedType?.definition?.restriction),
                                              minLength: e.target.value ? parseInt(e.target.value, 10) : undefined
                                            }
                                          }
                                        }
                                      })}
                                    />
                                    <label>{L('attributes.definition.restriction.maxLength', 'restriction.maxLength')}</label>
                                    <input
                                      type="number"
                                      value={selectedAttribute.namedType?.definition?.restriction?.maxLength ?? ''}
                                      onChange={(e) => updateAttribute(selectedAttributeIndex, {
                                        namedType: {
                                          ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.name ?? ''),
                                          definition: {
                                            restriction: {
                                              ...normalizeRestriction(selectedAttribute.namedType?.definition?.restriction),
                                              maxLength: e.target.value ? parseInt(e.target.value, 10) : undefined
                                            }
                                          }
                                        }
                                      })}
                                    />
                                    <label>{L('attributes.definition.restriction.minInclusive', 'restriction.minInclusive')}</label>
                                    <input
                                      value={selectedAttribute.namedType?.definition?.restriction?.minInclusive ?? ''}
                                      onChange={(e) => updateAttribute(selectedAttributeIndex, {
                                        namedType: {
                                          ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.name ?? ''),
                                          definition: {
                                            restriction: {
                                              ...normalizeRestriction(selectedAttribute.namedType?.definition?.restriction),
                                              minInclusive: e.target.value ? (isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)) : undefined
                                            }
                                          }
                                        }
                                      })}
                                    />
                                    <label>{L('attributes.definition.restriction.maxInclusive', 'restriction.maxInclusive')}</label>
                                    <input
                                      value={selectedAttribute.namedType?.definition?.restriction?.maxInclusive ?? ''}
                                      onChange={(e) => updateAttribute(selectedAttributeIndex, {
                                        namedType: {
                                          ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.name ?? ''),
                                          definition: {
                                            restriction: {
                                              ...normalizeRestriction(selectedAttribute.namedType?.definition?.restriction),
                                              maxInclusive: e.target.value ? (isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)) : undefined
                                            }
                                          }
                                        }
                                      })}
                                    />
                                    <label>{L('attributes.definition.restriction.minExclusive', 'restriction.minExclusive')}</label>
                                    <input
                                      value={selectedAttribute.namedType?.definition?.restriction?.minExclusive ?? ''}
                                      onChange={(e) => updateAttribute(selectedAttributeIndex, {
                                        namedType: {
                                          ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.name ?? ''),
                                          definition: {
                                            restriction: {
                                              ...normalizeRestriction(selectedAttribute.namedType?.definition?.restriction),
                                              minExclusive: e.target.value ? (isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)) : undefined
                                            }
                                          }
                                        }
                                      })}
                                    />
                                    <label>{L('attributes.definition.restriction.maxExclusive', 'restriction.maxExclusive')}</label>
                                    <input
                                      value={selectedAttribute.namedType?.definition?.restriction?.maxExclusive ?? ''}
                                      onChange={(e) => updateAttribute(selectedAttributeIndex, {
                                        namedType: {
                                          ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.name ?? ''),
                                          definition: {
                                            restriction: {
                                              ...normalizeRestriction(selectedAttribute.namedType?.definition?.restriction),
                                              maxExclusive: e.target.value ? (isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)) : undefined
                                            }
                                          }
                                        }
                                      })}
                                    />
                                    <label>{L('attributes.definition.restriction.totalDigits', 'restriction.totalDigits')}</label>
                                    <input
                                      type="number"
                                      value={selectedAttribute.namedType?.definition?.restriction?.totalDigits ?? ''}
                                      onChange={(e) => updateAttribute(selectedAttributeIndex, {
                                        namedType: {
                                          ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.name ?? ''),
                                          definition: {
                                            restriction: {
                                              ...normalizeRestriction(selectedAttribute.namedType?.definition?.restriction),
                                              totalDigits: e.target.value ? parseInt(e.target.value, 10) : undefined
                                            }
                                          }
                                        }
                                      })}
                                    />
                                    <label>{L('attributes.definition.restriction.fractionDigits', 'restriction.fractionDigits')}</label>
                                    <input
                                      type="number"
                                      value={selectedAttribute.namedType?.definition?.restriction?.fractionDigits ?? ''}
                                      onChange={(e) => updateAttribute(selectedAttributeIndex, {
                                        namedType: {
                                          ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.name ?? ''),
                                          definition: {
                                            restriction: {
                                              ...normalizeRestriction(selectedAttribute.namedType?.definition?.restriction),
                                              fractionDigits: e.target.value ? parseInt(e.target.value, 10) : undefined
                                            }
                                          }
                                        }
                                      })}
                                    />
                                    <label>{L('attributes.definition.restriction.whiteSpace', 'restriction.whiteSpace')}</label>
                                    <select
                                      value={selectedAttribute.namedType?.definition?.restriction?.whiteSpace ?? ''}
                                      onChange={(e) => updateAttribute(selectedAttributeIndex, {
                                        namedType: {
                                          ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.name ?? ''),
                                          definition: {
                                            restriction: {
                                              ...normalizeRestriction(selectedAttribute.namedType?.definition?.restriction),
                                              whiteSpace: e.target.value as 'preserve' | 'replace' | 'collapse' | undefined
                                            }
                                          }
                                        }
                                      })}
                                    >
                                      <option value="">— (default)</option>
                                      <option value="preserve">preserve</option>
                                      <option value="replace">replace</option>
                                      <option value="collapse">collapse</option>
                                    </select>
                                  </>
                                )}

                                <label>{L('attributes.definition.restriction.minExclusive', 'restriction.minExclusive')}</label>
                                <input
                                  value={selectedAttribute.namedType?.definition?.restriction?.minExclusive ?? ''}
                                  onChange={(e) => updateAttribute(selectedAttributeIndex, {
                                    namedType: {
                                      ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.name ?? ''),
                                      definition: {
                                        restriction: {
                                          ...normalizeRestriction(selectedAttribute.namedType?.definition?.restriction),
                                          minExclusive: e.target.value ? (isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)) : undefined
                                        }
                                      }
                                    }
                                  })}
                                />

                                <label>{L('attributes.definition.restriction.maxExclusive', 'restriction.maxExclusive')}</label>
                                <input
                                  value={selectedAttribute.namedType?.definition?.restriction?.maxExclusive ?? ''}
                                  onChange={(e) => updateAttribute(selectedAttributeIndex, {
                                    namedType: {
                                      ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.name ?? ''),
                                      definition: {
                                        restriction: {
                                          ...normalizeRestriction(selectedAttribute.namedType?.definition?.restriction),
                                          maxExclusive: e.target.value ? (isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)) : undefined
                                        }
                                      }
                                    }
                                  })}
                                />

                                <label>{L('attributes.definition.restriction.totalDigits', 'restriction.totalDigits')}</label>
                                <input
                                  type="number"
                                  value={selectedAttribute.namedType?.definition?.restriction?.totalDigits ?? ''}
                                  onChange={(e) => updateAttribute(selectedAttributeIndex, {
                                    namedType: {
                                      ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.name ?? ''),
                                      definition: {
                                        restriction: {
                                          ...normalizeRestriction(selectedAttribute.namedType?.definition?.restriction),
                                          totalDigits: e.target.value ? parseInt(e.target.value, 10) : undefined
                                        }
                                      }
                                    }
                                  })}
                                />

                                <label>{L('attributes.definition.restriction.fractionDigits', 'restriction.fractionDigits')}</label>
                                <input
                                  type="number"
                                  value={selectedAttribute.namedType?.definition?.restriction?.fractionDigits ?? ''}
                                  onChange={(e) => updateAttribute(selectedAttributeIndex, {
                                    namedType: {
                                      ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.name ?? ''),
                                      definition: {
                                        restriction: {
                                          ...normalizeRestriction(selectedAttribute.namedType?.definition?.restriction),
                                          fractionDigits: e.target.value ? parseInt(e.target.value, 10) : undefined
                                        }
                                      }
                                    }
                                  })}
                                />

                                <label>{L('attributes.definition.restriction.whiteSpace', 'restriction.whiteSpace')}</label>
                                <select
                                  value={selectedAttribute.namedType?.definition?.restriction?.whiteSpace ?? ''}
                                  onChange={(e) => updateAttribute(selectedAttributeIndex, {
                                    namedType: {
                                      ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.name ?? ''),
                                      definition: {
                                        restriction: {
                                          ...normalizeRestriction(selectedAttribute.namedType?.definition?.restriction),
                                          whiteSpace: e.target.value as 'preserve' | 'replace' | 'collapse' | undefined
                                        }
                                      }
                                    }
                                  })}
                                >
                                  <option value="">— (default)</option>
                                  <option value="preserve">preserve</option>
                                  <option value="replace">replace</option>
                                  <option value="collapse">collapse</option>
                                </select>
                              </>
                            )}

                            {selectedAttribute.namedType?.definition?.list && (
                              <>
                                <label>{L('attributes.definition.list.itemType', 'list.itemType type')}</label>
                                <select
                                  value={typeof selectedAttribute.namedType?.definition?.list?.itemType === 'string' ? 'primitive' : 'reference'}
                                  onChange={(e) => {
                                    const isPrimitive = e.target.value === 'primitive';
                                    updateAttribute(selectedAttributeIndex, {
                                      namedType: {
                                        ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.name ?? ''),
                                        definition: {
                                          list: {
                                            itemType: isPrimitive ? 'string' : { namespaceAlias: '', simpleType: '' }
                                          }
                                        }
                                      }
                                    });
                                  }}
                                >
                                  <option value="primitive">Primitív typ</option>
                                  <option value="reference">SimpleType referencia</option>
                                </select>

                                {typeof selectedAttribute.namedType?.definition?.list?.itemType === 'string' ? (
                                  <>
                                    <label>{L('attributes.definition.list.itemTypePrimitive', 'itemType primitív typ')}</label>
                                    <select
                                      value={selectedAttribute.namedType?.definition?.list?.itemType as string}
                                      onChange={(e) => updateAttribute(selectedAttributeIndex, {
                                        namedType: {
                                          ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.name ?? ''),
                                          definition: {
                                            list: {
                                              itemType: e.target.value
                                            }
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
                                    <label>{L('attributes.definition.list.namespaceAlias', 'list.itemType namespaceAlias')}</label>
                                    <select
                                      value={(selectedAttribute.namedType?.definition?.list?.itemType as SimpleTypeRef)?.namespaceAlias ?? ''}
                                      onChange={(e) => updateAttribute(selectedAttributeIndex, {
                                        namedType: {
                                          ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.name ?? ''),
                                          definition: {
                                            list: {
                                              itemType: {
                                                ...normalizeSimpleTypeRef(selectedAttribute.namedType?.definition?.list?.itemType as SimpleTypeRef),
                                                namespaceAlias: e.target.value
                                              }
                                            }
                                          }
                                        }
                                      })}
                                    >
                                      <option value="">—</option>
                                      {getNamespaceAliases().map(alias => (
                                        <option key={alias} value={alias}>{alias}</option>
                                      ))}
                                    </select>

                                    <label>{L('attributes.definition.list.simpleType', 'list.itemType simpleType')}</label>
                                    <select
                                      value={(selectedAttribute.namedType?.definition?.list?.itemType as SimpleTypeRef)?.simpleType ?? ''}
                                      onChange={(e) => updateAttribute(selectedAttributeIndex, {
                                        namedType: {
                                          ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.name ?? ''),
                                          definition: {
                                            list: {
                                              itemType: {
                                                ...normalizeSimpleTypeRef(selectedAttribute.namedType?.definition?.list?.itemType as SimpleTypeRef),
                                                simpleType: e.target.value
                                              }
                                            }
                                          }
                                        }
                                      })}
                                    >
                                      <option value="">—</option>
                                      {getAvailableSimpleTypes((selectedAttribute.namedType?.definition?.list?.itemType as SimpleTypeRef)?.namespaceAlias).map(st => (
                                        <option key={st} value={st}>{st}</option>
                                      ))}
                                    </select>
                                  </>
                                )}
                              </>
                            )}

                            {selectedAttribute.namedType?.definition?.union && (
                              <>
                                <label>{L('attributes.definition.union.memberTypes', 'union.memberTypes')}</label>
                                <p style={{ fontSize: '0.85em', marginTop: '0.2em', marginBottom: '0.2em' }}>
                                  Primiešajte primitívne typy a/alebo SimpleType referencie (referencie: namespaceAlias:simpleType, jeden na riadok)
                                </p>
                                <textarea
                                  rows={4}
                                  value={(selectedAttribute.namedType?.definition?.union?.memberTypes ?? []).map(item =>
                                    typeof item === 'string' ? item : simpleTypeRefToText(item)
                                  ).join('\n')}
                                  onChange={(e) => {
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
                                    updateAttribute(selectedAttributeIndex, {
                                      namedType: {
                                        ...normalizeNamedType(selectedAttribute.namedType, selectedAttribute.name ?? ''),
                                        definition: {
                                          union: {
                                            memberTypes
                                          }
                                        }
                                      }
                                    });
                                  }}
                                />
                              </>
                            )}
                          </>
                        )}

                        <label className="check-row">
                          <input
                            type="checkbox"
                            checked={selectedAttribute.namedType?.nullable ?? selectedAttribute.nullable ?? true}
                            onChange={(e) => updateAttribute(selectedAttributeIndex, {
                              namedType: {
                                ...selectedAttribute.namedType,
                                nullable: e.target.checked,
                                name: selectedAttribute.namedType?.name || '' // Ensure name is always a string
                              }
                            })}
                          />
                          {L('attributes.form.nullable', 'Nullable')}
                        </label>

                        <div className="panel-head compact">
                          <strong>States</strong>
                          <button onClick={addAttributeState}>{L('attributes.form.statesAdd', '+ State')}</button>
                        </div>

                        <table className="dm-table">
                          <thead>
                            <tr>
                              <th>{L('attributes.form.stateCode', 'Code')}</th>
                              <th>{L('attributes.form.stateLabel', 'Label')}</th>
                              <th>{L('attributes.columns.actions', 'Akcie')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(selectedAttribute.states ?? []).map((state, stateIndex) => (
                              <tr key={`${state.code}-${stateIndex}`} className={selectedAttributeStateIndex === stateIndex ? 'selected' : ''} onClick={() => setSelectedAttributeStateIndex(stateIndex)}>
                                <td>{state.code || '-'}</td>
                                <td>{state.label || '-'}</td>
                                <td>
                                  <div className="inline-actions">
                                    <button disabled={stateIndex === 0} onClick={(e) => { e.stopPropagation(); moveAttributeState(stateIndex, -1); }}>↑</button>
                                    <button disabled={stateIndex === (selectedAttribute.states ?? []).length - 1} onClick={(e) => { e.stopPropagation(); moveAttributeState(stateIndex, 1); }}>↓</button>
                                    <button onClick={(e) => { e.stopPropagation(); removeAttributeState(stateIndex); }}>✕</button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {selectedAttributeState && selectedAttributeStateIndex !== null && (
                          <div className="item-card compact">
                            <h4>{L('attributes.form.stateDetail', 'Detail state')}</h4>
                            <label>{L('attributes.form.stateCode', 'Code')}</label>
                            <input value={selectedAttributeState.code} onChange={(e) => updateAttributeState(selectedAttributeStateIndex, { code: e.target.value })} />
                            <label>{L('attributes.form.stateLabel', 'Label')}</label>
                            <input value={selectedAttributeState.label ?? ''} onChange={(e) => updateAttributeState(selectedAttributeStateIndex, { label: e.target.value })} />
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                )}

        {entityTab === 'functions' && (
                  <section className="panel nested">
                    <div className="panel-head">
                      <h4>{L('functions.view.title', 'Funkcie')}</h4>
                      <button onClick={addFunction}>{L('functions.view.add', '+ Funkcia')}</button>
                    </div>

                    <table className="dm-table">
                      <thead>
                        <tr>
                          <th>{L('functions.columns.name', 'Nazov')}</th>
                          <th>{L('functions.columns.description', 'Popis')}</th>
                          <th>{L('functions.columns.parameters', 'Parameters')}</th>
                          <th>{L('functions.columns.actions', 'Akcie')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedEntity.functions ?? []).map((fn, i) => (
                          <tr key={fn.name + i} className={selectedFunctionIndex === i ? 'selected' : ''} onClick={() => setSelectedFunctionIndex(i)}>
                            <td>{fn.name}</td>
                            <td>{fn.behavior?.description ?? '-'}</td>
                            <td>{normalizeFunctionParameters(fn).length}</td>
                            <td>
                              <div className="inline-actions">
                                <button disabled={i === 0} onClick={(e) => { e.stopPropagation(); moveFunction(i, -1); }}>↑</button>
                                <button disabled={i === (selectedEntity.functions ?? []).length - 1} onClick={(e) => { e.stopPropagation(); moveFunction(i, 1); }}>↓</button>
                                <button onClick={(e) => { e.stopPropagation(); removeFunction(i); }}>✕</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {selectedFunction && selectedFunctionIndex !== null && (
                      <div className="item-card compact">
                        <h4>{L('functions.view.detail', 'Detail funkcie')}</h4>
                        
                        <div className="tab-row sub">
                          <button className={functionTab === 'detail' ? 'tab active' : 'tab'} onClick={() => setFunctionTab('detail')}>
                            {L('functions.view.tabs.detail', 'Detail')}
                          </button>
                          <button className={functionTab === 'parameters' ? 'tab active' : 'tab'} onClick={() => setFunctionTab('parameters')}>
                            {L('functions.view.tabs.parameters', 'Parametre')}
                          </button>
                        </div>

                        {functionTab === 'detail' && (
                          <div style={{ marginTop: 12 }}>
                            <label>{L('functions.form.name', 'Nazov')}</label>
                            <input value={selectedFunction.name} onChange={(e) => updateFunction(selectedFunctionIndex, { name: e.target.value })} />

                            <label>{L('functions.form.description', 'Description')}</label>
                            <textarea rows={3} value={selectedFunction.behavior?.description ?? ''} onChange={(e) => updateFunctionBehavior(selectedFunctionIndex, { description: e.target.value })} />

                            <label>{L('functions.form.preconditions', 'Preconditions')}</label>
                            <textarea rows={4} value={(selectedFunction.behavior?.preconditions ?? []).join('\n')} onChange={(e) => updateFunctionBehavior(selectedFunctionIndex, { preconditions: e.target.value.split('\n').filter(s => s.trim().length > 0) })} />

                            <label>{L('functions.form.postconditions', 'Postconditions')}</label>
                            <textarea rows={4} value={(selectedFunction.behavior?.postconditions ?? []).join('\n')} onChange={(e) => updateFunctionBehavior(selectedFunctionIndex, { postconditions: e.target.value.split('\n').filter(s => s.trim().length > 0) })} />

                            <div style={{ marginTop: 16 }}>
                              <AffectedEntitiesEditor
                                affectedEntities={selectedFunction.behavior?.affectedEntities ?? []}
                                modelAliases={getNamespaceAliases()}
                                getEntitiesForAlias={getAvailableEntities}
                                onChange={(affectedEntities) => updateFunctionBehavior(selectedFunctionIndex, { affectedEntities })}
                              />
                            </div>

                            <ActorRefsEditor
                              actorRefs={normalizeActorRefs(selectedFunction.behavior?.actors)}
                              namespaceAliases={getNamespaceAliases()}
                              getAvailableActors={getAvailableActors}
                              onChange={(actors) => updateFunctionBehavior(selectedFunctionIndex, { actors })}
                              prefix="domain"
                            />
                          </div>
                        )}

                        {functionTab === 'parameters' && (
                          <div style={{ marginTop: 12 }}>
                            <ParametersEditor
                              value={normalizeFunctionParameters(selectedFunction)}
                              onChange={(parameters) => updateFunction(selectedFunctionIndex, {
                                parameters,
                                inputs: undefined
                              })}
                              useSelectsForRefs
                              namespaceAliases={getNamespaceAliases()}
                              getAvailableEntities={getAvailableEntities}
                              getAvailableAttributes={getAvailableAttributes}
                              getAvailableSimpleTypes={getAvailableSimpleTypes}
                              showDirection
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                )}

                {entityTab === 'stateModel' && (
                  <section className="panel nested">
                    <div className="panel-head">
                      <h4>{L('stateModel.view.title', 'stateModel')}</h4>
                      <button onClick={addEntityState}>{L('stateModel.view.add', '+ State')}</button>
                    </div>

                    <table className="dm-table">
                      <thead>
                        <tr>
                          <th>{L('stateModel.columns.name', 'Name')}</th>
                          <th>{L('stateModel.columns.label', 'Label')}</th>
                          <th>{L('stateModel.columns.final', 'Final')}</th>
                          <th>{L('stateModel.columns.actions', 'Akcie')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedEntity.stateModel ?? []).map((state, i) => (
                          <tr key={`${state.name}-${i}`} className={selectedStateModelIndex === i ? 'selected' : ''} onClick={() => setSelectedStateModelIndex(i)}>
                            <td>{state.name || '-'}</td>
                            <td>{state.label || '-'}</td>
                            <td>{state.isFinal ? 'true' : 'false'}</td>
                            <td>
                              <div className="inline-actions">
                                <button disabled={i === 0} onClick={(e) => { e.stopPropagation(); moveEntityState(i, -1); }}>↑</button>
                                <button disabled={i === (selectedEntity.stateModel ?? []).length - 1} onClick={(e) => { e.stopPropagation(); moveEntityState(i, 1); }}>↓</button>
                                <button onClick={(e) => { e.stopPropagation(); removeEntityState(i); }}>✕</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {selectedStateModel && selectedStateModelIndex !== null && (
                      <div className="item-card compact">
                        <h4>{L('stateModel.view.detail', 'Detail state model')}</h4>
                        <label>{L('stateModel.form.name', 'Name')}</label>
                        <input value={selectedStateModel.name} onChange={(e) => updateEntityState(selectedStateModelIndex, { name: e.target.value })} />

                        <label>{L('stateModel.form.label', 'Label')}</label>
                        <input value={selectedStateModel.label ?? ''} onChange={(e) => updateEntityState(selectedStateModelIndex, { label: e.target.value })} />

                        <label>{L('stateModel.form.description', 'Popis')}</label>
                        <textarea rows={3} value={selectedStateModel.description ?? ''} onChange={(e) => updateEntityState(selectedStateModelIndex, { description: e.target.value })} />

                        <label className="check-row">
                          <input type="checkbox" checked={selectedStateModel.isFinal ?? false} onChange={(e) => updateEntityState(selectedStateModelIndex, { isFinal: e.target.checked })} />
                          {L('stateModel.form.isFinal', 'isFinal')}
                        </label>
                      </div>
                    )}
                  </section>
                )}

              </div>
            )}
          </section>
        )}

        {topTab === 'simpleTypes' && (
          <section className="panel">
            <div className="panel-head">
              <h3>{L('simpleTypes.title', 'simpleTypes')}</h3>
              <button onClick={addSimpleType}>{L('simpleTypes.add', '+ simpleType')}</button>
            </div>

            <table className="dm-table">
              <thead>
                <tr>
                  <th>{L('simpleTypes.columns.name', 'Name')}</th>
                  <th>{L('simpleTypes.columns.kind', 'Definition kind')}</th>
                  <th>{L('simpleTypes.columns.actions', 'Akcie')}</th>
                </tr>
              </thead>
              <tbody>
                {simpleTypes.map((item, i) => {
                  const definition = normalizeSimpleTypeDefinition(item.definition);
                  return (
                    <tr key={`${item.name}-${i}`} className={selectedSimpleTypeIndex === i ? 'selected' : ''} onClick={() => setSelectedSimpleTypeIndex(i)}>
                      <td>{item.name || '-'}</td>
                      <td>{displaySimpleTypeDefinition(definition)}</td>
                      <td>
                        <div className="inline-actions">
                          <button disabled={i === 0} onClick={(e) => { e.stopPropagation(); moveSimpleType(i, -1); }}>↑</button>
                          <button disabled={i === simpleTypes.length - 1} onClick={(e) => { e.stopPropagation(); moveSimpleType(i, 1); }}>↓</button>
                          <button onClick={(e) => { e.stopPropagation(); removeSimpleType(i); }}>✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {selectedSimpleType && selectedSimpleTypeIndex !== null && (
              <div className="item-card">
                <h4>{L('simpleTypes.detail', 'Detail simpleType')}</h4>

                <label>{L('simpleTypes.name', 'Name')}</label>
                <input value={selectedSimpleType.name} onChange={(e) => updateSimpleType(selectedSimpleTypeIndex, { name: e.target.value })} />

                <label>{L('simpleTypes.definitionKind', 'Definition kind')}</label>
                <select
                  value={selectedSimpleType.definition?.restriction ? 'restriction' : selectedSimpleType.definition?.list ? 'list' : 'union'}
                  onChange={(e) => {
                    const mode = e.target.value as 'restriction' | 'list' | 'union';
                    const nextDefinition: SimpleTypeDefinition =
                      mode === 'restriction'
                        ? { restriction: normalizeRestriction(selectedSimpleType.definition?.restriction) }
                        : mode === 'list'
                          ? { list: { itemType: selectedSimpleType.definition?.list?.itemType ?? 'string' } }
                          : { union: { memberTypes: selectedSimpleType.definition?.union?.memberTypes ?? [] } };
                    updateSimpleType(selectedSimpleTypeIndex, { definition: nextDefinition });
                  }}
                >
                  <option value="restriction">restriction</option>
                  <option value="list">list</option>
                  <option value="union">union</option>
                </select>

                {(selectedSimpleType.definition?.restriction || (!selectedSimpleType.definition?.list && !selectedSimpleType.definition?.union)) && (
                  <>
                    <label>{L('simpleTypes.definition.restriction.base', 'restriction.base type')}</label>
                    <select
                      value={typeof selectedSimpleType.definition?.restriction?.base === 'string' ? 'primitive' : 'reference'}
                      onChange={(e) => {
                        const isPrimitive = e.target.value === 'primitive';
                        updateSimpleType(selectedSimpleTypeIndex, {
                          definition: {
                            restriction: {
                              ...normalizeRestriction(selectedSimpleType.definition?.restriction),
                              base: isPrimitive ? 'string' : { namespaceAlias: '', simpleType: '' }
                            }
                          }
                        });
                      }}
                    >
                      <option value="primitive">Primitív typ</option>
                      <option value="reference">SimpleType referencia</option>
                    </select>

                    {typeof selectedSimpleType.definition?.restriction?.base === 'string' ? (
                      <>
                        <label>{L('simpleTypes.definition.restriction.basePrimitive', 'Base primitív typ')}</label>
                        <select
                          value={selectedSimpleType.definition?.restriction?.base as string}
                          onChange={(e) => updateSimpleType(selectedSimpleTypeIndex, {
                            definition: {
                              restriction: {
                                ...normalizeRestriction(selectedSimpleType.definition?.restriction),
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
                        <label>{L('simpleTypes.definition.restriction.baseNamespaceAlias', 'restriction.base namespaceAlias')}</label>
                        <select
                          value={(selectedSimpleType.definition?.restriction?.base as SimpleTypeRef)?.namespaceAlias ?? ''}
                          onChange={(e) => updateSimpleType(selectedSimpleTypeIndex, {
                            definition: {
                              restriction: {
                                ...normalizeRestriction(selectedSimpleType.definition?.restriction),
                                base: {
                                  ...normalizeSimpleTypeRef(selectedSimpleType.definition?.restriction?.base as SimpleTypeRef),
                                  namespaceAlias: e.target.value
                                }
                              }
                            }
                          })}
                        >
                          <option value="">—</option>
                          {getNamespaceAliases().map(alias => (
                            <option key={alias} value={alias}>{alias}</option>
                          ))}
                        </select>

                        <label>{L('simpleTypes.definition.restriction.baseSimpleType', 'restriction.base simpleType')}</label>
                        <select
                          value={(selectedSimpleType.definition?.restriction?.base as SimpleTypeRef)?.simpleType ?? ''}
                          onChange={(e) => updateSimpleType(selectedSimpleTypeIndex, {
                            definition: {
                              restriction: {
                                ...normalizeRestriction(selectedSimpleType.definition?.restriction),
                                base: {
                                  ...normalizeSimpleTypeRef(selectedSimpleType.definition?.restriction?.base as SimpleTypeRef),
                                  simpleType: e.target.value
                                }
                              }
                            }
                          })}
                        >
                          <option value="">—</option>
                          {getAvailableSimpleTypes((selectedSimpleType.definition?.restriction?.base as SimpleTypeRef)?.namespaceAlias).map(st => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                      </>
                    )}

                    <div style={{ margin: '12px 0', padding: '8px', borderTop: '2px solid #ccc', borderBottom: '2px solid #ccc', backgroundColor: '#f5f5f5' }}>
                      <label style={{ fontWeight: 'bold' }}>{L('simpleTypes.definition.restriction.enumeration', '📋 restriction.enumeration (CSV)')}</label>
                      <p style={{ fontSize: '0.85em', marginTop: '0.2em', marginBottom: '0.5em', fontStyle: 'italic', color: '#666' }}>
                        Ak nastavíš enumeration, ostatné facety sa ignorujú — hodnota musí byť z tohto zoznamu
                      </p>
                      <input
                        value={(selectedSimpleType.definition?.restriction?.enumeration ?? []).join(', ')}
                        onChange={(e) => updateSimpleType(selectedSimpleTypeIndex, {
                          definition: {
                            restriction: {
                              ...normalizeRestriction(selectedSimpleType.definition?.restriction),
                              enumeration: parseEnumerationCsv(e.target.value)
                            }
                          }
                        })}
                        style={{ width: '100%', padding: '4px' }}
                      />
                    </div>

                    {(!selectedSimpleType.definition?.restriction?.enumeration || selectedSimpleType.definition.restriction.enumeration.length === 0) && (
                      <>
                        <label>{L('simpleTypes.definition.restriction.pattern', 'restriction.pattern (regex)')}</label>
                        <input
                          value={selectedSimpleType.definition?.restriction?.pattern ?? ''}
                          onChange={(e) => updateSimpleType(selectedSimpleTypeIndex, {
                            definition: {
                              restriction: {
                                ...normalizeRestriction(selectedSimpleType.definition?.restriction),
                                pattern: e.target.value
                              }
                            }
                          })}
                        />

                    <label>{L('simpleTypes.definition.restriction.length', 'restriction.length')}</label>
                    <input
                      type="number"
                      value={selectedSimpleType.definition?.restriction?.length ?? ''}
                      onChange={(e) => updateSimpleType(selectedSimpleTypeIndex, {
                        definition: {
                          restriction: {
                            ...normalizeRestriction(selectedSimpleType.definition?.restriction),
                            length: e.target.value ? parseInt(e.target.value, 10) : undefined
                          }
                        }
                      })}
                    />

                    <label>{L('simpleTypes.definition.restriction.minLength', 'restriction.minLength')}</label>
                    <input
                      type="number"
                      value={selectedSimpleType.definition?.restriction?.minLength ?? ''}
                      onChange={(e) => updateSimpleType(selectedSimpleTypeIndex, {
                        definition: {
                          restriction: {
                            ...normalizeRestriction(selectedSimpleType.definition?.restriction),
                            minLength: e.target.value ? parseInt(e.target.value, 10) : undefined
                          }
                        }
                      })}
                    />

                    <label>{L('simpleTypes.definition.restriction.maxLength', 'restriction.maxLength')}</label>
                    <input
                      type="number"
                      value={selectedSimpleType.definition?.restriction?.maxLength ?? ''}
                      onChange={(e) => updateSimpleType(selectedSimpleTypeIndex, {
                        definition: {
                          restriction: {
                            ...normalizeRestriction(selectedSimpleType.definition?.restriction),
                            maxLength: e.target.value ? parseInt(e.target.value, 10) : undefined
                          }
                        }
                      })}
                    />

                    <label>{L('simpleTypes.definition.restriction.minInclusive', 'restriction.minInclusive')}</label>
                    <input
                      value={selectedSimpleType.definition?.restriction?.minInclusive ?? ''}
                      onChange={(e) => updateSimpleType(selectedSimpleTypeIndex, {
                        definition: {
                          restriction: {
                            ...normalizeRestriction(selectedSimpleType.definition?.restriction),
                            minInclusive: e.target.value ? (isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)) : undefined
                          }
                        }
                      })}
                    />

                    <label>{L('simpleTypes.definition.restriction.maxInclusive', 'restriction.maxInclusive')}</label>
                    <input
                      value={selectedSimpleType.definition?.restriction?.maxInclusive ?? ''}
                      onChange={(e) => updateSimpleType(selectedSimpleTypeIndex, {
                        definition: {
                          restriction: {
                            ...normalizeRestriction(selectedSimpleType.definition?.restriction),
                            maxInclusive: e.target.value ? (isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)) : undefined
                          }
                        }
                      })}
                    />

                    <label>{L('simpleTypes.definition.restriction.minExclusive', 'restriction.minExclusive')}</label>
                    <input
                      value={selectedSimpleType.definition?.restriction?.minExclusive ?? ''}
                      onChange={(e) => updateSimpleType(selectedSimpleTypeIndex, {
                        definition: {
                          restriction: {
                            ...normalizeRestriction(selectedSimpleType.definition?.restriction),
                            minExclusive: e.target.value ? (isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)) : undefined
                          }
                        }
                      })}
                    />

                    <label>{L('simpleTypes.definition.restriction.maxExclusive', 'restriction.maxExclusive')}</label>
                    <input
                      value={selectedSimpleType.definition?.restriction?.maxExclusive ?? ''}
                      onChange={(e) => updateSimpleType(selectedSimpleTypeIndex, {
                        definition: {
                          restriction: {
                            ...normalizeRestriction(selectedSimpleType.definition?.restriction),
                            maxExclusive: e.target.value ? (isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)) : undefined
                          }
                        }
                      })}
                    />

                    <label>{L('simpleTypes.definition.restriction.totalDigits', 'restriction.totalDigits')}</label>
                    <input
                      type="number"
                      value={selectedSimpleType.definition?.restriction?.totalDigits ?? ''}
                      onChange={(e) => updateSimpleType(selectedSimpleTypeIndex, {
                        definition: {
                          restriction: {
                            ...normalizeRestriction(selectedSimpleType.definition?.restriction),
                            totalDigits: e.target.value ? parseInt(e.target.value, 10) : undefined
                          }
                        }
                      })}
                    />

                    <label>{L('simpleTypes.definition.restriction.fractionDigits', 'restriction.fractionDigits')}</label>
                    <input
                      type="number"
                      value={selectedSimpleType.definition?.restriction?.fractionDigits ?? ''}
                      onChange={(e) => updateSimpleType(selectedSimpleTypeIndex, {
                        definition: {
                          restriction: {
                            ...normalizeRestriction(selectedSimpleType.definition?.restriction),
                            fractionDigits: e.target.value ? parseInt(e.target.value, 10) : undefined
                          }
                        }
                      })}
                    />

                    <label>{L('simpleTypes.definition.restriction.whiteSpace', 'restriction.whiteSpace')}</label>
                    <select
                      value={selectedSimpleType.definition?.restriction?.whiteSpace ?? ''}
                      onChange={(e) => updateSimpleType(selectedSimpleTypeIndex, {
                        definition: {
                          restriction: {
                            ...normalizeRestriction(selectedSimpleType.definition?.restriction),
                            whiteSpace: e.target.value as 'preserve' | 'replace' | 'collapse' | undefined
                          }
                        }
                      })}
                    >
                      <option value="">— (default)</option>
                      <option value="preserve">preserve</option>
                      <option value="replace">replace</option>
                      <option value="collapse">collapse</option>
                    </select>
                  </>
                )}

                  </>
                )}

                {selectedSimpleType.definition?.list && (
                  <>
                    <label>{L('simpleTypes.definition.list.itemType', 'list.itemType type')}</label>
                    <select
                      value={typeof selectedSimpleType.definition?.list?.itemType === 'string' ? 'primitive' : 'reference'}
                      onChange={(e) => {
                        const isPrimitive = e.target.value === 'primitive';
                        updateSimpleType(selectedSimpleTypeIndex, {
                          definition: {
                            list: {
                              itemType: isPrimitive ? 'string' : { namespaceAlias: '', simpleType: '' }
                            }
                          }
                        });
                      }}
                    >
                      <option value="primitive">Primitív typ</option>
                      <option value="reference">SimpleType referencia</option>
                    </select>

                    {typeof selectedSimpleType.definition?.list?.itemType === 'string' ? (
                      <>
                        <label>{L('simpleTypes.definition.list.itemTypePrimitive', 'itemType primitív typ')}</label>
                        <select
                          value={selectedSimpleType.definition?.list?.itemType as string}
                          onChange={(e) => updateSimpleType(selectedSimpleTypeIndex, {
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
                        <label>{L('simpleTypes.definition.list.namespaceAlias', 'list.itemType namespaceAlias')}</label>
                        <select
                          value={(selectedSimpleType.definition?.list?.itemType as SimpleTypeRef)?.namespaceAlias ?? ''}
                          onChange={(e) => updateSimpleType(selectedSimpleTypeIndex, {
                            definition: {
                              list: {
                                itemType: {
                                  ...normalizeSimpleTypeRef(selectedSimpleType.definition?.list?.itemType as SimpleTypeRef),
                                  namespaceAlias: e.target.value
                                }
                              }
                            }
                          })}
                        >
                          <option value="">—</option>
                          {getNamespaceAliases().map(alias => (
                            <option key={alias} value={alias}>{alias}</option>
                          ))}
                        </select>

                        <label>{L('simpleTypes.definition.list.simpleType', 'list.itemType simpleType')}</label>
                        <select
                          value={(selectedSimpleType.definition?.list?.itemType as SimpleTypeRef)?.simpleType ?? ''}
                          onChange={(e) => updateSimpleType(selectedSimpleTypeIndex, {
                            definition: {
                              list: {
                                itemType: {
                                  ...normalizeSimpleTypeRef(selectedSimpleType.definition?.list?.itemType as SimpleTypeRef),
                                  simpleType: e.target.value
                                }
                              }
                            }
                          })}
                        >
                          <option value="">—</option>
                          {getAvailableSimpleTypes((selectedSimpleType.definition?.list?.itemType as SimpleTypeRef)?.namespaceAlias).map(st => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                      </>
                    )}
                  </>
                )}

                {selectedSimpleType.definition?.union && (
                  <>
                    <label>{L('simpleTypes.definition.union.memberTypes', 'union.memberTypes')}</label>
                    <p style={{ fontSize: '0.85em', marginTop: '0.2em', marginBottom: '0.2em' }}>
                      Primiešajte primitívne typy a/alebo SimpleType referencie (referencie: namespaceAlias:simpleType, jeden na riadok)
                    </p>
                    <textarea
                      rows={4}
                      value={(selectedSimpleType.definition?.union?.memberTypes ?? []).map(item =>
                        typeof item === 'string' ? item : simpleTypeRefToText(item)
                      ).join('\n')}
                      onChange={(e) => {
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
                        updateSimpleType(selectedSimpleTypeIndex, {
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
              </div>
            )}
          </section>
        )}

        {topTab === 'relationships' && (
          <section className="panel">
            <div className="panel-head">
              <h3>{L('relationships.view.title', 'Relationships')}</h3>
              <button onClick={addRelationship}>{L('relationships.view.add', '+ Relationship')}</button>
            </div>

            <table className="dm-table">
              <thead>
                <tr>
                  <th>{L('relationships.columns.startEntity', 'Start entita')}</th>
                  <th>{L('relationships.columns.startRole', 'Start rola')}</th>
                  <th>{L('relationships.columns.endEntity', 'End entita')}</th>
                  <th>{L('relationships.columns.endRole', 'End rola')}</th>
                  <th>{L('relationships.columns.type', 'Typ')}</th>
                  <th>{L('relationships.columns.actions', 'Akcie')}</th>
                </tr>
              </thead>
              <tbody>
                {relationships.map((rel, i) => {
                  const startEntity = rel.start_role?.entityRef?.entity ?? rel.start_role?.entity;
                  const endEntity = rel.end_role?.entityRef?.entity ?? rel.end_role?.entity;

                  return (
                    <tr key={`${startEntity}-${endEntity}-${i}`} className={selectedRelationshipIndex === i ? 'selected' : ''} onClick={() => setSelectedRelationshipIndex(i)}>
                      <td>{startEntity ?? '-'}</td>
                      <td>{rel.start_role?.nazov ?? '-'}</td>
                      <td>{endEntity ?? '-'}</td>
                      <td>{rel.end_role?.nazov ?? '-'}</td>
                      <td>{rel.type ?? 'references'}</td>
                      <td>
                        <div className="inline-actions">
                          <button disabled={i === 0} onClick={(e) => { e.stopPropagation(); moveRelationship(i, -1); }}>↑</button>
                          <button disabled={i === relationships.length - 1} onClick={(e) => { e.stopPropagation(); moveRelationship(i, 1); }}>↓</button>
                          <button onClick={(e) => { e.stopPropagation(); removeRelationship(i); }}>✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {selectedRelationship && selectedRelationshipIndex !== null && (
              <div className="item-card">
                <h4>{L('relationships.view.detail', 'Detail relationship')}</h4>

                <label>{L('relationships.form.type', 'Typ')}</label>
                <select
                  value={selectedRelationship.type ?? 'references'}
                  onChange={(e) => updateRelationship(selectedRelationshipIndex, { type: e.target.value as Relationship['type'] })}
                >
                  {RELATIONSHIP_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>

                <label>{L('relationships.form.description', 'Popis')}</label>
                <textarea rows={2} value={selectedRelationship.description ?? ''} onChange={(e) => updateRelationship(selectedRelationshipIndex, { description: e.target.value })} />

                <div className="role-row">
                  {renderRoleEditor(L('relationships.form.role.start', 'Start rola'), 'start_role')}
                  {renderRoleEditor(L('relationships.form.role.end', 'End rola'), 'end_role')}
                </div>
              </div>
            )}
          </section>
        )}

        {topTab === 'glossary' && (
          <section className="panel">
            <div className="panel-head">
              <h3>{L('glossary.view.title', 'Glossary')}</h3>
              <button onClick={addGlossary}>{L('glossary.view.add', '+ Pojem')}</button>
            </div>

            <table className="dm-table">
              <thead>
                <tr>
                  <th>{L('glossary.columns.term', 'Term')}</th>
                  <th>{L('glossary.columns.meaning', 'Meaning')}</th>
                  <th>{L('glossary.columns.relatedEntity', 'Related entity')}</th>
                  <th>{L('glossary.columns.actions', 'Akcie')}</th>
                </tr>
              </thead>
              <tbody>
                {glossary.map((entry, i) => (
                  <tr key={`${entry.term}-${i}`} className={selectedGlossaryIndex === i ? 'selected' : ''} onClick={() => setSelectedGlossaryIndex(i)}>
                    <td>{entry.term}</td>
                    <td>{entry.meaning || '-'}</td>
                    <td>{entry.relatedEntity || '-'}</td>
                    <td>
                      <div className="inline-actions">
                        <button disabled={i === 0} onClick={(e) => { e.stopPropagation(); moveGlossary(i, -1); }}>↑</button>
                        <button disabled={i === glossary.length - 1} onClick={(e) => { e.stopPropagation(); moveGlossary(i, 1); }}>↓</button>
                        <button onClick={(e) => { e.stopPropagation(); removeGlossary(i); }}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {selectedGlossary && selectedGlossaryIndex !== null && (
              <div className="item-card">
                <h4>{L('glossary.view.detail', 'Detail pojmu')}</h4>
                <label>{L('glossary.form.term', 'Term')}</label>
                <input value={selectedGlossary.term} onChange={(e) => updateGlossary(selectedGlossaryIndex, { term: e.target.value })} />

                <label>{L('glossary.form.meaning', 'Meaning')}</label>
                <textarea rows={4} value={selectedGlossary.meaning} onChange={(e) => updateGlossary(selectedGlossaryIndex, { meaning: e.target.value })} />

                <label>{L('glossary.form.relatedEntity', 'Related entity')}</label>
                <input value={selectedGlossary.relatedEntity ?? ''} onChange={(e) => updateGlossary(selectedGlossaryIndex, { relatedEntity: e.target.value })} />
              </div>
            )}
          </section>
        )}

        {topTab === 'eventGlossary' && (
          <section className="panel">
            <div className="panel-head">
              <h3>{DL('eventGlossary.view.title', 'eventGlossary')}</h3>
              <button onClick={addEventGlossary}>{DL('eventGlossary.view.add', '+ Event')}</button>
            </div>

            <table className="dm-table">
              <thead>
                <tr>
                  <th>{DL('eventGlossary.columns.code', 'Code')}</th>
                  <th>{DL('eventGlossary.columns.title', 'Title')}</th>
                  <th>{DL('eventGlossary.columns.severity', 'Severity')}</th>
                  <th>{DL('eventGlossary.columns.meaning', 'Meaning')}</th>
                  <th>{DL('eventGlossary.columns.actions', 'Akcie')}</th>
                </tr>
              </thead>
              <tbody>
                {eventGlossary.map((entry, i) => (
                  <tr key={`${entry.code}-${i}`} className={selectedEventGlossaryIndex === i ? 'selected' : ''} onClick={() => setSelectedEventGlossaryIndex(i)}>
                    <td>{entry.code}</td>
                    <td>{entry.title || '-'}</td>
                    <td>{entry.severity || '-'}</td>
                    <td>{entry.meaning || '-'}</td>
                    <td>
                      <div className="inline-actions">
                        <button disabled={i === 0} onClick={(e) => { e.stopPropagation(); moveEventGlossary(i, -1); }}>↑</button>
                        <button disabled={i === eventGlossary.length - 1} onClick={(e) => { e.stopPropagation(); moveEventGlossary(i, 1); }}>↓</button>
                        <button onClick={(e) => { e.stopPropagation(); removeEventGlossary(i); }}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {selectedEventGlossary && selectedEventGlossaryIndex !== null && (
              <div className="item-card">
                <h4>{DL('eventGlossary.view.detail', 'Detail event glossary')}</h4>
                <label>{DL('eventGlossary.form.code', 'Code')}</label>
                <input value={selectedEventGlossary.code} onChange={(e) => updateEventGlossary(selectedEventGlossaryIndex, { code: e.target.value })} />

                <label>{DL('eventGlossary.form.title', 'Title')}</label>
                <input value={selectedEventGlossary.title ?? ''} onChange={(e) => updateEventGlossary(selectedEventGlossaryIndex, { title: e.target.value })} />

                <label>{DL('eventGlossary.form.severity', 'Severity')}</label>
                <select
                  value={selectedEventGlossary.severity ?? 'info'}
                  onChange={(e) => updateEventGlossary(selectedEventGlossaryIndex, { severity: e.target.value as EventGlossaryEntry['severity'] })}
                >
                  <option value="info">info</option>
                  <option value="warning">warning</option>
                  <option value="error">error</option>
                </select>

                <label>{DL('eventGlossary.form.meaning', 'Meaning')}</label>
                <textarea rows={3} value={selectedEventGlossary.meaning} onChange={(e) => updateEventGlossary(selectedEventGlossaryIndex, { meaning: e.target.value })} />

                <label>{DL('eventGlossary.form.recommendedAction', 'Recommended action')}</label>
                <textarea rows={3} value={selectedEventGlossary.recommendedAction ?? ''} onChange={(e) => updateEventGlossary(selectedEventGlossaryIndex, { recommendedAction: e.target.value })} />
              </div>
            )}
          </section>
        )}

        {topTab === 'actors' && (
          <section className="panel">
            <div className="panel-head">
              <h3>{L('actors.view.title', 'Actors')}</h3>
              <button onClick={addActor}>{L('actors.view.add', '+ Actor')}</button>
            </div>

            <table className="dm-table">
              <thead>
                <tr>
                  <th>{L('actors.columns.code', 'Code')}</th>
                  <th>{L('actors.columns.title', 'Title')}</th>
                  <th>{L('actors.columns.type', 'Type')}</th>
                  <th>{L('actors.columns.meaning', 'Meaning')}</th>
                  <th>{L('actors.columns.actions', 'Akcie')}</th>
                </tr>
              </thead>
              <tbody>
                {actors.map((entry, i) => (
                  <tr key={`${entry.code}-${i}`} className={selectedActorIndex === i ? 'selected' : ''} onClick={() => setSelectedActorIndex(i)}>
                    <td>{entry.code}</td>
                    <td>{entry.title || '-'}</td>
                    <td>{entry.type || '-'}</td>
                    <td>{entry.meaning ? entry.meaning.substring(0, 50) + (entry.meaning.length > 50 ? '...' : '') : '-'}</td>
                    <td>
                      <div className="inline-actions">
                        <button disabled={i === 0} onClick={(e) => { e.stopPropagation(); moveActor(i, -1); }}>↑</button>
                        <button disabled={i === actors.length - 1} onClick={(e) => { e.stopPropagation(); moveActor(i, 1); }}>↓</button>
                        <button onClick={(e) => { e.stopPropagation(); removeActor(i); }}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {selectedActor && selectedActorIndex !== null && (
              <div className="item-card">
                <h4>{L('actors.detail', 'Detail aktéra')}</h4>
                <label>{L('actors.code', 'Code')}</label>
                <input value={selectedActor.code} onChange={(e) => updateActor(selectedActorIndex, { code: e.target.value })} />

                <label>{L('actors.title', 'Title')}</label>
                <input value={selectedActor.title ?? ''} onChange={(e) => updateActor(selectedActorIndex, { title: e.target.value })} />

                <label>{L('actors.type', 'Type')}</label>
                <select
                  value={selectedActor.type ?? 'user'}
                  onChange={(e) => updateActor(selectedActorIndex, { type: e.target.value as 'user' | 'system' | 'external_system' })}
                >
                  <option value="user">user</option>
                  <option value="system">system</option>
                  <option value="external_system">external_system</option>
                </select>

                <label>{L('actors.meaning', 'Meaning')}</label>
                <textarea rows={4} value={selectedActor.meaning} onChange={(e) => updateActor(selectedActorIndex, { meaning: e.target.value })} />

                <label>{L('actors.responsibilities', 'Responsibilities (one per line)')}</label>
                <textarea rows={4} value={(selectedActor.responsibilities ?? []).join('\n')} onChange={(e) => updateActor(selectedActorIndex, { responsibilities: e.target.value.split('\n').filter(s => s.trim().length > 0) })} />
              </div>
            )}
          </section>
        )}

        {topTab === 'namespaceRef' && (
          <section className="panel">
            <div className="panel-head">
              <h3>{L('namespaceRef.view.title', 'namespaceRef')}</h3>
              <div className="inline-actions">
                <button onClick={() => vscodeApi.postMessage({ type: 'pickFile' })}>{L('namespaceRef.pickFile', 'Vyber súbor')}</button>
                <button onClick={addNamespace}>{L('namespaceRef.view.add', '+ Namespace')}</button>
              </div>
            </div>

            <table className="dm-table">
              <thead>
                <tr>
                  <th>{L('namespaceRef.columns.alias', 'Alias')}</th>
                  <th>{L('namespaceRef.columns.sourceType', 'Source type')}</th>
                  <th>{L('namespaceRef.columns.filePath', 'File path')}</th>
                  <th>{L('namespaceRef.columns.actions', 'Akcie')}</th>
                </tr>
              </thead>
              <tbody>
                {namespaceRef.map((item, i) => (
                  <tr key={`${item.alias}-${i}`} className={selectedNamespaceIndex === i ? 'selected' : ''} onClick={() => setSelectedNamespaceIndex(i)}>
                    <td>{item.alias || '-'}</td>
                    <td>{item.sourceType || '-'}</td>
                    <td>{item.filePath || '-'}</td>
                    <td>
                      <div className="inline-actions">
                        <button disabled={i === 0} onClick={(e) => { e.stopPropagation(); moveNamespace(i, -1); }}>↑</button>
                        <button disabled={i === namespaceRef.length - 1} onClick={(e) => { e.stopPropagation(); moveNamespace(i, 1); }}>↓</button>
                        <button disabled={item.sourceType === 'current'} onClick={(e) => { e.stopPropagation(); removeNamespace(i); }}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {selectedNamespace && selectedNamespaceIndex !== null && selectedNamespace.sourceType !== 'current' && (
              <div className="item-card">
                <h4>{L('namespaceRef.view.detail', 'Detail namespace')}</h4>
                <label>{L('namespaceRef.form.alias', 'Alias')}</label>
                <input value={selectedNamespace.alias} onChange={(e) => updateNamespace(selectedNamespaceIndex, { alias: e.target.value })} />

                <label>{L('namespaceRef.sourceType', 'Source type')}</label>
                <select
                  value={selectedNamespace.sourceType}
                  onChange={(e) => updateNamespace(selectedNamespaceIndex, { sourceType: e.target.value as NamespaceEntity['sourceType'] })}
                >
                  <option value="model">model</option>
                  <option value="sqd">sqd</option>
                  <option value="current">current</option>
                </select>

                <label>{L('namespaceRef.form.filePath', 'File path')}</label>
                <input value={selectedNamespace.filePath} onChange={(e) => updateNamespace(selectedNamespaceIndex, { filePath: e.target.value })} />
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
};

export default DomainModelEditor;
export { DomainModelEditor };
