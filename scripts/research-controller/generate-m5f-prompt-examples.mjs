import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { AGENT_RESOURCE_CONTROL } from "./execution-policy.mjs";
import {
  buildAgentPrompt,
  buildAgentSystemPrompt,
  renderMechanicalProfilerEvidence,
} from "./prompt-builder.mjs";

const ROOT = resolve(import.meta.dirname, "..", "..");
const OUTPUT = join(ROOT, "experiments", "prompt-examples", "m5f");
const OLD_RUN = join(ROOT, "results", "raw", "m5c", "20261006T170423.670Z");

function stats(text) {
  return {
    characters: text.length,
    utf8Bytes: Buffer.byteLength(text, "utf8"),
    words: text.match(/\S+/gu)?.length ?? 0,
    lines: text.split("\n").length,
  };
}

const taskDescription = await readFile(
  join(ROOT, "experiments", "tasks", "sympy__sympy-20228", "agent", "task.md"),
  "utf8",
);
const profileDocument = JSON.parse(await readFile(
  join(ROOT, "results", "raw", "profiles", "sympy__sympy-20228", "20261006T091154.011Z", "evidence.json"),
  "utf8",
));
const oldB0 = await readFile(join(OLD_RUN, "B0", "prompt.md"), "utf8");
const oldB1 = await readFile(join(OLD_RUN, "B1", "prompt.md"), "utf8");
const oldEvidenceStart = oldB1.indexOf("PROFILER EVIDENCE");
if (oldEvidenceStart < 0) throw new Error("Archived M5c B1 profiler evidence is missing");
const oldEvidence = oldB1.slice(oldEvidenceStart);

const systemPrompt = buildAgentSystemPrompt();
const evidence = renderMechanicalProfilerEvidence(profileDocument);
const shared = {
  taskDescription,
  resourceControl: AGENT_RESOURCE_CONTROL,
  runClassification: "preliminary experiment",
};
const b0 = buildAgentPrompt({ ...shared, performanceContext: "" });
const b1 = buildAgentPrompt({ ...shared, performanceContext: evidence });

await mkdir(OUTPUT, { recursive: true });
await writeFile(join(OUTPUT, "system-prompt.txt"), `${systemPrompt}\n`, "utf8");
await writeFile(join(OUTPUT, "b0-user-prompt.md"), `${b0}\n`, "utf8");
await writeFile(join(OUTPUT, "b1-user-prompt.md"), `${b1}\n`, "utf8");
await writeFile(join(OUTPUT, "b1-performance-context.txt"), `${evidence}\n`, "utf8");

const comparison = {
  schemaVersion: 1,
  taskId: "sympy__sympy-20228",
  comparisonBasis: "Archived actual M5c prompts versus M5f unified prompt skeleton",
  before: { b0UserPrompt: stats(oldB0), b1UserPrompt: stats(oldB1), b1ProfilerEvidence: stats(oldEvidence) },
  after: { systemPrompt: stats(systemPrompt), b0UserPrompt: stats(b0), b1UserPrompt: stats(b1), b1ProfilerEvidence: stats(evidence) },
  b0B1Difference: "Only the PERFORMANCE CONTEXT body: B0 has no pre-supplied evidence; B1 has mechanically ordered profiler evidence.",
  profilerPolicy: { topK: 8, ordering: "mechanical descending runtime", intelligentRanking: false },
};
await writeFile(join(OUTPUT, "comparison.json"), `${JSON.stringify(comparison, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output: OUTPUT, comparison }, null, 2));
