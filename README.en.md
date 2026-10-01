# LingNao — the audit gate for AI-computed numbers

[中文文档](README.md)

An agent or LLM produces numbers. Before anyone acts on them, they need a deterministic check — not another model's opinion. **LingNao is that check**: a fail-closed audit gate that returns one of three verdicts and nothing else.

```
agent / LLM produces numbers
        │
        ▼
   LingNao gate  ──verified──▶  continue & archive the proof object
        │
        ├──refuted──▶  stop, discard, fix the prompt
        └──unverified─▶  route to a human
```

**There is no fourth verdict.** No "probably fine", no confidence score.

- `verified` — a deterministic checker confirmed the claim (e.g. the claimed root is a certified real root).
- `refuted` — a deterministic checker disproved it.
- `unverified` — it honestly abstains when it cannot deterministically judge.

## Two ways to plug it in

### HTTP

```bash
curl -X POST https://hongchenlingjing.com/verify \
  -H "Content-Type: application/json" \
  -d '{"caseLabel":"invoice-check",
       "items":[{"id":"i1","kind":"algebraic",
                 "payload":{"equations":["x+2=5"],
                            "claimed":{"x":3}}}]}'
```

Response (measured, abridged):

```json
{
  "ok": true,
  "reportId": "7c7aff229293858f",
  "summary": { "verified": 1, "refuted": 0, "unverified": 0 },
  "kernel": { "deterministic": true, "offline": true },
  "items": [ { "verdict": "verified",
               "evidence": { "solutions": [ { "values": [3], "tier": "proven", "certified": true } ] },
               "proofObject": { "scope": "...", "limitations": "..." } } ]
}
```

Full integration guide with the verdict semantics and refusal policy: **[hongchenlingjing.com/verify/integrate.html](https://hongchenlingjing.com/verify/integrate.html)**

### MCP (stdio)

```bash
npx lingnao-mcp
```

One gateway tool `lingnao` (64 capabilities under the hood), for agent frameworks that speak MCP.

## What it refuses — by design

Medical, mental-health, education & training, investment or financial advice, and legal advice are refused with HTTP 422 (`compliance:true`). An audit tool must refuse what it cannot deterministically judge. Inside scope: everyday numbers, formulas, algebraic constraints, logic.

## Why not just ask the model again?

Asking the model again gives you a second opinion, not an audit. LingNao's kernel is deterministic and offline: same input, same verdict, with a proof object you can archive for `audit-ready` / `controls-compliant` workflows. Your payload is not stored.

## Licence

Non-commercial use (personal, study, teaching, non-profit internal) is **free**. Commercial use requires prior written licence — 广州市红尘灵境数字科技有限公司 (Guangzhou Hongchen Lingjing Digital Technology Co., Ltd.).
