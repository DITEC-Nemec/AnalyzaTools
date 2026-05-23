# UI Renaming Mapping (zavazny podklad pre AI)

Tento subor sa vytvara alebo aktualizuje az po finalnom stave premenovania schemy.
UI premenovania sa vykonavaju iba podla mapovania v tomto subore.

## 1. Stav a zdroj pravdy

- Stav: FINAL_SCHEMA_SYNC
- Zdroj pravdy: finalna JSON schema + finalne subory v Example/
- Rozsah: iba premenovanie nazvov v UI, bez zmeny logiky a bez zmeny struktury editorov
- Spatna kompatibilita: NEPOVOLENA
- Enum literal values sa v tejto iteracii nemenia, pokial nie su explicitne uvedene v mapovani.

## 2. Premenovania v hlavnej sekcii (top-level properties)

Tieto premenovania sa tykaju priamych properties v korenovom objekte a v sekciach `meta`, `domain`, `algorithm`, `dictionary`.

| Sekcia | Stary nazov property | Novy nazov property | Poznamka |
|---|---|---|---|
| root | meta | meta | bez zmeny |
| root | domain | domain | bez zmeny |
| root | algorithm | algorithm | bez zmeny |
| root | dictionary | dictionary | bez zmeny |
| meta | metadata | metadata | bez zmeny |
| meta | namespaceRef | namespaceRefList | array |
| domain | metadata | metadata | bez zmeny |
| domain | imports | importList | array |
| domain | entities | entityList | array of entityDef |
| domain | simpleTypes | typeList | array of simpleTypeDef |
| domain | relationships | relationshipList | array of relationshipDef |
| domain | eventGlossary | eventGlossaryList | array of eventGlossaryEntryDef |
| algorithm | metadata | metadata | bez zmeny |
| algorithm | imports | importList | array |
| algorithm | definitions | algorithmList | array of algorithmDef |
| dictionary | metadata | metadata | bez zmeny |
| dictionary | imports | importList | array |
| dictionary | glossary | glossaryList | array of glossaryEntryDef |
| dictionary | businessRules | businessRuleList | array of businessRuleDef |
| dictionary | actors | actorList | array of actorDef |

## 3. Zavazne mapovanie Property (vnutorne properties objektov)

| Kontekst entity | Stary nazov property | Novy nazov property |
|---|---|---|
| * | nazov | name |
| * | text | description |
| * | start_role | startRoleRef |
| * | end_role | endRoleRef |
| * | body | subStepList |
| * | check | operatorType |
| * | collection | sourceCollectionRef |
| * | item | iteratorItemName |
| * | branches | branchList |
| * | meaning | definition |
| * | parameters | parameterList |
| * | mapParameters | parameterMapList |
| * | outputs | outputList |
| * | preconditions | preconditionList |
| * | postconditions | postconditionList |
| * | errorEvents | errorEventList |
| * | namespaceRef | namespaceRefList |
| * | imports | importList |
| * | relationships | relationshipList |
| * | glossary | glossaryList |
| * | eventGlossary | eventGlossaryList |
| * | businessRules | businessRuleList |
| * | responsibilities | responsibilityList |
| * | stateModel | stateList |
| * | transitions | transitionList |
| * | attributes | attributeList |
| * | functions | functionList |
| * | enumeration | enumerationList |
| attribute / parameter | namedType | variable |
| attribute | states | codeLabelList |
| Behavior | actors | actorRefList |
| Behavior | affectedEntities | affectedEntityList |
| BusinessRule | affectedEntities | affectedEntityNameList |
| DomainModel / SqdAlgorithm | actors | actorList |
| algorithmDefinition | steps | stepList |
| step | type | stepType |
| step | operation | operationRef |
| referenceOperation | kind | callType |
| referenceOperation | eventRef | emitEventRef |
| condition | kind | conditionType |
| entity | type | entityType |
| actorEntry | type | actorType |
| variable | type | varType |
| stateEntry | type | stateType |
| relationship | type | relationshipType |
| transition | operation | operationRef |

## 4. Zavazne mapovanie $defs nazvov (Entity/Element)

