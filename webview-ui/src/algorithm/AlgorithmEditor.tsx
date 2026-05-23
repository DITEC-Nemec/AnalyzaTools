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
  const cleaned: AnyObject = { callType: op.callType ?? op.kind };
  if (op.stepRef !== undefined) cleaned.stepRef = op.stepRef;
  if (op.entityFunctionRef) cleaned.entityFunctionRef = sanitizeMapRef(op.entityFunctionRef as AnyObject);
  if (op.sqdRef) cleaned.sqdRef = sanitizeMapRef(op.sqdRef as AnyObject);
  if (op.emitEventRef) cleaned.emitEventRef = sanitizeMapRef(op.emitEventRef as AnyObject);
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
  const legacySteps = s.stepList as SqdStep[] | undefined;
  const childSteps = (s.subStepList ?? legacySteps ?? []).map(sanitizeStep);

  const result: SqdStep = { id: s.id, stepType: s.stepType, description: s.description };

  if (s.legacyId) result.legacyId = s.legacyId;
  if (s.sourceCollectionRef !== undefined) result.sourceCollectionRef = s.sourceCollectionRef;
  if (s.iteratorItemName !== undefined) result.iteratorItemName = s.iteratorItemName;

  if (s.operationRef !== undefined) {
    result.operationRef =
      typeof s.operationRef === 'object' && s.operationRef !== null
        ? (sanitizeRefOperation(s.operationRef as unknown as AnyObject) as unknown as ReferenceOperation)
        : (s.operationRef as string);
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
            emitEventRef: cond.waitEvent.emitEventRef
              ? (sanitizeMapRef(cond.waitEvent.emitEventRef as unknown as AnyObject) as ReferenceEvent)
              : cond.waitEvent.emitEventRef,
          }
        : undefined,
    };
  }

  if (s.branchList) {
    result.branchList = s.branchList.map(branch => ({
      ...branch,
      then: (branch.then ?? []).map(sanitizeStep),
    }));
  }

  if (childSteps.length > 0) result.subStepList = childSteps;
  if (s.behavior) result.behavior = s.behavior;

  return result;
};

const sanitizeAlgorithmForSave = (model: SqdAlgorithm): Record<string, unknown> => {
  const metadata = {
    name: model.metadata?.name ?? model.algorithm?.name ?? model.name ?? 'algorithm',
    ...(model.metadata?.description ? { description: model.metadata.description } : {}),
    ...(model.metadata?.version ? { version: model.metadata.version } : {}),
    ...(model.metadata?.status ? { status: model.metadata.status } : {}),
  };

  const importList = (model.importList ?? model.imports ?? []).filter(a => a !== 'local');

  const algorithmList = (model.algorithmList ?? []).map((alg) => ({
    name: alg.name,
    ...(alg.version ? { version: alg.version } : {}),
    ...(alg.behavior ? { behavior: alg.behavior } : {}),
    ...(alg.parameterList?.length ? { parameterList: alg.parameterList } : {}),
    stepList: (alg.stepList ?? []).map(sanitizeStep)
  }));

  return {
    algorithm: {
      metadata,
      ...(importList.length ? { importList } : {}),
      algorithmList
    }
  };
};

export const AlgorithmEditor: React.FC = () => {
  const L = (path: string, fallback: string) => label(`algorithm.${path}`, fallback);

  const [model, setModel] = useState<SqdAlgorithm | null>(null);
  const [rawYaml, setRawYaml] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [globalNamespaces, setGlobalNamespaces] = useState<NamespaceEntity[]>([]);

  const countWarnings = (model: SqdAlgorithm): number => {
    let warnings = 0;

    const walk = (items: SqdStep[]) => {
      for (const step of items) {
        if (!step.description || step.description.trim().length === 0) {
          warnings += 1;
        }
        if (step.stepList && step.stepList.length > 0) walk(step.stepList);
        if (step.branchList) {
          for (const branch of step.branchList) {
            if (branch.then && branch.then.length > 0) walk(branch.then);
          }
        }
      }
    };

    for (const alg of (model.algorithmList ?? [])) {
      walk(alg.stepList ?? []);
    }
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

  const warningCount = countWarnings(model);

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
