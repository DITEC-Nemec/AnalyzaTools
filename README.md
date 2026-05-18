CELKOVÝ OBRAZ PLUGINU
Plugin pridá do VS Code novú „analytickú pracovnú plochu“, nie len editor súborov.
Hlavné časti:

SQD Explorer (ľavý sidebar)
Domain Model Editor (vizuálny + formulárový)
Algorithm Editor (naratív + štruktúra + tok)
Problems / Insights panel (validácie + AI feedback)


1️⃣ SQD Explorer (ľavý sidebar)
📍 Umiestnenie: Activity Bar → nový ikonový modul „SQD“
📂 Tree View štruktúra:
Plain Text📘 SQD Workspace ├─ 🧩 Domain Model │   └─ domain.model.yaml ├─ 🔁 Algorithms │   ├─ Prenos_vysledkov.sqd.yaml │   ├─ Rozdelenie_do_skol.sqd.yaml │   └─ Student_first.sqd.yaml ├─ 📚 Catalogues │   ├─ operations.catalog.yaml │   └─ events.catalog.yamlShow more lines
Interakcie:

klik → otvorí custom editor, nie plain text
pravé kliknutie:

New Algorithm
New Entity
Import from XML
Export to XML



✅ Toto je úplne v súlade s Tree View UX vo VS Code. [deepwiki.com]

2️⃣ Domain Model Editor (entity & vzťahy)
📍 Otvára sa ako Custom Editor (Editor Area)
Layout (3-panely)
🟦 Panel A: Entity List (ľavý)

zoznam entít
vyhľadávanie
indikácia chýb (⚠️ nevyužitá entita, ❌ neplatný atribút)

Plain TextEntities---------▶ Spracovanie▶ Priradenie▶ Študent▶ ŠkolaShow more lines

🟨 Panel B: Entity Detail (stred)
Formulárový editor, nie tabuľka DB stĺpcov.
Príklad: Entita „Spracovanie“
Name: Spracovanie
Description:
[ Reprezentuje jedno ucelené spracovanie prihlášok … ]

Attributes:
------------------------------------------------
+ DatumZaciatkuVypoctu   (DateTime)   [not null]
+ DatumUkonceniaVypoctu  (DateTime)   [nullable]
+ NavratovyKod           (Code)
    Allowed values:
    - 00 Spracované bez chýb
    - 11 Neexistujú dáta
    - 99 Neočakávaná chyba

✍️ Analytik:

píše význam, nie techniku
„type“ je len nápoveda, nie SQL/C#


🟩 Panel C: Relationship View (pravý)
Jednoduchá vizuálna mapa vzťahov (read‑heavy, edit‑light):
Spracovanie  ── contains ──▶  Priradenie
                     ▲
                     │
                 belongs to
                     │
                   Škola


drag & drop na vytvorenie vzťahu
krátky opis „čo tento vzťah znamená“

💡 Nemusí to byť UML – skôr konceptuálna mapa
(inšpirácia UX z diagram editorov vo VS Code.) [eclipsesource.com]

3️⃣ Algorithm Editor (jadro celého riešenia)
📍 Custom Editor pre *.sqd.yaml
Tento editor je kľúčový.
3.1 Základný layout (split view)
┌───────────────────────────┬─────────────────────────┐
│  NARRATIVE STEPS          │  FLOW VIEW              │
│  (ľavý panel)             │  (pravý panel)          │
└───────────────────────────┴─────────────────────────┘


🗨️ A) Narrative Steps (ľavý panel – HLAVNÝ)
Tu analytik píše voľný jazyk.
Každý krok je „karta“
[2.2]  Decision
-------------------------------------------
Ak spracovanie neexistuje, systém ukončí
spracovanie s chybovou informáciou.
-------------------------------------------
Condition:
Entity: Spracovanie
Check: exists (negated)

Branches:
✅ true  → návratová chyba
➡ false → pokračuj

Prečo je to dobré:

text je dominantný
štruktúra je len kotva
analytik necíti, že „kóduje“

💡 Editor aktívne pomáha:

ak začne vetu „Ak …“ → navrhne Decision
„Pre každé …“ → Foreach
„Spracovanie sa ukončí“ → Return / Event


🔄 B) Flow View (pravý panel – mentálny model)
Automaticky generovaný flow diagram:
[ Start ]
   |
[ Zisti spracovanie ]
   |
[ Exists? ]──no──▶[ sosm-11 ]
   |
  yes
   |
[ Pokračuj ]


drag & drop len jemné (nepovinné)
slúži na overenie toku, nie na tvorbu
klik na uzol → focus v Narrative paneli

✅ V súlade s „diagram‑as‑secondary‑view“ princípom. [devpost.com]

3.2 Condition editor (bez programovania)
Namiesto písania výrazov:
❌ Spracovanie.DatumUkonceniaVypoctu != null
✅ Formulár:
Testovaná entita:  Spracovanie
Atribút:           DatumUkonceniaVypoctu
Podmienka:         je prázdny

