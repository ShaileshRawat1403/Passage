const fs = require('fs');
let content = fs.readFileSync('src/components/canvas/WorkflowCanvas.tsx', 'utf-8');

const searchStr = `  // Sync React Flow state when store activeWorkflow changes
  React.useEffect(() => {
    isUpdatingFromStoreRef.current = true;
    setNodes(initialNodes);
    setEdges(initialEdges);
    const timer = setTimeout(() => {
      isUpdatingFromStoreRef.current = false;
    }, 0);
    
  const onDragOver = useCallback((event: React.DragEvent) => {`;

const replaceStr = `  // Sync React Flow state when store activeWorkflow changes
  React.useEffect(() => {
    isUpdatingFromStoreRef.current = true;
    setNodes(initialNodes);
    setEdges(initialEdges);
    const timer = setTimeout(() => {
      isUpdatingFromStoreRef.current = false;
    }, 0);
    
    return () => clearTimeout(timer);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onDragOver = useCallback((event: React.DragEvent) => {`;

content = content.replace(searchStr, replaceStr);

content = content.replace(
`  return (
) => clearTimeout(timer);
  }, [initialNodes, initialEdges, setNodes, setEdges]);`,
`  return (`
);

fs.writeFileSync('src/components/canvas/WorkflowCanvas.tsx', content);
