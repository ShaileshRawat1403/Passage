import ELK from 'elkjs/lib/elk.bundled.js';
import {
  WorkflowLayoutEngine,
  WorkflowLayoutGraph,
  WorkflowLayoutOptions,
  WorkflowLayoutResult,
  WorkflowLayoutWarning,
  LayoutPoint
} from './types';
import { STATE_LAYOUT_DIMENSIONS } from './dimensions';
import { classifyWorkflowEdges } from './classification';

export class ElkLayoutEngine implements WorkflowLayoutEngine {
  async layout(
    graph: WorkflowLayoutGraph,
    options: WorkflowLayoutOptions
  ): Promise<WorkflowLayoutResult> {
    const elk = new ELK();
    const warnings: WorkflowLayoutWarning[] = [];
    const positions: Record<string, LayoutPoint> = {};
    const edgeKinds: Record<string, "forward" | "branch" | "loopback" | "self_loop" | "cross_component"> = {};

    // Validate graph
    const stateIds = new Set<string>();
    const transitionIds = new Set<string>();
    
    for (const state of graph.states) {
      if (stateIds.has(state.id)) {
        return { positions: {}, edgeKinds: {}, warnings: [{ code: 'DUPLICATE_STATE_ID', message: `Duplicate state ID: ${state.id}`, stateId: state.id }] };
      }
      stateIds.add(state.id);
    }

    // Component detection using BFS
    const adj = new Map<string, string[]>();
    for (const id of stateIds) adj.set(id, []);
    
    for (const transition of graph.transitions) {
      if (transitionIds.has(transition.id)) {
        return { positions: {}, edgeKinds: {}, warnings: [{ code: 'DUPLICATE_TRANSITION_ID', message: `Duplicate transition ID: ${transition.id}`, transitionId: transition.id }] };
      }
      transitionIds.add(transition.id);
      
      if (!stateIds.has(transition.sourceStateId)) {
        return { positions: {}, edgeKinds: {}, warnings: [{ code: 'MISSING_SOURCE', message: `Missing source state: ${transition.sourceStateId}`, transitionId: transition.id }] };
      }
      if (!stateIds.has(transition.targetStateId)) {
        return { positions: {}, edgeKinds: {}, warnings: [{ code: 'MISSING_TARGET', message: `Missing target state: ${transition.targetStateId}`, transitionId: transition.id }] };
      }

      adj.get(transition.sourceStateId)!.push(transition.targetStateId);
      adj.get(transition.targetStateId)!.push(transition.sourceStateId); // undirected for components
    }

    const componentMap = new Map<string, number>();
    let compIndex = 0;
    for (const id of stateIds) {
      if (!componentMap.has(id)) {
        const q = [id];
        componentMap.set(id, compIndex);
        while (q.length > 0) {
          const curr = q.shift()!;
          for (const nxt of adj.get(curr)!) {
            if (!componentMap.has(nxt)) {
              componentMap.set(nxt, compIndex);
              q.push(nxt);
            }
          }
        }
        compIndex++;
      }
    }

    const direction = options.direction === "LR" ? "RIGHT" : "DOWN";

    const elkNodes = graph.states.map(state => {
      const dims = STATE_LAYOUT_DIMENSIONS[state.type as keyof typeof STATE_LAYOUT_DIMENSIONS] || { width: 200, height: 80 };
      const layoutOptions: Record<string, string> = {
        'elk.alignment': 'CENTER'
      };
      
      if (state.id === graph.initialStateId) {
        layoutOptions['elk.layered.layering.layerConstraint'] = 'FIRST';
      } else if (options.finalStateAlignment && state.type === 'final') {
        layoutOptions['elk.layered.layering.layerConstraint'] = 'LAST';
      }

      return {
        id: state.id,
        width: dims.width,
        height: dims.height,
        layoutOptions
      };
    });

    // Get edge classification using shared logic
    // We need to pass it as WorkflowDefinition-like shape.
    // The engine receives WorkflowLayoutGraph which doesn't group transitions by state, 
    // but the classification function needs it. Let's adapt it.
    
    const syntheticStates = graph.states.map(s => ({
       id: s.id,
       type: s.type,
       position: { x: 0, y: 0 },
       entryActions: [],
       activeActions: [],
       exitActions: [],
       transitions: graph.transitions.filter(t => t.sourceStateId === s.id).map(t => ({
           id: t.id,
           sourceStateId: t.sourceStateId,
           targetStateId: t.targetStateId,
           priority: 0,
       }))
    }));
    
    const syntheticWorkflow = { states: syntheticStates };
    // @ts-ignore
    const computedEdgeKinds = classifyWorkflowEdges(syntheticWorkflow);
    
    for (const k in computedEdgeKinds) {
        edgeKinds[k] = computedEdgeKinds[k] || 'forward';
    }

    const elkEdges = graph.transitions.map(transition => {
      let source = transition.sourceStateId;
      let target = transition.targetStateId;
      
      // Force initial state to be a root by reversing edges that enter it
      if (graph.initialStateId && target === graph.initialStateId && source !== graph.initialStateId) {
        source = transition.targetStateId;
        target = transition.sourceStateId;
      }
      
      return {
        id: transition.id,
        sources: [source],
        targets: [target]
      };
    });

    const elkGraph = {
      id: "root",
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': direction,
        'elk.spacing.nodeNode': options.nodeSpacing.toString(),
        'elk.layered.spacing.nodeNodeBetweenLayers': options.rankSpacing.toString(),
        'elk.spacing.componentComponent': options.componentSpacing.toString(),
        'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
        'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
        'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
        'elk.layered.compaction.postCompaction.strategy': 'LEFT_RIGHT'
      },
      children: elkNodes,
      edges: elkEdges
    };

    try {
      const layoutedGraph = await elk.layout(elkGraph);
      
      if (!layoutedGraph.children) {
         return { positions: {}, edgeKinds: {}, warnings: [{ code: 'LAYOUT_ENGINE_ERROR', message: 'Engine returned no children' }] };
      }

      const resultSet = new Set<string>();

      for (const node of layoutedGraph.children) {
        if (node.x === undefined || node.y === undefined || isNaN(node.x) || isNaN(node.y) || !isFinite(node.x) || !isFinite(node.y)) {
           return { positions: {}, edgeKinds: {}, warnings: [{ code: 'INVALID_COORDINATES', message: `Invalid coordinates for state: ${node.id}`, stateId: node.id }] };
        }
        if (!stateIds.has(node.id)) {
           return { positions: {}, edgeKinds: {}, warnings: [{ code: 'UNKNOWN_STATE_ID', message: `Engine returned unknown state ID: ${node.id}`, stateId: node.id }] };
        }
        positions[node.id] = { x: Math.round(node.x), y: Math.round(node.y) };
        resultSet.add(node.id);
      }

      if (resultSet.size !== stateIds.size) {
        return { positions: {}, edgeKinds: {}, warnings: [{ code: 'MISSING_RESULT', message: `Engine did not return positions for all states` }] };
      }

      return { positions, edgeKinds, warnings };
    } catch (e: unknown) {
      warnings.push({
        code: 'LAYOUT_ENGINE_ERROR',
        message: (e as Error).message || 'Unknown layout engine error'
      });
      return { positions: {}, edgeKinds: {}, warnings };
    }
  }
}
