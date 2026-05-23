import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { SqdAlgorithm, SqdStep } from '../types/sqd';

interface Props {
  model: SqdAlgorithm;
}

/** Konvertuje kroky algoritmu na React Flow nodes + edges */
function buildGraph(stepList: SqdStep[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Start node
  nodes.push({ id: '__start', position: { x: 200, y: 0 }, data: { label: 'START' }, type: 'input' });

  let prevId = '__start';
  let y = 80;

  for (const step of stepList) {
    const nodeId = `step-${step.id}`;
    const label = step.description
      ? step.description.slice(0, 50).replace(/\n/g, ' ') + (step.description.length > 50 ? '…' : '')
      : step.id;

    nodes.push({
      id: nodeId,
      position: { x: 100, y },
      data: { label },
      style: stepStyle(step.stepType),
    });

    edges.push({ id: `e-${prevId}-${nodeId}`, source: prevId, target: nodeId });

    // Pre decision pridaj vetvy
    if (step.stepType === 'decision' && step.branchList) {
      for (const branch of step.branchList) {
        const branchId = `branch-${step.id}-${branch.when}`;
        const branchLabel = branch.when ? 'TRUE' : 'FALSE';
        const branchActions = branch.then?.map(t => t.type).join(', ') ?? '';
        nodes.push({
          id: branchId,
          position: { x: branch.when ? 350 : -50, y: y + 70 },
          data: { label: `${branchLabel}: ${branchActions}` },
          style: { background: branch.when ? '#d4edda' : '#f8d7da', fontSize: 11 },
        });
        edges.push({ id: `e-${nodeId}-${branchId}`, source: nodeId, target: branchId, label: branchLabel });
      }
      y += 70;
    }

    prevId = nodeId;
    y += 90;
  }

  return { nodes, edges };
}

function stepStyle(type: string): React.CSSProperties {
  switch (type) {
    case 'decision': return { background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 4 };
    case 'event':    return { background: '#cce5ff', border: '1px solid #004085', borderRadius: 4 };
    case 'return':   return { background: '#d6d8db', border: '1px solid #6c757d', borderRadius: 4 };
    default:         return { background: '#e2e3e5', border: '1px solid #383d41', borderRadius: 4 };
  }
}

export const FlowPanel: React.FC<Props> = ({ model }) => {
  const { nodes, edges } = useMemo(() => buildGraph(model.stepList ?? []), [model.stepList]);

  return (
    <div className="flow-panel">
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
};
