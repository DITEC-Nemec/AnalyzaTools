# Analýza Modelu z pohľadu Analytika a UI

## YAML Schema – Unified Format

Všetky YAML súbory v tomto projekte používajú **unified schema format**.  
**Nové súbory sa VŽDY vytvárajú v unified formáte.** Legacy formát je podporovaný len na čítanie (fallback v editore).

### Štruktúra unified domain model (`*.model.yaml`)

```yaml
meta:
  namespaceRef:                          # Katalóg namespace referencií
    - alias: local
      filePath: path/to/this-file.model.yaml
      sourceType: current                # vždy pre local
    - alias: SomeNamespace
      filePath: path/to/other.model.yaml
      sourceType: model

domain:
  metadata: { name, description, version, status }
  imports: [local, SomeNamespace]        # Selektívny import
  entities: [...]
  simpleTypes: [...]
  relationships: [...]
  eventGlossary: [...]

dictionary:
  glossary: [...]
  businessRules: [...]
  actors: [...]
```

### Štruktúra unified algorithm model (`*.sqd.yaml`)

```yaml
meta:
  namespaceRef:
    - alias: local
      filePath: path/to/this-file.sqd.yaml
      sourceType: current
    - alias: DomainModel
      filePath: path/to/model.model.yaml
      sourceType: model

algorithm:
  definitions:
    - name: AlgorithmName
      version: "1.0"
      imports: [local, DomainModel]      # Selektívny import
      actors: [...]
      behavior: { description, preconditions, postconditions }
      steps: [...]
```

### Pravidlá
- `meta.namespaceRef` musí obsahovať `alias: local` s `sourceType: current`
- `domain.imports` / `algorithm.definitions[].imports` smú referencovať len aliasy z `meta.namespaceRef`
- `entityRef.namespaceAlias` v relationships musí byť alias definovaný v `meta.namespaceRef`
- Každý `step` musí mať `id` a platný `type`; `decision` vyžaduje `condition` + `branches`; `operation` vyžaduje `operation` pole

### Nástroje

```bash
npm run migrate           # Jednorazová konverzia legacy → unified (vytvorí .backup)
npm run validate:examples # Validácia všetkých Example/**/*.yaml (volaj pred commitom)
npm run build             # Build VS Code extension
npm run build:webview     # Build React webview UI
```

### CI

`npm run validate:examples` vracia exit code 1 pri chybách — zaraďte do CI pipeline pred každým merge.

---

## 1. ANALYTICKÁ PERSPEKTÍVA - Čo chýba v Modeli

### 1.1 Domain Model - Úroveň Domény

#### ✅ AKO JE TERAZ:
- **Entities** - Objekty/popis čo sa v doméne deje
- **Attributes** - Vlastnosti entít
- **Functions** - Operácie nad entitami  
- **SimpleTypes** - Definícia typov (enumy, restrictions)
- **Relationships** - Vzťahy medzi entitami
- **Glossary** - Pojmy a ich definitions
- **EventGlossary** - Udalosti a ich definitions
- **Actors** - Roly v doméne (user, system, external)
- **NamespaceRef** - Odkazy na iné modely

#### ❌ ČO CHÝBA Z ANALYTICKÉHO HĽADISKA:

**A) Domain Invariants / Business Rules**
- Globálne pravidlá ktoré musia byť vždy splnené
- Príklad: "Študent nemôže byť v dvoch triedach naraz"
- Príklad: "Suma počtov žiakov nesmie prekročiť kapacitu školy"
- **UI:** Nová tab "Business Rules" s listom pravidiel (code, description, severity)

**B) Aggregate Roots** 
- Ktoré entity sú agregačné korene
- Hlásenie konzistentnosti - ktoré entity sa menia spolu
- **UI:** Checkbox pri entite "Je agregačný koreň" + dokumentácia

**C) Value Objects vs Entities**
- Rozlíšenie medzi Value Object a Entity
- Value Objects nemajú identitu
- **UI:** Typ entity: Entity / Value Object / Enum

**D) Lifecycle / State Transitions**
- StateModel je len stavy, bez pravidiel prechodu
- Chýbajú podmienky prechodu medzi stavmi  
- Príklad: "Vypočet sa môže skončiť iba ak počet žiakov <= 0"
- **UI:** Stav -> Modal s preconditions/postconditions pre prechod

