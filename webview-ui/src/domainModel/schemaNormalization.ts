/**
 * Schema format normalization utilities
 * Converts between unified and legacy domain/algorithm model formats
 */

import * as yaml from 'js-yaml';
import type { DomainModel, SqdAlgorithm } from '../types/sqd';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export type DomainEditorFileKind = 'model' | 'meta' | 'dictionary';

export const getDomainEditorFileKind = (filePath: string): DomainEditorFileKind => {
  const lower = (filePath ?? '').toLowerCase();
  if (lower.endsWith('.meta.yaml') || lower.endsWith('.meta.yml')) {
    return 'meta';
  }
  if (lower.endsWith('.dictionary.yaml') || lower.endsWith('.dictionary.yml')) {
    return 'dictionary';
  }
  return 'model';
};

const baseNameFromPath = (filePath: string): string => {
  const normalized = (filePath ?? '').replace(/\\/g, '/');
  const fileName = normalized.split('/').pop() ?? 'model';
  return fileName
    .replace(/\.(meta|dictionary|model)\.ya?ml$/i, '')
    .replace(/\.ya?ml$/i, '')
    .trim() || 'model';
};

const normalizeImports = (imports: unknown): string[] | undefined => {
  if (!Array.isArray(imports)) {
    return undefined;
  }

  const filtered = imports
    .filter((entry): entry is string => typeof entry === 'string')
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0 && entry !== 'local');

  return filtered.length > 0 ? Array.from(new Set(filtered)) : undefined;
};

const normalizeNamespaceRef = (value: unknown): Array<Record<string, unknown>> => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Record<string, unknown> => isPlainObject(entry))
    .filter((entry) => String(entry.alias ?? '').trim() !== 'local')
    .map((entry) => ({
      alias: String(entry.alias ?? '').trim(),
      filePath: String(entry.filePath ?? '').trim(),
      sourceType: String(entry.sourceType ?? '').trim() || 'model',
      ...(entry.status ? { status: entry.status } : {})
    }))
    .filter((entry) => entry.alias.length > 0 && entry.filePath.length > 0);
};

const extractMetadata = (model: DomainModel, filePath: string): Record<string, unknown> => {
  const anyModel = model as any;
  const rawName = anyModel.name ?? anyModel.domain?.name;
  const name = typeof rawName === 'string' && rawName.trim().length > 0
    ? rawName.trim()
    : baseNameFromPath(filePath);

  const metadata: Record<string, unknown> = { name };

  if (typeof anyModel.description === 'string' && anyModel.description.trim().length > 0) {
    metadata.description = anyModel.description.trim();
  }
  if (typeof anyModel.version === 'string' && anyModel.version.trim().length > 0) {
    metadata.version = anyModel.version.trim();
  }
  if (typeof anyModel.status === 'string' && anyModel.status.trim().length > 0) {
    metadata.status = anyModel.status.trim();
  }

  return metadata;
};

/**
 * Normalize unified format to legacy format for editor compatibility
 * Extracts domain from meta/domain structure and flattens namespaceRef
 */
export const normalizeModelFormat = (
  parsed: unknown,
  fileKind: DomainEditorFileKind = 'model'
): DomainModel => {
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

      // Copy domain metadata to root
      if (fileKind === 'model' && isPlainObject(domain.metadata)) {
        const metadata = domain.metadata as Record<string, unknown>;
        Object.entries(metadata).forEach(([key, val]) => {
          legacy[key] = val;
        });
      }

      if (fileKind === 'model') {
        // Copy domain content
        ['entities', 'simpleTypes', 'relationships', 'eventGlossary', 'functions', 'stateModel'].forEach(key => {
          if (key in domain) {
            legacy[key] = domain[key];
          }
        });

        // Store imports as domain.imports for later use
        if (Array.isArray(domain.imports)) {
          (legacy as any).imports = domain.imports;
        }
      }
    }

    // Copy dictionary items to root for dictionary files
    if (isPlainObject(parsed.dictionary)) {
      const dict = parsed.dictionary as Record<string, unknown>;
      if (fileKind === 'dictionary') {
        if (Array.isArray(dict.imports)) {
          (legacy as any).imports = dict.imports;
        }
        if (isPlainObject(dict.metadata)) {
          Object.entries(dict.metadata as Record<string, unknown>).forEach(([key, val]) => {
            legacy[key] = val;
          });
        }
        ['glossary', 'businessRules', 'actors'].forEach(key => {
          if (key in dict) {
            legacy[key] = dict[key];
          }
        });
      }
    }

    // Copy meta metadata for meta files
    if (fileKind === 'meta' && isPlainObject(parsed.meta)) {
      const meta = parsed.meta as Record<string, unknown>;
      if (isPlainObject(meta.metadata)) {
        Object.entries(meta.metadata as Record<string, unknown>).forEach(([key, val]) => {
          legacy[key] = val;
        });
      }
    }

    return legacy as DomainModel;
  }

  // It's already legacy format
  return parsed as DomainModel;
};

