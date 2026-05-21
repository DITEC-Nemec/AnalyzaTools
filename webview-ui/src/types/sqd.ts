/* Zdieľané typy odvodené zo sqd.schema.json a model.schema.json */

export interface NamespaceEntity {
  alias: string;
  filePath: string;
  sourceType: 'current' | 'model' | 'sqd';
}

export type GovernanceStatus = 'draft' | 'active' | 'deprecated';

export interface GovernanceMetadata {
  name: string;
  description?: string;
  version?: string;
  status?: GovernanceStatus;
}

export interface SqdAlgorithm {
  algorithm: AlgorithmMeta;
  steps: SqdStep[];
  actors?: ActorEntry[];
  namespaceRef?: NamespaceEntity[];
  imports?: string[];
  name?: string;
  description?: string;
  version?: string;
  status?: GovernanceStatus;
}

export interface AlgorithmMeta {
  name: string;
  version?: string;
  parameters?: Parameter[];
  behavior?: Behavior;
}

export interface NamedType {
  name: string;
  type?: 'definition' | 'entityRef' | 'typeRef';
  entityRef?: ReferenceEntity;
  typeRef?: SimpleTypeRef;
  definition?: SimpleTypeDefinition;
  nullable?: boolean;
  readOnly?: boolean;
  multiplicity?: string;
}

export interface Variable {
  namedType?: NamedType;
}

export type ParameterDirection = 'in' | 'out' | 'inout';

export interface Parameter extends Variable {
  direction?: ParameterDirection;
}

export interface ParameterMap {
  parameter: string;
  value: string;
  // Spatna kompatibilita so starsim nazvom pola
  variable?: string;
}

export type StepType =
  | 'step'
  | 'operation'
  | 'decision'
  | 'loop'
  | 'foreach'
  | 'return'
  | 'stop'
  | 'block';

export interface SqdStep {
  id: string;
  legacyId?: string;
  type: StepType;
  text?: string;

  collection?: string;
  item?: string;

  operation?: string | ReferenceOperation;
  condition?: StepCondition;
  branches?: Branch[];
  body?: SqdStep[];
  behavior?: Behavior;

  // Spatna kompatibilita so starsimi datami/editorom
  steps?: SqdStep[];
  call?: string;
  outputs?: StepOutput[];
}

export interface StepOutput {
  variable: string;
  description?: string;
}

export interface NamespaceDataEntry {
  alias: string;
  sourceType: 'current' | 'model' | 'sqd';
  entities?: Array<{ name: string; attributes?: string[]; functions?: string[] }>;
  events?: string[];
  simpleTypes?: string[];
}

export type NamespaceData = Record<string, NamespaceDataEntry>;

export interface ReferenceEntity {
  namespaceAlias?: string;
  entity?: string;

}

export interface ReferenceAttribute {
  namespaceAlias?: string;
  entity?: string;
  attribute?: string;
}

export interface ReferenceEntityFunction {
  namespaceAlias?: string;
  entity?: string;
  function?: string;
  mapParameters?: ParameterMap[];
  
}

export interface ReferenceSqd {
  namespaceAlias?: string;
  mapParameters?: ParameterMap[];
  // Spatna kompatibilita so starsim formatom mapovania
  mapInput?: ParameterMap[];
  mapOutput?: ParameterMap[];
}

export interface ReferenceEvent {
  namespaceAlias?: string;
  event?: string;
  mapParameters?: ParameterMap[];
  // Spatna kompatibilita so starsim formatom mapovania
  mapInput?: ParameterMap[];
  mapOutput?: ParameterMap[];
}

export interface ReferenceOperation {
  kind: 'entityFunction' | 'sqd' | 'step' | 'event';
  stepRef?: string;
  entityFunctionRef?: ReferenceEntityFunction;
  sqdRef?: ReferenceSqd;
  eventRef?: ReferenceEvent;
}

export interface StepCondition {
  kind?: 'attributeRef' | 'variable' | 'operationRef' | 'waitEvent' | 'simple';
  variable?: string;
  attributeRef?: ReferenceAttribute;
  operationRef?: ReferenceOperation;
  waitEvent?: StepEvent;
  description?: string;
  check: 'exists' | 'is null' | 'is not null' | 'equals' | 'not equals' | 'greater than' | 'less than';
  value?: unknown;

 
}

export interface Branch {
  when: boolean | string;
  then: SqdStep[];
}

export interface StepEvent {
  eventRef: ReferenceEvent;
  waitUntil?: string;
  timeoutAction?: string;
}

export interface EntityImpact {
  attributeRef?: ReferenceAttribute;
  variableRef?: string;
  impact: 'read' | 'write' | 'affect';
  note?: string;

