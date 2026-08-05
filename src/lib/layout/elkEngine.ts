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

export class ElkLayoutEngine implements WorkflowLayoutEngine {
  async layout(
    graph: WorkflowLayoutGraph,
    options: WorkflowLayoutOptions
  ): Promise<WorkflowLayoutResult> {
    const elk = new ELK();
    const warnings: WorkflowLayoutWarning[] = [];
    const positions: Record<string, LayoutPoint> = {};
    const edgeKinds: Record<string, any> = {};

    // Validate graph
    const stateIds = new Set<string>();
    const transitionIds = new Set<string>();
    
    for (const state of graph.states) {
      if (stateIds.has(state.id)) {
        return { positions: {}, edgeKinds: {}, warnings: [{ code: 'DUPLICATE_STATE_ID', message: `Duplicate state ID: ${state.id}`, stateId: state.id }] };
      }
      stateIds.add(state.id);
    }

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
    }

    const direction = options.direction === "LR" ? "RIGHT" : "DOWN";

    const elkNodes = graph.states.map(state => {
      const dims = STATE_LAYOUT_DIMENSIONS[state.type as keyof typeof STATE_LAYOUT_DIMENSIONS] || { width: 200, height: 80 };
      return {
        id: state.id,
        width: dims.width,
        height: dims.height,
        layoutOptions: {
          'elk.alignment': 'CENTER'
        }
      };
    });

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
      
      if (layoutedGraph.children) {
        for (const node of layoutedGraph.children) {
          if (node.x === undefined || node.y === undefined || isNaN(node.x) || isNaN(node.y) || !isFinite(node.x) || !isFinite(node.y)) {
             return { positions: {}, edgeKinds: {}, warnings: [{ code: 'INVALID_COORDINATES', message: `Invalid coordinates for state: ${node.id}`, stateId: node.id }] };
          }
          positions[node.id] = { x: Math.round(node.x), y: Math.round(node.y) };
        }
      }
      
      // Determine edge kinds
      for (const transition of graph.transitions) {
        if (transition.sourceStateId === transition.targetStateId) {
          edgeKinds[transition.id] = "self_loop";
        } else {
          edgeKinds[transition.id] = "forward"; // Basic classification
          // Loopback classification can be more advanced based on topological sort, but ELK handles cycle breaking internally
        }
      }

      return { positions, edgeKinds, warnings };
    } catch (e: any) {
      warnings.push({
        code: 'LAYOUT_ENGINE_ERROR',
        message: e.message || 'Unknown layout engine error'
      });
      return { positions: {}, edgeKinds: {}, warnings };
    }
  }
}
