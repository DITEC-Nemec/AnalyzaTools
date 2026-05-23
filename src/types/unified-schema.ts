/**
 * Unified Schema Type Definitions
 * Generated from model.schema.json.unified
 * Represents combined domain models and algorithms with selective namespace imports
 */

// ============================================================================
// GOVERNANCE / META LAYER
// ============================================================================

export interface NamespaceEntity {
  alias: string;
  filePath: string;
  sourceType: "current" | "model" | "sqd";
  status?: "active" | "deprecated" | "draft";
}

export interface GovernanceMetadata {
  name: string;
  description?: string;
  version?: string;
  status?: "draft" | "active" | "deprecated";
}

export interface Meta {
  metadata?: GovernanceMetadata;
  namespaceRefList: NamespaceEntity[];
}

// ============================================================================
// SHARED / COMMON TYPES
// ============================================================================

export interface Annotation {
  title?: string;
  description?: string;
  documentation?: string;
}

export interface CodeLabel {
  code: string;
  label?: string;
}

export interface StateEntry {
  name: string;
  label?: string;
  description?: string;
  isFinal?: boolean;
}

// ============================================================================
// SIMPLE TYPES (Restrictions)
// ============================================================================

export type SimpleTypeBase =
  | "string"
  | "boolean"
  | "decimal"
  | "integer"
  | "long"
  | "int"
  | "short"
  | "byte"
  | "nonNegativeInteger"
  | "positiveInteger"
  | "nonPositiveInteger"
  | "negativeInteger"
  | "float"
  | "double"
  | "date"
  | "dateTime"
  | "time"
  | "duration"
  | "anyURI"
  | "QName"
  | "ID"
  | "IDREF"
  | "token"
  | "normalizedString";

export interface SimpleTypeRef {
  namespaceAlias: string;
  simpleType: string;
}

export interface Restriction {
  base: SimpleTypeBase | SimpleTypeRef;
  enumeration?: (string | number | boolean)[];
  pattern?: string;
  length?: number;
  minLength?: number;
  maxLength?: number;
  minInclusive?: number | string;
  maxInclusive?: number | string;
  minExclusive?: number | string;
  maxExclusive?: number | string;
  totalDigits?: number;
  fractionDigits?: number;
  whiteSpace?: "preserve" | "replace" | "collapse";
}

export interface SimpleTypeDefinition {
  restriction?: Restriction;
}

export interface SimpleType {
  name: string;
  annotation?: Annotation;
  definition: SimpleTypeDefinition;
}

// ============================================================================
// ENTITY & ATTRIBUTES
// ============================================================================

export interface ReferenceEntity {
  namespaceAlias: string;
  entity?: string;
}

export interface ReferenceAttribute {
  namespaceAlias: string;
  entity?: string;
  attribute?: string;
}

export type NamedTypeKind = "definition" | "entityRef" | "typeRef";

export interface NamedType {
  name: string;
  annotation?: Annotation;
  type?: NamedTypeKind;
  definition?: SimpleTypeDefinition;
  entityRef?: ReferenceEntity;
  typeRef?: SimpleTypeRef;
  nullable?: boolean;
  readOnly?: boolean;
  multiplicity?: string;
}

export interface Attribute {
  variable: NamedType;
  states?: CodeLabel[];
}

export interface Function {
  name: string;
  parameterList?: Parameter[];
  behavior?: Behavior;
}

export interface Parameter {
  direction?: "in" | "out" | "inout";
  namedType?: NamedType;
}

export interface Entity {
  name: string;
  description?: string;
  entityType?: "business_concept" | "database_table" | "code_list" | "conceptual_system" | "computational_system" | "other";
  agregationStatus?: "root" | "leaf" | "intermediate";
  status?: "active" | "deprecated";
  stateList?: StateEntry[];
  attributeList: Attribute[];
  functionList?: Function[];
}

// ============================================================================
// RELATIONSHIPS
// ============================================================================

export interface Role {
  nazov?: string;
  multiplicity?: string;
  entityRef: ReferenceEntity;
  description?: string;
}

export type RelationshipType = "contains" | "references" | "belongs_to" | "aggregates";

export interface Relationship {
  type: RelationshipType;
  startRoleRef: Role;
  endRoleRef: Role;
  description?: string;
}

// ============================================================================
// BEHAVIOR / ACTORS / GLOSSARY
// ============================================================================

export interface ActorRef {
  namespaceAlias: string;
  actor: string;
}

export type ErrorEventAction =
  | "emit"
  | "fallback"
  | "return"
  | "exception"
  | "retry"
  | "skip"
  | "compensate";

export interface ErrorEvent {
  condition: string;
  eventRef: ReferenceEvent;
  action?: ErrorEventAction;
  fallbackStepRef?: string;
  returnValue?: string;
  exceptionMessage?: string;
  maxAttempts?: number;
  backoffStrategy?: "fixed" | "linear" | "exponential";
  delayMs?: number;
  skipToStepRef?: string;
  compensationStepRef?: string;
  note?: string;
}

export interface ActorEntry {
  code: string;
  title?: string;
  type?: "user" | "system" | "external_system";
  meaning: string;
  responsibilities?: string[];
}

