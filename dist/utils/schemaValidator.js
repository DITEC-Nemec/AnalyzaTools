"use strict";
/**
 * Schema Validation Utilities
 * Validates unified schema structure and namespace references
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateImportsExist = validateImportsExist;
exports.validateNamespaceReferences = validateNamespaceReferences;
exports.validateUnifiedModel = validateUnifiedModel;
exports.getValidationErrorsByType = getValidationErrorsByType;
exports.formatValidationErrors = formatValidationErrors;
// ============================================================================
// NAMESPACE VALIDATION
// ============================================================================
/**
 * Validate that all imports[] in domain/algorithm exist in meta.namespaceRef
 * Returns errors if imports reference non-existent namespaces
 */
function validateImportsExist(model) {
    const errors = [];
    if (!model.meta?.namespaceRef) {
        errors.push({
            type: "error",
            path: "meta.namespaceRef",
            message: "meta.namespaceRef is required",
        });
        return errors;
    }
    const validAliases = new Set(model.meta.namespaceRef.map((n) => n.alias));
    // Check domain imports
    if (model.domain?.imports) {
        for (const alias of model.domain.imports) {
            if (!validAliases.has(alias)) {
                errors.push({
                    type: "error",
                    path: `domain.imports`,
                    message: `Import alias "${alias}" not found in meta.namespaceRef`,
                });
            }
        }
    }
    // Check algorithm imports
    if (model.algorithm?.imports) {
        for (const alias of model.algorithm.imports) {
            if (!validAliases.has(alias)) {
                errors.push({
                    type: "error",
                    path: `algorithm.imports`,
                    message: `Import alias "${alias}" not found in meta.namespaceRef`,
                });
            }
        }
    }
    return errors;
}
/**
 * Validate that all namespace references in domain/algorithm are in imports[]
 * e.g., entity references using namespaceAlias="SOSM" when domain.imports doesn't include "SOSM"
 */
function validateNamespaceReferences(model) {
    const errors = [];
    // Collect valid namespaces per module
    const domainImports = new Set(model.domain?.imports || ["local"]);
    const algorithmImports = new Set(model.algorithm?.imports || ["local"]);
    // Validate domain namespace usages
    if (model.domain) {
        const domainErrors = validateModuleNamespaceUsage(model.domain, domainImports, "domain");
        errors.push(...domainErrors);
    }
    // Validate algorithm namespace usages
    if (model.algorithm) {
        const algorithmErrors = validateModuleNamespaceUsage(model.algorithm, algorithmImports, "algorithm");
        errors.push(...algorithmErrors);
    }
    return errors;
}
/**
 * Internal: validate namespace usage within a single module
 */
function validateModuleNamespaceUsage(module, allowedImports, moduleName) {
    const errors = [];
    if ("entities" in module && module.entities) {
        for (let i = 0; i < module.entities.length; i++) {
            const entity = module.entities[i];
            const entityErrors = validateEntityNamespaces(entity, allowedImports, `${moduleName}.entities[${i}]`);
            errors.push(...entityErrors);
        }
    }
    if ("relationships" in module && module.relationships) {
        for (let i = 0; i < module.relationships.length; i++) {
            const rel = module.relationships[i];
            const relErrors = validateRelationshipNamespaces(rel, allowedImports, `${moduleName}.relationships[${i}]`);
            errors.push(...relErrors);
        }
    }
    if ("definitions" in module && module.definitions) {
        for (let i = 0; i < module.definitions.length; i++) {
            const def = module.definitions[i];
            const defErrors = validateAlgorithmNamespaces(def, allowedImports, `${moduleName}.definitions[${i}]`);
            errors.push(...defErrors);
        }
    }
    return errors;
}
/**
 * Validate entity attribute namespace references
 */
