const fs = require('fs');
let content = fs.readFileSync('src/components/canvas/FloatingCanvasToolbar.tsx', 'utf-8');

content = content.replace(
  /const handleDownloadJson = \(\) => \{\n\s*if \(\!activeWorkflow\) return;\n\s*const blob = new Blob\(\[JSON\.stringify\(activeWorkflow, null, 2\)\], \{/,
  `const handleDownloadJson = () => {
    if (!activeWorkflow) return;
    const layout: any = {};
    activeWorkflow.states.forEach(s => {
      layout[s.id] = { position: s.position || { x: 0, y: 0 } };
    });
    
    // strip position from export
    const cleanWorkflow = JSON.parse(JSON.stringify(activeWorkflow));
    cleanWorkflow.states.forEach((s: any) => {
      delete s.position;
    });

    const doc = {
      contract: "passage.workflow-document.v1",
      workflow: cleanWorkflow,
      layout,
      semanticCapabilities: ["implemented"],
      provenance: {
        source: "export",
        exportedAt: new Date().toISOString()
      }
    };
    const blob = new Blob([JSON.stringify(doc, null, 2)], {`
);

content = content.replace(
  /const handleCopyJson = \(\) => \{\n\s*if \(\!activeWorkflow\) return;\n\s*navigator\.clipboard\.writeText\(JSON\.stringify\(activeWorkflow, null, 2\)\);/,
  `const handleCopyJson = () => {
    if (!activeWorkflow) return;
    const layout: any = {};
    activeWorkflow.states.forEach(s => {
      layout[s.id] = { position: s.position || { x: 0, y: 0 } };
    });
    
    const cleanWorkflow = JSON.parse(JSON.stringify(activeWorkflow));
    cleanWorkflow.states.forEach((s: any) => {
      delete s.position;
    });

    const doc = {
      contract: "passage.workflow-document.v1",
      workflow: cleanWorkflow,
      layout,
      semanticCapabilities: ["implemented"],
      provenance: {
        source: "export",
        exportedAt: new Date().toISOString()
      }
    };
    navigator.clipboard.writeText(JSON.stringify(doc, null, 2));`
);


fs.writeFileSync('src/components/canvas/FloatingCanvasToolbar.tsx', content);
