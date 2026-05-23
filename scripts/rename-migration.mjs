#!/usr/bin/env node
/**
 * Schema + Example rename migration script
 * Implements UI_RENAMING_BASELINE.md (rename-only, no logic/structure changes)
 *
 * Run: node scripts/rename-migration.mjs
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// ─── Section 4: $defs key renames ───────────────────────────────────────────
const DEFS_RENAMES = new Map([
  ['governanceMetadata',   'governanceMetadataDef'],
  ['namespaceEntity',      'namespaceDef'],
  ['entity',               'entityDef'],
  ['referenceEntity',      'entityRef'],
  ['attribute',            'attributeDef'],
  ['referenceAttribute',   'attributeRef'],
  ['simpleTypeRef',        'typeRef'],
  ['namedType',            'varDef'],
  ['simpleType',           'simpleTypeDef'],
  ['simpleTypeDefinition', 'typeDefinitionDef'],
  ['restriction',          'restrictionDef'],
  ['annotation',           'annotationDef'],
  ['codeLabel',            'codeLabelDef'],
  ['role',                 'roleDef'],
  ['relationship',         'relationshipDef'],
  ['function',             'functionDef'],
  ['parameter',            'parameterDef'],
  ['behavior',             'behaviorDef'],
  ['errorEvent',           'errorEventDef'],
  ['affectedEntities',     'affectedEntityList'],
  ['entityImpact',         'entityImpactDef'],
  ['output',               'outputDef'],
  // actorRef stays unchanged
  ['actorEntry',           'actorDef'],
  ['glossaryEntry',        'glossaryEntryDef'],
  ['eventGlossaryEntry',   'eventGlossaryEntryDef'],
  ['businessRule',         'businessRuleDef'],
  ['algorithmDefinition',  'algorithmDef'],
  ['step',                 'stepDef'],
  ['condition',            'conditionDef'],
  ['branches',             'branchList'],
  ['body',                 'subStepList'],
  ['waitEvent',            'eventTriggerRef'],
  ['referenceOperation',   'operationRef'],
  ['referenceEntityFunction', 'entityFunctionRef'],
  ['referenceSqd',         'sqdRef'],
  ['referenceEvent',       'eventRef'],
  ['parameterMap',         'parameterMapDef'],
  ['transition',           'transitionDef'],
  ['stateEntry',           'stateDef'],
]);

// ─── Property renames WITHIN schema $defs (keyed by OLD def name) ────────────
// These are the names of schema properties (keys inside "properties" objects)
const DEF_PROP_RENAMES = {
  entity:               { type: 'entityType', stateModel: 'stateList', transitions: 'transitionList', attributes: 'attributeList', functions: 'functionList' },
  attribute:            { namedType: 'variable', states: 'codeLabelList' },
  namedType:            { type: 'varType' },
  role:                 { nazov: 'name' },
  relationship:         { type: 'relationshipType', start_role: 'startRoleRef', end_role: 'endRoleRef' },
  function:             { parameters: 'parameterList' },
  parameter:            { namedType: 'variable' },
  behavior:             { preconditions: 'preconditionList', postconditions: 'postconditionList', errorEvents: 'errorEventList', affectedEntities: 'affectedEntityList', actors: 'actorRefList' },
  actorEntry:           { type: 'actorType', meaning: 'definition', responsibilities: 'responsibilityList' },
  glossaryEntry:        { meaning: 'definition' },
  eventGlossaryEntry:   { meaning: 'definition' },
  businessRule:         { affectedEntities: 'affectedEntityNameList' },
  algorithmDefinition:  { parameters: 'parameterList', steps: 'stepList' },
  step:                 { type: 'stepType', text: 'description', collection: 'sourceCollectionRef', item: 'iteratorItemName', operation: 'operationRef', branches: 'branchList', body: 'subStepList' },
  condition:            { kind: 'conditionType', check: 'operatorType' },
  referenceOperation:   { kind: 'callType', eventRef: 'emitEventRef' },
  referenceEntityFunction: { mapParameters: 'parameterMapList' },
  referenceSqd:         { mapParameters: 'parameterMapList' },
  referenceEvent:       { mapParameters: 'parameterMapList' },
  stateEntry:           { type: 'stateType' },
  transition:           { operation: 'operationRef' },
  restriction:          { enumeration: 'enumerationList' },
};

// ─── Top-level section property renames ──────────────────────────────────────
const SECTION_RENAMES = {
  meta:       { namespaceRef: 'namespaceRefList' },
  domain:     { imports: 'importList', entities: 'entityList', simpleTypes: 'typeList', relationships: 'relationshipList', eventGlossary: 'eventGlossaryList' },
  algorithm:  { imports: 'importList', definitions: 'algorithmList' },
  dictionary: { imports: 'importList', glossary: 'glossaryList', businessRules: 'businessRuleList', actors: 'actorList' },
};

// ─── Utility: rename keys in an object ───────────────────────────────────────
function renameKeys(obj, renames) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    result[renames[k] ?? k] = v;
  }
  return result;
}

// ─── Update all $ref strings recursively ────────────────────────────────────
function updateRefs(node) {
  if (Array.isArray(node)) return node.map(updateRefs);
  if (node && typeof node === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === '$ref' && typeof v === 'string') {
        result[k] = v.replace(/^#\/\$defs\/(.+)$/, (_, name) => {
          return `#/$defs/${DEFS_RENAMES.get(name) ?? name}`;
        });
      } else {
        result[k] = updateRefs(v);
      }
    }
    return result;
  }
  return node;
}

// ─── Update a required array using a rename map ──────────────────────────────
function updateRequired(required, renames) {
  if (!Array.isArray(required)) return required;
  return required.map(name => renames[name] ?? name);
}

// ─── Rename properties inside a schema definition's "properties" block ───────
function applyDefPropRenames(defObj, propRenames) {
  if (!defObj || typeof defObj !== 'object') return defObj;
  const result = { ...defObj };

  if (result.properties) {
    result.properties = renameKeys(result.properties, propRenames);
  }
  if (result.required) {
    result.required = updateRequired(result.required, propRenames);
  }
  return result;
}

// ─── Handle allOf if/then prop renames (e.g. in stepDef) ─────────────────────
function applyAllOfRenames(allOf, propRenames) {
  if (!Array.isArray(allOf)) return allOf;
  return allOf.map(item => {
    const newItem = { ...item };
    if (newItem.if?.properties) {
      newItem.if = { ...newItem.if, properties: renameKeys(newItem.if.properties, propRenames) };
    }
    if (newItem.then?.required) {
      newItem.then = { ...newItem.then, required: updateRequired(newItem.then.required, propRenames) };
    }
    return newItem;
  });
}

// ─── Transform the JSON Schema ───────────────────────────────────────────────
function transformSchema(schema) {
  // 1. Rename $defs keys + rename internal properties + update required arrays
  const newDefs = {};
  for (const [oldKey, defRaw] of Object.entries(schema.$defs)) {
    const newKey = DEFS_RENAMES.get(oldKey) ?? oldKey;
    const propRenames = DEF_PROP_RENAMES[oldKey] ?? {};
    let def = applyDefPropRenames(defRaw, propRenames);
    // Handle allOf conditions (e.g. step has allOf with if/then on stepType)
    if (def.allOf) {
      def = { ...def, allOf: applyAllOfRenames(def.allOf, propRenames) };
    }
    newDefs[newKey] = def;
  }

  // 2. Rename top-level section properties
  const newProperties = { ...schema.properties };
  for (const [section, renames] of Object.entries(SECTION_RENAMES)) {
    if (newProperties[section]) {
      const sec = { ...newProperties[section] };
      if (sec.properties) sec.properties = renameKeys(sec.properties, renames);
      if (sec.required) sec.required = updateRequired(sec.required, renames);
      newProperties[section] = sec;
    }
  }

  const result = { ...schema, properties: newProperties, $defs: newDefs };

  // 3. Update all $ref strings in the whole schema
  return updateRefs(result);
}

// ─── YAML instance data: context-aware recursive key rename ──────────────────
// Path-based context for deciding which renames apply.

// Universal renames that apply in all YAML instance contexts
const YAML_UNIVERSAL = {
  nazov:            'name',
  text:             'description',
  start_role:       'startRoleRef',
  end_role:         'endRoleRef',
  body:             'subStepList',
  check:            'operatorType',
  collection:       'sourceCollectionRef',
  item:             'iteratorItemName',
  branches:         'branchList',
  meaning:          'definition',
  parameters:       'parameterList',
  mapParameters:    'parameterMapList',
  outputs:          'outputList',
  preconditions:    'preconditionList',
  postconditions:   'postconditionList',
  errorEvents:      'errorEventList',
  namespaceRef:     'namespaceRefList',
  relationships:    'relationshipList',
  glossary:         'glossaryList',
  eventGlossary:    'eventGlossaryList',
  businessRules:    'businessRuleList',
  responsibilities: 'responsibilityList',
  stateModel:       'stateList',
  transitions:      'transitionList',
  attributes:       'attributeList',
  functions:        'functionList',
  enumeration:      'enumerationList',
  namedType:        'variable',   // in attribute / parameter context
  states:           'codeLabelList',
};

// Root-section specific renames (only at that section's direct children)
const YAML_SECTION_DIRECT = {
  meta:       { namespaceRef: 'namespaceRefList' },
  domain:     { imports: 'importList', entities: 'entityList', simpleTypes: 'typeList', relationships: 'relationshipList', eventGlossary: 'eventGlossaryList' },
  algorithm:  { imports: 'importList', definitions: 'algorithmList' },
  dictionary: { imports: 'importList', glossary: 'glossaryList', businessRules: 'businessRuleList', actors: 'actorList' },
};

/**
 * Recursively renames keys in a YAML-parsed object.
 * `path` tracks the ancestor keys to determine context.
 */
