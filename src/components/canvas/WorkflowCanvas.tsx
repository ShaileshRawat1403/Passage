import React, { useCallback, useMemo } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useWorkflowStore } from "../../store/workflowStore";
import { TransitionDefinition } from "../../types/workflow";
import { StartNode } from "./nodes/StartNode";
import { AtomicNode } from "./nodes/AtomicNode";
import { DecisionNode } from "./nodes/DecisionNode";
import { ParallelNode } from "./nodes/ParallelNode";
import { WaitingNode } from "./nodes/WaitingNode";
import { ApprovalNode } from "./nodes/ApprovalNode";
import { FinalNode } from "./nodes/FinalNode";
import { CustomEdge } from "./CustomEdge";
import { FloatingCanvasToolbar } from "./FloatingCanvasToolbar";
import { FloatingStateInspector } from "../inspector/FloatingStateInspector";

const nodeTypes = {
  start: StartNode,
  atomic: AtomicNode,
  decision: DecisionNode,
  parallel: ParallelNode,
  waiting: WaitingNode,
  approval: ApprovalNode,
  final: FinalNode,
  compound: AtomicNode,
};

const edgeTypes = {
  customEdge: CustomEdge,
};

const WorkflowCanvasInner: React.FC = () => {
  const {
    workflows,
    activeWorkflowId,
    selectedStateId,
    selectedTransitionId,
    setSelectedStateId,
    setSelectedTransitionId,
    updateStatePosition,
    addTransition,
    deleteSelection,
    copySelection,
    pasteSelection,
    duplicateState,
  } = useWorkflowStore();

  const activeWorkflow = useMemo(() => {
    return workflows.find((w) => w.id === activeWorkflowId) || workflows[0];
  }, [workflows, activeWorkflowId]);

  // Convert workflow states into React Flow nodes
  const initialNodes: Node[] = useMemo(() => {
    if (!activeWorkflow) return [];
    return activeWorkflow.states.map((st) => ({
      id: st.id,
      type: st.type,
      position: st.position || { x: 100, y: 100 },
      data: st as unknown as Record<string, unknown>,
      selected: st.id === selectedStateId,
    }));
  }, [activeWorkflow, selectedStateId]);

  // Convert transitions into React Flow edges
  const initialEdges: Edge[] = useMemo(() => {
    if (!activeWorkflow) return [];
    const edgesList: Edge[] = [];
    for (const st of activeWorkflow.states) {
      for (const tr of st.transitions || []) {
        edgesList.push({
          id: tr.id,
          source: tr.sourceStateId,
          target: tr.targetStateId,
          type: "customEdge",
          selected: tr.id === selectedTransitionId,
          data: {
            event: tr.event,
            guardName: tr.guard?.name,
            priority: tr.priority,
          },
        });
      }
    }
    return edgesList;
  }, [activeWorkflow, selectedTransitionId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync React Flow state when store activeWorkflow changes
  React.useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Handle Dragging Node positions
  const onNodeDragStop = useCallback(
    (_event: unknown, node: Node) => {
      if (!activeWorkflow) return;
      updateStatePosition(activeWorkflow.id, node.id, node.position);
    },
    [activeWorkflow, updateStatePosition]
  );

  // Handle Node selection
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedStateId(node.id);
    },
    [setSelectedStateId]
  );

  // Handle Edge selection
  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      setSelectedTransitionId(edge.id);
    },
    [setSelectedTransitionId]
  );

  // Handle Node Deletion
  const onNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      if (!activeWorkflow) return;
      deleteSelection(
        activeWorkflow.id,
        deletedNodes.map((n) => n.id),
        []
      );
    },
    [activeWorkflow, deleteSelection]
  );

  // Handle Edge Deletion
  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      if (!activeWorkflow) return;
      deleteSelection(
        activeWorkflow.id,
        [],
        deletedEdges.map((e) => e.id)
      );
    },
    [activeWorkflow, deleteSelection]
  );

  // Keyboard Shortcuts (Copy / Paste / Duplicate)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeWorkflow) return;
      const isInput =
        ["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName) ||
        (e.target as HTMLElement)?.isContentEditable;
      if (isInput) return;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && e.key.toLowerCase() === "c") {
        if (selectedStateId || selectedTransitionId) {
          copySelection(
            activeWorkflow.id,
            selectedStateId ? [selectedStateId] : [],
            selectedTransitionId ? [selectedTransitionId] : []
          );
        }
      } else if (modifier && e.key.toLowerCase() === "v") {
        pasteSelection(activeWorkflow.id);
      } else if (modifier && e.key.toLowerCase() === "d") {
        if (selectedStateId) {
          e.preventDefault();
          duplicateState(activeWorkflow.id, selectedStateId);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeWorkflow,
    selectedStateId,
    selectedTransitionId,
    copySelection,
    pasteSelection,
    duplicateState,
  ]);

  // Handle Connecting handles to create new Transition
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!activeWorkflow || !connection.source || !connection.target) return;
      const newTransition: TransitionDefinition = {
        id: `tr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: "New Route",
        sourceStateId: connection.source,
        targetStateId: connection.target,
        event: "EVENT_REQUIRED",
        priority: 10,
      };
      addTransition(activeWorkflow.id, newTransition);
    },
    [activeWorkflow, addTransition]
  );

  const onPaneClick = useCallback(() => {
    setSelectedStateId(null);
    setSelectedTransitionId(null);
  }, [setSelectedStateId, setSelectedTransitionId]);

  return (
    <div className="relative w-full h-full bg-[#020617] overflow-hidden select-none">
      <FloatingCanvasToolbar />
      <FloatingStateInspector />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        panOnScroll
        panOnDrag
        zoomOnPinch
        zoomOnDoubleClick
        defaultEdgeOptions={{ type: "customEdge" }}
        className="stateflow-canvas"
      >
        <Background variant={BackgroundVariant.Dots} gap={32} size={1.5} color="rgba(255, 255, 255, 0.08)" />
        <Controls
          className="!bg-black/60 !backdrop-blur-xl !border-white/15 !text-slate-100 !rounded-xl !shadow-2xl"
          showInteractive={false}
        />
        <MiniMap
          nodeColor={(node) => {
            switch (node.type) {
              case "start":
                return "#22d3ee";
              case "decision":
                return "#fbbf24";
              case "parallel":
                return "#f472b6";
              case "approval":
                return "#818cf8";
              case "final":
                return "#34d399";
              default:
                return "#475569";
            }
          }}
          maskColor="rgba(2, 6, 23, 0.85)"
          className="!bg-black/60 !backdrop-blur-xl !border-white/15 !rounded-xl overflow-hidden shadow-2xl"
        />
      </ReactFlow>
    </div>
  );
};

export const WorkflowCanvas: React.FC = () => {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner />
    </ReactFlowProvider>
  );
};

