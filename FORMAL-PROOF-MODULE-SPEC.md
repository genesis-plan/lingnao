# 灵脑形式化证明模块 —— 最小可执行规格（M1 / M2 / M3）

> 落地面：内核 `灵脑.html`（单一真源）。实测日期 2026-09-03。
> 口径：本文档只陈述**已被机器检验**的部分。未被机器检验的一律标"未证明 / 待办"，不包装成结论。

---

## 0. 一句话结论

灵脑此前**没有任何机器可检验的形式化证明**——有的是"确定性"（无 LLM 概率采样）、"可审计性"（签名哈希链，属完整性而非正确性）、"近似安全验证"（lite 浮点）。

本次落地的 **M2 数值安全证书**是灵脑**第一处真正的机器可检验证明**：它用灵数求解器**严格证明"某盒式域内不存在使安全不变式为负的状态"**——这是单点浮点判定永远做不到的。

同批落地的 **M1 能力/意图门控证明**把 `execute()` 里"隐含在控制流中的 if"提升为**显式门控规格表 + 零副作用预检器**，并证明性地在「释放任何指令前」拦截——把"先执行再停机、副作用不回滚"（部署陷阱⑦）改成**零释放停机**。它证的不是执行结果正确，而是**门控链的静态可判定部分**。

---

## 1. 诚实清单：证明了什么 / 没证明什么

| 项 | 状态 | 说明 |
|---|---|---|
| 确定性执行（不幻觉） | ✅ 工程属性 | vm 抽内核实跑、零依赖、无概率采样。**不是数学证明**，确定性 ≠ 正确 |
| 可审计性 | ✅ 密码学完整性 | 签名审计账本（HMAC 单写者哈希链）。证"轨迹未被篡改"，**不证"决策正确"** |
| **安全不变式的全域成立** | ✅ **已可机器证明**（M2，本次新增） | 灵数 Krawczyk **证明无实数解** ⇒ 域内 h ≥ 0 恒成立 |
| 安全不变式的违反检出 | ⚠️ 候选反例 | 欠定系统给出"候选"反例（非 Krawczyk 认证解），需回代校验 |
| Hoare 三元组证明 | ❌ lite | `verifyHoarePath` 仍是 `lingnao-hoare-lite`，**未**形式化 |
| BrainTuple 逻辑命题 | ❌ 未证明 | 属 Coq / Lean / TLA+ 范畴，本模块不覆盖 |
| **execute() 门控链的静态部分**（M1） | ✅ **已可机器证明**（M1，本次新增） | `proveGateChain`：8 条守卫谓词，静态部分给出 `provably-blocked:zero-release` / `after-j` / `conditional`，**零副作用**，与真实执行器实测一致 |
| execute() 运行时守卫（G5..G8） | ❌ 诚实标 `conditional` | 依赖 `state_i`（执行历史的函数），静态预检判定不了 ⇒ 定理 M1.3 明说不给 `provably-admitted` |
| execute() 的"意图绑定" | ⚠️ 结构化，非密码学 | `G0.intentBound` 校验 `step.intentId` 与 `opts.intent.id` 一致 + 审计入链；**不引入新密码学**，完整性由既有签名账本负责 |
| "数学上不可越狱" | ❌ **禁止声称** | 哥德尔不完备 + 图灵完备 + 外部副作用，任何系统都不成立 |

---

## 2. M1 能力/意图门控证明 —— `proveGateChain`

### 2.1 它解决什么：越狱攻击面不在状态空间，在 `execute()` 的能力执行层

那份第一性原理 spec 全文围绕抽象状态 `S` 与安全集 `S_safe` 展开，但灵脑**真实的危险面**是
`execute()`：哪些能力被放行、在什么时刻被拦、拦之前已经发生了什么。原实现把守卫链放在
`while` 循环内逐条判定，而其中 **G0..G4 五个谓词不依赖执行后状态**（纯静态）⇒
结果是「先执行 `step_0..step_{j-1}`，才在第 j 步停」——副作用已发生且**内核不回滚**（部署陷阱⑦）。

M1 把这层从"隐含在控制流里的 if"提升为**显式门控规格表 + 零副作用预检器**，
并在「释放任何指令前」执行 ⇒ 释放数恒为 0。

### 2.2 门控规格表 `GATE_SPEC`（8 条谓词）

