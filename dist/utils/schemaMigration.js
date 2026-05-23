"use strict";
/**
 * Schema Migration Utilities
 * Converts between legacy (model.schema.json + sqd.schema.json) and unified formats
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertLegacyDomainToUnified = convertLegacyDomainToUnified;
exports.convertLegacySqdToUnified = convertLegacySqdToUnified;
exports.mergeUnifiedModels = mergeUnifiedModels;
exports.convertUnifiedToLegacyDomain = convertUnifiedToLegacyDomain;
exports.convertUnifiedToLegacySqd = convertUnifiedToLegacySqd;
exports.isUnifiedFormat = isUnifiedFormat;
exports.isLegacyDomainFormat = isLegacyDomainFormat;
exports.isLegacySqdFormat = isLegacySqdFormat;
exports.toUnified = toUnified;
exports.fromUnified = fromUnified;
// ============================================================================
// LEGACY → UNIFIED CONVERSION
// ============================================================================
/**
 * Convert legacy domain model (model.schema.json format) to unified format
 * Wraps flat structure into modular structure with namespace support
 */
function convertLegacyDomainToUnified(legacyModel) {
    const result = {};
    // Extract namespace references (legacy: root.namespaceRef)
    const namespaceRefList = [];
    // Always add "local" namespace
    namespaceRefList.push({
        alias: "local",
        filePath: "current",
        sourceType: "current",
    });
    // Add any existing namespace references
    if (legacyModel.namespaceRef && Array.isArray(legacyModel.namespaceRef)) {
        for (const ns of legacyModel.namespaceRef) {
            if (ns.alias !== "local") {
                namespaceRefList.push(ns);
            }
        }
    }
    result.meta = { namespaceRefList };
    // Extract domain metadata and content
    const domain = {};
    // Create metadata (legacy has flat structure)
    if (legacyModel.domain) {
        domain.metadata = legacyModel.domain;
    }
    else if (typeof legacyModel.domain === "object" && "name" in legacyModel) {
        domain.metadata = {
            name: legacyModel.name,
            description: legacyModel.description,
            version: legacyModel.version,
            status: legacyModel.status,
        };
    }
    // Set default imports to "local" only (user adds more via imports panel)
    domain.importList = ["local"];
    // Copy domain content
    domain.entityList = legacyModel.entities;
    domain.typeList = legacyModel.simpleTypes;
    domain.relationshipList = legacyModel.relationships;
    domain.eventGlossary = legacyModel.eventGlossary;
    result.domain = domain;
    // Extract cross-domain dictionary
    const dictionary = {};
    if (legacyModel.glossary || legacyModel.businessRules || legacyModel.actors) {
        if (legacyModel.glossary)
            dictionary.glossary = legacyModel.glossary;
        if (legacyModel.businessRules)
            dictionary.businessRules = legacyModel.businessRules;
        if (legacyModel.actors)
            dictionary.actorList = legacyModel.actors;
        result.dictionary = dictionary;
    }
    return result;
}
/**
 * Convert legacy SQD model (sqd.schema.json format) to unified algorithm format
 * Wraps steps into algorithmDefinition with namespace support
 */
