import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { DomainModelEditor } from './DomainModelEditor';
import { normalizeModelFormat, parseAndNormalizeYaml } from './schemaNormalization';
import './styles.css';
import * as yaml from 'js-yaml';
import type { DomainModel } from '../types/sqd';

declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };
export const vscodeApi = acquireVsCodeApi();

interface AppState {
  model: DomainModel | null;
  currentPath: string;
  availableModels: Array<{ name: string; path: string }>;
  error: string | null;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const deepPrune = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    const next = value
      .map(item => deepPrune(item))
      .filter(item => item !== undefined);
    return next.length > 0 ? next : undefined;
  }

  if (isPlainObject(value)) {
    const next: Record<string, unknown> = {};
    Object.entries(value).forEach(([key, val]) => {
      const pruned = deepPrune(val);
      if (pruned !== undefined) {
        next[key] = pruned;
      }
    });
    return Object.keys(next).length > 0 ? next : undefined;
  }

  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }

  return value;
};

const sanitizeNamedType = (namedType: unknown): unknown => {
  if (!isPlainObject(namedType)) {
    return namedType;
  }

  const cleaned: Record<string, unknown> = {};
  Object.entries(namedType).forEach(([key, val]) => {
    if (key === 'entityRef' || key === 'typeRef' || key === 'definition') {
      return;
    }
    const nextVal = sanitizeModelForSave(val);
    if (nextVal !== undefined) {
      cleaned[key] = nextVal;
    }
  });

  const type = typeof cleaned.type === 'string' ? cleaned.type : undefined;
  const entityRef = deepPrune(sanitizeModelForSave(namedType.entityRef));
  const typeRef = deepPrune(sanitizeModelForSave(namedType.typeRef));
  const definition = deepPrune(sanitizeModelForSave(namedType.definition));

  if (type === 'entityRef' && entityRef) {
    cleaned.entityRef = entityRef;
  } else if (type === 'typeRef' && typeRef) {
    cleaned.typeRef = typeRef;
  } else if (type === 'definition' && definition) {
    cleaned.definition = definition;
  } else if (!type) {
    if (entityRef) {
      cleaned.entityRef = entityRef;
    } else if (typeRef) {
      cleaned.typeRef = typeRef;
    } else if (definition) {
      cleaned.definition = definition;
    }
  }

  return cleaned;
};

/**
 * Normalize unified format to legacy format for editor compatibility
 * Extracts domain from meta/domain structure and flattens namespaceRef
 */
const normalizeModelFormat = (parsed: unknown): DomainModel => {
  if (!isPlainObject(parsed)) {
    return parsed as DomainModel;
  }

  // Check if it's unified format (has meta.namespaceRef or domain.imports)
  const hasMeta = isPlainObject(parsed.meta);
  const hasDomainModule = isPlainObject(parsed.domain);

  if (hasMeta || (hasDomainModule && 'imports' in (parsed.domain || {}))) {
    // It's unified format - convert to legacy
    const legacy: Record<string, unknown> = {};

    // Extract from meta
    if (isPlainObject(parsed.meta) && Array.isArray((parsed.meta as any).namespaceRef)) {
      legacy.namespaceRef = (parsed.meta as any).namespaceRef;
    }

    // Extract from domain module
    if (isPlainObject(parsed.domain)) {
      const domain = parsed.domain as Record<string, unknown>;
      
      // Copy domain.metadata to root
      if (isPlainObject(domain.metadata)) {
        const metadata = domain.metadata as Record<string, unknown>;
        Object.entries(metadata).forEach(([key, val]) => {
          legacy[key] = val;
        });
      }

      // Copy domain content
      ['entities', 'simpleTypes', 'relationships', 'eventGlossary', 'functions', 'stateModel'].forEach(key => {
        if (key in domain) {
          legacy[key] = domain[key];
        }
      });

      // Store imports as domain.imports for later use (not in legacy format but needed)
      if (Array.isArray(domain.imports)) {
        (legacy as any).imports = domain.imports;
      }
    }

    // Copy dictionary items to root
    if (isPlainObject(parsed.dictionary)) {
      const dict = parsed.dictionary as Record<string, unknown>;
      ['glossary', 'businessRules', 'actors'].forEach(key => {
        if (key in dict) {
          legacy[key] = dict[key];
        }
      });
    }

    return legacy as DomainModel;
  }

  // It's already legacy format
  return parsed as DomainModel;
};

