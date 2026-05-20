#!/usr/bin/env node

/**
 * Migration script: Converts legacy YAML files to unified schema format
 * 
 * Usage: npm run migrate
 * 
 * Finds all *.model.yaml and *.sqd.yaml files and converts legacy format to unified
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const EXTENSIONS = ['*.model.yaml', '*.sqd.yaml'];

interface ConversionResult {
  file: string;
  format: 'legacy' | 'unified' | 'unknown';
  converted: boolean;
  error?: string;
}

/**
 * Detect if content is legacy or unified format
 */
function detectFormat(parsed: any): 'legacy' | 'unified' | 'unknown' {
  if (!parsed || typeof parsed !== 'object') {
    return 'unknown';
  }

  // Unified format has meta/domain/algorithm/dictionary at root
  if (parsed.meta || (parsed.domain && 'imports' in parsed.domain) || parsed.algorithm?.definitions) {
    return 'unified';
  }

  // Legacy domain format: entities, relationships, simpleTypes at root
  if (parsed.entities || parsed.relationships || parsed.simpleTypes) {
    return 'legacy';
  }

  // Legacy sqd format: algorithm.name at root level, steps at root
  if (parsed.algorithm && parsed.steps && !parsed.algorithm.definitions) {
    return 'legacy';
  }

  return 'unknown';
}

/**
 * Convert legacy domain to unified
 */
function convertLegacyDomain(parsed: any): any {
  const unified: any = {
    meta: {
      namespaceRef: parsed.namespaceRef || [
        {
          alias: 'local',
          filePath: 'unknown.model.yaml',
          sourceType: 'current'
        }
      ]
    },
    domain: {
      metadata: {
        name: parsed.name,
        description: parsed.description,
        version: parsed.version,
        status: parsed.status
      },
      imports: ['local'],
      entities: parsed.entities || [],
      simpleTypes: parsed.simpleTypes || [],
      relationships: parsed.relationships || [],
      eventGlossary: parsed.eventGlossary || [],
      functions: parsed.functions,
      stateModel: parsed.stateModel
    },
    dictionary: {
      glossary: parsed.glossary || [],
      businessRules: parsed.businessRules || [],
      actors: parsed.actors || []
    }
  };

  // Clean undefined values
  Object.keys(unified.domain).forEach(key => {
    if (unified.domain[key] === undefined) {
      delete unified.domain[key];
    }
  });

  return unified;
}

/**
 * Convert legacy sqd to unified
 */
function convertLegacySqd(parsed: any): any {
  const unified: any = {
    meta: {
      namespaceRef: parsed.namespaceRef || [
        {
          alias: 'local',
          filePath: 'unknown.sqd.yaml',
          sourceType: 'current'
        }
      ]
    },
    algorithm: {
      definitions: [
        {
          name: parsed.algorithm?.name || 'algorithm',
          version: parsed.algorithm?.version,
          imports: ['local'],
          steps: parsed.steps || [],
          actors: parsed.actors,
          behavior: parsed.algorithm?.behavior
        }
      ]
    }
  };

  return unified;
}

/**
 * Process single file
 */
async function processFile(filePath: string): Promise<ConversionResult> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = yaml.load(content);

    const format = detectFormat(parsed);

    if (format === 'unified') {
      return {
        file: filePath,
        format: 'unified',
        converted: false
      };
    }

    if (format === 'unknown') {
      return {
        file: filePath,
        format: 'unknown',
        converted: false,
        error: 'Could not determine format'
      };
    }

    // Convert legacy to unified
    let converted: any;
    if (filePath.endsWith('.model.yaml')) {
      converted = convertLegacyDomain(parsed);
    } else if (filePath.endsWith('.sqd.yaml')) {
      converted = convertLegacySqd(parsed);
    } else {
      return {
        file: filePath,
        format,
        converted: false,
        error: 'Unknown file extension'
      };
    }

    // Create backup
    const backupPath = `${filePath}.backup`;
    fs.copyFileSync(filePath, backupPath);

    // Write unified format
    const unifiedYaml = yaml.dump(converted, { lineWidth: 120 });
    fs.writeFileSync(filePath, unifiedYaml);

    return {
      file: filePath,
      format: 'legacy',
      converted: true
    };
  } catch (error) {
    return {
      file: filePath,
      format: 'unknown',
      converted: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Find all YAML files matching patterns
 */
function findYamlFiles(rootDir: string): string[] {
  const files: string[] = [];

  function walk(dir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip node_modules and hidden directories
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
          continue;
        }

        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.name.endsWith('.model.yaml') || entry.name.endsWith('.sqd.yaml')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dir}:`, error);
    }
  }

  walk(rootDir);
  return files;
}

/**
 * Main migration function
 */
async function main() {
  const rootDir = process.cwd();
  console.log(`🔍 Searching for YAML files in ${rootDir}...`);

  const yamlFiles = findYamlFiles(rootDir);
  console.log(`📄 Found ${yamlFiles.length} YAML files\n`);

  if (yamlFiles.length === 0) {
    console.log('No YAML files found');
    process.exit(0);
  }

  const results: ConversionResult[] = [];

  for (const file of yamlFiles) {
    const result = await processFile(file);
    results.push(result);

    const icon = result.converted ? '✅' : result.format === 'unified' ? '⏭️ ' : '❌';
    const message = result.converted
      ? 'Converted to unified format'
      : result.format === 'unified'
        ? 'Already unified'
        : result.error || 'Not converted';

    console.log(`${icon} ${path.relative(rootDir, file)}`);
    console.log(`   ${message}`);
    if (result.format === 'legacy' && result.converted) {
      console.log(`   💾 Backup: ${path.relative(rootDir, file)}.backup`);
    }
  }

  // Summary
  const converted = results.filter(r => r.converted).length;
  const unchanged = results.filter(r => !r.converted && r.format === 'unified').length;
  const failed = results.filter(r => !r.converted && r.format !== 'unified').length;

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Converted: ${converted}`);
  console.log(`   ⏭️  Already unified: ${unchanged}`);
  console.log(`   ❌ Failed/Unknown: ${failed}`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