| 守卫 | 静态可判定 | 模式 | 对应 haltReason | 说明 |
|---|---|---|---|---|
| **G0.intentBound** | ✅（仅 `opts.requireIntent` 开时） | halt | `UNBOUND-INTENT` | 步骤绑定意图且与 `opts.intent.id` 一致（文档 T1 意图-行为不可分） |
| **G1.registered** | ✅ | halt（`preempted`） | `unknown-capability` | 能力已注册；已被前置守卫覆盖 ⇒ **零释放** |
| **G2.notPerception** | ✅ | **throw**（`preempted`） | `FIREWALL_VIOLATION` | 步骤非 PERCEPTION 感知档（铁律③） |
| **G3.irreversible** | ✅ | halt | `IRREVERSIBLE-HALT` | 可逆，或已显式授权 `opts.allowIrreversible` |
| **G4.autonomy** | ✅ | halt | `HUMAN-IN-THE-LOOP` | 风险等级 ≤ 自主等级，或已人类授权 |
| G5.safeStop | ❌ 依赖 `state_i` | halt | `SAFE-STOP` | `checkHard`（依赖执行到该步时的状态） |
| G6.preApplicable | ❌ 依赖 `state_i` | halt | `pre-violated` | `applicable(...)`（同上） |
| G7.imprecise | ❌ 依赖包络 | halt | `IMPRECISE-UNCERTAINTY-HALT` | 端到端不确定性闸门 |
| G8.observation | ❌ 依赖观测 | halt | `OBSERVATION-BLIND-SPOT` | 执行结果可被观测区分 |

### 2.3 三条定理（均可被测试机器检验）

- **M1.1（零释放停机）**：若最小索引 j 使某**非 preempted** 静态守卫在 `step_j` 上为假，
  则 `execute()` 释放的指令数**恰为 j**。依据：循环内 G0/G3/G4 的判定严格位于 `bodyAdapter(...)`
  之前。开启前置守卫后**降为 0** —— 这 j 条副作用被完全避免。
- **M1.2（不可绕过）**：若 ¬G1 或 ¬G2 对任一步成立，则释放指令数 = 0
  （二者已实现为「释放任何指令前整段拒」的前置守卫）。
- **M1.3（诚实边界）**：G5..G8 依赖 `state_i`（执行历史的函数），静态预检判定不了 ⇒
  静态全通过时**只给 `conditional`，绝不给 `provably-admitted`**。这是能力边界，不是不安全。

### 2.4 接口与输出

```js
proveGateChain(plan, opts)   // 零副作用：不调 bodyAdapter、不改 state
// → { verdict, proof, blockIndex, blockingGate, haltReasonPredicted,
//     releasedPredicted, blockingMode, intentBound, gates[], tool }
```

| verdict | 含义 |
|---|---|
| `provably-blocked:zero-release` | 证明零释放停机（M1.2，或命中 preempted 守卫） |
| `provably-blocked:after-j` | 证明释放 j 条后停机（M1.1）；**开启前置守卫后为 0** |
| `conditional` | 静态全通过，但 G5..G8 依赖运行时状态 ⇒ 不证明全程放行（M1.3） |

### 2.5 行为变更（重要，部署须知）

`execute()` **默认开启**门控前置守卫（`opts.gateProof === false` 可显式关闭）：

| 计划 | 变更前 | 变更后 |
|---|---|---|
| `[move, send_email]`（不可逆未授权） | 先执行 `move`，第 2 步才停 | **零释放停机**（`move` 也不跑） |
| `[move, 高风险步, ...]` | 前面的低风险步先执行 | 整体零释放 |

这是**严格更安全**的变更：只会更早停，绝不会更晚停；停机语义等价，
`haltReason` 加前缀 `GATE-PROOF-PREEMPT` 并保留原原因。副作用差异已由测试 **E9 / E10 实测对照**
（开/关前置守卫分别释放 0 条与 1 条）。

### 2.6 诚实边界（M1）

- 证的是「**门控链的静态可判定部分**」，不是「执行结果正确」，更不是「不可越狱」。
- **G0 只做结构化意图绑定 + 审计入链，不引入新的密码学**；签名完整性由既有审计账本负责。
  意图绑定守卫同时写进了 `execute()` 循环内——否则关掉预检就失效，那是门面不是证明。
