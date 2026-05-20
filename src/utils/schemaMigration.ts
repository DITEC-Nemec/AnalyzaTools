/**
 * Schema Migration Utilities
 * Converts between legacy (model.schema.json + sqd.schema.json) and unified formats
 */

import {
  UnifiedModel,
  LegacyDomainModel,
  LegacySqdModel,
  Domain,
  Algorithm,
  Dictionary,
  Meta,
  NamespaceEntity,
  DomainMetadata,
} from "../types/unified-schema";

// ============================================================================
// LEGACY → UNIFIED CONVERSION
// ============================================================================

/**
 * Convert legacy domain model (model.schema.json format) to unified format
 * Wraps flat structure into modular structure with namespace support
 */
export function convertLegacyDomainToUnified(legacyModel: LegacyDomainModel): Partial<UnifiedModel> {
  const result: Partial<UnifiedModel> = {};

  // Extract namespace references (legacy: root.namespaceRef)
  const namespaceRef: NamespaceEntity[] = [];

  // Always add "local" namespace
  namespaceRef.push({
    alias: "local",
    filePath: "current",
    sourceType: "current",
  });

  // Add any existing namespace references
  if (legacyModel.namespaceRef && Array.isArray(legacyModel.namespaceRef)) {
    for (const ns of legacyModel.namespaceRef) {
      if (ns.alias !== "local") {
        namespaceRef.push(ns);
      }
    }
  }

  result.meta = { namespaceRef };

  // Extract domain metadata and content
  const domain: Domain = {};

  // Create metadata (legacy has flat structure)
  if (legacyModel.domain) {
    domain.metadata = legacyModel.domain;
  } else if (typeof legacyModel.domain === "object" && "name" in legacyModel) {
    domain.metadata = {
      name: (legacyModel as any).name,
      description: (legacyModel as any).description,
      version: (legacyModel as any).version,
      status: (legacyModel as any).status,
    };
  }

  // Set default imports to "local" only (user adds more via imports panel)
  domain.imports = ["local"];

  // Copy domain content
  domain.entities = legacyModel.entities;
  domain.simpleTypes = legacyModel.simpleTypes;
  domain.relationships = legacyModel.relationships;
  domain.eventGlossary = legacyModel.eventGlossary;

  result.domain = domain;

  // Extract cross-domain dictionary
  const dictionary: Dictionary = {};

  if (legacyModel.glossary || legacyModel.businessRules || legacyModel.actors) {
    if (legacyModel.glossary) dictionary.glossary = legacyModel.glossary;
    if (legacyModel.businessRules) dictionary.businessRules = legacyModel.businessRules;
    if (legacyModel.actors) dictionary.actors = legacyModel.actors;
    result.dictionary = dictionary;
  }

  return result;
}

/**
 * Convert legacy SQD model (sqd.schema.json format) to unified algorithm format
 * Wraps steps into algorithmDefinition with namespace support
 */
export function convertLegacySqdToUnified(legacySqd: LegacySqdModel): Partial<UnifiedModel> {
  const result: Partial<UnifiedModel> = {};

  // Extract namespace references from SQD (if any)
  const namespaceRef: NamespaceEntity[] = [];
  namespaceRef.push({
    alias: "local",
    filePath: "current",
    sourceType: "current",
  });

  result.meta = { namespaceRef };

  // Create algorithm definition from flat SQD structure
  const algorithmName = legacySqd.algorithm?.name || "Algorithm";
  const algorithm: Algorithm = {
    imports: ["local"],
    definitions: [
      {
        name: algorithmName,
        parameters: legacySqd.parameters,
        behavior: legacySqd.behavior,
        steps: legacySqd.steps || [],
      },
    ],
  };

  result.algorithm = algorithm;

  return result;
}

/**
 * Merge multiple partial unified models into single document
 * Used when combining domain model + SQD + external namespaces
 */
export function mergeUnifiedModels(...models: Partial<UnifiedModel>[]): UnifiedModel {
  const merged: UnifiedModel = {
    meta: { namespaceRef: [] },
  };

  for (const model of models) {
    // Merge namespace references
    if (model.meta?.namespaceRef) {
      const aliases = new Set(merged.meta!.namespaceRef.map((n) => n.alias));
      for (const ns of model.meta.namespaceRef) {
        if (!aliases.has(ns.alias)) {
          merged.meta!.namespaceRef.push(ns);
          aliases.add(ns.alias);
        }
      }
    }

    // Domain (can only have one primary domain)
    if (model.domain) {
      merged.domain = model.domain;
    }

    // Algorithm (can only have one primary algorithm)
    if (model.algorithm) {
      merged.algorithm = model.algorithm;
    }

    // Dictionary (merge glossary, rules, actors)
    if (model.dictionary) {
      if (!merged.dictionary) {
        merged.dictionary = {};
      }
      if (model.dictionary.glossary) {
        merged.dictionary.glossary = [
          ...(merged.dictionary.glossary || []),
          ...model.dictionary.glossary,
        ];
      }
      if (model.dictionary.businessRules) {
        merged.dictionary.businessRules = [
          ...(merged.dictionary.businessRules || []),
          ...model.dictionary.businessRules,
        ];
      }
      if (model.dictionary.actors) {
        merged.dictionary.actors = [
          ...(merged.dictionary.actors || []),
          ...model.dictionary.actors,
        ];
      }
    }
  }

  return merged;
}