function convertLegacySqdToUnified(legacySqd) {
    const result = {};
    // Extract namespace references from SQD (if any)
    const namespaceRefList = [];
    namespaceRefList.push({
        alias: "local",
        filePath: "current",
        sourceType: "current",
    });
    result.meta = { namespaceRefList };
    // Create algorithm definition from flat SQD structure
    const algorithmName = legacySqd.algorithm?.name || "Algorithm";
    const algorithm = {
        importList: ["local"],
        algorithmList: [
            {
                name: algorithmName,
                parameterList: legacySqd.parameters,
                behavior: legacySqd.behavior,
                stepList: legacySqd.steps || [],
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
function mergeUnifiedModels(...models) {
    const merged = {
        meta: { namespaceRefList: [] },
    };
    for (const model of models) {
        // Merge namespace references
        if (model.meta?.namespaceRefList) {
            const aliases = new Set(merged.meta.namespaceRefList.map((n) => n.alias));
            for (const ns of model.meta.namespaceRefList) {
                if (!aliases.has(ns.alias)) {
                    merged.meta.namespaceRefList.push(ns);
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
            if (model.dictionary.actorList) {
                merged.dictionary.actorList = [
                    ...(merged.dictionary.actorList || []),
                    ...model.dictionary.actorList,
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
function convertUnifiedToLegacyDomain(unified) {
    const legacy = {};
    // Flatten domain metadata
    if (unified.domain?.metadata) {
        legacy.domain = unified.domain.metadata;
    }
    // Flatten namespace references
    if (unified.meta?.namespaceRefList) {
        legacy.namespaceRef = unified.meta.namespaceRefList;
    }
    // Copy domain content directly to root (legacy structure)
    legacy.entities = unified.domain?.entityList;
    legacy.simpleTypes = unified.domain?.typeList;
    legacy.relationships = unified.domain?.relationshipList;
    legacy.eventGlossary = unified.domain?.eventGlossary;
    // Copy dictionary back to root level
    if (unified.dictionary) {
        legacy.glossary = unified.dictionary.glossary;
        legacy.businessRules = unified.dictionary.businessRules;
        legacy.actors = unified.dictionary.actorList;
    }
    return legacy;
}
/**
 * Convert unified model back to legacy SQD format
 * Extracts algorithm into flat steps structure
 * WARNING: Some information may be lost (parameters, behavior mapping)
 */
function convertUnifiedToLegacySqd(unified) {
    const legacy = {};
    const algorithmDef = unified.algorithm?.algorithmList?.[0];
    if (!algorithmDef) {
        return legacy;
    }
    legacy.algorithm = {
        name: algorithmDef.name,
    };
    legacy.parameters = algorithmDef.parameterList;
    legacy.behavior = algorithmDef.behavior;
    legacy.steps = algorithmDef.stepList;
    return legacy;
}
// ============================================================================
// DETECTION & FORMAT GUESSING
// ============================================================================
/**
 * Detect if object is in unified format
 * Looks for meta.namespaceRefList + domain.importList or algorithm.importList
 */
function isUnifiedFormat(obj) {
    if (typeof obj !== "object" || obj === null) {
        return false;
    }
    const candidate = obj;
    // Unified format has meta.namespaceRefList at root
    if (candidate.meta && typeof candidate.meta === "object") {
        const meta = candidate.meta;
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
function isLegacyDomainFormat(obj) {
    if (typeof obj !== "object" || obj === null) {
        return false;
    }
    const candidate = obj;
    // Check for legacy domain indicators (but NOT unified)
    const hasLegacyDomainMarkers = Array.isArray(candidate.entities) ||
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
function isLegacySqdFormat(obj) {
    if (typeof obj !== "object" || obj === null) {
        return false;
    }
    const candidate = obj;
    // Check for SQD indicators
    const hasSqdMarkers = Array.isArray(candidate.steps) ||
        (candidate.algorithm &&
            typeof candidate.algorithm === "object" &&
            candidate.algorithm.name);
    if (hasSqdMarkers && !isUnifiedFormat(candidate)) {
        return true;
    }
    return false;
}
/**
 * Auto-detect and convert any format to unified
 * Returns unified model or null if format not recognized
 */
function toUnified(obj) {
    if (isUnifiedFormat(obj)) {
        return obj;
    }
    if (isLegacyDomainFormat(obj)) {
        return mergeUnifiedModels(convertLegacyDomainToUnified(obj));
    }
    if (isLegacySqdFormat(obj)) {
        return mergeUnifiedModels(convertLegacySqdToUnified(obj));
    }
    return null;
}
/**
 * Auto-detect and convert unified back to appropriate legacy format
 * Returns legacy model or null if can't determine target format
 */
function fromUnified(unified, targetFormat = "auto") {
    if (targetFormat === "domain" || (targetFormat === "auto" && unified.domain)) {
        return convertUnifiedToLegacyDomain(unified);
    }
    if (targetFormat === "sqd" || (targetFormat === "auto" && unified.algorithm)) {
        return convertUnifiedToLegacySqd(unified);
    }
    return null;
}
