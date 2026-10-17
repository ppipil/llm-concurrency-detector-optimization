import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";

const EXPECTED_PI_VERSION = "1.0.3";
const REQUESTED_TOOLS = ["read", "grep", "find", "ls"];
const extensionEvents = [];
const sessionEvents = [];

function probeExtension(pi) {
  pi.on("session_start", async (event) => {
    extensionEvents.push(event.type);
  });
}

async function readInstalledPackageMetadata() {
  const entryUrl = import.meta.resolve("@earendil-works/pi-coding-agent");
  const packageRoot = resolve(dirname(fileURLToPath(entryUrl)), "..");
  return JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8"));
}

const packageMetadata = await readInstalledPackageMetadata();
assert.equal(
  packageMetadata.version,
  EXPECTED_PI_VERSION,
  `Expected Pi ${EXPECTED_PI_VERSION}, found ${packageMetadata.version}`,
);

const cwd = process.cwd();
const settingsManager = SettingsManager.inMemory();
const resourceLoader = new DefaultResourceLoader({
  cwd,
  agentDir: getAgentDir(),
  settingsManager,
  extensionFactories: [probeExtension],
  noSkills: true,
  noPromptTemplates: true,
  noThemes: true,
  noContextFiles: true,
});

await resourceLoader.reload();

const { session } = await createAgentSession({
  cwd,
  tools: REQUESTED_TOOLS,
  resourceLoader,
  sessionManager: SessionManager.inMemory(cwd),
  settingsManager,
});

const unsubscribe = session.subscribe((event) => {
  sessionEvents.push(event.type);
});

try {
  const initialActiveTools = session.getActiveToolNames();
  assert.deepEqual(initialActiveTools, REQUESTED_TOOLS);
  assert.equal(session.model?.provider, "unknown");
  assert.equal(session.model?.id, "unknown");

  await session.bindExtensions({ mode: "print" });
  assert.ok(
    extensionEvents.includes("session_start"),
    "Inline extension did not receive the session_start lifecycle hook",
  );

  session.setActiveToolsByName(["read", "ls"]);
  assert.deepEqual(session.getActiveToolNames(), ["read", "ls"]);

  // A mock BashOperations adapter exercises the session event channel without
  // starting a process or invoking an LLM.
  const mockBashResult = await session.executeBash("mock:no-process-started", undefined, {
    excludeFromContext: true,
    id: "pi-sdk-probe",
    operations: {
      exec: async (_command, _cwd, { onData }) => {
        onData(Buffer.from("mock result"));
        return { exitCode: 0 };
      },
    },
  });
  assert.equal(mockBashResult.output, "mock result");
  assert.ok(
    sessionEvents.includes("bash_execution_update"),
    "AgentSession subscriber did not receive the local lifecycle event",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        pi: {
          package: packageMetadata.name,
          version: packageMetadata.version,
          gitHead: packageMetadata.gitHead ?? null,
        },
        session: {
          cwd,
          inMemory: true,
          model: {
            provider: session.model?.provider ?? null,
            id: session.model?.id ?? null,
            placeholderOnly: session.model?.provider === "unknown" && session.model?.id === "unknown",
          },
          initialActiveTools,
          reconfiguredActiveTools: session.getActiveToolNames(),
          callableTools: session.getCallableToolNames(),
        },
        extension: {
          kind: "inline factory",
          observedEvents: extensionEvents,
        },
        lifecycle: {
          observedSessionEvents: sessionEvents,
          source: "executeBash with mock BashOperations; no process or model invoked",
        },
      },
      null,
      2,
    ),
  );
} finally {
  unsubscribe();
  session.dispose();
}
