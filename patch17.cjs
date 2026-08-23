const fs = require('fs');
let content = fs.readFileSync('src/domain/validation.ts', 'utf-8');

const validationPatch = `
  // 6. Semantic Truthfulness Checks
  for (const state of states) {
    if (state.type === "parallel") {
      issues.push({
        id: \`err-semantic-parallel-\$\{state.id\}\`,
        severity: "error",
        stateId: state.id,
        message: \`Parallel states are currently 'design_only' and unsupported in runtime execution.\`,
      });
    }
    if (state.type === "compound") {
      issues.push({
        id: \`err-semantic-compound-\$\{state.id\}\`,
        severity: "error",
        stateId: state.id,
        message: \`Compound (nested) states are currently 'design_only' and unsupported in runtime execution.\`,
      });
    }
  }

  return issues;
}
`;

content = content.replace(/return issues;\n\}$/, validationPatch);

fs.writeFileSync('src/domain/validation.ts', content);
