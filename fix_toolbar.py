import re

with open("src/components/canvas/FloatingCanvasToolbar.tsx", "r") as f:
    code = f.read()

# Remove activeWorkflow declaration
code = code.replace("  const activeWorkflow = workflows.find((w) => w.id === activeWorkflowId) || workflows[0];\n", "")

# Move it up
hook_addition = """  const activeWorkflow = workflows.find((w) => w.id === activeWorkflowId) || workflows[0];
  const history = activeWorkflow ? historyByWorkflowId[activeWorkflow.id] : undefined;"""

code = code.replace("  const history = activeWorkflow ? historyByWorkflowId[activeWorkflow.id] : undefined;", hook_addition)

with open("src/components/canvas/FloatingCanvasToolbar.tsx", "w") as f:
    f.write(code)

