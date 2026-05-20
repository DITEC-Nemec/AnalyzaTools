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

function detectFormat(parsed) {
  if (!isPlainObject(parsed)) return 'unknown';

  const isUnifiedDomain = isPlainObject(parsed.meta) && isPlainObject(parsed.domain);
  const isUnifiedAlgorithm = isPlainObject(parsed.meta) && isPlainObject(parsed.algorithm) &&
    Array.isArray(parsed.algorithm.definitions);
  if (isUnifiedDomain || isUnifiedAlgorithm) return 'unified';

  // legacy domain
  if (parsed.entities || parsed.relationships || (isPlainObject(parsed.domain) && parsed.domain.name)) return 'legacy';
  // legacy sqd
  if (isPlainObject(parsed.algorithm) && Array.isArray(parsed.steps)) return 'legacy';

  return 'unknown';
}

// ─── Validators ─────────────────────────────────────────────────────────────

function validateMeta(meta, errors) {
  if (!isPlainObject(meta)) {
    errors.push('meta is missing or not an object');
    return;
  }
  if (!Array.isArray(meta.namespaceRef) || meta.namespaceRef.length === 0) {
    errors.push('meta.namespaceRef must be a non-empty array');
    return;
  }
  const aliases = new Set();
  for (const [i, ns] of meta.namespaceRef.entries()) {
    if (!ns.alias) errors.push(`meta.namespaceRef[${i}] is missing alias`);
    if (!ns.filePath) errors.push(`meta.namespaceRef[${i}] is missing filePath`);
    if (!['current', 'model', 'sqd'].includes(ns.sourceType)) {
      errors.push(`meta.namespaceRef[${i}] has invalid sourceType: ${ns.sourceType}`);
    }
    if (aliases.has(ns.alias)) errors.push(`meta.namespaceRef has duplicate alias: ${ns.alias}`);
    aliases.add(ns.alias);
  }
  const hasLocal = meta.namespaceRef.some(ns => ns.alias === 'local' && ns.sourceType === 'current');
  if (!hasLocal) errors.push('meta.namespaceRef must contain an entry with alias=local and sourceType=current');
  return aliases;
}

function validateDomainModel(parsed, errors) {
  const availableAliases = validateMeta(parsed.meta, errors) ?? new Set();

  const domain = parsed.domain;
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
        errors.push(`${role}.entityRef.namespaceAlias "${r.entityRef.namespaceAlias}" not in meta.namespaceRef`);
      }
    }
  }
}

function validateAlgorithm(parsed, errors) {
  const availableAliases = validateMeta(parsed.meta, errors) ?? new Set();

  const alg = parsed.algorithm;
  if (!isPlainObject(alg)) { errors.push('algorithm is missing'); return; }
  if (!Array.isArray(alg.definitions) || alg.definitions.length === 0) {
    errors.push('algorithm.definitions must be a non-empty array');
    return;
  }

  for (const [i, def] of alg.definitions.entries()) {
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

function validateFile(filePath) {
  const rel = path.relative(ROOT, filePath);
  let parsed;
  try {
    parsed = yaml.load(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    return { file: rel, errors: [`YAML parse error: ${e.message}`] };
  }

  const format = detectFormat(parsed);
  const errors = [];

  if (format === 'legacy') {
    errors.push('File is in legacy format — run `npm run migrate` to convert to unified format');
  } else if (format === 'unknown') {
    errors.push('Could not detect file format (neither unified nor legacy)');
  } else {
    // unified — run full validation
    if (filePath.endsWith('.model.yaml')) {
      validateDomainModel(parsed, errors);
    } else {
      validateAlgorithm(parsed, errors);
    }
  }

  return { file: rel, format, errors };
}

const files = findYamlFiles(EXAMPLES_DIR);
console.log(`🔍 Validating ${files.length} YAML files in Example/\n`);

let totalErrors = 0;
for (const f of files) {
  const { file, format, errors } = validateFile(f);
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
