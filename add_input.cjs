const fs = require('fs');
let content = fs.readFileSync('src/components/runtime/SimulationBar.tsx', 'utf-8');

content = content.replace(
  /<div className="flex items-center gap-1">\s*<input\s*type="text"/,
  `<div className="flex items-center gap-1 text-slate-400">Payload:</div>
        <input
          type="text"
          value={customPayload}
          onChange={(e) => setCustomPayload(e.target.value)}
          placeholder='{"key": "value"}'
          className="w-48 px-2 py-1 rounded-lg bg-black/40 border border-white/10 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-400"
          title="Event Context Payload (JSON)"
        />
        <div className="flex items-center gap-1">
          <input
            type="text"`
);

fs.writeFileSync('src/components/runtime/SimulationBar.tsx', content);
