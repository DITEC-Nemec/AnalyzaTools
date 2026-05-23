# Analýza Modelu z pohľadu Analytika a UI

## YAML Schema – Unified Format

Všetky YAML súbory v tomto projekte používajú **unified schema format**.  
**Nové súbory sa VŽDY vytvárajú v unified formáte.** Legacy formát je podporovaný len na čítanie (fallback v editore).

### Štruktúra unified domain model (`*.model.yaml`)

```yaml
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
algorithm:
  definitions:
    - name: AlgorithmName
      version: "1.0"
      imports: [local, DomainModel]      # Selektívny import
      actors: [...]
      behavior: { description, preconditions, postconditions }
      steps: [...]
```

### Štruktúra global meta katalogu (`_global.meta.yaml`)

```yaml
meta:
   metadata: { name }
   namespaceRef:
      - alias: SomeNamespace
         filePath: Catalogs/SomeNamespace.model.yaml
         sourceType: model
      - alias: SomeAlgorithm
         filePath: Algoritm/SomeAlgorithm.sqd.yaml
         sourceType: sqd
```

### Pravidlá
- `namespaceRef` je centralizovaný v `_global.meta.yaml`
- `local` je implicitný alias, nemusí byť uvedený v `_global.meta.yaml`
- `domain.imports` / `algorithm.definitions[].imports` smú referencovať len aliasy z `_global.meta.yaml` + `local`
- `entityRef.namespaceAlias` v relationships musí byť alias definovaný v `_global.meta.yaml` alebo `local`
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
- Entities / Attributes / Functions / Relationships / SimpleTypes sú pokryté.
- Business rules sú dostupné v dictionary vrstve.
- Aggregate root je modelovaný cez `agregationStatus`.
- Eventy, aktéri, audit a bezpečnostné poznámky sa dajú vyjadriť cez behavior prvky.
- Namespace importy sú centralizované cez `_global.meta.yaml`.

#### ❌ ČO EŠTE CHÝBA (ANALYTICKY):

**A) State Transition Semantika a validácia (MEDIUM)**
- Transition model existuje, ale chýba konzistentná validačná a editorová vrstva nad prechodmi.
- Potrebné je explicitne kontrolovať podmienky prechodu, trigger, konflikty priorít a konzistenciu medzi stavmi.

**B) Jednoznačné hranice agregátov (LOW)**
- Vzťahy existujú, ale pre architektonický návrh chýba explicitné odlíšenie association/aggregation/composition.
- Potrebné pre presné mapovanie na doménové boundary a ownership dát.

---

### 1.2 Algorithm (SQD) - Úroveň Procedúry

#### ✅ AKO JE TERAZ:
- Steps, branches, conditions a operation referencie sú pokryté.
- Rationale, error handling, retry a compensation sú vyjadriteľné cez behavior/errorEvents.
- Affected entities a actor väzby sú dostupné pre use-case mapovanie.

#### ❌ ČO EŠTE CHÝBA (ANALYTICKY):

**A) Wait Event Timeout Policy (MEDIUM)**
- Je potrebná silnejšia štruktúra a validačné pravidlá timeout scenárov.
- Cieľ je odstrániť voľné texty pri kritických rozhodnutiach v behu algoritmu.

**B) Performance SLA (LOW)**
- Chýba jednotný spôsob evidencie očakávaného času behu algoritmu/kroku.
- Potrebné pre NFR a sizing architektúry.

**C) Parallel Flow Semantika (LOW)**
- Chýba explicitný parallel krok so semantikou synchronizačného bodu.
- Potrebné pre návrh škálovania a orchestrácie.

**D) Data Lineage (LOW)**
- Chýba konzistentný zápis transformácie dát medzi krokmi.
- Dôležité pre auditovateľnosť, dopadové analýzy a troubleshooting.

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

Aktualizovaný zoznam obsahuje iba otvorené položky. Už implementované položky sú v samostatnom bloku nižšie.

**A) DOMAIN MODEL - otvorené položky**

1. **State Transition Validation & UX**
   - Model prechodu existuje, treba doplniť pravidlá editácie a validácie prechodov
   - Rozšíriť detail stavov/prechodov o explicitné transition constraints a kontroly konzistencie
   - Status: ❌ PRIORITY: MEDIUM

