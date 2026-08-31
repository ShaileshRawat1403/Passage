const fs = require('fs');
let content = fs.readFileSync('src/components/canvas/WorkflowCanvas.tsx', 'utf-8');

content = content.replace(
  /import \{\n  ReactFlow,/,
  `import {
  ReactFlow,
  useReactFlow,`
);

content = content.replace(
  /import \{ WorkflowDashboard \} from "\.\/WorkflowDashboard";/,
  `import { WorkflowDashboard } from "./WorkflowDashboard";\nimport { QuickAddSidebar, DraggedTemplate } from "./QuickAddSidebar";`
);

content = content.replace(
  /const activeWorkflow = useMemo/,
  `const { screenToFlowPosition } = useReactFlow();\n  const addState = useWorkflowStore(s => s.addState);\n\n  const activeWorkflow = useMemo`
);

const dropHandlers = `
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const typeRaw = event.dataTransfer.getData("application/reactflow");
      if (!typeRaw || !activeWorkflow) return;

      try {
        const template = JSON.parse(typeRaw) as DraggedTemplate;
        
        // Calculate the dropped position
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        // Add the new state via store
        addState(activeWorkflow.id, {
          type: template.type,
          name: template.name,
          position,
          entryActions: template.entryActions || [],
        });
      } catch (err) {
        console.error("Drop parsing error:", err);
      }
    },
    [activeWorkflow, screenToFlowPosition, addState]
  );

  return (
`;

content = content.replace(
  /return \(/,
  dropHandlers
);

content = content.replace(
  /<ReactFlow\n/,
  `<ReactFlow\n        onDragOver={onDragOver}\n        onDrop={onDrop}\n`
);

content = content.replace(
  /<FloatingCanvasToolbar \/>\n      <WorkflowDashboard \/>\n      <FloatingStateInspector \/>/,
  `<FloatingCanvasToolbar />\n      <WorkflowDashboard />\n      <QuickAddSidebar />\n      <FloatingStateInspector />`
);


fs.writeFileSync('src/components/canvas/WorkflowCanvas.tsx', content);