| Stary nazov v $defs | Novy nazov v $defs |
|---|---|
| governanceMetadata | governanceMetadataDef |
| namespaceEntity | namespaceDef |
| entity | entityDef |
| referenceEntity | entityRef |
| attribute | attributeDef |
| referenceAttribute | attributeRef |
| simpleTypeRef | typeRef |
| namedType | varDef |
| simpleType | simpleTypeDef |
| simpleTypeDefinition | typeDefinitionDef |
| restriction | restrictionDef |
| annotation | annotationDef |
| codeLabel | codeLabelDef |
| role | roleDef |
| relationship | relationshipDef |
| function | functionDef |
| parameter | parameterDef |
| behavior | behaviorDef |
| errorEvent | errorEventDef |
| affectedEntities | affectedEntityList |
| entityImpact | entityImpactDef |
| output | outputDef |
| actorRef | actorRef |
| actorEntry | actorDef |
| glossaryEntry | glossaryEntryDef |
| eventGlossaryEntry | eventGlossaryEntryDef |
| businessRule | businessRuleDef |
| algorithmDefinition | algorithmDef |
| step | stepDef |
| condition | conditionDef |
| branches | branchList |
| body | subStepList |
| waitEvent | eventTriggerRef |
| referenceOperation | operationRef |
| referenceEntityFunction | entityFunctionRef |
| referenceSqd | sqdRef |
| referenceEvent | eventRef |
| parameterMap | parameterMapDef |
| transition | transitionDef |
| stateEntry | stateDef |

## 5. Zakazane nazvy po migracii

| Zakazany nazov | Nahrada |
|---|---|
| operationRefDef | operationRef |
| entityFunctionRefDef | entityFunctionRef |

## 6. Explicitne bez zmeny

Nasledujuce leaf properties a ref fields ostavaju bez zmeny a nesmu byt heuristicky premenuvane:

| Kontext entity | Property bez zmeny | Poznamka |
|---|---|---|
| referenceEntity | entity | nazov cielovej entity |
| referenceAttribute | entity | nazov cielovej entity |
| referenceAttribute | attribute | nazov cieloveho atributu |
| referenceEntityFunction | function | nazov cielovej funkcie |
| referenceEvent | event | nazov cielovej udalosti |
| namedType | entityRef | ref na entitu, nazov ostava |
| namedType | typeRef | ref na typ, nazov ostava |
| condition | attributeRef | ref na atribut, nazov ostava |
| condition | operationRef | ref na operaciu, nazov ostava |
| condition | waitEvent | ref na event trigger, nazov ostava |
| errorEvent | eventRef | ref na event, nazov ostava |
| referenceOperation | stepRef | ref na krok, nazov ostava |
| referenceOperation | entityFunctionRef | ref na funkciu, nazov ostava |
| referenceOperation | sqdRef | ref na sqd, nazov ostava |
| referenceSqd | namespaceAlias | alias cieloveho namespace |
| referenceEvent | namespaceAlias | alias cieloveho namespace |
| referenceEntity | namespaceAlias | alias cieloveho namespace |
| referenceAttribute | namespaceAlias | alias cieloveho namespace |

## 7. Poznamka pre buducu iteraciu

Nasledujuca iteracia moze urobit strukturalne rozdelenie kolekcie `affectedEntities` na dve samostatne kolekcie:

- `entityImpactList`
- `outputList`

Tato zmena nie je sucastou aktualnej rename-only iteracie.

## 8. Iteracia 2 (volitelne): enum normalizacia

Ak sa rozhodne pre enum normalizaciu, realizuje sa ako samostatna iteracia po dokonceni rename-only migracie.

- Scope Iteracie 2: iba enum hodnoty explicitne schvalene v mapovani.
- Povinne kroky: schema + Example + validator + UI switch vetvy pre enum hodnoty.
- Ziadna enum hodnota sa nesmie menit implicitne alebo heuristicky.

## 9. Povinny vystup AI kroku pre UI

AI odovzda iba zoznam realne vykonanych premenovani vo formate:

| Subor | Entita/Kontekst | Typ | Stary nazov | Novy nazov |
|---|---|---|---|---|
| webview-ui/src/... | step alebo operation alebo * | property/element | oldName | newName |
