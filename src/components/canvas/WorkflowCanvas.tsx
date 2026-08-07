import { classifyWorkflowEdges } from "../../lib/layout/classification";
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
    selectedStateIds,
    selectedTransitionIds,
    setSelectedStateId,
    setSelectedTransitionId,
    setSelectedSelection,
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
    const selSet = new Set(selectedStateIds.length > 0 ? selectedStateIds : (selectedStateId ? [selectedStateId] : []));
    return activeWorkflow.states.map((st) => ({
      id: st.id,
      type: st.type,
      position: st.position || { x: 100, y: 100 },
      data: st as unknown as Record<string, unknown>,
      selected: selSet.has(st.id),
    }));
  }, [activeWorkflow, selectedStateId, selectedStateIds]);

  // Convert transitions into React Flow edges
  const initialEdges: Edge[] = useMemo(() => {
    if (!activeWorkflow) return [];
    const selSet = new Set(selectedTransitionIds.length > 0 ? selectedTransitionIds : (selectedTransitionId ? [selectedTransitionId] : []));
    const edgesList: Edge[] = [];
    const edgeKinds = classifyWorkflowEdges(activeWorkflow);
    for (const st of activeWorkflow.states) {
      for (const tr of st.transitions || []) {
        edgesList.push({
          id: tr.id,
          source: tr.sourceStateId,
          target: tr.targetStateId,
          type: "customEdge",
          selected: selSet.has(tr.id),
          data: {
            event: tr.event,
            guardName: tr.guard?.name,
            priority: tr.priority,
            kind: edgeKinds[tr.id] || "forward",
          },
        });
      }
    }
    return edgesList;
  }, [activeWorkflow, selectedTransitionId, selectedTransitionIds]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const isUpdatingFromStoreRef = React.useRef(false);
  const isDraggingRef = React.useRef(false);
  const justDraggedRef = React.useRef(false);

  // Sync React Flow state when store activeWorkflow changes
  React.useEffect(() => {
    isUpdatingFromStoreRef.current = true;
    setNodes(initialNodes);
    setEdges(initialEdges);
    const timer = setTimeout(() => {
      isUpdatingFromStoreRef.current = false;
    }, 0);
    return () => clearTimeout(timer);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Handle Dragging Node positions
  const onNodeDragStart = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  const onNodeDragStop = useCallback(
    (_event: unknown, node: Node) => {
      if (!activeWorkflow) return;
      updateStatePosition(activeWorkflow.id, node.id, node.position);
      isDraggingRef.current = false;
      justDraggedRef.current = true;
      setTimeout(() => {
        justDraggedRef.current = false;
      }, 150);
    },
    [activeWorkflow, updateStatePosition]
  );

  // Handle multi-selection change from React Flow box-select / shift-select
  const onSelectionChange = useCallback(
    ({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) => {
      if (isUpdatingFromStoreRef.current || isDraggingRef.current || justDraggedRef.current) return;
      // Single node click is handled explicitly by onNodeClick to prevent inspector popping open during drag
      if (nodes.length > 1 || (edges.length > 0 && nodes.length === 0)) {
        setSelectedSelection(
          nodes.map((n) => n.id),
          edges.map((e) => e.id)
        );
      }
    },
    [setSelectedSelection]
  );

  // Handle Node selection on explicit click
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (isDraggingRef.current || justDraggedRef.current) return;
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
        const stateIdsToCopy = selectedStateIds.length > 0 ? selectedStateIds : (selectedStateId ? [selectedStateId] : []);
        const transitionIdsToCopy = selectedTransitionIds.length > 0 ? selectedTransitionIds : (selectedTransitionId ? [selectedTransitionId] : []);
        if (stateIdsToCopy.length > 0 || transitionIdsToCopy.length > 0) {
          copySelection(activeWorkflow.id, stateIdsToCopy, transitionIdsToCopy);
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
    selectedStateIds,
    selectedTransitionIds,
    copySelection,
    pasteSelection,
    duplicateState,
  ]);

  // Handle Connecting handles to create new Transition
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!activeWorkflow || !connection.source || !connection.target) return;
      const newTransition: TransitionDefinition = {
        id: "", // store will generate this securely
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
    <div
      className="relative w-full h-full overflow-hidden select-none"
      style={{ backgroundColor: "var(--canvas-bg, #020617)" }}
    >
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
        onSelectionChange={onSelectionChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        selectNodesOnDrag={false}
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
        <Background variant={BackgroundVariant.Dots} gap={32} size={1.5} color="var(--grid-dots, rgba(255, 255, 255, 0.08))" />
        <Controls
          className="!bg-[var(--control-bg,#0e1626)] !backdrop-blur-xl !border-[var(--control-border,rgba(255,255,255,0.15))] !text-[var(--control-text,#f8fafc)] !rounded-xl !shadow-2xl"
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
          maskColor="var(--canvas-mask, rgba(2, 6, 23, 0.85))"
          className="!bg-[var(--control-bg,#0e1626)] !backdrop-blur-xl !border-[var(--control-border,rgba(255,255,255,0.15))] !rounded-xl overflow-hidden shadow-2xl"
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