  // Spatna kompatibilita so starsimi datami
  entity?: string;
}

export interface Output {
  variable: string;
  description?: string;
}

export type AffectedEntity = EntityImpact | Output;

export interface ActorRef {
  namespaceAlias: string;
  actor: string;
}

export type ErrorEventAction =
  | 'emit'
  | 'fallback'
  | 'return'
  | 'exception'
  | 'retry'
  | 'skip'
  | 'compensate';

export interface ErrorEvent {
  condition: string;
  eventRef: ReferenceEvent;
  action?: ErrorEventAction;
  fallbackStepRef?: string;
  returnValue?: string;
  exceptionMessage?: string;
  maxAttempts?: number;
  backoffStrategy?: 'fixed' | 'linear' | 'exponential';
  delayMs?: number;
  skipToStepRef?: string;
  compensationStepRef?: string;
  note?: string;
}

export interface ActorEntry {
  code: string;
  title?: string;
  type?: 'user' | 'system' | 'external_system';
  meaning: string;
  responsibilities?: string[];
}

export interface Behavior {
  description?: string;
  preconditions?: string[];
  postconditions?: string[];
  errorEvents?: ErrorEvent[];
  affectedEntities?: AffectedEntity[];
  actors?: ActorRef[];
}

// ----- Domain Model -----

export interface DomainModel {
  domain: DomainMeta;
  entities: Entity[];
  simpleTypes?: SimpleType[];
  relationships?: Relationship[];
  glossary?: GlossaryEntry[];
  eventGlossary?: EventGlossaryEntry[];
  businessRules?: BusinessRule[];
  actors?: ActorEntry[];
  namespaceRef?: NamespaceEntity[];
}

export interface Annotation {
  title?: string;
  description?: string;
  documentation?: string;
}

export interface SimpleTypeRef {
  namespaceAlias: string;
  simpleType: string;
}

export interface RestrictionDefinition {
  base: string | SimpleTypeRef;
  enumeration?: Array<string | number | boolean>;
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
  whiteSpace?: 'preserve' | 'replace' | 'collapse';
}

export interface SimpleTypeDefinition {
  restriction?: RestrictionDefinition;
}

export interface SimpleType {
  name: string;
  annotation?: Annotation;
  definition: SimpleTypeDefinition;
}

export interface DomainMeta {
  name: string;
  description?: string;
  version?: string;
  status?: 'draft' | 'active' | 'deprecated';
}

export interface Entity {
  name: string;
  description?: string;
  type?: 'business_concept' | 'database_table' | 'code_list' | 'conceptual_system' | 'computational_system' | 'other';
  agregationStatus?: 'root' | 'leaf' | 'intermediate';
  status?: 'active' | 'deprecated';
  stateModel?: StateEntry[];
  transitions?: Transition[];
  attributes?: Attribute[];
  functions?: DomainFunction[];
}

export interface StateEntry {
  name: string;
  label?: string;
  description?: string;
  type?: 'initial' | 'normal' | 'final' | 'choice' | 'junction' | 'error';
  entryOperation?: ReferenceOperation;
  doOperation?: ReferenceOperation;
  exitOperation?: ReferenceOperation;
  isFinal?: boolean;
}

export interface Transition {
  id?: string;
  from: string;
  to: string;
  trigger?: StepEvent;
  condition?: string;
  operation?: ReferenceOperation;
  priority?: number;
  automatic?: boolean;
  description?: string;
}

export interface CodeLabel {
  code: string;
  label?: string;
}

export interface Attribute {
  namedType?: NamedType;
  states?: CodeLabel[];


}

export interface RelationshipRole {
  nazov?: string;
  multiplicity?: string;
  entity?: string;
  entityRef?: ReferenceEntity;
  description?: string;
}

export interface Relationship {
  type?: 'contains' | 'references' | 'belongs_to' | 'aggregates';
  start_role?: RelationshipRole;
  end_role?: RelationshipRole;
  description?: string;
}

export interface GlossaryEntry {
  term: string;
  meaning: string;
  relatedEntity?: string;
}

export interface DomainFunction {
  name: string;
  parameters?: Parameter[];
  behavior?: Behavior;

  // Spatna kompatibilita so starsim formatom funkcie
  inputs?: Variable[];
  effects?: FunctionEffect[];
}

export interface FunctionEffect {
  type: 'reads' | 'writes';
  attributeRef?: ReferenceAttribute;
 
}

export interface EventGlossaryEntry {
  code: string;
  title?: string;
  meaning: string;
  severity?: 'info' | 'warning' | 'error';
  recommendedAction?: string;
}

export interface BusinessRule {
  code: string;
  description: string;
  severity?: 'mandatory' | 'recommended' | 'informational';
  affectedEntities?: string[];
}