function renameYamlNode(node, path = []) {
  if (Array.isArray(node)) {
    return node.map(item => renameYamlNode(item, path));
  }
  if (node && typeof node === 'object') {
    const result = {};
    for (const [key, val] of Object.entries(node)) {
      const newKey = resolveYamlKey(key, val, path, node);
      const newPath = [...path, key]; // use original key for path tracking
      result[newKey] = renameYamlNode(val, newPath);
    }
    return result;
  }
  return node;
}

/**
 * Determine the new key name for a YAML property given its path context.
 */
function resolveYamlKey(key, val, path, parentObj) {
  const parentKey = path[path.length - 1];
  const grandparentKey = path[path.length - 2];
  const rootSection = path[0]; // 'meta', 'domain', 'algorithm', 'dictionary'

  // Context-specific renames with higher priority
  // More specific context checks must come first.
  if (key === 'type') {
    if (isVarDefContext(path)) return 'varType';         // namedType.type → varType (must be first)
    if (isOperationRefContext(path)) return 'callType';  // referenceOperation.kind renamed separately but 'type' may appear too
    if (isStateEntryContext(path)) return 'stateType';
    if (isRelationshipContext(path)) return 'relationshipType';
    if (isActorEntryContext(path)) return 'actorType';
    if (isStepContext(path) || rootSection === 'algorithm' || isAlgorithmContext(path)) return 'stepType';
    if (isEntityContext(path)) return 'entityType';
  }

  // kind in condition → conditionType; kind in referenceOperation → callType
  if (key === 'kind') {
    if (isOperationRefContext(path)) return 'callType';
    if (isConditionContext(path)) return 'conditionType';
  }

  // eventRef inside referenceOperation → emitEventRef
  if (key === 'eventRef' && isOperationRefContext(path)) return 'emitEventRef';

  // operation inside transition → operationRef
  if (key === 'operation' && isTransitionContext(path)) return 'operationRef';

  // operation inside step → operationRef  
  if (key === 'operation' && isStepContext(path)) return 'operationRef';

  // steps inside algorithmDefinition → stepList
  if (key === 'steps' && isAlgorithmDefContext(path)) return 'stepList';

  // actors: behavior → actorRefList; top-level section → actorList
  if (key === 'actors') {
    if (isBehaviorContext(path)) return 'actorRefList';
    return 'actorList';
  }

  // affectedEntities in businessRule → affectedEntityNameList; otherwise → affectedEntityList
  if (key === 'affectedEntities') {
    if (isBusinessRuleContext(path)) return 'affectedEntityNameList';
    return 'affectedEntityList';
  }

  // imports at any level → importList
  if (key === 'imports') return 'importList';

  // Check universal renames
  if (YAML_UNIVERSAL[key] !== undefined) return YAML_UNIVERSAL[key];

  // Root-section direct property renames
  if (path.length === 1 && YAML_SECTION_DIRECT[path[0]]?.[key]) {
    return YAML_SECTION_DIRECT[path[0]][key];
  }

  return key;
}