export interface EntityImpact {
  attributeRef?: ReferenceAttribute;
  variableRef?: string;
  impact: "read" | "write" | "affect";
  note?: string;
}

export interface Output {
  variable: string;
  description?: string;
}

export type AffectedEntity = EntityImpact | Output;

export interface Behavior {
  description?: string;
  preconditionList?: string[];
  postconditionList?: string[];
  errorEventList?: ErrorEvent[];
  affectedEntityList?: AffectedEntity[];
  actorRefList?: ActorRef[];
}

export interface GlossaryEntry {
  term: string;
  meaning: string;
  relatedEntity?: string;
}

export interface EventGlossaryEntry {
  code: string;
  title?: string;
  meaning: string;
  severity?: "info" | "warning" | "error";
  recommendedAction?: string;
}

export interface BusinessRule {
  code: string;
  description: string;
  severity?: "mandatory" | "recommended" | "informational";
  affectedEntities?: string[];
}

// ============================================================================
// ALGORITHM / STEPS
// ============================================================================

export interface ParameterMap {
  parameter: string;
  value: string;
}

export interface ReferenceEntityFunction {
  namespaceAlias?: string;
  entity?: string;
  function: string;
  mapParameters?: ParameterMap[];
}

export interface ReferenceSqd {
  namespaceAlias: string;
  mapParameters?: ParameterMap[];
}

export interface ReferenceEvent {
  namespaceAlias: string;
  event?: string;
  mapParameters?: ParameterMap[];
}

export interface WaitEvent {
  eventRef: ReferenceEvent;
  waitUntil?: string;
  timeoutAction?: string;
}

export type OperationRefKind = "entityFunction" | "sqd" | "step" | "event";

export interface ReferenceOperation {
  kind: OperationRefKind;
  stepRef?: string;
  entityFunctionRef?: ReferenceEntityFunction;
  sqdRef?: ReferenceSqd;
  eventRef?: ReferenceEvent;
}

export type ConditionKind = "entityRef" | "variableRef" | "operationRef" | "waitEvent" | "simple";

export interface Condition {
  kind: ConditionKind;
  variableRef?: string; // @deprecated
  attributeRef?: ReferenceAttribute;
  operationRef?: ReferenceOperation;
  waitEvent?: WaitEvent;
  description: string;
  check: "exists" | "is null" | "is not null" | "equals" | "not equals" | "greater than" | "less than";
  value?: unknown;
}

export interface Branch {
  when: boolean | "otherwise";
  then: Step[];
}

export type StepType = "step" | "decision" | "loop" | "foreach" | "operation" | "return" | "stop" | "block";

export interface Step {
  id: string;
  legacyId?: string;
  stepType: StepType;
  text: string;
  sourceCollectionRef?: string;
  iteratorItemName?: string;
  operationRef?: string | ReferenceOperation;
  condition?: Condition;
  branchList?: Branch[];
  subStepList?: Step[];
  behavior?: Behavior;
}

export interface AlgorithmDefinition {
  name: string;
  version?: string;
  parameterList?: Parameter[];
  behavior?: Behavior;
  stepList: Step[];
}

// ============================================================================
// DOMAIN MODULE
// ============================================================================

export type DomainMetadata = GovernanceMetadata;

export interface Domain {
  metadata?: DomainMetadata;
  importList?: string[];
  entityList?: Entity[];
  typeList?: SimpleType[];
  relationshipList?: Relationship[];
  eventGlossary?: EventGlossaryEntry[];
  // Legacy support
  name?: string;
}

// ============================================================================
// ALGORITHM MODULE
// ============================================================================

export interface Algorithm {
  metadata?: GovernanceMetadata;
  importList?: string[];
  algorithmList?: AlgorithmDefinition[];
}

// ============================================================================
// DICTIONARY MODULE (Cross-domain)
// ============================================================================

export interface Dictionary {
  metadata?: GovernanceMetadata;
  importList?: string[];
  glossary?: GlossaryEntry[];
  businessRules?: BusinessRule[];
  actorList?: ActorEntry[];
}

// ============================================================================
// ROOT DOCUMENT
// ============================================================================

export interface UnifiedModel {
  $schema?: string;
  $id?: string;
  title?: string;
  description?: string;
  meta?: Meta;
  domain?: Domain;
  algorithm?: Algorithm;
  dictionary?: Dictionary;
}

// ============================================================================
// LEGACY FORMATS (for backward compatibility detection)
// ============================================================================

export interface LegacyDomainModel {
  domain?: DomainMetadata;
  namespaceRef?: NamespaceEntity[];
  entities?: Entity[];
  simpleTypes?: SimpleType[];
  relationships?: Relationship[];
  glossary?: GlossaryEntry[];
  eventGlossary?: EventGlossaryEntry[];
  businessRules?: BusinessRule[];
  actors?: ActorEntry[];
  [key: string]: unknown;
}

export interface LegacySqdModel {
  algorithm?: { name: string };
  parameters?: Parameter[];
  behavior?: Behavior;
  steps?: Step[];
  [key: string]: unknown;
}
