Tu je kompletný konsolidovaný návrh refaktoringu tvojej schémy.

Tento súbor slúži ako "Style Guide" pre tvoju architektúru, ktorý zabezpečí, že AI bude s tvojou schémou pracovať konzistentne, predvídateľne a bez halucinácií.

# Refaktoringová mapa a štandardy pre SQD schému

Tento dokument definuje pravidlá pomenovávania prvkov v JSON schéme pre zabezpečenie maximálnej interoperability s LLM (Large Language Models).

## 1. Pravidlá sémantických sufixov

Každý prvok v `$defs` musí mať sufix podľa svojho účelu:

- **...Def**: Architektonická šablóna/definícia (objekt v `$defs`).
- **...Ref**: Odkaz na iný objekt (pointer/link).
- **...List**: Zoznam prvkov (array inštancií).
- **...Type**: Kategória, enum alebo typová klasifikácia. Property pomenovaná `type` v objekte sa premenuje na `<NazovEntity>Type` (napr. `entity.type` → `entityType`, `step.type` → `stepType`).

## 2. Tabuľka premenovaní

### 2.1 Premenovania typu Property

| Pôvodný názov | Nový názov | Typ |
|---|---|---|
| nazov | name | Property |
| text | description | Property |
| kind | stepType / operatorType | Property |
| start_role | startRoleRef | Property |
| end_role | endRoleRef | Property |
| body | subStepList | Property |
| check | operatorType | Property |
| collection | sourceCollectionRef | Property |
| item | iteratorItemName | Property |
| branches | branchList | Property |
| meaning | definition | Property |

### 2.2 Premenovania typu Element

| Pôvodný názov | Nový názov | Typ |
|---|---|---|
| simpleTypes | typeList | Element |
| waitEvent | eventTriggerRef | Element |
| steps | stepList | Element |
| functions | functionList | Element |
| referenceOperation | operationRef | Element |
| referenceEntityFunction | entityFunctionRef | Element |
| namespaceEntity | namespaceDef | Element |
| entity | entityDef | Element |
| attribute | attributeDef | Element |
| stateEntry | stateDef | Element |
| businessRule | businessRuleDef | Element |

## 3. Doplnkové architektonické pravidlá

1. **Strict camelCase**: Všetky kľúče musia začínať malým písmenom a každé ďalšie slovo veľkým (napr. `sourceCollectionRef`, nie `source_collection_ref`).
2. **Jazyková integrita**: Všetky názvy kľúčov, popisov a hodnôt (enum) musia byť v angličtine.
3. **Ref vs. Def**:
   - **Ref** nikdy neobsahuje definíciu objektu, len cestu k nemu (cez `$ref` alebo `namespaceAlias`).
   - **Def** obsahuje kompletnú štruktúru objektu.
   - **Zákaz kombinácie RefDef**: Nikdy nepoužívaj `entityRefDef` (je to sémanticky protichodné). Použi buď `entityRef` .
4. **Implicitnosť**: Ak je niečo zoznam, vždy používaj `...List` namiesto plurálu (napr. `stepList` je lepšie ako `steps`). AI ľahšie pochopí `stepList` ako array objektov typu `stepDef`.

## 4. Prompt pre automatizovanú migráciu (Prompt pre AI)

Ak chceš vykonať zmeny v kóde pomocou AI, použi tento prompt:

> "Refaktoruj moju JSON schému podľa priloženej Refaktoringovej mapy.
> Dodržuj tieto striktné pravidlá:
> 1. Premenuj všetky kľúče v `$defs` a ich referencie v celej schéme.
> 2. Ak je objekt zoznamom, premenuj ho na sufix `List`.
> 3. Ak je objekt definíciou štruktúry v `$defs`, premenuj ho na sufix `Def`.
> 4. Ak objekt odkazuje na iný prvok, premenuj ho na sufix `Ref`.
> 5. Uisti sa, že všetky cesty v `$ref` sú aktualizované podľa nových názvov.
> 6. Validuj, či sú `required` polia v objektoch v súlade s novými názvami.
>
> Cieľom je čistá, sémanticky jasná schéma, kde každý názov kľúča okamžite informuje AI o tom, či ide o zoznam, odkaz alebo definíciu."

Tento prístup vytvorí "jazyk", ktorým bude tvoja schéma hovoriť k AI modelom. Bude to presné, logické a ext

## 5. Spresnenie zadania po dohode

Táto kapitola dopĺňa pôvodný návrh o záväzné realizačné pravidlá.

### 5.1 Názvoslovie pre Type podľa entity
- Typ sa pomenováva podľa názvu entity v tvare `<NazovEntity>Type`.
- Toto pravidlo je nadradené všeobecnému pomenovaniu tam, kde sa typ viaže na konkrétnu entitu.

