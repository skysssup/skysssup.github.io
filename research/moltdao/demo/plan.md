# MoltDAO: interactive demo assessment

**Recommendation: no interactive demo.** Use the dashboard recording and the terminal captures in `visuals/`. Nothing in this repo runs honestly in a browser without a chain, and the one option that would (option 3) is mostly new glue code around a UI that only lets you fund and read.

## What the repo contains that could run in a browser

| Piece | Runs offline in a browser? | Why |
| --- | --- | --- |
| `web/` dashboard (index.html, app.js, html.mjs: 3.9 KB gzipped) | No | It needs a JSON-RPC endpoint, deployed contracts, and an EIP-1193 wallet. It also imports ethers 6.13.4 from cdn.jsdelivr.net at runtime. |
| `skill/moltdao.js` CLI | No | It's a Node CommonJS CLI. The pure parts are input validators (`requireProposalId`, `requirePositiveAmount`, `requireAddress`); everything else is RPC calls. |
| Contracts (`MoltGovernance` runtime: 9,031 B, `EqualSplitter`: 3,162 B, `MockUSDC`: 1,492 B, from `forge build --sizes`) | Only inside an EVM | The vote tally, quorum, and payout rules live in Solidity, so a JS re-implementation would not be the actual code. |

## Options considered

1. **Pre-computed replay of real outputs** (about 10 KB of JSON). Step through the local-chain scenario using the real CLI outputs saved during research: fund, propose, vote, execute, and the vote-recycling double count. This is honest, but it's a slideshow. The terminal blocks in `visuals/` already show the same content with less machinery. Verdict: not worth a separate demo.

2. **Validator playground** (under 5 KB). Expose the CLI's argument checks so visitors can type proposal IDs and amounts and watch them get rejected (`"12oops"`, `"01"`, `2^53`). This is real code, but it's trivial and says nothing about governance. Verdict: no.

3. **Real bytecode in an in-browser EVM, behind the real dashboard** (about 230 KB gzipped, measured below). Compile the actual contracts, run them in `@ethereumjs/vm`, and give the unmodified dashboard an EIP-1193 provider backed by that VM. Measured with esbuild (minified ESM, gzip -9):
   - `@ethereumjs/vm` 10.1.3 (`createVM`, `runTx`): 381 KB raw, **119 KB gzipped**
   - ethers 6.13.4 (the subset app.js imports): 244 KB raw, **93 KB gzipped** (today this loads from the CDN)
   - dashboard files: 3.9 KB gzipped, plus 15,025 bytes of contract initcode (9,434 + 4,070 + 1,521)

   The size fits the 300 KB budget, but the work does not pay off. The page would need a hand-written JSON-RPC layer (`eth_call`, `eth_estimateGas`, `eth_sendTransaction`, receipts, blocks, time travel to end a vote). That layer is new code, not repo code, and it's where subtle bugs would hide. The dashboard can only fund the treasury and list proposals. Proposing and voting happen in the Node CLI, so the interesting part of the experiment would still not be interactive. Verdict: feasible, but not recommended.

## If Aakash wants one anyway

Option 3, scoped to: deploy the scenario at page load (3 agents, 3 proposals, as in the captures), let the visitor fund the treasury from the real dashboard, and add one scripted button that replays the vote-recycling transfer so the yes count visibly exceeds the USDC held. Expect 1 to 2 days of work for the RPC shim and its tests. Label the page as a simulation running the real bytecode.
