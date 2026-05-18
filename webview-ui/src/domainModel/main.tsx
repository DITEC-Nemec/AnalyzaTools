import React from 'react';
import ReactDOM from 'react-dom/client';
import { DomainModelEditor } from './DomainModelEditor';
import './styles.css';

declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };
export const vscodeApi = acquireVsCodeApi();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DomainModelEditor />
  </React.StrictMode>
);