function validateEntityNamespaces(entity, allowedImports, path) {
    const errors = [];
    if (entity.attributes) {
        for (let i = 0; i < entity.attributes.length; i++) {
            const attr = entity.attributes[i];
            const namedType = attr.namedType;
            if (namedType.entityRef?.namespaceAlias) {
                if (!allowedImports.has(namedType.entityRef.namespaceAlias)) {
                    errors.push({
                        type: "error",
                        path: `${path}.attributes[${i}].namedType.entityRef.namespaceAlias`,
                        message: `Namespace alias "${namedType.entityRef.namespaceAlias}" not in imports`,
                    });
                }
            }
            if (namedType.typeRef?.namespaceAlias) {
                if (!allowedImports.has(namedType.typeRef.namespaceAlias)) {
                    errors.push({
                        type: "error",
                        path: `${path}.attributes[${i}].namedType.typeRef.namespaceAlias`,
                        message: `Namespace alias "${namedType.typeRef.namespaceAlias}" not in imports`,
                    });
                }
            }
        }
    }
    if (entity.functions) {
        for (let i = 0; i < entity.functions.length; i++) {
            const func = entity.functions[i];
            if (func.behavior) {
                const behErrors = validateBehaviorNamespaces(func.behavior, allowedImports, `${path}.functions[${i}].behavior`);
                errors.push(...behErrors);
            }
        }
    }
    return errors;
}
/**
 * Validate relationship role namespace references
 */
function validateRelationshipNamespaces(rel, allowedImports, path) {
    const errors = [];
    if (rel.start_role?.entityRef?.namespaceAlias) {
        if (!allowedImports.has(rel.start_role.entityRef.namespaceAlias)) {
            errors.push({
                type: "error",
                path: `${path}.start_role.entityRef.namespaceAlias`,
                message: `Namespace alias "${rel.start_role.entityRef.namespaceAlias}" not in imports`,
            });
        }
    }
    if (rel.end_role?.entityRef?.namespaceAlias) {
        if (!allowedImports.has(rel.end_role.entityRef.namespaceAlias)) {
            errors.push({
                type: "error",
                path: `${path}.end_role.entityRef.namespaceAlias`,
                message: `Namespace alias "${rel.end_role.entityRef.namespaceAlias}" not in imports`,
            });
        }
    }
    return errors;
}
/**
 * Validate algorithm namespace references in steps
 */
function validateAlgorithmNamespaces(def, allowedImports, path) {
    const errors = [];
    if (def.behavior) {
        const behErrors = validateBehaviorNamespaces(def.behavior, allowedImports, `${path}.behavior`);
        errors.push(...behErrors);
    }
    if (def.steps) {
        for (let i = 0; i < def.steps.length; i++) {
            const stepErrors = validateStepNamespaces(def.steps[i], allowedImports, `${path}.steps[${i}]`);
            errors.push(...stepErrors);
        }
    }
    return errors;
}
/**
 * Validate behavior section namespace references
 */
function validateBehaviorNamespaces(behavior, allowedImports, path) {
    const errors = [];
    if (behavior.actors) {
        for (let i = 0; i < behavior.actors.length; i++) {
            const actor = behavior.actors[i];
            if (!allowedImports.has(actor.namespaceAlias)) {
                errors.push({
                    type: "error",
                    path: `${path}.actors[${i}].namespaceAlias`,
                    message: `Namespace alias "${actor.namespaceAlias}" not in imports`,
                });
            }
        }
    }
    if (behavior.affectedEntities) {
        for (let i = 0; i < behavior.affectedEntities.length; i++) {
            const entity = behavior.affectedEntities[i];
            if (entity.attributeRef?.namespaceAlias) {
                if (!allowedImports.has(entity.attributeRef.namespaceAlias)) {
                    errors.push({
                        type: "error",
                        path: `${path}.affectedEntities[${i}].attributeRef.namespaceAlias`,
                        message: `Namespace alias "${entity.attributeRef.namespaceAlias}" not in imports`,
                    });
                }
            }
        }
    }
    return errors;
}
/**
 * Validate step namespace references recursively
 */
function validateStepNamespaces(step, allowedImports, path) {
    const errors = [];
    // Check operation references
    if (step.operation && typeof step.operation === "object") {
        const opErrors = validateOperationNamespaces(step.operation, allowedImports, `${path}.operation`);
        errors.push(...opErrors);
    }
    // Check condition
    if (step.condition) {
        const condErrors = validateConditionNamespaces(step.condition, allowedImports, `${path}.condition`);
        errors.push(...condErrors);
    }
    // Check branches recursively
    if (step.branches) {
        for (let i = 0; i < step.branches.length; i++) {
            const branch = step.branches[i];
            if (branch.then) {
                for (let j = 0; j < branch.then.length; j++) {
                    const subErrors = validateStepNamespaces(branch.then[j], allowedImports, `${path}.branches[${i}].then[${j}]`);
                    errors.push(...subErrors);
                }
            }
        }
    }
    // Check body recursively
    if (step.body) {
        for (let i = 0; i < step.body.length; i++) {
            const subErrors = validateStepNamespaces(step.body[i], allowedImports, `${path}.body[${i}]`);
            errors.push(...subErrors);
        }
    }
    // Check behavior
    if (step.behavior) {
        const behErrors = validateBehaviorNamespaces(step.behavior, allowedImports, `${path}.behavior`);
        errors.push(...behErrors);
    }
    return errors;
}
/**
 * Validate operation reference namespace usage
 */
