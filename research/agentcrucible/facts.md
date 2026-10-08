# AgentCrucible case-study evidence

Checked 8 October 2026 against public source commit
[`475e5c0c76e6496fb21c3210aa1ef70cc6eace78`](https://github.com/skysssup/agentcrucible/commit/475e5c0c76e6496fb21c3210aa1ef70cc6eace78).
This supersedes earlier project descriptions. Package version at this commit is
2.1.0; GitHub's latest published release at this check is v1.0.0. The page gives
source-build commands instead of linking to an unverified 2.1.0 release tarball.

## Claim sources at the pinned commit

- `package.json`: Node >=22.12.0; TypeScript; the single runtime dependency is
  `yaml`; CLI and library exports; build and verification commands.
- `src/registry.ts`: five built-in worlds (payments, database, email, tickets,
  filesystem). `src/faults.ts`: fourteen built-in faults with before/after/twice
  stages and seeded call selection.
- `src/harness.ts`: separate committed result and agent observation, per-call
  snapshots, fresh/reset worlds, task and tool schemas, and final answer.
- `src/grader.ts`, `src/expect.ts`, `src/answer.ts`, `docs/grading.md`: six
  verdicts; explicit expectations for SAFE_SUCCESS; evidence-bearing findings;
  invariants, recovery paths, and the limitations of answer keyword rules.
- `src/replay.ts`, `docs/traces.md`: recorded-call replay without invoking the
  agent, comparison of observations and states, regrading, deterministic-world
  and extension requirements. JSON, HTML, Markdown and JUnit reports.
- `docs/sweeps.md`, `docs/model-agents.md`, `docs/mcp.md`, `docs/ci.md`: sweep
  semantics, recorded model responses, provider adapters, stdio MCP, and
  regression baselines. Fresh model calls require the configured provider.
- `src/ui/workspace.ts`, `docs/ui.md`: local history stores summaries;
  historical reports are regenerated and checked for agreement. Server uses
  loopback by default and a session token; browser assets are served locally.
- `README.md`, `src/ui/demo-workspace.ts`: Northwind is fictional and its
  historical timeline is generated. The scenarios use the actual engine.
  Screenshots are demonstrations, not customer or production measurements.
- `.github/workflows/ci.yml`: build, typecheck, tests, docs/package verification
  on Node 22 and 24; schema consistency and reusable-action checks.
- `README.md` limitations: in-memory worlds without real latency, concurrency,
  or partial writes; limited answer parsing; explicit checks for facts beyond
  amounts; fresh model variability. Future directions on the page are proposed
  validation work, not claimed current features.

## Media provenance

- `work/agentcrucible/media/console.png`: unchanged copy of
  `docs/images/ui-overview.png` at the pinned source commit (1440 × 900).
- `work/agentcrucible/media/report.png`: unchanged copy of
  `docs/images/ui-report.png` at the same commit (1440 × 900).
- The existing `overview.mp4` and `overview-poster.webp` remain as an explicitly
  labeled earlier CLI recording with four strategies. The current demo has five.
- Architecture diagram is a simplified execution path derived from the harness;
  its caption and accessible text also identify scenario and answer inputs to
  the grader.

## Verification performed

- Clean source checkout: `npm ci` and `npm run build` succeeded.
- `node dist/cli.js demo`: all five expected strategy verdicts matched.
- `node dist/cli.js faults --ids`: fourteen fault kinds.
- `node dist/cli.js check --tag smoke`: 37/37 expectation checks passed, five
  trials each with default seeds.
- Ran `payments/timeout-after-commit` with `idempotent-retry`, saved its report,
  and replayed it: two calls, world states, and SAFE_SUCCESS verdict matched.
- Source CI at the pinned commit:
  [Build and test, successful](https://github.com/skysssup/agentcrucible/actions/runs/37408328510).
- Site generator and share-card renderer completed. All 97 existing site unit
  and content checks passed, including generated-page consistency, local links,
  media usage, figure numbering, and current share-card fingerprints.

No paid model API call was made for this verification.
