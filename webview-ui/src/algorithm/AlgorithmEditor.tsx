import React, { useEffect, useState } from 'react';
import * as yaml from 'js-yaml';
import { normalizeAlgorithmFormat } from '../domainModel/schemaNormalization';
import { NarrativePanel } from './NarrativePanel';
import type { NamespaceEntity, ReferenceAttribute, ReferenceEntity, ReferenceEvent, ReferenceOperation, SqdAlgorithm, SqdStep } from '../types/sqd';
import { vscodeApi } from './main';
import { label } from '../ui-labels';

type AnyObject = Record<string, unknown>;

const sanitizeMapRef = (ref: AnyObject): AnyObject => {
  const { mapInput: _mi, mapOutput: _mo, ...clean } = ref;
  return clean;
};

const sanitizeRefOperation = (op: AnyObject): AnyObject => {
  const cleaned: AnyObject = { kind: op.kind };
  if (op.stepRef !== undefined) cleaned.stepRef = op.stepRef;
  if (op.entityFunctionRef) cleaned.entityFunctionRef = sanitizeMapRef(op.entityFunctionRef as AnyObject);
  if (op.sqdRef) cleaned.sqdRef = sanitizeMapRef(op.sqdRef as AnyObject);
  if (op.eventRef) cleaned.eventRef = sanitizeMapRef(op.eventRef as AnyObject);
  return cleaned;
};

const sanitizeAttributeRef = (ref: AnyObject): AnyObject => {
  const cleaned: AnyObject = {};
  if (ref.namespaceAlias !== undefined) cleaned.namespaceAlias = ref.namespaceAlias;
  if (ref.entity !== undefined) cleaned.entity = ref.entity;
  if (ref.attribute !== undefined) cleaned.attribute = ref.attribute;
  return cleaned;
};

const sanitizeEntityRef = (ref: AnyObject): AnyObject => {
  const cleaned: AnyObject = {};
  if (ref.namespaceAlias !== undefined) cleaned.namespaceAlias = ref.namespaceAlias;
  if (ref.entity !== undefined) cleaned.entity = ref.entity;
   return cleaned;
};

const sanitizeStep = (step: SqdStep): SqdStep => {
  const s = step as SqdStep & AnyObject;

  // migrate legacy steps -> body
  const legacySteps = s.steps as SqdStep[] | undefined;
  const childSteps = (s.body ?? legacySteps ?? []).map(sanitizeStep);

  const result: SqdStep = { id: s.id, type: s.type, text: s.text };

  if (s.legacyId) result.legacyId = s.legacyId;
  if (s.collection !== undefined) result.collection = s.collection;
  if (s.item !== undefined) result.item = s.item;

  if (s.operation !== undefined) {
    result.operation =
      typeof s.operation === 'object' && s.operation !== null
        ? (sanitizeRefOperation(s.operation as unknown as AnyObject) as unknown as ReferenceOperation)
        : (s.operation as string);
  }

  if (s.condition) {
    const cond = s.condition;
    result.condition = {
      ...cond,
      attributeRef: cond.attributeRef
        ? (sanitizeAttributeRef(cond.attributeRef as unknown as AnyObject) as ReferenceAttribute)
        : undefined,
      operationRef: cond.operationRef
        ? (sanitizeRefOperation(cond.operationRef as unknown as AnyObject) as unknown as ReferenceOperation)
        : undefined,
      waitEvent: cond.waitEvent
        ? {
            ...cond.waitEvent,
            eventRef: cond.waitEvent.eventRef
              ? (sanitizeMapRef(cond.waitEvent.eventRef as unknown as AnyObject) as ReferenceEvent)
              : cond.waitEvent.eventRef,
          }
        : undefined,
    };
  }

  if (s.branches) {
    result.branches = s.branches.map(branch => ({
      ...branch,
      then: (branch.then ?? []).map(sanitizeStep),
    }));
  }

  if (childSteps.length > 0) result.body = childSteps;
  if (s.behavior) result.behavior = s.behavior;

  return result;
};

const sanitizeAlgorithmForSave = (model: SqdAlgorithm): SqdAlgorithm => ({
  ...model,
  steps: (model.steps ?? []).map(sanitizeStep),
});

export const AlgorithmEditor: React.FC = () => {
  const L = (path: string, fallback: string) => label(`algorithm.${path}`, fallback);

  const [model, setModel] = useState<SqdAlgorithm | null>(null);
  const [rawYaml, setRawYaml] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [globalNamespaces, setGlobalNamespaces] = useState<NamespaceEntity[]>([]);

  const countWarnings = (steps: SqdAlgorithm['steps']): number => {
    let warnings = 0;

    const walk = (items: SqdAlgorithm['steps']) => {
      for (const step of items) {
        if (!step.text || step.text.trim().length === 0) {
          warnings += 1;
        }

        if (step.steps && step.steps.length > 0) {
          walk(step.steps);
        }

        if (step.branches && step.branches.length > 0) {
          for (const branch of step.branches) {
            if (branch.then && branch.then.length > 0) {
              walk(branch.then);
            }
          }
        }
      }
    };

    walk(steps);
    return warnings;
  };

  // Prijímaj správy z extension hosta (obsah súboru)
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'update') {
        setRawYaml(msg.content);
        setFileName(msg.fileName ?? '');
        setGlobalNamespaces(Array.isArray(msg.globalNamespaces) ? msg.globalNamespaces : []);
        try {
          const parsed = yaml.load(msg.content);
          const normalized = normalizeAlgorithmFormat(parsed);
          setModel(normalized);
          setError(null);
        } catch (e) {
          setError(String(e));
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Pošli zmenu späť do extension hosta
  const handleModelChange = (updated: SqdAlgorithm) => {
    setModel(updated);
    const sanitized = sanitizeAlgorithmForSave(updated);
    const newYaml = yaml.dump(sanitized, { lineWidth: 120 });
    setRawYaml(newYaml);
    vscodeApi.postMessage({ type: 'edit', content: newYaml });
  };

  if (error) {
    return <div className="error-banner">⚠ {L('yamlError', 'YAML chyba')}: {error}</div>;
  }

  if (!model) {
    return <div className="loading">{L('loading', 'Nacitavam...')}</div>;
  }

  const warningCount = countWarnings(model.steps ?? []);

  return (
    <div className="editor-root">
      <div className="editor-header">
        <span className="editor-filename">{fileName || `${model.algorithm?.name ?? 'algorithm'}.sqd.yaml`}</span>
        <span className="editor-separator">|</span>
        <span className="editor-title">{L('editorTitle', 'SQD Algorithm Editor')}</span>
      </div>
      <div className="editor-body">
        <NarrativePanel model={model} onChange={handleModelChange} globalNamespaces={globalNamespaces} />
      </div>
      <div className="editor-footer">
        <span className="footer-item footer-valid">{L('footer.status', 'Status: Valid')}</span>
        <span className="footer-separator">|</span>
        <span className="footer-item footer-warn">
          ⚠ {warningCount} {warningCount === 1 ? L('footer.warningPrefix', 'warning') : L('footer.warnings', 'warnings')}
        </span>
        <span className="footer-separator">|</span>
        <span className="footer-item footer-ai">{L('footer.aiInsight', 'AI insight available')}</span>
      </div>
    </div>
  );
};
