import re

with open("tests/history.test.ts", "r") as f:
    code = f.read()

# Make history ? safe
code = code.replace('expect(history.past', 'expect(history!.past')
code = code.replace('expect(history.future', 'expect(history!.future')
code = code.replace('expect(wf.states', 'expect(wf!.states')
code = code.replace('expect(wf1.id', 'expect(wf1!.id')
code = code.replace('expect(state.historyByWorkflowId[wf1.id]', 'expect(state.historyByWorkflowId[wf1!.id])')
code = code.replace('useWorkflowStore.getState().setActiveWorkflowId(wf1.id)', 'useWorkflowStore.getState().setActiveWorkflowId(wf1!.id)')
code = code.replace('useWorkflowStore.getState().addState(wf1.id,', 'useWorkflowStore.getState().addState(wf1!.id,')

with open("tests/history.test.ts", "w") as f:
    f.write(code)