export const buildUnifiedDomainDocument = (
  model: DomainModel,
  fileKind: DomainEditorFileKind,
  filePath: string
): Record<string, unknown> => {
  const metadata = extractMetadata(model, filePath);
  const imports = normalizeImports((model as any).imports);

  if (fileKind === 'meta') {
    return {
      meta: {
        metadata,
        namespaceRef: normalizeNamespaceRef((model as any).namespaceRef)
      }
    };
  }

  if (fileKind === 'dictionary') {
    return {
      dictionary: {
        metadata,
        ...(imports ? { imports } : {}),
        glossary: (model as any).glossary ?? [],
        businessRules: (model as any).businessRules ?? [],
        actors: (model as any).actors ?? []
      }
    };
  }

  return {
    domain: {
      metadata,
      ...(imports ? { imports } : {}),
      entities: model.entities ?? [],
      simpleTypes: (model as any).simpleTypes ?? [],
      relationships: (model as any).relationships ?? [],
      eventGlossary: (model as any).eventGlossary ?? []
    }
  };
};

/**
 * Parse YAML content and normalize to legacy format
 */
export const parseAndNormalizeYaml = (content: string): DomainModel | null => {
  try {
    const parsed = yaml.load(content);
    return normalizeModelFormat(parsed);
  } catch (e) {
    console.error('Failed to parse YAML:', e);
    return null;
  }
};

/**
 * Normalize unified algorithm format to legacy format
 * Handles algorithm.definitions[0] (unified) -> root level (legacy)
 */
export const normalizeAlgorithmFormat = (parsed: unknown): SqdAlgorithm => {
  if (!isPlainObject(parsed)) {
    return parsed as SqdAlgorithm;
  }

  // Check if it's unified format (has algorithm.definitions[0].imports)
  const hasAlgorithmModule = isPlainObject(parsed.algorithm);

  if (hasAlgorithmModule) {
    const alg = parsed.algorithm as Record<string, unknown>;
    const definitions = Array.isArray(alg.definitions) ? alg.definitions : [];

    // Check if first definition has imports (indicator of unified format)
    if (definitions.length > 0 && isPlainObject(definitions[0])) {
      const firstDef = definitions[0] as Record<string, unknown>;
      if ('imports' in firstDef) {
        const moduleMetadata = isPlainObject(alg.metadata)
          ? (alg.metadata as Record<string, unknown>)
          : null;

        // It's unified format - convert to legacy
        const legacy: Record<string, unknown> = {
          algorithm: {
            name: firstDef.name ?? 'algorithm',
            version: firstDef.version,
            behavior: firstDef.behavior
          },
          steps: (firstDef.steps as any) ?? [],
          imports: firstDef.imports as string[] | undefined,
          name: moduleMetadata?.name ?? firstDef.name,
          description: moduleMetadata?.description,
          version: moduleMetadata?.version ?? firstDef.version,
          status: moduleMetadata?.status
        };

        if (firstDef.actors) legacy.actors = firstDef.actors;
        if (firstDef.namespaceRef) legacy.namespaceRef = firstDef.namespaceRef;

        return legacy as SqdAlgorithm;
      }
    }
  }

  // It's already legacy format
  const legacy = parsed as SqdAlgorithm;
  if (!legacy.name && legacy.algorithm?.name) {
    legacy.name = legacy.algorithm.name;
  }
  if (!legacy.version && legacy.algorithm?.version) {
    legacy.version = legacy.algorithm.version;
  }
  return legacy;
};

/**
 * Parse YAML content for algorithm and normalize to legacy format
 */
export const parseAndNormalizeAlgorithm = (content: string): SqdAlgorithm | null => {
  try {
    const parsed = yaml.load(content);
    return normalizeAlgorithmFormat(parsed);
  } catch (e) {
    console.error('Failed to parse algorithm YAML:', e);
    return null;
  }
};
