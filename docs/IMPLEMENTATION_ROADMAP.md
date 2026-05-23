# Unified Schema Implementation Roadmap

## Phase 0: Review & Sign-off (Current)
**Goal:** Validate schema design before making any breaking changes.

- [x] Proposed unified schema created: `unified.schema.json.proposed`
- [ ] Review namespace imports concept
- [ ] Review domain.imports structure
- [ ] Review algorithm.imports structure
- [ ] Confirm no breaking changes to existing file structure
- [ ] Decide on meta.namespaceRef governance

**Output:** Signed-off schema design

---

## Phase 1: Create Parallel Infrastructure (Non-breaking)
**Goal:** Set up new schema without touching existing files.

### Step 1.1: Create new unified schema file
- Copy `unified.schema.json.proposed` → `model.schema.json.unified`
- Add this to source control
- **No editor code changes yet**
- **Existing files unchanged**: `model.schema.json`, `sqd.schema.json` still active

### Step 1.2: Create TypeScript types from unified schema
```
src/types/
  ├── unified-schema.ts (generated from unified.schema.json.unified)
  └── legacy-schema.ts (existing types)
```
- Use `json-schema-to-typescript` or similar
- Keep both in parallel
- No runtime changes

### Step 1.3: Create data mapper/converter
```
src/utils/
  └── schemaMigration.ts
    - convertLegacyToUnified()
    - convertUnifiedToLegacy() (for compatibility)
    - validateNamespaceImports()
```

### Step 1.4: Create validation utilities
```
src/utils/
  └── schemaValidator.ts
    - validateImportsExist() // Check all imports in meta.namespaceRef
    - validateNamespaceReferences() // Check entityRef/actorRef use valid aliases
    - reportMissingNamespaces() // Helpful error messages
```

**Status Check:** Everything parallel, no breaking changes. Editors still work unchanged.

---

## Phase 2: Update Domain Editor (Controlled Migration)
**Goal:** Add support for imports, test with new schema.

### Step 2.1: Add imports panel to DomainModelEditor
```tsx
// webview-ui/src/domainModel/DomainModelEditor.tsx
<ImportsPanel 
  imports={model.domain.imports}
  availableNamespaces={model.meta.namespaceRef}
  onChange={(imports) => updateImports(imports)}
/>
```
- Display list of available namespaces (read from meta)
- Allow add/remove imports
- Show validation errors if namespace not in meta

### Step 2.2: Update entity reference selector
- When selecting entityRef, only show entities from imported namespaces
- Add visual indicator: "entity (alias)"

### Step 2.3: Create test data
```
Example/Models/
  └── unified-model.yaml  (new test file)
    - Has meta.namespaceRef
    - Has domain.imports: ["local", "SOSM"]
    - Has entities with cross-namespace references
```

### Step 2.4: Test with parallel loading
```
extensionSettings:
  schemaVersion: "legacy" | "unified"  // User choice in settings
```
- Users can opt-in to test unified schema
- Domain editor loads from meta.namespaceRef instead of root.namespaceRef
- All existing functionality should work

**Status Check:** Domain editor works with both schemas. Users can toggle.

---

## Phase 3: Update Algorithm Editor (Controlled Migration)
**Goal:** Add imports to algorithm module.

### Step 3.1: Add imports panel to AlgorithmEditor
```tsx
<ImportsPanel 
  imports={algorithm.imports}
  availableNamespaces={model.meta.namespaceRef}
  onChange={(imports) => updateImports(imports)}
/>
```

### Step 3.2: Update entity/actor reference selectors
- Only show items from imported namespaces
- Help users understand dependencies

### Step 3.3: Create test algorithms
```
Example/Algorithm/
  └── unified-algorithm.sqd.yaml
    - Has imports: ["local", "SOSM"]
    - References entities/actors with namespace aliases
```

**Status Check:** Algorithm editor works with both schemas.

---

## Phase 4: Create Migration Script
**Goal:** Prepare one-way migration for production data.

### Step 4.1: Build migrator
```
src/utils/migrator.ts
- Converts old model.yaml → new unified format
- Generates meta.namespaceRef from old root.namespaceRef
- Preserves all data
- Creates audit log of changes
```

### Step 4.2: Test on example files
```
Example/Models/
  - Load existing YAML files
  - Run migrator
  - Compare old vs new structure
  - Validate schema compliance
```

### Step 4.3: Create rollback plan
- Keep backup of old files
- Document reversal steps
- Test restore process

---

## Phase 5: Full Cutover (Breaking change - controlled)
**Goal:** Switch to unified schema in production.

### Step 5.1: Update default schema
```
// In extension settings
- Change default schema from "legacy" to "unified"
- Show banner: "Schema has been updated. Old files still supported in compatibility mode."
```

### Step 5.2: Batch migrate existing files
- Run migrator on all *.model.yaml files
- Run migrator on all *.sqd.yaml files
- Commit migrated files to git
- Create PR for review before merging

### Step 5.3: Update documentation
- Explain new meta module
- Document imports concept
- Show examples of namespace isolation

---

## Phase 6: Cleanup (After stabilization)
**Goal:** Remove legacy code once unified is stable.

### Step 6.1: Mark legacy as deprecated
- Keep legacy schema file for reference only
- Remove legacy types from active code
- Update all imports

### Step 6.2: Remove dual-loading code
- Remove `schemaVersion` setting
- Remove legacy converter functions
- Simplify editor code

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Schema incompatibility discovered | Stay in Phase 1/2, iterate on schema before cutover |
| Existing data loss during migration | Backup all files, test migrator on copies first, use git for rollback |
| Editor bugs with new format | Parallel loading allows users to switch back, fixes don't block other work |
| Large namespace lists impact performance | Implement lazy-loading in ImportsPanel, cache namespace list |
| Breaking changes to ecosystem | Phases 1-3 are 100% non-breaking, cutover can be user-initiated |

---

## Timeline Estimate

| Phase | Duration | Breaking? | Reversible? |
|-------|----------|-----------|------------|
| Phase 0 (Review) | 1-2 days | No | N/A |
| Phase 1 (Infrastructure) | 2-3 days | No | Yes |
| Phase 2 (Domain Editor) | 3-4 days | No | Yes |
| Phase 3 (Algorithm Editor) | 2-3 days | No | Yes |
| Phase 4 (Migrator) | 2 days | No | Yes |
| Phase 5 (Cutover) | 1 day | **YES** | Yes (with git rollback) |
| Phase 6 (Cleanup) | 1 day | No | N/A |
| **Total** | **11-14 days** | | |

---

## Success Criteria

- ✅ All existing files still loadable and editable (Phase 3)
- ✅ New unified schema fully validates in editors (Phase 3)
- ✅ Namespace imports reduce file size for large models (Phase 4)
- ✅ Zero data loss during migration (Phase 4)
- ✅ Users can opt-in/opt-out of schema version (Phase 2-3)
- ✅ All tests pass with both schema versions (Phase 3)