// ─── Context detection helpers ────────────────────────────────────────────────

function isAlgorithmContext(path) {
  // Inside algorithmDefinition.steps[] items
  return path.some(p => p === 'steps' || p === 'stepList' || p === 'subStepList' || p === 'body') ||
    (path.includes('then') && path.some(p => p === 'branchList' || p === 'branches'));
}

function isAlgorithmDefContext(path) {
  // Direct child of an algorithmDefinition object (inside definitions array items)
  return path.includes('definitions') || path.includes('algorithmList');
}

function isEntityContext(path) {
  return path.includes('entities') || path.includes('entityList');
}

function isStateEntryContext(path) {
  return path.includes('stateModel') || path.includes('stateList');
}

function isRelationshipContext(path) {
  return path.includes('relationships') || path.includes('relationshipList');
}

function isActorEntryContext(path) {
  return path.includes('actors') || path.includes('actorList');
}

function isVarDefContext(path) {
  // namedType or variable sub-object
  return path.includes('namedType') || path.includes('variable');
}

function isOperationRefContext(path) {
  return path.includes('operation') || path.includes('operationRef') ||
    path.includes('entryOperation') || path.includes('doOperation') || path.includes('exitOperation');
}

function isConditionContext(path) {
  return path.includes('condition');
}

function isBehaviorContext(path) {
  return path.includes('behavior');
}

