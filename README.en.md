# LingNao · Deterministic Reasoning Engine

[中文文档](README.md)

> **LingNao is a deterministic reasoning engine for all agents and robots — it does NOT verify, does NOT audit, it only reasons.**
> It sits at the intersection of three frontiers: **deliberate planning** (A*/MCTS), **causal inference** (do-calculus), and **neuro-symbolic determinism** (no neural net → no hallucination, fully reproducible).
> No "probably right" — only "right / wrong / can't (honest abstain 𝕌)".
> Ships as **MCP stdio (`npx lingnao-mcp`) / web playground / Node library**. Zero dependencies · non-commercial free, commercial by agreement.

- Repo: `genesis-plan/lingnao` · npm: `lingnao-mcp` · Try: [playground](https://hclj-1409755229.cos.ap-guangzhou.myqcloud.com/lingnao/playground.html) ／ [console](https://hclj-1409755229.cos.ap-guangzhou.myqcloud.com/lingnao/lingnao-console.html)

| | Notes |
|---|---|
| **Is** | A **deterministic reasoning engine**: symbolic reasoning over planning, causality, world models, and mathematical soundness; identical input → identical output; honestly returns 𝕌 when undecidable |
| **Is not** | A language model, a verifier, an auditor, a "provably safe" prover, a general theorem prover (Coq/Lean), or a verification/adjudication layer |

## Positioning (root purpose)

LingNao is a **reasoning substrate** — concretely the **deterministic reasoning engine** for autonomous agents and robots: it reasons about planning, causality, and world models so that every step an agent takes is *thought-through correctly, explainable, and not confabulated*. It does **not** verify, audit, or adjudicate other agents' decisions. Division of labour: **LingShu = computation (numerical solving); LingNao = reasoning (pure inference)**.

## Five reasoning frontiers

| # | Frontier | Academic anchors | LingNao capabilities |
|---|---|---|---|
| ① | **Deliberate planning** | A*/RSG; MCTS (Kocsis & Szepesvári 2006, UCB1); deterministic MCTS; delete-relaxation admissible heuristic | `reason`(A*+RSG) · `dmcts` · `plan_task` · `h_max` · `goal_directed` · `execute_task` |
| ② | **Causal inference** | Pearl's ladder; do-calculus (back/front-door, Shpitser & Pearl 2006); counterfactual 3-step | `causal`(PC-lite+do) · `causal_effect`(ACE) · `counterfactual` |
| ③ | **Uncertainty theory** | PAC learning (Valiant 1984); VC-dimension sample bound m ≥ (d_VC·ln(1/ε)+ln(1/δ))/ε² | `pac_bound` |
| ④ | **Mathematical soundness stress-tests** | Baire category (1899) · compactness/Heine-Borel · algebraic variety/Zariski · van der Waerden (1927) · Cauchy-Lipschitz/Picard-Lindelöf · Bertrand's postulate (Chebyshev 1852) · Pigeonhole (Dirichlet 1834) · Hall's matching (1935) · Erdős–Szekeres (1935) · Euler path (1736) | `baire_trap` · `compactness_trap` · `variety_trap` · `van_der_waerden_trap` · `cauchy_lipschitz_trap` · `bertrand_trap` · `pigeonhole_trap` · `hall_trap` · `erdos_szekeres_trap` · `euler_path_trap` · `run_deterministic_traps` |
| ⑤ | **World model / counterfactual / metacognition / self-evolution** | SEM + Pearl counterfactual framework; knowledge entropy H(K)/consistency; experience-base lifecycle | `world_model` · `perceive_belief`(Bayesian+Banach) · `meta` · `knowledge_*` · `sl_record`/`sl_discover`/`sl_monitor`/`sl_status` · `ima_load`/`ima_query` |
| ＋ | **Embodied decision** | declarative capability contract; plan→execute→SAFE-STOP→bounded-replan | `attach_body` · `get_state`/`set_state`/`state_diff` · `positioning` · `carrier_report` |

> **Method & theorem basis:** the precise method, every theorem cited above, and the per-`op` mapping are documented in [docs/00-推理引擎原理与方法学.md](docs/00-推理引擎原理与方法学.md). That doc is the mathematical ground that lets LingNao serve *any* agent deterministically.

## 30-second start

**① MCP (recommended)** — no server, no local install:
```json
{ "mcpServers": { "lingnao": { "command": "npx", "args": ["github:genesis-plan/lingnao"], "env": { "OPENROUTER_API_KEY": "your free key (optional)" } } } }
```
npm stable: `{ "command": "npx", "args": ["-y", "lingnao-mcp"] }` (see `mcp.json`).

**② Zero-install web** — double-click `playground.html` (A* planning + causality + soundness traps, offline), or `lingnao-console.html`.

**③ Developer**
```bash
git clone https://github.com/genesis-plan/lingnao && cd lingnao
node lingnao-mcp.js --selftest      # zero-dependency self-test
node build-umd.js                   # rebuild UMD from the real kernel source
```

## Capability boundary (honest)

| Dimension | Notes |
|---|---|
| Decision/planning | A* optimal path + hard/soft constraints + RSG; System-1 high-confidence fast path; **identical input → identical output** |
| Causality | do-calculus (back/front-door) effect estimation, counterfactual inference; deterministic causal graph, no LLM fabrication |
| Soundness | ten deterministic traps (Baire/compactness/variety/van der Waerden/Cauchy-Lipschitz/Bertrand/Pigeonhole/Hall matching/Erdős–Szekeres/Euler path), guaranteed by real theorems |
| No hallucination | LLM only at perception (NL→JSON) and explanation, forced `UNVERIFIED_LLM` + `mayHallucinate`, **never in the reasoning chain** |
| Embodied | declarative capability contract; plan → SAFE-STOP → execute → bounded replan loop |
| Tool exposure | **1 gateway tool `lingnao`** (`op` parameter, reasoning sub-capabilities: planning / causality / soundness / embodied decision); LingNao = reasoning-only, no calculation |
| Self-test | `--selftest` → core pass + 6 honestly-disclosed unimplemented (KB not attached) |
| Dependencies | zero third-party runtime deps; LingNao = reasoning-only, **no calculation engine attached or delegated** (equation solving/verification belongs to LingShu lingshu-solver, a separate product) |

**Not guaranteed**: absolute safety, absolute correctness, completeness, connectivity to all real hardware. These are honest design boundaries, not defects.

## Reasoning capabilities (single gateway `lingnao`, `op` dispatch)

`world_info` · `set_world` · `perceive` · `reason` · `carrier_report` · `learn` · `knowledge_query` · `knowledge_add` · `meta` · `perceive_belief` · `knowledge_ann` · `knowledge_distill` · `cog_graph` · `world_model` · `counterfactual` · `causal_effect` · `dmcts` · `goal_directed` · `pac_bound` · `ask` · `explain` · `causal` · `event_publish` · `knowledge_fabric` · `ima_load` · `ima_query` · `sl_record` · `sl_discover` · `sl_monitor` · `sl_status` · `attach_body` · `capabilities` · `get_state` · `set_state` · `state_diff` · `h_max` · `plan_task` · `execute_task` · `positioning` · `bertrand_trap` · `compactness_trap` · `van_der_waerden_trap` · `baire_trap` · `variety_trap` · `cauchy_lipschitz_trap` · `pigeonhole_trap` · `hall_trap` · `erdos_szekeres_trap` · `euler_path_trap` · `run_deterministic_traps`

## Two separate products (do not confuse)

| Product | What it is | Repo | npm |
|---|---|---|---|
| **LingNao** (this) | **reasoning engine**: perception / planning / causality / world model / soundness / embodied decision | genesis-plan/lingnao | lingnao-mcp |
| **LingShu** | **solver**: real roots of equation systems (interval contraction + Krawczyk) | genesis-plan/lingshu-solver | lingshu-solver |

LingNao = **reasoning-only**: perception / planning / causality / soundness / embodied decision — no calculation, no solving, no delegation. Equation solving/verification belongs to **LingShu lingshu-solver** (separate product); the two are decoupled and never delegate to each other.

## License (summary)

**Non-commercial free + commercial by written agreement** (own "LingNao Commercial License Agreement", **not an open-source license**):
- Non-commercial free: personal study / research / teaching / evaluation; non-profit & educational internal use; teams with annual revenue ≤ ¥1M (≤ 3 instances). Copyright & license notice must be retained.
- Commercial use requires prior written agreement: any for-profit product/service, SaaS/cloud/API exposure (paid or not), embedding in commercial distribution, redistribution/resale.
- "LingNao / 灵脑" is a trademark; this license grants no trademark rights.

Full terms: [LICENSE](LICENSE) ｜ commercial: [docs/06-商业授权与收费.md](docs/06-商业授权与收费.md)

## Contact

- Business / license / feedback: 553420544@qq.com (or repo Issues)
- Copyright: Guangzhou Hongchen Lingjing Digital Technology Co., Ltd.

## Honest notes (known follow-ups)

- `knowledge_query` / `knowledge_add` / `knowledge_ann` / `knowledge_distill` / `cog_graph` need the KB attached; return `available:false` until then.
- Of 30 physical-access protocols, only `ws` / `modbus-tcp` / `mqtt` have real drivers; others are filed-only.
- `docs/` 01–11 still use the old "audit/verify" wording and need a sync pass (follow-up).
- Verification/audit capabilities (`audit`/`certify`/`verify`/`prove`/`runtime_monitor` …) have been **removed from the public gateway** — LingNao reasons only, it does not verify or audit.
