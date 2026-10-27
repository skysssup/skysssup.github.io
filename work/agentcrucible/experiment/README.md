# Refund experiment provenance

Built from [AgentCrucible commit adde7cb](https://github.com/skysssup/agentcrucible/commit/adde7cb), using its `src/browser-refund.ts` entry point.

Reproduce in that checkout:

```sh
npm ci
npm run build
npm run build:demo
```

Copy `dist/demo/browser-refund.js` to `engine.js` and `dist/demo/refund-scenario.json` to `scenario.json`. The scenario's source field is normalized to a repository-relative path. `test/browser-refund.test.ts` checks parity with `runScenario`, and the portfolio browser test checks actual execution and export.

The engine contains the real payment world, scripted agents, fault schedule, harness, and grader. It does not call a model or a live payment provider. The page offers alternate faults; reference expected verdicts are retained only for the original timeout scenario.

SHA-256:

```text
7840deec488e2230cac7ce7edfbe004218b8c87f034f9cc558f67892e94022d5  engine.js
7a1b9dff260a1e5dbb994f0cd545b3fea896f690535fc95c7097b12b9403fb07  scenario.json
```