### 5.2 Rozsah zmeny
- Upraviť JSON schému podľa novej štruktúry.
- Upraviť súbory v `Example/` podľa novej štruktúry.
- Vyprodukovať zoznam všetkých premenovaní ako podklad pre následnú AI úpravu UI.

### 5.3 Technické obmedzenia
- Nemení sa biznis logika.
- Nemení sa štruktúra editorov.
- Zachováva sa existujúca štruktúra entity/property; realizuje sa iba premenovanie.

### 5.4 Kompatibilita
- Realizácia je bez spätnej kompatibility.
- Staré názvy sa po migrácii nepodporujú.

### 5.5 Validácia a kontrola
- Upraviť validačný skript podľa novej schémy.
- Všetky súbory v `Example/` musia prejsť validačným skriptom bez chyby.

### 5.6 Povinný výstup pre ďalší krok (UI)
- Výstupom musí byť úplný zoznam zmien/premenovaní použiteľný ako vstup pre AI realizáciu premenovaní v UI.
- Zoznam musí byť deterministický: jeden starý názov má presne jeden nový názov v danom kontexte.
- Autoritatívny zdroj rename pravidiel a presných pokynov je `scripts/UI_RENAMING_BASELINE.md`.
- Ak vznikne rozpor medzi týmto dokumentom a `scripts/UI_RENAMING_BASELINE.md`, rozhodujúci je `scripts/UI_RENAMING_BASELINE.md`.

### 5.6.1 Poznámka pre budúcu iteráciu
- V budúcej iterácii je možné urobiť štrukturálne rozdelenie kolekcie `affectedEntities` na `entityImpactList` a `outputList`.
- Táto zmena nepatrí do aktuálnej iterácie, pretože aktuálny scope povoľuje iba premenovanie, nie zmenu štruktúry.

### 5.6.2 Poradie premenovaní bez kolízií
- Premenovania sa nesmú robiť ako neobmedzené globálne nahradenie textu.
- Každé premenovanie musí mať určený kontext: `$defs` key, `$ref` hodnota, `properties` key, `required` položka, YAML key, TS field.
- Pri riziku kolízie sa používa dvojkrokový rename cez dočasný technický názov.

#### Odporúčaná sekvencia
1. Zafixovať autoritatívnu mapu rename pravidiel v `scripts/UI_RENAMING_BASELINE.md`.
2. Premenovať `$defs` kľúče na dočasné technické názvy, napr. `entity -> __tmp_entityDef__`.
3. Aktualizovať všetky `$ref` cesty na tie isté dočasné názvy.
4. Premenovať dočasné `$defs` názvy na finálne názvy.
5. Premenovať property names v schéme na dočasné názvy všade tam, kde hrozí kolízia alebo substring match.
6. Aktualizovať `required` polia a ostatné interné odkazy na dočasné property názvy.
7. Premenovať dočasné property názvy na finálne názvy.
8. Migrovať súbory v `Example/` podľa finálneho mappingu.
9. Upraviť validačný skript podľa finálneho stavu schémy.
10. Spustiť validáciu example súborov.
11. Upraviť TS typy a interné mapovanie dát.
12. Až nakoniec upraviť UI podľa finálneho mappingu.

#### Pravidlá pre bezpečný rename
- Nikdy nepremenovávať iba podľa holého tokenu bez kontextu.
- Premenovanie `entity -> entityDef` sa robí iba ako názov `$defs` kľúča alebo hodnota `$ref`, nie ako voľný substring v inom názve.
- Premenovanie `type`, `kind`, `function`, `entity`, `condition`, `event` sa musí robiť kontextovo, lebo ide o kolízne názvy.
- Ak starý názov existuje aj ako časť iného názvu, použiť dočasný názov vo formáte `__tmp_<finalName>__`.
- Po každej fáze spustiť úzku validáciu pred pokračovaním na ďalšiu vrstvu.

### 5.7 Riadenie zmien dokumentu
- Pri mazacích alebo deštruktívnych zmenách v súbore sa vždy vyžaduje explicitný súhlas.
- Preferované sú inkrementálne doplnenia a cielené úpravy.

## 6. Synchronizovana kopia dohodnuteho mappingu pre AI

Tato sekcia je synchronizovana kopia z `scripts/UI_RENAMING_BASELINE.md`.

Ak vznikne rozpor medzi touto sekciou a `scripts/UI_RENAMING_BASELINE.md`, rozhodujuci je `scripts/UI_RENAMING_BASELINE.md`.

### 6.1 Top-level properties

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

### 6.2 Vnutorne properties objektov

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

### 6.3 Premenovania nazvov v $defs

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

### 6.4 Explicitne bez zmeny

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

### 6.5 Enum pravidlo

- Enum literal values sa v tejto iteracii nemenia, pokial nie su explicitne uvedene v mapovani.