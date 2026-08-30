# LingNao Brain — Review Brief

**A small, deterministic, auditable reference implementation of the "Embodied Brain" contract**

---

## What this is

LingNao Brain is a **pure cognitive engine**: perception → world graph → reasoning → audit → metacognition.
It holds **no built-in knowledge base, no assumed physical body, and no built-in generative LLM**.
All "knowledge" (world graph + hard/soft constraints) is supplied **externally** by the body or the integrator.

An LLM can be plugged in as a **pluggable input-understanding adapter** only (PERCEPTION tier, explicitly flagged `mayHallucinate`, never enters the proof chain).

## Why it may interest you

Your roadmap (arXiv 2607.11689, *From World Action Models to Embodied Brains*) proposes **Embodied Brain + Physical Harness**, where the brain issues **state-transition / capability requests rather than direct actuator commands**, mediated by explicit contracts.

This is a **working minimal implementation of exactly that contract** — small, non-learning, but it runs:

- The brain emits **plans + constraints only**. It never commands actuators.
- Two **heterogeneous robots** (a warehouse mover with a hazard-zone hard constraint; an inspection drone with a no-fly-zone hard constraint) were plugged into the **same brain instance**. Integration test: **13/13 pass**.
- **Body-agnosticism proven**: after serving robot B, switching back to robot A yields a plan identical to the first run — the brain retains **no robot state**.
- When a robot reports a **fact that deviates** from the brain's conjecture, the brain **revises the conjecture toward the fact**:
  - scalar beliefs via a **Banach contraction** `T(b)=α·o+(1−α)·b`, `L=1−α<1` (unique fixed point = the fact; geometric contraction);
  - distributional beliefs via **minimum cross-entropy I-projection** `q* = argmin_{q∈C} D_KL(q‖p)` (reduces to the Bayes posterior).
  - Measured: edge probability `1 → 0.541` after a robot reports `0.3`.

## Honest limitations (please read before judging)

This is **not SOTA**, and I would rather state the gaps than have you find them:

1. **No learning.** It revises beliefs; it does not learn models. Your roadmap's closed-loop post-training is absent — this is a **generational gap**, not an engineering gap.
2. **`lite` verification.** Hoare path checking is structured per-edge verification (**not** Coq); symbolic solving is a hand-written constraint solver (**not** Z3); causal discovery is a PC-lite discrete approximation (**not** real PC/FCI); ANN is SimHash (**not** Milvus). All run, all honest, none industrial.
3. **Self-generated audit.** The seven-segment audit is produced by the brain itself. Per Illinois SB315 (2026) and standard practice, **self-grading is not auditing** — independent third-party reproduction has **not** been done.

Also stated plainly: "non-hallucination" covers the **KERNEL computation**, **not** the truth of PERCEPTION inputs. A hallucinated perception can propagate through the world graph into a deterministic plan. This boundary is a real gap, not a decoration.

## Reproduce it yourself

```bash
# kernel syntax check
node -e "const fs=require('fs');const h=fs.readFileSync('灵脑.html','utf8');\
const m=h.match(/\/\/ ==KERNEL START==[^\n]*\n([\s\S]*?)\n\/\/ ==KERNEL END==/);\
fs.writeFileSync('/tmp/k.js',m[1]);" && node --check /tmp/k.js

node build-umd.js        # rebuild UMD (75 exports)
node selftest-umd.js     # SELFTEST-UMD OK (offline / with OPENROUTER_API_KEY)
node test-robot-integration.js   # the two-robot integration test: 13/13
```

Kernel: `灵脑.html` (~2,400 lines, single source of truth; UMD is extracted from it).
Deterministic: fixed `ALGO_VERSION`, no random seed — the same audit reproduces.

## The one question I am asking

> It is small and it does not learn. Given that, **what is missing to make this contract real** — is the gap the standardized contract (capability-request vocabulary, trace cards), the learning loop, the verification stack, or something structural I am not seeing?

I am specifically inviting falsification of three claims:

1. **The non-hallucination boundary** — can a PERCEPTION hallucination survive `reconcile` and corrupt a plan?
2. **Body-agnosticism** — is the "no robot state" property robust, or does it break under a body I have not imagined?
3. **Belief revision** — Banach / KL convergence holds **relative to the given world graph**; if the graph is wrong, what remains guaranteed?

---

*Contact / code: [to be added before sending].*
*Status: not yet pushed to a public repository; not published to npm. Released for review on request.*
