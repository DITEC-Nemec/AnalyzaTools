#!/usr/bin/env node
/**
 * Validates all Example YAML files against unified schema rules.
 * Run: npm run validate:examples
 * Exits 1 on any error so CI pipelines can catch issues.
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const ROOT = process.cwd();
const EXAMPLES_DIR = path.join(ROOT, 'Example');
const GLOBAL_META_CANDIDATES = ['_global.meta.yaml', '_global.meta.yml'];

// ─── Helpers ────────────────────────────────────────────────────────────────

const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

function findYamlFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findYamlFiles(full));
    } else if (entry.name.endsWith('.model.yaml') || entry.name.endsWith('.sqd.yaml')) {
      results.push(full);
    }
  }
  return results;
}

// ─── Format detection ───────────────────────────────────────────────────────

function detectFormat(parsed, filePath) {
  if (!isPlainObject(parsed)) return 'unknown';

  if (filePath.endsWith('.model.yaml') || filePath.endsWith('.model.yml')) {
    if (isPlainObject(parsed.domain) || Array.isArray(parsed.entities)) {
      return 'domain';
    }
    return 'unknown';
  }

  if (filePath.endsWith('.sqd.yaml') || filePath.endsWith('.sqd.yml')) {
    const hasUnifiedAlgorithm = isPlainObject(parsed.algorithm) && Array.isArray(parsed.algorithm.definitions);
    const hasFlatAlgorithm = isPlainObject(parsed.algorithm) && Array.isArray(parsed.steps);
    if (hasUnifiedAlgorithm || hasFlatAlgorithm) {
      return 'algorithm';
    }
    return 'unknown';
  }

  return 'unknown';
}

// ─── Validators ─────────────────────────────────────────────────────────────

function validateNamespaceCatalog(namespaceRef, errors, pathLabel) {
  if (!Array.isArray(namespaceRef) || namespaceRef.length === 0) {
    errors.push(`${pathLabel} must be a non-empty array`);
    return;
  }

  const aliases = new Set();
  for (const [i, ns] of namespaceRef.entries()) {
    if (!ns.alias) errors.push(`${pathLabel}[${i}] is missing alias`);
    if (!ns.filePath) errors.push(`${pathLabel}[${i}] is missing filePath`);
    if (!['current', 'model', 'sqd'].includes(ns.sourceType)) {
      errors.push(`${pathLabel}[${i}] has invalid sourceType: ${ns.sourceType}`);
    }
    if (aliases.has(ns.alias)) errors.push(`${pathLabel} has duplicate alias: ${ns.alias}`);
    aliases.add(ns.alias);
  }

  return aliases;
}

function loadGlobalAliases(errors) {
  for (const candidate of GLOBAL_META_CANDIDATES) {
    const fullPath = path.join(EXAMPLES_DIR, candidate);
    if (!fs.existsSync(fullPath)) {
      continue;
    }

    let parsed;
    try {
      parsed = yaml.load(fs.readFileSync(fullPath, 'utf-8'));
    } catch (e) {
      errors.push(`Failed to parse ${candidate}: ${e.message}`);
      return new Set(['local']);
    }

    const namespaceRef = parsed?.meta?.namespaceRef;
    const aliases = validateNamespaceCatalog(namespaceRef, errors, `${candidate}:meta.namespaceRef`) ?? new Set();
    aliases.add('local');
    return aliases;
  }

  errors.push('Missing global namespace catalog file (_global.meta.yaml or _global.meta.yml)');
  return new Set(['local']);
}

function validateDomainModel(parsed, errors, availableAliases) {
  const domain = isPlainObject(parsed.domain) ? parsed.domain : parsed;

  if (!isPlainObject(domain)) { errors.push('domain is missing'); return; }

  if (!Array.isArray(domain.imports) || domain.imports.length === 0) {
    errors.push('domain.imports must be a non-empty array');
  } else {
    for (const imp of domain.imports) {
      if (!availableAliases.has(imp)) {
        errors.push(`domain.imports references unknown namespace alias: "${imp}"`);
      }
    }
  }

  const entities = domain.entities ?? [];
  if (!Array.isArray(entities)) { errors.push('domain.entities must be an array'); return; }

  for (const entity of entities) {
    if (!entity.name) errors.push(`Entity is missing name: ${JSON.stringify(entity).slice(0, 60)}`);

    for (const attr of (entity.attributes ?? [])) {
      const namedType = attr.namedType;
      if (!namedType) errors.push(`Entity "${entity.name}" has attribute without namedType`);
      else if (!namedType.name) errors.push(`Entity "${entity.name}" has namedType without name`);
    }
  }

  for (const rel of (domain.relationships ?? [])) {
    for (const role of ['start_role', 'end_role']) {
      const r = rel[role];
      if (!r) { errors.push(`Relationship missing ${role}`); continue; }
      if (!isPlainObject(r.entityRef)) { errors.push(`${role}.entityRef is missing`); continue; }
      if (!availableAliases.has(r.entityRef.namespaceAlias)) {
        errors.push(`${role}.entityRef.namespaceAlias "${r.entityRef.namespaceAlias}" not in global namespaceRef`);
      }
    }
  }
}

function validateAlgorithm(parsed, errors, availableAliases) {
  const alg = parsed.algorithm;

  if (!isPlainObject(alg)) { errors.push('algorithm is missing'); return; }

  const definitions = Array.isArray(alg.definitions)
    ? alg.definitions
    : [{
        name: alg.name,
        imports: parsed.imports,
        steps: parsed.steps,
      }];

  if (!Array.isArray(definitions) || definitions.length === 0) {
    errors.push('algorithm.definitions or flat algorithm shape must be present');
    return;
  }

  for (const [i, def] of definitions.entries()) {
    const prefix = `algorithm.definitions[${i}]`;
    if (!def.name) errors.push(`${prefix} is missing name`);

    if (!Array.isArray(def.imports) || def.imports.length === 0) {
      errors.push(`${prefix}.imports must be a non-empty array`);
    } else {
      for (const imp of def.imports) {
        if (!availableAliases.has(imp)) {
          errors.push(`${prefix}.imports references unknown namespace alias: "${imp}"`);
        }
      }
    }

    if (!Array.isArray(def.steps)) {
      errors.push(`${prefix}.steps must be an array`);
      continue;
    }

    validateSteps(def.steps, prefix, errors);
  }
}

const VALID_STEP_TYPES = new Set(['step', 'decision', 'loop', 'foreach', 'operation', 'return', 'stop', 'block']);

function validateSteps(steps, prefix, errors) {
  for (const step of steps) {
    if (!step.id) errors.push(`${prefix}: step is missing id`);
    if (!VALID_STEP_TYPES.has(step.type)) {
      errors.push(`${prefix} step "${step.id}" has invalid type: ${step.type}`);
    }
    if (step.type === 'decision') {
      if (!isPlainObject(step.condition)) errors.push(`${prefix} step "${step.id}" decision missing condition`);
      if (!Array.isArray(step.branches)) errors.push(`${prefix} step "${step.id}" decision missing branches`);
    }
    if (step.type === 'operation' && step.operation === undefined) {
      errors.push(`${prefix} step "${step.id}" operation type missing operation field`);
    }
    if (step.body) validateSteps(step.body, `${prefix}/${step.id}`, errors);
    for (const branch of (step.branches ?? [])) {
      if (branch.then) validateSteps(branch.then, `${prefix}/${step.id}/branch`, errors);
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

function validateFile(filePath, availableAliases, globalErrors) {
  const rel = path.relative(ROOT, filePath);
  let parsed;
  try {
    parsed = yaml.load(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    return { file: rel, errors: [`YAML parse error: ${e.message}`] };
  }

  const format = detectFormat(parsed, filePath);
  const errors = [...globalErrors];

  if (format === 'unknown') {
    errors.push('Could not detect file format (neither unified nor legacy)');
  } else {
    if (format === 'domain') {
      validateDomainModel(parsed, errors, availableAliases);
    } else {
      validateAlgorithm(parsed, errors, availableAliases);
    }
  }

  return { file: rel, format, errors };
}

const files = findYamlFiles(EXAMPLES_DIR);
const globalErrors = [];
const globalAliases = loadGlobalAliases(globalErrors);
console.log(`🔍 Validating ${files.length} YAML files in Example/\n`);

let totalErrors = 0;
for (const f of files) {
  const { file, format, errors } = validateFile(f, globalAliases, globalErrors);
  if (errors.length === 0) {
    console.log(`  ✅ ${file}  (${format})`);
  } else {
    console.log(`  ❌ ${file}  (${format ?? 'unknown'})`);
    for (const e of errors) console.log(`       • ${e}`);
    totalErrors += errors.length;
  }
}

console.log(`\n${totalErrors === 0 ? '✅ All files valid' : `❌ ${totalErrors} error(s) found`}`);
process.exit(totalErrors > 0 ? 1 : 0);