- 若调用方绕过 `execute()` 直接调 `bodyAdapter`，门控不生效：门控保护的是**经内核执行**的路径。
- `preempted` 标记（G1/G2）是**实测校准**的结果：初版断言 G1 命中 step_1 会释放 1 条，
  实测为 0 条（前置守卫已覆盖），已按实测修正为 M1.2。——断言必须与真实执行器一致。

---

## 3. M2 数值安全证书 —— `certifySafetyInvariant`

### 3.1 它解决什么：从「单点浮点判定」到「全域集合认证」

改造前 `cbfMargin` 的判据：

```js
safe: (hx >= 0) && (lhs + gamma * hx >= -1e-12)
```

它只看**当前状态这一个点**，并用 1e-12 容差兜。它回答"此刻安不安全"，**不回答"这个域里会不会出事"**，且不是证明。

M2 把它升级为**全域集合认证**：在给定盒式域内，是否存在任何使 h < 0 的状态？

### 3.2 数学原理（核心思想）

把**不等式安全验证**翻译成**方程无解判定**：

```
要证   ∀x ∈ 盒式域 D :  h(x) ≥ 0
⟺ 证  违反系统 { h(x) + s² = 0 ,  s·w = 1 }  在 D 内【无实数解】
```

- `s·w = 1` 强制 `s ≠ 0` ⇒ `h(x) = -s² < 0`，即"存在一个**严格**违反点"（边界 h = 0 不算违反）。
- 该系统**无解** ⇒ 域内不存在违反点 ⇒ **h ≥ 0 恒成立**。
- 灵数求解器能**证明无实数解**（`resultTypeName:'empty'`，引擎全局穷尽证无实根）——**浮点采样/单点判定永远做不到这一点**。

### 3.3 接口

```js
certifySafetyInvariant({
  hExpr:  '1 - (x^2 + y^2)',        // 必填：安全不变式【表达式字符串】
  vars:   ['x', 'y'],                // 必填：状态变量名
  domain: { x:[-0.5,0.5], y:[-0.5,0.5] },  // 可选：盒式域
  bound:  1000,                      // 可选：辅助变量域界（默认 1e6）
  options: {}                        // 可选：透传灵数 options
})
```

### 3.4 输出三档

| verdict | tier | 含义 |
|---|---|---|
| `verified` | `certified-krawczyk` | **真数学证明**：灵数证明域内不存在违反点，h ≥ 0 恒成立 |
| `violated` | `candidate-counterexample` | 域内存在 h < 0 的状态；返回 `counterexample` 供回代校验 |
| `unverified` | `lite-unverified` / `partially-explored` | 证不了。**不等于安全**，按 fail-closed 处理 |

### 3.5 硬约束（诚实边界，逐条）

| 约束 | 说明 |
|---|---|
| 只吃**方程字符串** | 内核 `cbfFilter`/`cbfMargin` 的 **JS 函数形态 h 不在灵数能力域** ⇒ 诚实返回 `unverified`，**绝不退回浮点假装认证** |
| 域为**盒式区间** | 灵数 `domain` 形态，不是任意半代数集 |
| 状态维数 ≤ 4 | 变量总数（状态 + s + w）受灵数 ≤ 6 上限 |
| 检出粒度 ≈ 1/BOUND² | `s·w = 1` 与辅助域界共同决定：bound=1000 ⇒ 可检出深度 ≥ 1e-6 的违反 |
| `violated` 是**候选**反例 | 欠定系统（2 方程 / n+2 变量），引擎标 `candidate` 而非 Krawczyk 认证；`residual` 是强证据但**不是认证** |
| 只证 h ≥ 0 类**代数不变式** | 不证 Hoare 三元组、不证 BrainTuple 逻辑（那是 Coq/Lean/TLA+ 的事） |

---

## 4. M3 三层次裁决引擎 —— `verdictThreeLayer`

对应形式化体系的「验证层次分离定理」，修掉"把计算超时误当逻辑不可判定"这一混淆。

| 层次 | 触发 | 策略 | 含义 |
|---|---|---|---|
| **逻辑层** | `logicDecidable: false` | `refuse`（拒绝执行） | 算力无法弥补逻辑不可判定 |
| **计算层** | `computeCompleted: false` | `degrade-conservative`（降级保守） | 申请更多预算或走保守策略 |
| **工程层** | `engineeringSupported: false` | `record-capability-limit`（记能力边界） | 是"**证不了**"，不是"不安全" |
| 三层均通过 | — | `proceed` | `verdict:'verified'` |