**E) Domain Events**
- Udalosti ktoré sa emitujú pri zmenách
- Prípad: "Keď sa žiak zaradí, emit ZiakZaradeny event"
- **UI:** Pri funkcii: "Emitted Events" - zoznam eventov

**F) Cross-cutting Concerns**
- Security/Authorization pravidlá na úrovni domény
- Audit trails - čo treba loggovať
- Prípad: "Všetky zmeny v rámci Vypočtu musia byť auditované"
- **UI:** Nová sekcia pri entite "Audit", "Security"

**G) Aggregate Boundaries**
- Explicitný popis ako sa agregáty vzájomne referencujú
- Nie je jasné či EntityRef znamená "agregát" alebo "iba referenciu"
- **UI:** Pri Relationship: "Type" - Association / Aggregation / Composition

---

### 1.2 Algorithm (SQD) - Úroveň Procedúry

#### ✅ AKO JE TERAZ:
- **Steps** - Jednotlivé kroky procedúry
- **Operations** - Referencie na funkcie alebo SQD
- **Conditions** - Podmienky (entityRef/variable/simple)
- **Branches** - Rozhodnutia (decision, loop, foreach)
- **Behavior** - Preconditions, Postconditions, Affected Entities, Actors
- **Events** - Udalosti ktoré sa emitujú v kroku

#### ❌ ČO CHÝBA Z ANALYTICKÉHO HĽADISKA:

**A) Step Narrative / Human-Readable Description**
- Step.text je len čo sa deje
- Chýba PREČO sa to deje (rationale)
- Chýba KĽÚČOVÝ INFO (komentár analytika)
- **UI:** TextField pri step "Rationale / Why" (voliteľné)

**B) Wait Event Policy (PARTIAL)**
- Máme `waitEvent` s `eventRef`, `waitUntil` a `timeoutAction`
- Chýba štruktúrovaná politika timeout-u (enum + fallback step ref + retry policy)
- **UI:** Polia existujú, ale bez silnej validácie semantiky

**C) Error Handling / Exception Paths**
- Čo sa stane ak operácia zlyhá?
- Prípad: "Ak výpočet trvá >5min, timeout"
- **UI:** Pri operation/step: "Error Handler" - referencie na fallback steps

**D) Timing / Performance Requirements**
- Nesledujeme čas vykonania
- Prípad: "Tento výpočet musí skončiť do 30 sekúnd"
- **UI:** Pri algoritme/step: "Performance SLA" (description)

**E) Retry Logic**
- Nemáme popis ako sa retryuje
- Prípad: "Ak sieťová chyba, skúsiť 3x s exponential backoff"
- **UI:** Pri operation: "Retry Policy" (description)

**F) Parallel Execution Support**
- Algoritmus je lineárny, bez parallelizmu
- Prípad: "Tieto 3 výpočty sa dajú robiť paralelne"
- **UI:** Block / Parallel step type (spolu s do-all semantikou)

**G) Compensation / Rollback**
- Čo sa stane ak algoritmus zlyhá v strede
- Prípad: "Ak zlyhá step 5, kompenzuj step 2,3,4"
- **UI:** Pri step: "Compensation" - ref na krок na rollback

**H) Traceability / Audit Trail**
- Ktoré dáta (koľko) a aké transformácie sa uskutočnili
- **UI:** Pri step: "Data Lineage" (description)

---

## 2. UI PERSPEKTÍVA - Chýbajúce UI Komponenty a Features

### 2.1 Súčasný Stav UI

#### Domain Model Editor ✅
- Entities / Attributes / Functions / SimpleTypes / Relationships / Glossary / EventGlossary / Actors / NamespaceRef
- Detail editácia s textareas pre description
- Multiline pre preconditions/postconditions u funkcií

#### Algorithm Editor ✅  
- Steps s textem
- Behavior (description, preconditions, postconditions, actors, affected entities)
- Operations (entityFunction, sqd, step, event)
- Conditions (entityRef, variable, simple)
- Branches (decision, loop, foreach)
- Events + waitEvent

### 2.2 Chýbajúce UI Komponenty

**A) DOMAIN MODEL - Missing UI:**

1. **Business Rules Tab** 
   - Tabuľka s pravidlami (code, description, severity)
   - Detail: Pravidlo + jeho popis + severity (high/medium/low)
   - Status: ✅ DONE

