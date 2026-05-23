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
 * Validate that all importList[] in domain/algorithm exist in meta.namespaceRefList
 * Returns errors if importList reference non-existent namespaces
 */
function validateImportsExist(model) {
    const errors = [];
    const domainImports = model.domain?.importList ?? [];
    const algorithmImports = model.algorithm?.importList ?? [];
    const dictionaryImports = model.dictionary?.importList ?? [];
    const hasAnyImports = domainImports.length > 0 || algorithmImports.length > 0 || dictionaryImports.length > 0;
    if (!model.meta?.namespaceRefList) {
        if (hasAnyImports) {
            errors.push({
                type: "warning",
                path: "meta.namespaceRefList",
                message: "Cannot validate imports without meta.namespaceRefList catalog",
            });
        }
        return errors;
    }
    const validAliases = new Set(model.meta.namespaceRefList.map((n) => n.alias));
    validAliases.add("local"); // local is always implicit
    // Check domain imports
    for (const alias of domainImports) {
        if (!validAliases.has(alias)) {
            errors.push({
                type: "error",
                path: `domain.importList`,
                message: `Import alias "${alias}" not found in meta.namespaceRefList`,
            });
        }
    }
    // Check algorithm imports
    for (const alias of algorithmImports) {
        if (!validAliases.has(alias)) {
            errors.push({
                type: "error",
                path: `algorithm.importList`,
                message: `Import alias "${alias}" not found in meta.namespaceRefList`,
            });
        }
    }
    // Check dictionary imports
    for (const alias of dictionaryImports) {
        if (!validAliases.has(alias)) {
            errors.push({
                type: "error",
                path: `dictionary.importList`,
                message: `Import alias "${alias}" not found in meta.namespaceRefList`,
            });
        }
    }
    return errors;
}
/**
 * Validate that all namespace references in domain/algorithm are in importList[]
 * e.g., entity references using namespaceAlias="SOSM" when domain.importList doesn't include "SOSM"
 */
