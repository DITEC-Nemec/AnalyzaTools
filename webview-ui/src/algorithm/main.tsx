import React from 'react';
import ReactDOM from 'react-dom/client';
import { AlgorithmEditor } from './AlgorithmEditor';
import './styles.css';

// VS Code API je dostupná v webview kontexte
declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };
export const vscodeApi = acquireVsCodeApi();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AlgorithmEditor />
  </React.StrictMode>
);
