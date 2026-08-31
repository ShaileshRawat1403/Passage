const fs = require('fs');
let content = fs.readFileSync('src/components/runtime/SimulationBar.tsx', 'utf-8');

content = content.replace(
  /const \[customAmount, setCustomAmount\] = useState<number>\(82400\);/,
  `const [customPayload, setCustomPayload] = useState<string>('{\\n  "invoice": {\\n    "amount": 82400\\n  }\\n}');`
);

content = content.replace(
  /const handleEmit = \(eventName: string\) => {[\s\S]*?dispatchEventToRun\(activeRun\.id, eventName, {[\s\S]*?invoice: {[\s\S]*?\.\.\.inv,[\s\S]*?amount: customAmount,[\s\S]*?},[\s\S]*?}\);[\s\S]*?};/,
  `const handleEmit = (eventName: string) => {
    let payload = {};
    try {
      payload = JSON.parse(customPayload);
    } catch (e) {
      console.warn("Invalid JSON in custom payload");
      return;
    }
    dispatchEventToRun(activeRun.id, eventName, payload);
  };`
);

content = content.replace(
  /const handleRestart = \(\) => {[\s\S]*?startNewRun\(activeWorkflowId, {[\s\S]*?invoice: {[\s\S]*?id: "INV-2026-SIM",[\s\S]*?amount: customAmount,[\s\S]*?currency: "INR",[\s\S]*?vendorId: "VEND-991",[\s\S]*?vendorName: "Simulated Logistics",[\s\S]*?},[\s\S]*?}\);[\s\S]*?};/,
  `const handleRestart = () => {
    let payload = {};
    try {
      payload = JSON.parse(customPayload);
    } catch (e) {
      console.warn("Invalid JSON in custom payload");
    }
    startNewRun(activeWorkflowId, payload);
  };`
);

content = content.replace(
  /<input\s+type="number"\s+value=\{customAmount\}\s+onChange=\{\(e\) => setCustomAmount\(Number\(e\.target\.value\)\)\}\s+className="w-24 px-2 py-1\.5 rounded-lg bg-black\/40 border border-white\/10 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-400"\s+\/>/,
  `<input
          type="text"
          value={customPayload}
          onChange={(e) => setCustomPayload(e.target.value)}
          placeholder='{"key": "value"}'
          className="w-48 px-2 py-1.5 rounded-lg bg-black/40 border border-white/10 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-400"
          title="Event Context Payload (JSON)"
        />`
);

fs.writeFileSync('src/components/runtime/SimulationBar.tsx', content);