Text ostáva:

„Ak výpočet ešte nebol ukončený…“


4️⃣ Problems / Insights Panel (AI + validácie)
📍 VS Code Problems panel
Typy hlásení:

❌ syntaktické (neplatná schéma)
⚠️ logické:

vetva bez návratu
cyklus bez zmeny riadiacej podmienky
používaný atribút, ktorý neexistuje v domain modeli


💡 AI insight:

„Táto vetva má rovnaký efekt ako vetva X“
„Tento návratový kód nikdy nenastane“



➡️ Toto je priamy základ pre AI‑assisted analýzu, ale nezasahuje do UX písania.

5️⃣ Import / Export UX
Import XML

Command Palette: SQD: Import legacy XML
sprievodca:

nájdené kroky
mapovanie na typy (step / decision / loop)
náhľad výsledného SQD modelu



Export XML

pravým klikom na algoritmus
deterministic export
zachované sq:id, texty, poradie


6️⃣ Prečo je toto UX silné (zhrnutie)
✅ analytik:

píše prirodzene
vidí tok
rozumie doméne

✅ programátor:

má jednoznačný algoritmus
jasné vetvy
nulová interpretácia

✅ AI:

má AST + doménu
vie analyzovať postupnosti
vie generovať otázky, testy, skeletony

✅ legacy:

nič sa neláme
XML prežije


Ak chceš ísť ešte hlbšie:
Môžem ďalšie:

🔹 nakresliť konkrétny wireframe (ASCII / krokový) pre jeden editor
🔹 navrhnúť AI otázky a výstupy, ktoré z tohto modelu dostanete
🔹 ukázať ako z tohto UX vznikne C# skeleton

Stačí povedať, ktorým smerom pokračujeme.
SourcesProvide your feedback on BizChatYou said: nakresliť konkrétny wireframe (ASCII / krokový) pre jeden editorCopilot said: CopilotSuper, poďme na to konkrétne a „nakreslene“.
Nižšie máš ASCII wireframe pre JEDEN editor – Algorithm Editor (*.sqd.yaml), presne v duchu toho, čo sme navrhli: voľný jazyk + jemná štruktúra + čitateľný tok.
Budem postupovať takto:

celkový layout v editore
detail Narrative panelu (hlavný pre analytika)
detail Flow panelu (mentálny model toku)
detail Condition editoru (bez programovania)
krátky „user flow“ – ako by analytik reálne pracoval


1️⃣ CELKOVÝ LAYOUT – Algorithm Editor
┌─────────────────────────────────────────────────────────────────────────┐
│ Prenos_vysledkov.sqd.yaml     |  SQD Algorithm Editor                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│ ┌───────────────────────────────┬─────────────────────────────────────┐ │
│ │ 🗨️ NARRATIVE STEPS             │ 🔄 FLOW VIEW                         │ │
│ │ (voľný text + štruktúra)      │ (automatický diagram)                │ │
│ │                               │                                     │ │
│ │                               │                                     │ │
│ └───────────────────────────────┴─────────────────────────────────────┘ │
│                                                                           │
├─────────────────────────────────────────────────────────────────────────┤
│ Status: ✔ Valid  |  ⚠ 1 warning  |  AI insight available                 │
└─────────────────────────────────────────────────────────────────────────┘

✅ Zodpovedá Custom Editor vzoru vo VS Code
✅ Text vľavo = pravda pre analytika
✅ Diagram vpravo = mentálna kontrola toku

2️⃣ NARRATIVE STEPS – hlavný panel (ľavý)
Tu analytik prirodzene píše, štruktúra je len opora.
┌───────────────────────────────────────────────────────────┐
│ Steps                                                     │
│───────────────────────────────────────────────────────────│
│ ➕ Add step   ➕ Decision   ➕ Loop   ➕ Foreach            │
│───────────────────────────────────────────────────────────│
│                                                           │
│ [2.1] Operation                                          │
│ ─────────────────────────────────────────────────────── │
│ Text:                                                    │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Systém zistí, či existuje spracovanie prihlášok       │ │
│ │ pre zadané vstupné parametre.                          │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ Operation:  SOSM_Spracovanie_VratSpracovanie              │
│ Outputs:    Spracovanie                                  │
│                                                          │
│──────────────────────────────────────────────────────────│
│                                                           │
│ [2.2] Decision                                           │
│ ─────────────────────────────────────────────────────── │
│ Text:                                                    │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Ak spracovanie neexistuje, systém ukončí spracovanie  │ │
│ │ s chybovou informáciou.                                │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ Condition summary:                                       │
│   ✱ Spracovanie  exists  = FALSE                         │
│   [ Edit condition… ]                                    │
│                                                          │
│ Branch TRUE (neexistuje):                                │
│   - Event: sosm-11 Neexistujú dáta na prenos              │
│   - Return                                               │
│                                                          │
│ Branch FALSE (existuje):                                 │
│   - Step: Pokračuj v spracovaní                          │
│                                                          │
│──────────────────────────────────────────────────────────│
│                                                           │
│ [2.3] Step                                               │
│ ─────────────────────────────────────────────────────── │
│ Text:                                                    │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Pokračuj v ďalšej kontrole stavu spracovania.         │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
└───────────────────────────────────────────────────────────┘