function validateNamespaceReferences(model) {
    const errors = [];
    // Collect valid namespaces per module
    const domainImports = new Set([...(model.domain?.importList ?? []), "local"]);
    const algorithmImports = new Set([...(model.algorithm?.importList ?? []), "local"]);
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
    if ("entityList" in module && module.entityList) {
        for (let i = 0; i < module.entityList.length; i++) {
            const entity = module.entityList[i];
            const entityErrors = validateEntityNamespaces(entity, allowedImports, `${moduleName}.entityList[${i}]`);
            errors.push(...entityErrors);
        }
    }
    if ("relationshipList" in module && module.relationshipList) {
        for (let i = 0; i < module.relationshipList.length; i++) {
            const rel = module.relationshipList[i];
            const relErrors = validateRelationshipNamespaces(rel, allowedImports, `${moduleName}.relationshipList[${i}]`);
            errors.push(...relErrors);
        }
    }
    if ("algorithmList" in module && module.algorithmList) {
        for (let i = 0; i < module.algorithmList.length; i++) {
            const def = module.algorithmList[i];
            const defErrors = validateAlgorithmNamespaces(def, allowedImports, `${moduleName}.algorithmList[${i}]`);
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
    if (entity.attributeList) {
        for (let i = 0; i < entity.attributeList.length; i++) {
            const attr = entity.attributeList[i];
            const variable = attr.variable;
            if (variable.entityRef?.namespaceAlias) {
                if (!allowedImports.has(variable.entityRef.namespaceAlias)) {
                    errors.push({
                        type: "error",
                        path: `${path}.attributeList[${i}].variable.entityRef.namespaceAlias`,
                        message: `Namespace alias "${variable.entityRef.namespaceAlias}" not in imports`,
                    });
                }
            }
            if (variable.typeRef?.namespaceAlias) {
                if (!allowedImports.has(variable.typeRef.namespaceAlias)) {
                    errors.push({
                        type: "error",
                        path: `${path}.attributeList[${i}].variable.typeRef.namespaceAlias`,
                        message: `Namespace alias "${variable.typeRef.namespaceAlias}" not in imports`,
                    });
                }
            }
        }
    }
    if (entity.functionList) {
        for (let i = 0; i < entity.functionList.length; i++) {
            const func = entity.functionList[i];
            if (func.behavior) {
                const behErrors = validateBehaviorNamespaces(func.behavior, allowedImports, `${path}.functionList[${i}].behavior`);
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
    if (rel.startRoleRef?.entityRef?.namespaceAlias) {
        if (!allowedImports.has(rel.startRoleRef.entityRef.namespaceAlias)) {
            errors.push({
                type: "error",
                path: `${path}.startRoleRef.entityRef.namespaceAlias`,
                message: `Namespace alias "${rel.startRoleRef.entityRef.namespaceAlias}" not in imports`,
            });
        }
    }
    if (rel.endRoleRef?.entityRef?.namespaceAlias) {
        if (!allowedImports.has(rel.endRoleRef.entityRef.namespaceAlias)) {
            errors.push({
                type: "error",
                path: `${path}.endRoleRef.entityRef.namespaceAlias`,
                message: `Namespace alias "${rel.endRoleRef.entityRef.namespaceAlias}" not in imports`,
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
    if (def.stepList) {
        for (let i = 0; i < def.stepList.length; i++) {
            const stepErrors = validateStepNamespaces(def.stepList[i], allowedImports, `${path}.stepList[${i}]`);
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
    if (behavior.actorRefList) {
        for (let i = 0; i < behavior.actorRefList.length; i++) {
            const actor = behavior.actorRefList[i];
            if (!allowedImports.has(actor.namespaceAlias)) {
                errors.push({
                    type: "error",
                    path: `${path}.actorRefList[${i}].namespaceAlias`,
                    message: `Namespace alias "${actor.namespaceAlias}" not in imports`,
                });
            }
        }
    }
    if (behavior.affectedEntityList) {
        for (let i = 0; i < behavior.affectedEntityList.length; i++) {
            const entity = behavior.affectedEntityList[i];
            if (entity.attributeRef?.namespaceAlias) {
                if (!allowedImports.has(entity.attributeRef.namespaceAlias)) {
                    errors.push({
                        type: "error",
                        path: `${path}.affectedEntityList[${i}].attributeRef.namespaceAlias`,
                        message: `Namespace alias "${entity.attributeRef.namespaceAlias}" not in imports`,
                    });
                }
            }
        }
    }
    if (behavior.errorEventList) {
        for (let i = 0; i < behavior.errorEventList.length; i++) {
            const errorEvent = behavior.errorEventList[i];
            if (errorEvent.eventRef?.namespaceAlias) {
                if (!allowedImports.has(errorEvent.eventRef.namespaceAlias)) {
                    errors.push({
                        type: "error",
                        path: `${path}.errorEventList[${i}].eventRef.namespaceAlias`,
                        message: `Namespace alias "${errorEvent.eventRef.namespaceAlias}" not in imports`,
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
    if (step.operationRef && typeof step.operationRef === "object") {
        const opErrors = validateOperationNamespaces(step.operationRef, allowedImports, `${path}.operationRef`);
        errors.push(...opErrors);
    }
    // Check condition
    if (step.condition) {
        const condErrors = validateConditionNamespaces(step.condition, allowedImports, `${path}.condition`);
        errors.push(...condErrors);
    }
    // Check branches recursively
    if (step.branchList) {
        for (let i = 0; i < step.branchList.length; i++) {
            const branch = step.branchList[i];
            if (branch.then) {
                for (let j = 0; j < branch.then.length; j++) {
                    const subErrors = validateStepNamespaces(branch.then[j], allowedImports, `${path}.branchList[${i}].then[${j}]`);
                    errors.push(...subErrors);
                }
            }
        }
    }
    // Check body recursively
    if (step.subStepList) {
        for (let i = 0; i < step.subStepList.length; i++) {
            const subErrors = validateStepNamespaces(step.subStepList[i], allowedImports, `${path}.subStepList[${i}]`);
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
    // Local alias is implicit and should not be listed explicitly in namespace catalog.
    // Checks:
    // - meta.namespaceRefList exists and has "local"
    // - domain/algorithm importList exist in namespaceRefList
    // - all namespace references are in importList
    if (model.meta?.namespaceRefList?.some((n) => n.alias === "local")) {
        errors.push({
            type: "warning",
            path: "meta.namespaceRefList",
            message: 'Alias "local" is implicit and should not be listed in meta.namespaceRefList',
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
