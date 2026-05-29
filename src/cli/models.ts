import fs from "node:fs";
import path from "node:path";

const port = process.env.PORT ?? "3000";
const baseUrl = `http://localhost:${port}`;

const response = await fetch(`${baseUrl}/models`);
if (!response.ok) {
  const text = await response.text();
  console.error(`Failed (${response.status}): ${text}`);
  console.error(`Is the server running? Try: npm run dev`);
  process.exit(1);
}

const data = (await response.json()) as {
  models: Array<{ id: string; provider?: string; capabilities: string[] }>;
  profiles: unknown[];
};

console.log(`\nActive models (${data.models.length}):\n`);
for (const model of data.models) {
  const provider = model.provider ? ` [${model.provider}]` : "";
  console.log(`  • ${model.id}${provider}`);
  console.log(`    capabilities: ${model.capabilities.join(", ")}`);
}

const outFile = path.join(process.cwd(), "models-output.json");
fs.writeFileSync(outFile, JSON.stringify(data, null, 2));
console.log(`\nFull details saved to:\n  ${outFile}\n`);