cislovanie krokov bude automaticke a bude respektovat aj uroven vnorenia


Prečo je to silné UX

text je dominantný
analytik vždy vidí „čo sa deje“
technická štruktúra je skrytá za summary („exists = FALSE“)


3️⃣ FLOW VIEW – mentálny model (pravý panel)
Diagram sa nepíše, ale generuje.
┌───────────────────────────────────────────────┐
│ Flow                                          │
│───────────────────────────────────────────────│
│                                               │
│        ┌──────────────┐                       │
│        │   START      │                       │
│        └──────┬───────┘                       │
│               │                               │
│   ┌───────────▼───────────┐                  │
│   │ Zisti spracovanie     │                  │
│   └───────────┬───────────┘                  │
│               │                               │
│        ┌──────▼───────┐                       │
│        │ Exists ?     │                       │
│        └───┬─────┬───┘                       │
│           NO     YES                           │
│           │       │                           │
│ ┌─────────▼───┐   │                           │
│ │ sosm-11     │   │                           │
│ │ návrat      │   │                           │
│ └─────────────┘   │                           │
│                   │                           │
│         ┌─────────▼─────────┐                 │
│         │ Pokračuj           │                 │
│         └───────────────────┘                 │
│                                               │
└───────────────────────────────────────────────┘

Interakcie

klik na blok → zvýrazní krok v Narrative paneli
⚠️ zvýraznené hrany, kde chýba návrat
🟦 farby: step / decision / event / return


4️⃣ CONDITION EDITOR – detail (bez programovania)
Otvára sa po kliknutí na [ Edit condition… ]
┌───────────────────────────────────────────┐
│ Edit condition                            │
│───────────────────────────────────────────│
│                                           │
│ Testovaná entita:   [ Spracovanie ▼ ]     │
│ Atribút:            [ — none — ]           │
│                                           │
│ Kontrola:           [ exists ▼ ]           │
│                                           │
│ Význam:                                     
│   „Spracovanie musí existovať.“            │
│                                           │
│ [ ] Negovať podmienku                     │
│                                           │
│ Výsledok čítateľný pre človeka:            │
│   „Ak spracovanie neexistuje…“             │
│                                           │
│        [ Cancel ]      [ Save ]            │
│                                           │
└───────────────────────────────────────────┘

✅ analytik nikdy nevidí != null
✅ AI dostane presnú štruktúru
✅ text zostáva prirodzený

5️⃣ Typický USER FLOW analytika (krokový)
Scenár: „chcem pridať kontrolu, či už prebieha prenos“

Klikne ➕ Decision
Napíše text:

„Ak už prenos dát pre spracovanie prebieha, systém spracovanie ukončí.“


Editor automaticky:

nastaví type = decision
otvorí Condition Editor


Vyberie:

Entita: Spracovanie
Atribút: DatumZaciatkuPrenosu
Kontrola: is not null


V Branch TRUE vyberie:

Event: sosm-12
Return


Hotovo:

✅ Flow sa aktualizuje
✅ Validácia OK
✅ AI vie: „táto vetva končí“


6️⃣ UX v editore (veľmi dôležité)
V Algorithm Editore:

pole Entity → dropdown z domain modelu
pole Function → dropdown funkcií tej entity
parametre → formulár podľa inputs

Náhľad (ASCII):
Operation
---------
Entity:     Spracovanie ▼
Function:   UkonciSpracovanie ▼

Arguments:
- NavratovyKod   [ "11" ]
- NavratovyText  [ Neexistujú dáta na prenos ]

Effects:
✔ writes NavratovyKod
✔ writes NavratovyText



Analytik nikdy nemal pocit, že programuje.

6️⃣ Prečo tento wireframe funguje pre tvoje ciele

✅ voľný jazyk je primárny artefakt
✅ štruktúra je asistovaná, nie vnucovaná
✅ jasne oddelené: čo vs ako
✅ ideálne pre:

AI analýzu postupností
kontrolu úplnosti vetiev
generovanie testov / C# skeletonov


✅ zodpovedá VS Code UX vzorom (Custom Editor, Tree View, Flow secondary view)


Ak chceš, ďalší krok viem spraviť ešte konkrétnejší:

🔹 ASCII wireframe Domain Model Editora
🔹 Error/Warning prípady v UX (čo keď niečo chýba)
🔹 C# skeleton preview panel
🔹 AI „Ask questions about this algorithm“ panel

Stačí povedať, kam pokračujeme.
Provide your feedback on BizChatYou said: 