**诚实关键**：`unverified ≠ unsafe`。证不了就停（fail-closed），但绝不把"证不了"说成"已证安全"。

---

## 5. 路由与 fail-closed

`cbfMargin` 增加可选认证路径（**不改默认行为**）：

- **默认**（不传 `hExpr`）：保持原单点浮点判定，但返回 `tier:'lite-float'`，**诚实标注这不是证明**。
- **传 `hExpr` + `vars` + `domain`**：并行走全域认证。
  - `verified` ⇒ `verifiedSafe = true`
  - `violated` ⇒ **强制 `safe = false`**（fail-closed 覆盖单点浮点的"此刻安全"结论）
  - `unverified` ⇒ `verifiedSafe = false`，并在 note 明示"结论仅基于单点浮点，非证明"

---

## 6. 实测实据（2026-09-03）

| 项 | 结果 |
|---|---|
| `test-gate-proof.js`（M1） | **41 通过 / 0 失败** |
| `test-formal-proof.js`（M2/M3） | **18 通过 / 0 失败**（2.1 秒） |
| 内核 boot 三件套 | `verifyLedger=true` `firewall=true` `auditLedger=true` |
| 全套回归 | **215 通过 / 0 失败**（11 套测试） |

**M2 关键用例**

- `h = 1-(x²+y²)`，域 ±0.5 ⇒ `verified`（灵数：严格证明无实数解）
- `h = 1-(x²+y²)`，域 ±2 ⇒ `violated`，反例 `x≈-0.8409, y=-1`；**回代校验 h = -0.707 < 0** ✓
- `h = 4-x²`，域 [-3,3] ⇒ `violated`；反例回代 h < 0 ✓
- 无 `hExpr` / 5 维状态 ⇒ `unverified`（工程边界，诚实降级）

**M1 关键用例（机器检验，非断言口号）**

- **定理 M1.1 一致性**：`[move, send_email]` ⇒ 预检预测释放 **1** 条，`execute()`（`gateProof:false`）实际释放 **1** 条，相等 ✓
- **零释放对照**：同一计划默认（前置守卫开）释放 **0** 条；关闭前置守卫释放 **1** 条 ⇒ 差异为真，非测试假象 ✓
- **G1 实测校准**：`[move, nope]` 预测 0 条 / 实际 0 条 —— G1 已被前置守卫覆盖，`preempted` 标记由此校准 ✓
- **G0 意图绑定**：未绑 / ID 不一致 ⇒ `G0.intentBound` 拦截；一致 ⇒ 放行 ✓
- **行为不变**：感知步骤仍抛 `FIREWALL_VIOLATION`，零释放 ✓
- **不误拦**：静态全通过的计划照常执行 2 步且 `ok=true`，附 `conditional` 门控证明 ✓

---

## 7. 待办与「不做」

### 待办（按性价比排序）

1. **M1 扩展：把运行时守卫（G5..G8）也纳入证明**：当前只对 `state_i` 未知的部分诚实标 `conditional`；可考虑对"状态演化可符号化"的身体给出 N 步静态门控（注意计算爆炸风险）。
2. **Lean/Coq 证纯函数核心**：区间算术、`decode*` 字节解码器无副作用，可被形式化证明"我们的工具本身正确"。
3. **TLA+ 模型检查 `execute()` 状态机**：证 fail-closed 不可达 unsafe 状态（带副作用的真实执行无法完全模型化）。
4. **M2 覆盖面扩展**：当前仅 `cbfMargin` 接了认证路径；`clfCbfUnified`(QP) 与 `modelFreeCbf` 仍是 lite 浮点。

### 不做（明确排除）

| 项 | 理由 |
|---|---|
| 微分流形状态空间（ℳ, g） | 我们的状态空间是 SE(2) 与 ℝᵏ；且**区间分析是欧氏坐标内的东西**，与流形抽象自相矛盾 |
| N 步联合可达集验证 | 计算爆炸；我们默认 fail-closed + 人工在环，用不上 |
| Zonotope 可达集 | 灵数 Krawczyk 已覆盖我们的认证需求，不重复造 |
| 密钥轮换进主线 | 单部署内核，属 nice-to-have，非模块核心 |
| 全集形式化证明 | 图灵完备 + 外部副作用 + 哥德尔边界 ⇒ **数学上不存在**，不追求 |
