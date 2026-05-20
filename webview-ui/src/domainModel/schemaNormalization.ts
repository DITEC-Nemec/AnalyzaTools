/**
 * Schema format normalization utilities
 * Converts between unified and legacy domain/algorithm model formats
 */

import * as yaml from 'js-yaml';
import type { DomainModel, SqdAlgorithm } from '../types/sqd';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Normalize unified format to legacy format for editor compatibility
 * Extracts domain from meta/domain structure and flattens namespaceRef
 */
export const normalizeModelFormat = (parsed: unknown): DomainModel => {
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
        // It's unified format - convert to legacy
        const legacy: Record<string, unknown> = {
          algorithm: {
            name: firstDef.name ?? 'algorithm',
            version: firstDef.version,
            behavior: firstDef.behavior
          },
          steps: (firstDef.steps as any) ?? [],
          imports: firstDef.imports as string[] | undefined
        };

        if (firstDef.actors) legacy.actors = firstDef.actors;
        if (firstDef.namespaceRef) legacy.namespaceRef = firstDef.namespaceRef;

        return legacy as SqdAlgorithm;
      }
    }
  }

  // It's already legacy format
  return parsed as SqdAlgorithm;
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
