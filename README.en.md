# LingNao — AI number verification API

[中文文档](README.md)

Your AI computes numbers. LingNao **recomputes them independently** — no second model, no confidence scores — and returns one of three verdicts: **verified / refuted / unverifiable**. A fail-closed verification API, ~3 ms per call.

```
agent / LLM produces numbers
        │
        ▼
   LingNao API  ──verified──▶  continue & archive the proof id
        │
        ├──refuted──▶  stop, discard, fix the prompt
        └─unverified─▶  route to a human
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

Medical, mental-health, education & training, investment or financial advice, and legal advice are refused with HTTP 422 (`compliance:true`). A verification service must refuse what it cannot check. Inside scope: everyday numbers, formulas, algebraic constraints, logic.

## Why not just ask the model again?

Asking the model again gives you a second opinion, not a verification. LingNao's kernel is independent and offline: same input, same verdict, with a proof id you can archive for audit-ready workflows. Your payload is not stored.

## Pricing

Browser playground is free. Hosted API: self-service key, ¥0.01 per call — [hongchenlingjing.com/pay/en.html](https://hongchenlingjing.com/pay/en.html).

## Licence

Non-commercial use (personal, study, teaching, non-profit internal) is **free**. Commercial use requires prior written licence — 广州市红尘灵境数字科技有限公司 (Guangzhou Hongchen Lingjing Digital Technology Co., Ltd.).
