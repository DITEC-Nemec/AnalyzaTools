/**
 * Schema Conversion & Validation Test Suite
 * Verifies round-trip conversion: legacy → unified → legacy
 * 
 * Run with: npx ts-node src/utils/__test__/schema.test.ts
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import {
  convertLegacyDomainToUnified,
  convertUnifiedToLegacyDomain,
  isLegacyDomainFormat,
  toUnified,
} from "../schemaMigration";
import { validateUnifiedModel, formatValidationErrors } from "../schemaValidator";

// ============================================================================
// TEST UTILITIES
// ============================================================================

function loadYaml(filePath: string): any {
  const content = fs.readFileSync(filePath, "utf-8");
  return yaml.load(content);
}

function saveYaml(filePath: string, data: any): void {
  const content = yaml.dump(data, {
    indent: 2,
    lineWidth: 120,
    noRefs: false,
  });
  fs.writeFileSync(filePath, content, "utf-8");
}

function testRoundTrip(legacyModel: any, testName: string): void {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`TEST: ${testName}`);
  console.log(`${"=".repeat(80)}`);

  // Step 1: Verify it's legacy format
  console.log(`\n1. Format detection...`);
  const isLegacy = isLegacyDomainFormat(legacyModel);
  console.log(`   ✓ Detected as legacy domain format: ${isLegacy}`);

  if (!isLegacy) {
    console.error(`   ✗ NOT recognized as legacy format!`);
    return;
  }

  // Step 2: Convert to unified
  console.log(`\n2. Converting legacy → unified...`);
  const unified = convertLegacyDomainToUnified(legacyModel);
  console.log(`   ✓ Conversion successful`);
  console.log(`     - meta.namespaceRefList: ${unified.meta?.namespaceRefList?.length || 0} entries`);
  console.log(`     - domain.entityList: ${unified.domain?.entityList?.length || 0}`);
  console.log(`     - domain.importList: ${JSON.stringify(unified.domain?.importList)}`);

  // Step 3: Validate unified schema
  console.log(`\n3. Validating unified schema...`);
  const validationResult = validateUnifiedModel(unified as any);
  if (validationResult.valid) {
    console.log(`   ✓ Schema is valid`);
  } else {
    console.error(`   ✗ Validation failed:`);
    console.error(formatValidationErrors(validationResult));
  }

  // Step 4: Convert back to legacy
  console.log(`\n4. Converting unified → legacy...`);
  const backToLegacy = convertUnifiedToLegacyDomain(unified as any);
  console.log(`   ✓ Conversion successful`);

  // Step 5: Compare structures
  console.log(`\n5. Comparing original vs round-trip...`);
  const originalEntities = legacyModel.entities?.length || 0;
  const roundTripEntities = backToLegacy.entities?.length || 0;
  console.log(`     - Original entities: ${originalEntities}`);
  console.log(`     - After round-trip: ${roundTripEntities}`);
  console.log(`     - Match: ${originalEntities === roundTripEntities ? "✓" : "✗"}`);

  const originalSimpleTypes = legacyModel.simpleTypes?.length || 0;
  const roundTripSimpleTypes = backToLegacy.simpleTypes?.length || 0;
  console.log(`     - Original simpleTypes: ${originalSimpleTypes}`);
  console.log(`     - After round-trip: ${roundTripSimpleTypes}`);
  console.log(`     - Match: ${originalSimpleTypes === roundTripSimpleTypes ? "✓" : "✗"}`);

  const originalRelationships = legacyModel.relationships?.length || 0;
  const roundTripRelationships = backToLegacy.relationships?.length || 0;
  console.log(`     - Original relationships: ${originalRelationships}`);
  console.log(`     - After round-trip: ${roundTripRelationships}`);
  console.log(`     - Match: ${originalRelationships === roundTripRelationships ? "✓" : "✗"}`);

  console.log(`\n✅ Test completed successfully!`);
}

// ============================================================================
// RUN TESTS
// ============================================================================

async function runTests() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`SCHEMA MIGRATION TEST SUITE`);
  console.log(`${"=".repeat(80)}`);

  try {
    // Test 1: Load and convert real example file
    console.log(`\nLoading example files...`);
    const externePath = path.join(__dirname, "../../..", "Example/Catalogs/Externe.model.yaml");

    if (!fs.existsSync(externePath)) {
      console.warn(`⚠️  Example file not found: ${externePath}`);
      console.log(`Please run tests from project root with example files present.`);
      process.exit(1);
    }

    const externeModel = loadYaml(externePath);
    testRoundTrip(externeModel, "Externe.model.yaml Round-Trip Conversion");

    // Test 2: Simple synthetic test
    console.log(`\n\n`);
    const syntheticModel = {
      domain: {
        name: "TestDomain",
        version: "1.0.0",
      },
      entities: [
        {
          name: "TestEntity",
          attributes: [
            {
              namedType: {
                name: "id",
                type: "definition",
                definition: {
                  restriction: {
                    base: "integer",
                  },
                },
              },
            },
          ],
        },
      ],
      namespaceRef: [
        {
          alias: "local",
          filePath: "test.model.yaml",
          sourceType: "current",
        },
      ],
    };

    testRoundTrip(syntheticModel, "Synthetic Model Round-Trip Conversion");

    console.log(`\n${"=".repeat(80)}`);
    console.log(`ALL TESTS COMPLETED ✅`);
    console.log(`${"=".repeat(80)}\n`);
  } catch (error) {
    console.error(`\n❌ Test failed with error:`);
    console.error(error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runTests();
}

export { testRoundTrip };