function validateOperationNamespaces(operation, allowedImports, path) {
    const errors = [];
    if (operation.entityFunctionRef?.namespaceAlias) {
        if (!allowedImports.has(operation.entityFunctionRef.namespaceAlias)) {
            errors.push({
                type: "error",
                path: `${path}.entityFunctionRef.namespaceAlias`,
                message: `Namespace alias "${operation.entityFunctionRef.namespaceAlias}" not in imports`,
            });
        }
    }
    if (operation.sqdRef?.namespaceAlias) {
        if (!allowedImports.has(operation.sqdRef.namespaceAlias)) {
            errors.push({
                type: "error",
                path: `${path}.sqdRef.namespaceAlias`,
                message: `Namespace alias "${operation.sqdRef.namespaceAlias}" not in imports`,
            });
        }
    }
    if (operation.eventRef?.namespaceAlias) {
        if (!allowedImports.has(operation.eventRef.namespaceAlias)) {
            errors.push({
                type: "error",
                path: `${path}.eventRef.namespaceAlias`,
                message: `Namespace alias "${operation.eventRef.namespaceAlias}" not in imports`,
            });
        }
    }
    return errors;
}
/**
 * Validate condition namespace references
 */
function validateConditionNamespaces(condition, allowedImports, path) {
    const errors = [];
    if (condition.attributeRef?.namespaceAlias) {
        if (!allowedImports.has(condition.attributeRef.namespaceAlias)) {
            errors.push({
                type: "error",
                path: `${path}.attributeRef.namespaceAlias`,
                message: `Namespace alias "${condition.attributeRef.namespaceAlias}" not in imports`,
            });
        }
    }
    if (condition.operationRef) {
        const opErrors = validateOperationNamespaces(condition.operationRef, allowedImports, `${path}.operationRef`);
        errors.push(...opErrors);
    }
    if (condition.waitEvent?.eventRef?.namespaceAlias) {
        if (!allowedImports.has(condition.waitEvent.eventRef.namespaceAlias)) {
            errors.push({
                type: "error",
                path: `${path}.waitEvent.eventRef.namespaceAlias`,
                message: `Namespace alias "${condition.waitEvent.eventRef.namespaceAlias}" not in imports`,
            });
        }
    }
    return errors;
}
// ============================================================================
// COMPREHENSIVE VALIDATION
// ============================================================================
/**
 * Comprehensive validation of entire unified model
 * Checks:
 * - meta.namespaceRef exists and has "local"
 * - domain/algorithm imports exist in namespaceRef
 * - all namespace references are in imports
 */
function validateUnifiedModel(model) {
    const errors = [];
    // Check required "local" namespace
    if (!model.meta?.namespaceRef?.some((n) => n.alias === "local")) {
        errors.push({
            type: "error",
            path: "meta.namespaceRef",
            message: 'meta.namespaceRef must contain an entry with alias="local"',
        });
    }
    // Validate imports exist
    errors.push(...validateImportsExist(model));
    // Validate namespace references are in imports
    errors.push(...validateNamespaceReferences(model));
    return {
        valid: errors.filter((e) => e.type === "error").length === 0,
        errors,
    };
}
/**
 * Get validation errors by type
 */
function getValidationErrorsByType(result, type) {
    return result.errors.filter((e) => e.type === type);
}
/**
 * Format validation errors as readable string
 */
function formatValidationErrors(result) {
    if (result.valid) {
        return "✓ Schema is valid";
    }
    const errorGroups = {
        errors: getValidationErrorsByType(result, "error"),
        warnings: getValidationErrorsByType(result, "warning"),
    };
    let output = "";
    if (errorGroups.errors.length > 0) {
        output += `\n❌ ERRORS (${errorGroups.errors.length}):\n`;
        for (const err of errorGroups.errors) {
            output += `  [${err.path}] ${err.message}\n`;
        }
    }
    if (errorGroups.warnings.length > 0) {
        output += `\n⚠️  WARNINGS (${errorGroups.warnings.length}):\n`;
        for (const warn of errorGroups.warnings) {
            output += `  [${warn.path}] ${warn.message}\n`;
        }
    }
    return output;
}
