# Three projects, five minutes

Lead with AgentCrucible, then AirForge, then Shipgate. Each demonstration produces something inspectable: an agent trace, a motion recording, or a policy decision. Open the pages and run the examples before presenting.

## 0:00–2:00 — AgentCrucible

[Project and live experiment](https://skysssup.github.io/work/agentcrucible/) · [Source](https://github.com/skysssup/agentcrucible)

“A payment service can refund someone and then time out. An agent only sees the timeout. Retrying can pay twice, and claiming success can hide what actually happened. I test recovery by comparing tool observations, committed state, and the final answer.”

Run the five strategies with the timeout-after-commit fault. Open `naive-retry` and point to the two refund records. Compare `idempotent-retry` and `cross-checker`, then download the evidence. The public experiment calls the same harness and grader as the CLI; a test compares their traces and verdicts.

The engineering point: fault timing and intermediate effects matter. The limit: these are deterministic mock services and scripted strategies. Northwind's surrounding history is fictional; it is not customer usage or production model reliability.

## 2:00–3:30 — AirForge

[Case study](https://skysssup.github.io/work/airforge/) · [Application](https://skysssup.github.io/airforge/) · [Source](https://github.com/skysssup/airforge)

“A drawn stroke becomes a collider. The hard part is making the interaction understandable and the examples behave as described.”

Open Ramp & Ball, enable Motion, and Drop. Record the motion, stop, and export CSV. Explain the fixed 1/120-second physics step and the separate, slower measurement sampling. Pause adds no duplicate timestamps; Restart stops the recording while preserving its data.

The engineering point: use the same collider layout in the browser and headless physics tests. The limit: one plane, static tracks, and a small scene; webcam testing has used a simulated camera rather than broad physical-device validation.

## 3:30–4:45 — Shipgate

[Case study](https://skysssup.github.io/work/shipgate/) · [Source](https://github.com/skysssup/shipgate)

“A coding agent needs an explicit boundary before it commits and pushes. That boundary should inspect what Git will commit and explain its decision.”

Run the local simulator from the source checkout. Compare the database-password example with an exact placeholder template. Show the rule, redacted finding, and Block outcome. Explain that the real CLI scans staged blobs and uses an explicit remote lease for undo. The simulator shares the planner but does not modify Git.

The engineering point: preserve the distinction between a local commit and a failed push. The limit: pattern matching cannot prove a repository has no secrets, and policy approval cannot prove code correctness.

## 4:45–5:00 — Close on evidence

“Each project has a runnable failure or experiment, source you can inspect, and tests tied to its claims.”

When discussing authorship, distinguish the work you can personally explain from generated code, automated dependency updates, and any collaborators' contributions. Demonstrations and tests establish behavior; adoption and usefulness need separate evidence from real users.
