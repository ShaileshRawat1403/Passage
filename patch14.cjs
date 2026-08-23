const fs = require('fs');
let content = fs.readFileSync('src/domain/schemas.ts', 'utf-8');

const docSchema = `

export const PassageLayoutSchema = z.record(
  z.string(), // stateId
  z.strictObject({
    position: z.strictObject({
      x: z.number(),
      y: z.number(),
    }),
  })
);

export const PassageWorkflowDocumentV1Schema = z.strictObject({
  contract: z.literal("passage.workflow-document.v1"),
  workflow: WorkflowDefinitionSchema,
  layout: PassageLayoutSchema,
  semanticCapabilities: z.array(z.string()),
  provenance: z.strictObject({
    source: z.enum(["blank", "import", "assistant", "template"]),
    exportedAt: z.string(),
  }),
});
`;

content += docSchema;

fs.writeFileSync('src/domain/schemas.ts', content);

let tContent = fs.readFileSync('src/types/workflow.ts', 'utf-8');
const docType = `

export interface PassageLayout {
  [stateId: string]: {
    position: { x: number; y: number };
  };
}

export interface PassageWorkflowDocumentV1 {
  contract: "passage.workflow-document.v1";
  workflow: WorkflowDefinition;
  layout: PassageLayout;
  semanticCapabilities: string[];
  provenance: {
    source: "blank" | "import" | "assistant" | "template";
    exportedAt: string;
  };
}
`;

tContent += docType;
fs.writeFileSync('src/types/workflow.ts', tContent);