const FUNCTION_ALLOWED_KEYS = new Set(['name', 'parameters', 'behavior']);

const sanitizeFunction = (fn: unknown): unknown => {
  if (!isPlainObject(fn)) return fn;
  const cleaned: Record<string, unknown> = {};
  Object.entries(fn).forEach(([key, val]) => {
    if (!FUNCTION_ALLOWED_KEYS.has(key)) return;
    const next = sanitizeModelForSave(val);
    if (next !== undefined) cleaned[key] = next;
  });
  return cleaned;
};

const sanitizeAttribute = (attribute: unknown): unknown => {
  if (!isPlainObject(attribute)) {
    return attribute;
  }

  const namedType = sanitizeNamedType(attribute.namedType);
  const states = sanitizeModelForSave(attribute.states);

  const cleaned: Record<string, unknown> = {};
  if (namedType !== undefined) {
    cleaned.namedType = namedType;
  }
  if (states !== undefined) {
    cleaned.states = states;
  }

  return cleaned;
};

const sanitizeModelForSave = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(item => sanitizeModelForSave(item));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  if ('attributes' in value && Array.isArray(value.attributes)) {
    const entityLike: Record<string, unknown> = {};

    Object.entries(value).forEach(([key, val]) => {
      if (key === 'label') return; // not in entity schema
      if (key === 'attributes') {
        entityLike.attributes = val.map(item => sanitizeAttribute(item));
        return;
      }
      if (key === 'functions' && Array.isArray(val)) {
        entityLike.functions = val.map(fn => sanitizeFunction(fn));
        return;
      }

      entityLike[key] = sanitizeModelForSave(val);
    });

    return entityLike;
  }

  const next: Record<string, unknown> = {};
  Object.entries(value).forEach(([key, val]) => {
    if (key === 'namedType') {
      next[key] = sanitizeNamedType(val);
      return;
    }

    next[key] = sanitizeModelForSave(val);
  });

  return next;
};

function App() {
  const [state, setState] = useState<AppState>({
    model: null,
    currentPath: '',
    availableModels: [],
    error: null
  });

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, content, currentPath, availableModels } = event.data;
      
      if (type === 'update') {
        try {
          const parsed = yaml.load(content);
          const normalized = normalizeModelFormat(parsed);
          setState(prev => ({
            ...prev,
            model: normalized,
            currentPath,
            availableModels: availableModels || [],
            error: null
          }));
        } catch (e) {
          setState(prev => ({
            ...prev,
            error: `Failed to parse YAML: ${e instanceof Error ? e.message : String(e)}`
          }));
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleChange = (model: DomainModel) => {
    setState(prev => ({ ...prev, model }));
    const sanitized = sanitizeModelForSave(model) as DomainModel;
    const yaml_str = yaml.dump(sanitized);
    vscodeApi.postMessage({
      type: 'edit',
      content: yaml_str
    });
  };

  const handleModelSwitch = (path: string) => {
    vscodeApi.postMessage({
      type: 'loadModel',
      path
    });
  };

  if (!state.model) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <p>Loading domain model...</p>
        {state.error && <div style={{ color: 'red' }}>{state.error}</div>}
      </div>
    );
  }

  return (
    <DomainModelEditor
      value={state.model}
      onChange={handleChange}
      availableModels={state.availableModels}
      onModelSwitch={handleModelSwitch}
      currentPath={state.currentPath}
      vscodeApi={vscodeApi}
    />
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
