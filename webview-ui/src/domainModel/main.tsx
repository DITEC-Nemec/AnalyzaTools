import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { DomainModelEditor } from './DomainModelEditor';
import './styles.css';
import * as yaml from 'js-yaml';
import type { DomainModel } from '../types/sqd';

declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };
export const vscodeApi = acquireVsCodeApi();

interface AppState {
  model: DomainModel | null;
  currentPath: string;
  availableModels: Array<{ name: string; path: string }>;
  error: string | null;
}

function App() {
  const [state, setState] = useState<AppState>({
    model: null,
    currentPath: '',
    availableModels: [],
    error: null
  });

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, content, currentPath, availableModels } = event.data;
      
      if (type === 'update') {
        try {
          const parsed = yaml.load(content) as DomainModel;
          setState(prev => ({
            ...prev,
            model: parsed,
            currentPath,
            availableModels: availableModels || [],
            error: null
          }));
        } catch (e) {
          setState(prev => ({
            ...prev,
            error: `Failed to parse YAML: ${e instanceof Error ? e.message : String(e)}`
          }));
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleChange = (model: DomainModel) => {
    setState(prev => ({ ...prev, model }));
    const yaml_str = yaml.dump(model);
    vscodeApi.postMessage({
      type: 'edit',
      content: yaml_str
    });
  };

  const handleModelSwitch = (path: string) => {
    vscodeApi.postMessage({
      type: 'loadModel',
      path
    });
  };

  if (!state.model) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <p>Loading domain model...</p>
        {state.error && <div style={{ color: 'red' }}>{state.error}</div>}
      </div>
    );
  }

  return (
    <DomainModelEditor
      value={state.model}
      onChange={handleChange}
      availableModels={state.availableModels}
      onModelSwitch={handleModelSwitch}
      currentPath={state.currentPath}
      vscodeApi={vscodeApi}
    />
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