function isBusinessRuleContext(path) {
  return path.includes('businessRules') || path.includes('businessRuleList');
}

function isStepContext(path) {
  return path.includes('steps') || path.includes('stepList') || path.includes('subStepList') ||
    path.includes('body') || path.includes('then');
}

function isTransitionContext(path) {
  return path.includes('transitions') || path.includes('transitionList');
}

// ─── Reporting ────────────────────────────────────────────────────────────────
const report = [];

function logRename(file, entity, type, oldName, newName) {
  report.push({ file, entity, type, oldName, newName });
}

// ─── File transformation ──────────────────────────────────────────────────────

function transformSchemaFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const schema = JSON.parse(raw);
  const transformed = transformSchema(schema);

  // Build report from $defs renames
  for (const [oldName, newName] of DEFS_RENAMES) {
    logRename(path.basename(filePath), '$defs', 'element', oldName, newName);
  }
  // Report property renames within defs
  for (const [defName, propMap] of Object.entries(DEF_PROP_RENAMES)) {
    for (const [oldProp, newProp] of Object.entries(propMap)) {
      logRename(path.basename(filePath), defName, 'property', oldProp, newProp);
    }
  }
  // Report section renames
  for (const [section, renames] of Object.entries(SECTION_RENAMES)) {
    for (const [oldProp, newProp] of Object.entries(renames)) {
      logRename(path.basename(filePath), section, 'property', oldProp, newProp);
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(transformed, null, 2), 'utf8');
  console.log(`✓ Schema transformed: ${filePath}`);
}

function transformYamlFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  let parsed;
  try {
    parsed = yaml.load(raw);
  } catch (e) {
    console.error(`✗ Failed to parse ${filePath}: ${e.message}`);
    return;
  }
  if (!parsed || typeof parsed !== 'object') {
    console.log(`  (skipped, not an object) ${filePath}`);
    return;
  }
  const transformed = renameYamlNode(parsed);
  const out = yaml.dump(transformed, { lineWidth: 120, quotingType: "'", forceQuotes: false, noRefs: true });
  fs.writeFileSync(filePath, out, 'utf8');
  console.log(`✓ YAML transformed: ${filePath}`);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

// Transform schema
transformSchemaFile(path.join(ROOT, 'unified.schema.json'));

// Transform all YAML files in Example/
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) {
      transformYamlFile(full);
    }
  }
}
walk(path.join(ROOT, 'Example'));

// ─── Print report ─────────────────────────────────────────────────────────────
console.log('\n--- Renaming Report ---');
const header = '| File | Entity/Context | Type | Old Name | New Name |';
const sep    = '|---|---|---|---|---|';
console.log(header);
console.log(sep);
for (const r of report) {
  console.log(`| ${r.file} | ${r.entity} | ${r.type} | ${r.oldName} | ${r.newName} |`);
}
console.log(`\nTotal renamings: ${report.length}`);
