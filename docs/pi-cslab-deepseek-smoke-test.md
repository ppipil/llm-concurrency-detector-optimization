# Pi Mono + CSLab DeepSeek M1 Smoke Test

## Status

**M1d: PASS**  
**M1 overall: PASS**

Observed on 2026-10-06 using a real CSLab request and real Pi SDK tool execution. This is an environment and tool-loop smoke test, not a performance experiment and not part of M2.

The run met every M1d acceptance condition:

- Pi connected to CSLab DeepSeek through the OpenAI-compatible API.
- The real model produced tool calls.
- Pi executed `read`, `grep`, `edit`, and `bash`.
- The model changed project source code rather than the test.
- The Pi-driven test and a separate controller-driven verification test both passed.
- No mock model or mock tool was used.

## Environment and Configuration

| Item | Observed value |
|---|---|
| Operating system | Native Windows (`win32`) |
| Node.js | v22.22.0 |
| Pi package | `@earendil-works/pi-coding-agent` 1.0.3 |
| Provider ID | `cslab` |
| API protocol | `openai-completions` |
| Base URL | `https://llm.cs.cityu.edu.hk/v1` |
| Model | `CS/DeepSeek-V4-Flash-FP8` |
| API key source | `process.env.CSLAB_API_KEY` |
| Pi command shell | `D:\pp\app\Git\bin\bash.exe` |
| Session storage | In memory |
| Pi thinking level | `off` |

The API key was passed to Pi as an in-memory runtime credential. Its value was not printed, stored in the repository, or written to evidence files.

The custom provider was registered programmatically for this smoke test. The model metadata used Pi's compatible-endpoint defaults of a 128,000-token context window and 16,384 maximum output tokens; these limits were not independently verified against the CSLab server and must not be treated as measured service limits.

## Smoke-Test Repository

The isolated repository was reused from:

```text
workspaces/m1-smoke
```

Initial revision:

```text
65ae3d5e7900599468d6ae85bcb4cf880d8a07fb
```

The repository was clean before the run. Its committed fixture contained one deliberately failing test:

```javascript
assert.equal(greet("Ada"), "Hello, Ada!");
```

while the source returned:

```javascript
return `hello ${name}`;
```

The controller ran the unchanged baseline before starting Pi:

| Check | Result |
|---|---|
| Command | `npm test` through native `cmd.exe` |
| Exit code | 1 |
| Elapsed time | 587 ms |
| Expected state | One failing test |

## Agent Task

The real model received this instruction through `AgentSession.prompt()`:

> Read `TASK.md`, use `grep` to locate `greet`, read the relevant file, edit or write the source fix, and use `bash` to run `npm test`. Stop only after reporting the real test result.

The active Pi tools were:

```text
read, grep, edit, write, bash
```

`write` was available but was not needed.

## Actual Tool Sequence

The event stream recorded the following real Pi tool calls:

| Sequence | Approx. start | Tool | Main input | Result |
|---:|---:|---|---|---|
| 1 | 6.249 s | `read` | `TASK.md` | Success |
| 2 | 6.250 s | `grep` | Pattern `greet` | Success |
| 3 | 13.447 s | `read` | `src/greeting.js` | Success |
| 4 | 13.447 s | `read` | `test/greeting.test.js` | Success |
| 5 | 24.287 s | `edit` | Replace the return expression | Success |
| 6 | 28.909 s | `bash` | `npm test` | Success |

The first `read` and `grep`, and later the two source/test reads, were issued in parallel batches by the model. Pi executed and reported all six tool results without tool errors.

## Source Modification

Only `src/greeting.js` was modified:

```diff
-  return `hello ${name}`;
+  return `Hello, ${name}!`;
```

`test/greeting.test.js` had no diff. The final worktree status was:

```text
 M src/greeting.js
```

## Test Validation

### Pi-driven test

The real model invoked Pi's `bash` tool with:

```text
npm test
```

Observed result:

```text
# tests 1
# pass 1
# fail 0
```

Pi reported the `bash` tool result as successful.

### Independent controller verification

After the Agent session ended, the controller independently ran the same test through native Windows `cmd.exe`.

| Field | Observed value |
|---|---|
| Exit code | 0 |
| Tests | 1 |
| Passed | 1 |
| Failed | 0 |
| Controller elapsed time | 648 ms |
| Node test-runner duration | 96.1604 ms |

This independent run confirms the result without relying on the Agent's natural-language report.

## Timing and Usage

| Metric | Observed value |
|---|---:|
| Agent loop elapsed time | 36,440 ms |
| User messages | 1 |
| Assistant messages | 5 |
| Tool calls | 6 |
| Tool results | 6 |
| Input tokens | 4,196 |
| Output tokens | 355 |
| Cache-read tokens | 4,608 |
| Cache-write tokens | 0 |
| Total accounted tokens | 9,159 |

CSLab returned token usage successfully through the OpenAI-compatible streaming responses. Monetary cost is unavailable: the local custom-provider entry deliberately uses zero price metadata because no verified CSLab pricing was supplied. The resulting Pi `cost: 0` must not be interpreted as evidence that the request was free.

## Compatibility Findings

### Pi and CSLab

No blocking Pi/CSLab compatibility issue was observed in this run:

- OpenAI-compatible streaming completed successfully.
- DeepSeek returned valid tool calls.
- Parallel tool calls were handled correctly.
- Tool results were accepted in subsequent model turns.
- The Agent stopped normally after the successful test.
- No retry was needed.

### Native Windows controller

The first controller preflight failed before any model request because Node.js returned `spawn EINVAL` when `npm.cmd` was launched directly with `shell: false`. The controller was corrected to invoke `npm.cmd test` through native `cmd.exe /d /s /c`. The subsequent real Agent run passed. This is a Windows process-launch issue in the smoke-test controller, not a Pi/CSLab protocol failure.

Git Bash remained necessary for Pi's built-in `bash` tool. Its non-standard installation path was supplied explicitly through the in-memory Pi settings.

## Preserved Evidence

Raw evidence for the successful run is stored locally under the ignored directory:

```text
results/raw/m1d/20261006T074552.973Z/
├── events.jsonl
└── summary.json
```

`events.jsonl` contains lifecycle events, exact tool order, sanitized tool arguments, tool outcomes, stop reasons, and per-response usage. `summary.json` contains the environment metadata, repository revision, baseline result, session statistics, source diff, test-file diff, final source, and independent test output.

The earlier controller-only failure is retained separately at:

```text
results/raw/m1d/20261006T074531.652Z/summary.json
```

Neither evidence directory contains the API key.

## Reproduction

Prerequisites:

- Native Windows
- Node.js 22.19 or later
- Git Bash
- `CSLAB_API_KEY` present in the launching process
- A clean `workspaces/m1-smoke` checkout at the recorded fixture revision

Run:

```powershell
npm run smoke:pi-cslab
```

The controller implementation is `scripts/research-controller/pi-cslab-tool-loop.mjs`.

## M1 Conclusion

| Milestone | Result |
|---|---|
| M1a — Pi CLI on Native Windows | PASS |
| M1b — Pi SDK probe | PASS |
| M1c — CSLab API connectivity | PASS |
| M1d — Real Pi + CSLab tool loop | PASS |

Therefore, **M1 overall is PASS**. This conclusion covers environment and minimum Agent-loop feasibility only; it does not claim performance-optimization effectiveness and does not start M2.