// ============================================================================
// UNIFIED → LEGACY CONVERSION (for backward compatibility)
// ============================================================================

/**
 * Convert unified model back to legacy domain format
 * Flattens modular structure for compatibility with old model.schema.json format
 * WARNING: Some information may be lost (imports[] → discarded, namespace aliases → not preserved)
 */
export function convertUnifiedToLegacyDomain(unified: UnifiedModel): LegacyDomainModel {
  const legacy: LegacyDomainModel = {};

  // Flatten domain metadata
  if (unified.domain?.metadata) {
    legacy.domain = unified.domain.metadata;
  }

  // Flatten namespace references
  if (unified.meta?.namespaceRef) {
    legacy.namespaceRef = unified.meta.namespaceRef;
  }

  // Copy domain content directly to root (legacy structure)
  legacy.entities = unified.domain?.entities;
  legacy.simpleTypes = unified.domain?.simpleTypes;
  legacy.relationships = unified.domain?.relationships;
  legacy.eventGlossary = unified.domain?.eventGlossary;

  // Copy dictionary back to root level
  if (unified.dictionary) {
    legacy.glossary = unified.dictionary.glossary;
    legacy.businessRules = unified.dictionary.businessRules;
    legacy.actors = unified.dictionary.actors;
  }

  return legacy;
}

/**
 * Convert unified model back to legacy SQD format
 * Extracts algorithm into flat steps structure
 * WARNING: Some information may be lost (parameters, behavior mapping)
 */
export function convertUnifiedToLegacySqd(unified: UnifiedModel): LegacySqdModel {
  const legacy: LegacySqdModel = {};

  const algorithmDef = unified.algorithm?.definitions?.[0];
  if (!algorithmDef) {
    return legacy;
  }

  legacy.algorithm = {
    name: algorithmDef.name,
  };

  legacy.parameters = algorithmDef.parameters;
  legacy.behavior = algorithmDef.behavior;
  legacy.steps = algorithmDef.steps;

  return legacy;
}

// ============================================================================
// DETECTION & FORMAT GUESSING
// ============================================================================

/**
 * Detect if object is in unified format
 * Looks for meta.namespaceRef + domain.imports or algorithm.imports
 */
export function isUnifiedFormat(obj: unknown): obj is UnifiedModel {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  // Unified format has meta.namespaceRef at root
  if (candidate.meta && typeof candidate.meta === "object") {
    const meta = candidate.meta as Record<string, unknown>;
    if (Array.isArray(meta.namespaceRef)) {
      return true;
    }
  }

  return false;
}

/**
 * Detect if object is in legacy domain format
 * Looks for root-level entities/simpleTypes/relationships
 */
export function isLegacyDomainFormat(obj: unknown): obj is LegacyDomainModel {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  // Check for legacy domain indicators (but NOT unified)
  const hasLegacyDomainMarkers =
    Array.isArray(candidate.entities) ||
    Array.isArray(candidate.simpleTypes) ||
    Array.isArray(candidate.relationships) ||
    (candidate.domain && typeof candidate.domain === "object");

  if (hasLegacyDomainMarkers && !isUnifiedFormat(candidate)) {
    return true;
  }

  return false;
}

/**
 * Detect if object is in legacy SQD format
 * Looks for root-level steps + algorithm.name
 */
export function isLegacySqdFormat(obj: unknown): obj is LegacySqdModel {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  // Check for SQD indicators
  const hasSqdMarkers =
    Array.isArray(candidate.steps) ||
    (candidate.algorithm &&
      typeof candidate.algorithm === "object" &&
      (candidate.algorithm as Record<string, unknown>).name);

  if (hasSqdMarkers && !isUnifiedFormat(candidate)) {
    return true;
  }

  return false;
}

/**
 * Auto-detect and convert any format to unified
 * Returns unified model or null if format not recognized
 */
export function toUnified(obj: unknown): UnifiedModel | null {
  if (isUnifiedFormat(obj)) {
    return obj as UnifiedModel;
  }

  if (isLegacyDomainFormat(obj)) {
    return mergeUnifiedModels(convertLegacyDomainToUnified(obj as LegacyDomainModel));
  }

  if (isLegacySqdFormat(obj)) {
    return mergeUnifiedModels(convertLegacySqdToUnified(obj as LegacySqdModel));
  }

  return null;
}

/**
 * Auto-detect and convert unified back to appropriate legacy format
 * Returns legacy model or null if can't determine target format
 */
export function fromUnified(unified: UnifiedModel, targetFormat: "domain" | "sqd" | "auto" = "auto") {
  if (targetFormat === "domain" || (targetFormat === "auto" && unified.domain)) {
    return convertUnifiedToLegacyDomain(unified);
  }

  if (targetFormat === "sqd" || (targetFormat === "auto" && unified.algorithm)) {
    return convertUnifiedToLegacySqd(unified);
  }

  return null;
}
