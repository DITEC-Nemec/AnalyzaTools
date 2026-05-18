import React, { useEffect, useState } from 'react';
import * as yaml from 'js-yaml';
import { NarrativePanel } from './NarrativePanel';
import type { SqdAlgorithm } from '../types/sqd';
import { vscodeApi } from './main';
import { label } from '../ui-labels';

export const AlgorithmEditor: React.FC = () => {
  const L = (path: string, fallback: string) => label(`algorithm.${path}`, fallback);

  const [model, setModel] = useState<SqdAlgorithm | null>(null);
  const [rawYaml, setRawYaml] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);

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
        try {
          const parsed = yaml.load(msg.content) as SqdAlgorithm;
          setModel(parsed);
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
    const newYaml = yaml.dump(updated, { lineWidth: 120 });
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
        <NarrativePanel model={model} onChange={handleModelChange} />
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
