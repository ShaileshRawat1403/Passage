import re

with open("src/store/workflowStore.ts", "r") as f:
    code = f.read()

code = re.sub(r'throw new Error\(\s*`Workflow import rejected due to contract validation errors:\s*\\n\$\{parseResult\.errors\.join\("\\n"\)\s*"\)\}`\s*\);',
              'throw new Error(`Workflow import rejected due to contract validation errors:\\n${parseResult.errors.join("\\n")}`);',
              code)

with open("src/store/workflowStore.ts", "w") as f:
    f.write(code)