2. **Entity Type Selector**
   - Momentálne: len Entity
   - Treba: Entity / Value Object / Enum dropdown pri detaili entity
   - Status: ✅ DONE

3. **Aggregate Root Checkbox**
   - Pri entity detail: "Aggregate Root?" (boolean)
   - Status: ✅ DONE — riešené cez pole `agregationStatus` (root / leaf / intermediate)

4. **State Transition Rules**
   - Stav -> Pravítka pre prechod (preconditions/postconditions)
   - U StateModel pribudnú detaily na prechod
   - Status: ❌ PRIORITY: MEDIUM

5. **Emitted Events v Funkcii**
   - Pri funkcii: "Emitted Events" - zoznam eventov ktoré funkcia emituje
   - Status: ❌ PRIORITY: LOW

6. **Audit/Security Settings**
   - Pri entite: sekcia "Audit" (Yes/No), "Security" (description)
   - Status: ❌ PRIORITY: LOW

---

**B) ALGORITHM EDITOR - Missing UI:**

1. **Step Rationale / Comment**
   - TextField pri step detaili "Why / Rationale"
   - Status: ✅ DONE

2. **Error Handler per Operation**
   - Pri operation detail: "On Error" - dropdown s fallback steps alebo skip
   - Status: ✅ DONE

3. **Performance SLA**
   - Pri algoritme behavior: "Performance SLA" textarea (description)
   - Pri step: "Expected Duration" field (optional)
   - Status: ❌ PRIORITY: LOW

4. **Retry Configuration**
   - Pri operation: "Retry Policy" (description: "retry N times with backoff")
   - Status: ❌ PRIORITY: LOW

5. **Compensation Step**
   - Pri step: "Compensation" - link na iný step na spustenie ak toto zlyhá
   - Status: ❌ PRIORITY: MEDIUM

6. **Data Output Assignment**
   - Pri Affected Entities: pri "write" impact -> "Assign to Variable" field
   - Status: ✅ DONE

7. **Parallel Execution Step Type**
   - Nový step type: "parallel" s možnosťou viacerých substeps
   - Status: ❌ PRIORITY: LOW

8. **Data Lineage / Transformation Notes**
   - Pri step: "Data Notes" textarea (čo sa s dátami deje)
   - Status: ❌ PRIORITY: LOW

---

### 2.3 Existing UI Issues (Potrebné Opravy)

1. ✅ **DONE** - Multiline preconditions/postconditions v funkcii (DOMAIN)
2. ✅ **DONE** - Multiline preconditions/postconditions v algoritme
3. ✅ **DONE** - Add Behavior button premmiestnený do action buttons
4. ⚠️ **PARTIAL** - Actors tab v doméne - OK ale chýba prispanie do funkcií
5. ✅ **DONE** - ActorRefsEditor styling (zjednotený so zvyškom formu)

---

## 3. Prioritizácia Implementácie

### PHASE 1 (HIGH PRIORITY - Analyticky potrebné): ✅ DONE
1. Step Rationale / Comment (Algorithm) ✅
2. Business Rules (Domain) ✅
3. Error Handler per Operation (Algorithm) ✅

### PHASE 2 (MEDIUM PRIORITY - Lepšia vyjadriteľnosť):
1. State Transition Rules (Domain)
4. Wait Event timeout stratégia (Algorithm)
5. Compensation Step (Algorithm)

### PHASE 3 (LOW PRIORITY - Nice to Have):
1. Performance SLA (Algorithm)
2. Retry Configuration (Algorithm)
3. Emitted Events (Domain)
4. Audit/Security Settings (Domain)
5. Parallel Execution (Algorithm)
6. Data Lineage (Algorithm)

---

## 4. Súhrn - Klíčové Chýbajúce Koncepty

### Z pohľadu ANALYTIKA:
- Business rules a constraints
- Domain events & aggregates
- State transitions s pravidlami
- Error handling & compensation
- Data flow & transformations

### Z pohľadu UI:
- Racionalizácia krokov
- Error recovery
- Output data assignment
- Business rules management
- Entity classification (aggregate/value object)

### Z pohľadu MODELU:
- BusinessRule interface
- StateTransition s conditions
- CompensationPath  
- PerformanceSLA
- DataLineage