2. **Relationship Semantics Typing**
   - Spresniť vzťahové typy pre doménové hranice (association/aggregation/composition)
   - Umožniť lepší export do architektonického návrhu modulov
   - Status: ❌ PRIORITY: LOW

---

**B) ALGORITHM EDITOR - otvorené položky**

1. **Wait Event Timeout Strategy**
   - Štruktúrovaný timeout model (akcia, fallback step, retry pravidlo)
   - Doplniť validačné pravidlá, nie iba voľný text
   - Status: ❌ PRIORITY: MEDIUM

2. **Performance SLA**
   - Pri algoritme: SLA popis, voliteľne očakávané trvanie na úrovni kroku
   - Vhodné pre NFR a architektonické návrhy
   - Status: ❌ PRIORITY: LOW

3. **Parallel Execution Step Type**
   - Nový typ kroku `parallel` s podkrokmi
   - Nutná jasná semantika join/sync bodu
   - Status: ❌ PRIORITY: LOW

4. **Data Lineage / Transformation Notes**
   - Pri step: poznámky k transformácii dát a pôvodu
   - Pomáha pri analytike dopadov a auditovateľnosti
   - Status: ❌ PRIORITY: LOW

**C) Už implementované (pre referenciu)**

1. Business Rules Tab (Domain) ✅
2. Entity Type Selector (Domain) ✅
3. Aggregate Root cez `agregationStatus` (Domain) ✅
4. Step Rationale / Comment (Algorithm) ✅
5. Error Handler per Operation (Algorithm) ✅
6. Data Output Assignment (Algorithm) ✅
7. Retry Configuration cez behavior.errorEvents (Algorithm) ✅
8. Emitted Events vo funkcii cez behavior/errorEvents (Domain/Function) ✅
9. Audit/Security cez behavior poznámky a pravidlá (Domain/Function) ✅
10. Actors na úrovni funkcií cez behavior.actors ✅
11. Compensation Step cez behavior.errorEvents (Algorithm) ✅

---

### 2.3 Existing UI Issues (Potrebné Opravy)

1. ✅ **DONE** - Multiline preconditions/postconditions v funkcii (DOMAIN)
2. ✅ **DONE** - Multiline preconditions/postconditions v algoritme
3. ✅ **DONE** - Add Behavior button premmiestnený do action buttons
4. ✅ **DONE** - Actors tab v doméne vrátane mapovania na funkcie cez behavior
5. ✅ **DONE** - ActorRefsEditor styling (zjednotený so zvyškom formu)
6. ⚠️ **PARTIAL** - Wait Event timeout má UI polia, ale chýba tvrdšia validačná logika

---

## 3. Prioritizácia Implementácie

### PHASE 1 (MEDIUM PRIORITY - Kľúčové otvorené položky)
1. State Transition validation a UX (Domain)
2. Wait Event timeout stratégia + validačné pravidlá (Algorithm)

### PHASE 2 (LOW PRIORITY - Rozšírenie modelu a UI)
1. Relationship Semantics Typing (Domain)
2. Performance SLA (Algorithm)
3. Parallel Execution (Algorithm)
4. Data Lineage (Algorithm)

### PHASE 3 (VOLITEĽNÉ - Stabilizácia a export)
1. Konsolidácia validačných pravidiel pre nové polia
2. Export-ready štruktúra pre architektonické návrhy (reporting/view model)

---

## 4. Súhrn - Klíčové Chýbajúce Koncepty

### Z pohľadu ANALYTIKA:
- State transitions s explicitnými pravidlami prechodu a validáciou konzistencie
- Wait-event timeout policy s jednoznačnou semantikou
- Presnejšie hranice agregátov cez typizované vzťahy
- Konzistentné mapovanie dátových transformácií (lineage)

### Z pohľadu UI:
- Editácia a validácia pravidiel prechodu stavov
- Validované timeout scenáre pre wait-event
- Podpora pre paralelný krok so synchronizačným bodom
- Evidencia SLA a dátovej línie na úrovni kroku

### Z pohľadu MODELU:
- `StateTransition` s podmienkami, triggerom, prioritou a validačnými pravidlami
- `WaitEventPolicy` (timeout, fallback, retry)
- Typizácia `Relationship` pre doménové boundary
- `PerformanceSLA` pre algoritmus/krok
- `DataLineage` pre sledovanie transformácií

