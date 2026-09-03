# 灵脑形式化证明模块 —— 最小可执行规格（M1 / M2 / M3 / M4）

> 落地面：内核 `灵脑.html`（单一真源）。实测日期 2026-09-03。
> 口径：本文档只陈述**已被机器检验**的部分。未被机器检验的一律标"未证明 / 待办"，不包装成结论。

---

## 0. 一句话结论

灵脑此前**没有任何机器可检验的形式化证明**——有的是"确定性"（无 LLM 概率采样）、"可审计性"（签名哈希链，属完整性而非正确性）、"近似安全验证"（lite 浮点）。

本次落地的 **M2 数值安全证书**是灵脑**第一处真正的机器可检验证明**：它用灵数求解器**严格证明"某盒式域内不存在使安全不变式低于 -1/B² 的状态"**（默认 B=1e6 ⇒ 容差 1e-12）——这是单点浮点判定永远做不到的。

同批落地的 **M1 能力/意图门控证明**把 `execute()` 里"隐含在控制流中的 if"提升为**显式门控规格表 + 零副作用预检器**，并证明性地在「释放任何指令前」拦截——把"先执行再停机、副作用不回滚"（部署陷阱⑦）改成**零释放停机**。它证的不是执行结果正确，而是**门控链的静态可判定部分**。

**M4 完全中介参考监视器**补的是前三者共同缺的那一半：**完备性**。

> M1/M2/M3 都在回答"这道判定对不对"（正确性 soundness）。
> 但没人回答过"**是不是所有副作用都经过判定**"（完备性 completeness）。
> 实测曾扫出内核 13 个副作用出口中 **12 个未受控**——只要有一条 `fetch` 没接闸，
> 前面所有门控、证书、裁决**全部形同虚设**。安全性等于最弱的那条路径，不等于最强的那道证明。

M4 把这个缺口从"实测事实清单"升级为**可机器检验的源码判定程序**（定理 M4.1，9 项检查 C1..C9），
并用**对象能力模型**在词法层剥夺环境权限，使"没过闸"在 JS 语义下**结构上不可能**。

### 0b. 复核阶段抓到的真实缺陷（2026-09-03，本文档必须先说坏消息）

M1–M4 落地后做自我复核，**在 M2 上抓到一处真实的假证明（false positive）**：

```js
certifySafetyInvariant({ hExpr:'x^2+y^2-1', vars:['x','y'], domain:[[-2,2],[-2,2]] })
// 修复前返回：verdict:'verified' / tier:'certified-krawczyk' / provenNoSolution:true
// 但 h(0,0) = -1 < 0 —— 该域内明显存在违反点，"已证明 h≥0" 是假的
```

这是安全模块**最危险的一类错误**：不是"证不出"（fail-closed，安全），而是"**把不安全说成已证安全**"。
根因、两道防线与回归用例见 **§3.6**。此处先记结论：

- 缺陷已修复，并被 **7 组 / 44 项回归测试**钉住（`test-formal-proof.js` 由 18 项扩到 **62 项**）。
- 同批发现 **UMD 分发面此前完全没有 M1/M2/M3**（只有 M4）——即用 `<script>` 引入灵脑的部署者
  **调不到这三个证明模块**，"M1–M4 已落地"在那个面上当时不成立。已补齐（导出 240→**246**）。

> 写在最前面的理由：一份只列成功项的证明规格，本身就是不可信的。
> **判定程序的价值 = 它抓到过什么**，不是它宣称过什么。

---

## 1. 诚实清单：证明了什么 / 没证明什么

| 项 | 状态 | 说明 |
|---|---|---|
| 确定性执行（不幻觉） | ✅ 工程属性 | vm 抽内核实跑、零依赖、无概率采样。**不是数学证明**，确定性 ≠ 正确 |
| 可审计性 | ✅ 密码学完整性 | 签名审计账本（HMAC 单写者哈希链）。证"轨迹未被篡改"，**不证"决策正确"** |
| **安全不变式的全域成立** | ✅ **已可机器证明**（M2，本次新增） | 灵数 Krawczyk **证明无实数解** ⇒ 域内 h ≥ -1/B² 恒成立（默认 B=1e6 ⇒ 容差 1e-12；浅层违反 (-1/B², 0) 不在射程）。每个 `verified` 附 `provenBound` |
| 安全不变式的违反检出 | ⚠️ 候选反例 | 欠定系统给出"候选"反例（非 Krawczyk 认证解），需回代校验 |
| **M2 假证明（假阳性）** | ✅ **已修复 + 已回归**（FP-1，§3.6） | 非法域形态曾致 `verified` 假阳性；现入口 fail-closed + 独立回代复核，**每个 `verified` 必附 `independentRecheck`** |
| M2 独立回代复核的完备性 | ⚠️ 有限采样 | 复核是**证伪器**不是证明器：网格+定种子采样，**只能推翻不能确立**；它的作用是让引擎的假阳性无处藏 |
| Hoare 三元组证明 | ❌ lite | `verifyHoarePath` 仍是 `lingnao-hoare-lite`，**未**形式化 |
| BrainTuple 逻辑命题 | ❌ 未证明 | 属 Coq / Lean / TLA+ 范畴，本模块不覆盖 |
| **execute() 门控链的静态部分**（M1） | ✅ **已可机器证明**（M1，本次新增） | `proveGateChain`：8 条守卫谓词，静态部分给出 `provably-blocked:zero-release` / `after-j` / `conditional`，**零副作用**，与真实执行器实测一致 |
| execute() 运行时守卫（G5..G8） | ❌ 诚实标 `conditional` | 依赖 `state_i`（执行历史的函数），静态预检判定不了 ⇒ 定理 M1.3 明说不给 `provably-admitted` |
| execute() 的"意图绑定" | ⚠️ 结构化，非密码学 | `G0.intentBound` 校验 `step.intentId` 与 `opts.intent.id` 一致 + 审计入链；**不引入新密码学**，完整性由既有签名账本负责 |
| **副作用出口的完全中介**（M4） | ✅ **已可机器证明**（M4，本次新增） | `proveCompleteMediation`：定理 M4.1 的 9 项检查 C1..C9，**语法层**完全中介，闸外未中介出口 = 0 |
| 语义层信息流不干扰（noninterference） | ❌ 未证明 | 需 Isabelle/Coq 级工具（seL4 那种规模），本内核**没有**，不谎称有 |
| 无隐蔽信道 / 无时间侧信道 | ❌ 未证明 | M4 不覆盖；CompCert 式"可观测行为"也把执行时间与内存排除在外 |
| TCB（效应闸 + 签名账本）内部正确性 | ⚠️ 诚实残余 | 不被自己中介（否则循环依赖）。可信度来自 Anderson 第③条"小到可验证" + 哈希链自校验 |
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
- 该系统**无解** ⇒ 域内不存在使 h < -1/B² 的违反点 ⇒ **h ≥ -1/B² 恒成立**（默认 B=1e6 ⇒ 容差 1e-12；浅层违反 (-1/B², 0) 不在射程）。
- 灵数求解器能**证明无实数解**（`resultTypeName:'empty'`，引擎全局穷尽证无实根）——**浮点采样/单点判定永远做不到这一点**。

### 3.3 接口

```js
certifySafetyInvariant({
  hExpr:  '1 - (x^2 + y^2)',        // 必填：安全不变式【表达式字符串】
  vars:   ['x', 'y'],                // 必填：状态变量名
  domain: { x:[-0.5,0.5], y:[-0.5,0.5] },  // 可选：盒式域【必须是对象，数组会被拒】
  bound:  1000,                      // 可选：辅助变量域界（默认 1e6）
  options: {}                        // 可选：透传灵数 options
})
```

### 3.4 输出四档（`contradiction` 为 2026-09-03 新增）

| verdict | tier | 含义 |
|---|---|---|
| `verified` | `certified-krawczyk` | **真数学证明**：灵数证明违反系统无解 ⇒ 域内 h ≥ -1/B² 恒成立（默认 B=1e6 ⇒ 容差 1e-12；浅层违反 (-1/B², 0) 不可检出）。**必附 `independentRecheck`** 与 `provenBound` |
| `violated` | `candidate-counterexample` | 域内存在 h < 0 的状态；返回 `counterexample` 供回代校验 |
| `unverified` | `lite-unverified` / `ambiguous-expression` / `partially-explored` | 证不了。**不等于安全**，按 fail-closed 处理 |
| **`contradiction`** | `engine-result-refuted` | **引擎说"无解"，但独立回代在域内找到 h < 0** ⇒ 二者冲突。此时**一律不给 verified**，并回报 `minValue` / `minAt` 指认冲突点 |

> `contradiction` 是本轮加的第四档。它的存在本身就是诚实机制：
> **允许"我的证明引擎和我的复核器打起来"这个结果被表达出来**，而不是默默选一个信。
> 冲突即拒判 —— 这是 fail-closed 在"两个都是自己人"场景下的正确形态。

### 3.5 硬约束（诚实边界，逐条）

| 约束 | 说明 |
|---|---|
| 只吃**方程字符串** | 内核 `cbfFilter`/`cbfMargin` 的 **JS 函数形态 h 不在灵数能力域** ⇒ 诚实返回 `unverified`，**绝不退回浮点假装认证** |
| 域为**盒式区间** | 灵数 `domain` 形态，不是任意半代数集 |
| **域必须是「变量名→[lo,hi]」的对象** | `[[-2,2],[-2,2]]` 这类**数组形态一律 fail-closed 拒判**（正是 FP-1 的入口，§3.6）。另校验：键为已声明变量、区间长度 = 2、端点为有限数、`lo < hi` |
| **表达式不得有语义歧义** | 一元位置的 `-a^b`（如 `-x^2+1`）在灵数解作 `(-x)²`、在数学惯例/本模块求值器解作 `-(x²)` ⇒ **两义不可比 ⇒ 拒判 `ambiguous-expression`**，要求显式括号 `-(x^2)+1` |
| **`verified` 必须通过独立回代复核** | 引擎单方面说"无解"不足以出 `verified`；须 `_m2SampleRefute` 在域内采样回代且未找到 h < 0。找到 ⇒ `contradiction` |
| 未给 `domain` 时用默认 ±`bound` | 会在结果里标 `defaultedDomains`，**不隐瞒"你没给域、我替你假设了域"** |
| 状态维数 ≤ 4 | 变量总数（状态 + s + w）受灵数 ≤ 6 上限 |
| 检出粒度 ≈ 1/BOUND² | `s·w = 1` 与辅助域界共同决定：bound=1000 ⇒ 可检出深度 ≥ 1e-6 的违反 |
| `violated` 是**候选**反例 | 欠定系统（2 方程 / n+2 变量），引擎标 `candidate` 而非 Krawczyk 认证；`residual` 是强证据但**不是认证** |
| 只证 h ≥ -1/B² 类**代数不变式**（默认容差 1e-12） | 不证 Hoare 三元组、不证 BrainTuple 逻辑（那是 Coq/Lean/TLA+ 的事） |

### 3.6 缺陷 FP-1：一处真实的假证明，及其两道防线

#### (a) 现象与最小复现

```js
// 同一个数学问题，只改 domain 的写法：
certifySafetyInvariant({hExpr:'x^2+y^2-1', vars:['x','y'], domain:{x:[-2,2],y:[-2,2]}})
// → violated，反例 (x≈1.03e-8, y=0)，h ≈ -1 < 0        ← 引擎正确
certifySafetyInvariant({hExpr:'x^2+y^2-1', vars:['x','y'], domain:[[-2,2],[-2,2]]})
// → 修复前：verified / certified-krawczyk / provenNoSolution:true   ← 【假证明】
```

#### (b) 根因链（四步都"各自合理"，合起来产出假阳性）

```
① 调用方把 domain 写成数组（一个很自然的笔误，且当时无校验）
② JSON.parse(JSON.stringify(domain)) 深拷贝后【仍是数组】，挂上 _sv/_wv 辅助变量域属性
③ 灵数解析这个对象时取不到 x/y 的域 ⇒ 在【退化域】上求解 ⇒ 返回 resultTypeName:'empty'（无解）
④ 上层把 'empty' 无条件映射为 verified ⇒ "证明了域内无违反点"
```

**教训（写进规格，不只写进代码）**：`empty` 的语义是"**在引擎实际使用的那个域上**无解"。
把它读成"在**我以为的那个域**上无解"，中间隔着一个"引擎是否真的收到了我的域"的假设 ——
而这个假设当时**没有任何检查**。**证明的前提没被验证，结论就不是证明。**

#### (c) 防线一：入口 fail-closed 形态校验

`domain` 非对象 / 是数组 / 键非声明变量 / 区间非 `[lo,hi]` / 端点非有限数 / `lo ≥ hi`
⇒ 一律 `unverified`，`reason` 直接点明形态问题（如上文实测："`domain` 形态非法：必须是以变量名为键的对象…收到 Array"）。
**不猜、不纠正、不静默转换** —— 猜错一次就是一次假证明。

#### (d) 防线二：独立回代复核（证明器不许只信自己）

新增两个纯函数（均已导出，可被第三方单独调用复核）：

| 函数 | 作用 | 关键设计 |
|---|---|---|
| `_m2Eval(expr, env)` | **手写递归下降求值器** | **不用 `eval`/`new Function`** —— 因为 `EVAL` 是 M4 的 `deny` 硬轨，用动态求值会自伤（C5 当场判 incomplete）。支持 `+ - * / ^ ()`、`sin/cos/tan/exp/log/sqrt/abs`、`pi/e`；未绑定变量/未知函数/语法错**抛错，绝不静默给 0** |
| `_m2SampleRefute(hExpr, vars, domain)` | 域内回代求 h 最小值 | 每维 5 点网格 + **固定种子 LCG** 补采 64 点 ⇒ **确定性可复现**（同输入同结论，不引入随机性到安全判定里）。返回 `{usable, sampled, minValue, minAt, refuted}` |

引擎给出 `provenNoSolution` 后**必过此复核**：找到 h < 0 ⇒ `contradiction`；未找到 ⇒ `verified` 并附
`independentRecheck:{done,sampled,minValue,refuted}`（上文实测：恒正例 `sampled=89, minValue=0.5, refuted=false`）。

> **复核器的诚实定位**：它是**证伪器**，`refuted:false` **不构成**证明（有限采样永远漏得掉窄缝）。
> 它唯一的职责是：**让"引擎在错的域上返回 empty"这类假阳性无处藏身**。
> 真正的证明力来自灵数的 Krawczyk 全局穷尽；复核只负责把"证明的前提被悄悄破坏"这条路堵死。

#### (e) 求值器与引擎的语义分歧（第三个发现）

复核器一旦上线，立刻暴露一个更隐蔽的问题：**同一个字符串两个语义**。

| 表达式 | 灵数 | `_m2Eval` / 数学惯例 | 处理 |
|---|---|---|---|
| `-3^2` | `9`（即 `(-3)²`） | `-9`（即 `-(3²)`） | **拒判 `ambiguous-expression`**，要求加括号 |
| `2^-3` | `0.125` | `0.125` | 一致，放行 |
| `2^3^2` | `512`（右结合） | `512` | 一致，放行 |

若不处理，复核器会用 `-(x²)` 的语义去回代引擎按 `(-x)²` 算出的结论 ——
**两边算的不是同一个命题，复核结果毫无意义，还可能反过来制造假 `contradiction`**。
故用正则只锁**一元位置**的 `-a^b`（`^|[(,+\-*\/^]` 之后），**不误伤二元减号**（`4 - x^2` 无歧义，照常判定）。
判据边界本身有 16 个用例钉住（F-6e）。

#### (f) 回归测试（F-1 … F-7，共 44 项）

| 组 | 钉住的东西 |
|---|---|
| F-1 | **数组域绝不能 verified**（FP-1 本体，钉成永久回归） |
| F-2 | 合法对象域须 `violated`，且反例回代确认 h < 0 |
| F-3 | 各类非法域（键未声明 / 区间长度≠2 / 端点非有限 / lo≥hi）一律 fail-closed |
| F-4 | 任何 `verified` 必须携带 `independentRecheck` |
| F-5 | 未给域时必须回报 `defaultedDomains`（不许隐瞒默认假设） |
| F-6 | `-x^2+1` 拒判；消歧为 `-(x^2)+1` 后判别正确；F-6e 16 例锁歧义判据边界 |
| F-7 | `_m2Eval` 优先级正确（`-3^2 = -9`、`2^-3 = 0.125`）、非法输入抛错 |

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

## 4b. M4 完全中介参考监视器 —— `EffectGate` + `proveCompleteMediation`

### 4b.1 外部思想来源（据实标注，非原创）

| 来源 | 吸收的东西 |
|---|---|
| **Anderson 1972** 参考监视器 | 三要求：完全中介(always invoked) / 防篡改(tamper-proof) / **小到可验证**(small enough to verify) |
| **Saltzer & Schroeder 1975** | 完全中介原则(complete mediation)：每次访问都必须过检查，不能有缓存旁路 |
| **Miller 对象能力模型** / Wagner **Joe-E** | 消除**环境权限**(ambient authority)：把"不申请就能拿的权力"变成"必须被显式授予的能力对象" |
| **seL4 权限封闭**(authority confinement) | 静态策略是**所有未来状态**的安全上界 ⇒ 静态扫描可升级为证明，无需枚举运行时路径（那不可判定） |
| **CompCert 可观测行为** | 副作用的形式定义 = I/O trace；**不含**执行时间与内存 ⇒ 明确了侧信道在射程外 |

### 4b.2 它解决什么：正确性 ≠ 完备性

改造前的实测事实（`lingnao-sideeffect-audit.js`）：**13 个副作用出口，12 个未受控**。

```
未受控出口 = fetch(LLM 调用) / fetch(IMA 加载) ×2 / localStorage 读写 ×N / bodyAdapter 物理动作 …
```

这些出口**不申请就能用**——`fetch` 和 `localStorage` 是全局名，任何代码路径直接写就能产生真实世界副作用。
这就是 ambient authority。**M1 的 8 条守卫再严密，也管不到没走 `execute()` 的那条 `fetch`。**

### 4b.3 关键手法：不是"逐个改调用点然后祈祷"，而是在词法层剥夺全局名

```js
// 闸内：以属性访问持有真实原语（属性访问不受词法遮蔽影响 ⇒ 功能不损）
function _rawFetch(){ return globalThis.fetch; }
…
// 闸尾：把内核作用域内的全局名重绑掉
const fetch          = __ambientDenied('fetch');      // 拒绝物：调用即抛
const XMLHttpRequest = __ambientDenied('XMLHttpRequest');
const WebSocket      = __ambientDenied('WebSocket');
const localStorage   = EffectGate.storageProxy;        // 中介能力对象：每次必经 mediate()
const sessionStorage = null;
const indexedDB      = null;
```

于是内核里**任何**位置写 `fetch(...)` 都不再是"权力"，而是抛
`AMBIENT_AUTHORITY_DENIED`；写 `localStorage.setItem(...)` 会自动过闸并入轨迹。
要绕过只剩 `eval` / 反射 / 动态 `import` 三条路——而这三条**机器检查为 0**。

> ⚠️ 这条正是本判定**曾写错并被实测纠正**的地方：初版 C4 判据是"闸外裸引用计数为 0"，
> 结果把 4 处**已被重绑为中介代理**的 `localStorage.getItem` 误报为缺口。
> 正确论证是对象能力模型的原意：**安全性不来自"禁止写这个名字"，而来自"这个名字已不再指向环境权限"**。
> 判据据此改为"每处引用都可**归约**到已批准绑定"。

### 4b.4 定理 M4.1（语法层完全中介）

设内核源码文本 `S`，副作用原语集 `P`，`GATE` = 效应闸区间，`TCB` = 签名账本区间。若：

| 条件 | 内容 | 机器检验 |
|---|---|---|
| (i) | ∀p∈P：`p` 在 GATE 内被 `const` 重绑，且初始化式属**已批准形态**（拒绝物/null ⇒ `denied`；`EffectGate.*` ⇒ `mediated`） | **C2** |
| (ii) | ∀p∈P：`globalThis.p` / `window.p` 形式的真实原语访问**只**出现在 GATE 内 | **C3** |
| (iii) | GATE∪TCB 外每处引用都可归约到 (i) 的绑定：`mediated` ⇒ 已中介；`denied` ⇒ 抛错/为 null，产生不了副作用 | **C4** |
| (iv) | 动态求值面（`eval` / `new Function` / `import()` / `globalThis[动态键]`）计数为 **0** | **C5** |
| (v) | 唯一物理出口 `bodyAdapter` 的调用点前有 `EffectGate.mediate` 中介 | **C7** |
| (vi) | (i) 的绑定未被 GATE 外的 `var/let/const` 重声明覆盖（否则归约链断裂） | **C9** |

则内核作用域内**任何执行路径都无法取得未中介的副作用原语引用**。∎

**证明骨架**：JS 中获得一个原语引用只有三条途径 —— (a) 词法名字引用；(b) 属性访问 `globalThis.x`；
(c) 动态求值。(a) 被 (i)+(vi) 归约（同作用域 `const` 遮蔽优先于全局对象属性，故闸外写下 `p`
解析到的**必然**是闸内那条绑定）；(b) 被 (ii) 限制在 GATE 内；(c) 被 (iv) 判定为不存在。
三条途径穷尽 ⇒ 闸外无从取得未中介原语。

其余检查：**C1** 区间哨兵齐备（无哨兵则判定失去边界，必须拒绝而非放过）、
**C6** Node 模块加载仅在 GATE∪TCB 内、**C8** 闸未泄露真实原语持有者（`_rawFetch`/`_rawHttps` 不出闸）。

### 4b.5 机制与策略分离（seL4 同款取舍）

闸只保证「**必经中介 + 必入轨迹**」，放行与否是策略，交部署层：

| 效应类型 | 默认 | 可配置 | 说明 |
|---|---|---|---|
| `NETWORK_OUT` | `ledger`（放行+入签名账本） | ✅ + host 白名单 | 默认拒网络会砸掉 LLM 感知层，**那是假安全** |
| `STORAGE_WRITE` | `ledger` | ✅ | 拒绝时**抛错**而非静默丢数据（静默丢数据更危险） |
| `STORAGE_READ` | `audit` | ✅ | 调用点密集，仅计数 |
| `PHYSICAL` | `ledger` | ✅ | 拒绝 ⇒ `execute()` 在 `bodyAdapter` **之前**停住，零释放 |
| `PROCESS` | `deny` | ❌ **硬轨** | 不可经 `configure` 放开，否则"配置即提权" |
| `EVAL` | `deny` | ❌ **硬轨** | 同上；要放开只能改源码，而改源码会被 C5/C6 当场抓到 |
| 未注册类型 | `deny` | — | **fail-closed** |

### 4b.6 接口

```js
proveCompleteMediation(srcText)   // 纯函数；无源码 ⇒ verdict:'unverified'（fail-closed，不假设通过）
// → { ok, theorem:'M4.1', verdict, checks[9], unmediated[], classification, reduction,
//     regions, policy, assumptions[H1..H6], notProved[] }

EffectGate.mediate(effect, ctx)   // 唯一中介点
EffectGate.net.postJson / getJson // 网络能力对象（须声明 purpose ⇒ 意图绑定）
EffectGate.storageProxy           // 存储能力对象
EffectGate.attest()               // 运行时自证：真去碰被遮蔽的名字，不发任何网络
EffectGate.configure / policySnapshot / stats / trace
```

| verdict | 含义 |
|---|---|
| `complete-mediation-proved` | C1..C9 全过 ⇒ 定理 M4.1 成立，闸外未中介出口 = 0 |
| `incomplete` | 存在未中介出口；`unmediated[]` 逐条给出行号与缺口类型 |
| `unverified` | 拿不到源码 ⇒ 不猜、不假设通过 |

### 4b.7 诚实边界（M4，必须与结论一起读）

- 证的是**语法层**完全中介，**不是**语义层信息流不干扰(noninterference)。后者需 Isabelle/Coq 级工具，**本内核没有，不谎称有**。
- 证的是"所有效应出口都过闸"，**没证**"过闸的放行决策一定正确"（那是 M1 的射程），也**没证**无隐蔽/时间侧信道。
- 前提 **H1**（单 realm，无 iframe/Worker/新 vm context 逃逸）与 **H5**（宿主层不受此限）**不可由源码判定**，如实标 `machineChecked:false`。宿主进程若直接调 `fetch`，与内核无关也不在射程内 —— **部署层责任**。
- **TCB 不被自己中介**（效应闸 + 签名账本）。理由是循环依赖："写审计需过闸、过闸需写审计"。可信度来自"小到可验证" + 哈希链自校验，**此为诚实残余，不掩盖**。
- 效应轨迹为**本会话内存链**；跨重启持久化需部署层注入 store。
- MCP 的 `prove_complete_mediation` 默认判定**服务端自身源码**（`srcFrom:'server-builtin'`）——这是**自证**。自证不能替代第三方复核，故该工具**接受调用方传入 `src`** 做独立复核（`srcFrom:'caller-provided'`）。

---

## 4c. MCP 暴露（2026-09-03）：证明模块从"内核代码"变成"产品能力"

此前 M1/M2/M3 **只存在于内核与本地测试，MCP 一个都调不到**——等于外部智能体/审计者
无法要求灵脑"出证明"。本次接出 5 个工具（工具总数 **57 → 62**）：

| 工具 | 模块 | 实测（真 JSON-RPC 调用）|
|---|---|---|
| `prove_gate_chain` | M1 正确性 | `[{cap:'nope'}]` ⇒ `provably-blocked:zero-release`，`G1.registered`，释放 0 |
| `certify_safety_invariant` | M2 全域认证 | `h=1-(x²+y²)` 域±0.5 ⇒ `verified` / `certified-krawczyk`（灵数桥在 MCP 内真实工作）|
| `verdict_three_layer` | M3 层次分离 | `logicDecidable:false` ⇒ `layer:'logic'`，`strategy:'refuse'` |
| `prove_complete_mediation` | M4 完备性 | `complete-mediation-proved`，checks **9/9**，`unmediated 0` |
| `effect_gate_report` | M4 机制 | `policy.PROCESS='deny'`，`attest.ok=true`，含意图/调用者的效应轨迹 |

统一原则：**能力缺失一律 fail-closed 返回 `unverified` / `unavailable`，绝不默认通过。**

### 4c-2. UMD 分发面：曾缺 M1/M2/M3，已补齐（2026-09-03 复核发现）

灵脑有**三个出口**：内核 `灵脑.html`（`<script>` 直接用）、`lingnao-mcp.js`（MCP/JSON-RPC）、
`lingnao.umd.js`（打包分发给 Node `require` / 浏览器 `<script>`）。
复核时逐面点名，发现 **UMD 面只有 M4，M1/M2/M3 三个证明模块全部 `undefined`**：

```js
const u = require('./lingnao.umd.js');
u.proveGateChain            // undefined  ← M1 拿不到
u.certifySafetyInvariant    // undefined  ← M2 拿不到
u.verdictThreeLayer         // undefined  ← M3 拿不到
u.proveCompleteMediation    // function   ← 只有 M4 在
```

即：对**用 UMD 部署的人**而言，"M1–M4 已落地"当时是**不成立**的。
根因是 `build-umd.js` 的 `EXPORT_NAMES` 白名单没同步新增符号 —— 内核里有，导不出去，等于没有。

修复：白名单补 7 个符号（`proveGateChain`, `GATE_SPEC`, `certifiedNumeric`,
`certifySafetyInvariant`, `_m2Eval`, `_m2SampleRefute`, `verdictThreeLayer`），重建后实测：

| 项 | 修复前 | 修复后 |
|---|---|---|
| 导出符号数 | 239（报告显示 240，见下） | **246**，M1–M4 全部可用 |
| 文件大小 | 559479（报告显示 448162，见下） | **571050 bytes** |
| UMD 面 M2 行为 | 不存在 | 数组域→`unverified`、对象域→`violated`+反例、恒正→`verified`+`independentRecheck`、`-x^2+1`→`ambiguous-expression`（与内核/MCP **三面一致**）|

**顺带修掉两处计数不实**（属"报告数字不可信"，比缺功能更该改）：

- `EXPORT_NAMES` 里 `'getBody'` 重复出现两次 ⇒ 报告的导出数**虚高 1**（240 vs 实际 239）。现去重并对重名 WARN。
- 构建报告用 `umd.length`（JS 字符串是 **UTF-16 码元数**），而中文按 UTF-8 落盘占 3 字节
  ⇒ 报告 448162 与磁盘真实 559479 差 11 万。现改用 `Buffer.byteLength(umd,'utf8')` 报**真实字节**，另附 `chars`。

> 这两条不影响安全，但**构建报告说的数和磁盘上的数不一样**，会让所有以它为准的核对失效。
> 本项目的收尾标准是"用实据（md5 / 字节 / HTTP 状态）核对"，那实据本身就必须是真的。

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
| `test-formal-proof.js`（M2/M3） | **62 通过 / 0 失败**（含 FP-1 假证明回归 44 项） |
| `test-complete-mediation.js`（M4） | **75 通过 / 0 失败** |
| 内核 boot 三件套 | `verifyLedger=true` `firewall=true` `auditLedger=true` |
| MCP 入口自测 | `SELFTEST OK`；工具总数 **62** |
| UMD 构建 | `OK bytes=571050 chars=457149 导出=246`；UMD 内 M1–M4 **全部可用**，M4 判定 **9/9** |
| **全套回归** | **334 通过 / 0 失败**（12 套测试） |

**12 套逐项**（本轮实跑，2026-09-03）：
`test-access-engine` 12 · `test-bridge` 12 · `test-classify` 6 · `test-cn-standards` 19 ·
`test-complete-mediation` **75** · `test-console-pipeline` 7 · `test-consumer-standards` 34 ·
`test-formal-proof` **62** · `test-gate-proof` 41 · `test-general-standards` 39 ·
`test-link-layer` 14 · `test-realworld-devices` 13 　⇒ 合计 **334 / 0**

**三面一致性实据（同一 M2 输入，三个出口同结论）**

| 输入 | 内核 | MCP | UMD |
|---|---|---|---|
| `x^2+y^2-1`，域**数组** `[[-2,2],[-2,2]]` | `unverified`（形态非法） | 同 | 同 |
| `x^2+y^2-1`，域**对象** `{x:[-2,2],y:[-2,2]}` | `violated` + 反例 | 同 | 同（反例 `x≈1.03e-8, y=0` ⇒ h ≈ −1）|
| `1-(x^2+y^2)`，域 ±0.5 | `verified` + `independentRecheck` | 同 | 同（`sampled=89, minValue=0.5, refuted=false`）|
| `-x^2+1`（歧义） | `unverified/ambiguous-expression` | 同 | 同 |

**M4 关键用例 —— 变异测试（这是判定程序可信度的唯一实据）**

> 一个永远返回 `proved` 的检查器毫无价值。故 12 项测试专门**故意注入违规**，
> 验证判定程序抓得到。每一项都必须 `verdict='incomplete'` 且对应检查 `pass=false`。

| 变异 | 注入的违规 | 应被抓 | 实测 |
|---|---|---|---|
| M-a | 移除 `fetch` 重绑 + 闸外裸调用 | C2 / C4 | ✅ 抓到，缺口类型 `bare-primitive-unreducible` |
| **M-b** | **保留 `const fetch =` 的"形"，改成 `= globalThis.fetch` 把环境权限原样放回来** | C2 | ✅ 抓到，类型 `shadow-reexposes-ambient` |
| M-c/c2/c3 | 闸外 `eval` / `new Function` / `globalThis[k]` 反射 | C5 | ✅ 三例全抓 |
| M-d | 闸外经 `globalThis.fetch` 取真实原语 | C3 | ✅ 抓到 |
| M-e | 闸外 `let fetch = 1` 重声明覆盖 | C9 | ✅ 抓到 |
| M-f | 撤掉 `bodyAdapter` 前的效应闸中介 | C7 | ✅ 抓到 |
| M-g | 闸外 `require('fs')` | C6 | ✅ 抓到 |
| M-h | 抹掉效应闸区间哨兵 | C1 | ✅ 抓到（判定失去边界 ⇒ 拒绝而非放过）|
| M-i | 泄露真实原语持有者 `_rawFetch` 到闸外 | C8 | ✅ 抓到 |

> **M-b 是最刁的一条**：它正是"只查有没有 `const p =`"的旧判据会**漏掉**的攻击——
> 遮蔽形式完好，实质却把 ambient authority 原样放回。判定程序必须查**绑定到了什么**。

**M4 其余实测**

- 运行时自证：闸外裸 `fetch` **实际抛** `AMBIENT_AUTHORITY_DENIED`；闸内仍持有真实原语（功能未被砸掉）
- 记忆持久化：`Memory.save()` 经中介代理**仍成功**，且该写入**已计入效应轨迹**（此前这条副作用面完全无审计）
- 存储写被拒 ⇒ 抛 `EFFECT_DENIED`（**不静默丢数据**）
- 物理面：`execute()` 轨迹记录了**具体能力名与参数**（法医级"谁用什么参数做了什么"，此前只记汇总）
- 物理策略 `deny` ⇒ **零释放**，`haltReason = 'EFFECT-GATE-DENIED …'`（在 `bodyAdapter` 之前停住）
- 硬轨：`configure({process:'ledger', eval:'ledger'})` 后 `PROCESS`/`EVAL` **仍为 `deny`**（拒绝"配置即提权"）
- 归约分类实据：`fetch→denied`、`localStorage→mediated`、`sessionStorage/indexedDB→denied`；
  存在 **>0 处经能力对象中介的闸外引用** ⇒ 证明走的是"重绑"而非"禁用"路线

**M2 关键用例**

- `h = 1-(x²+y²)`，域 ±0.5 ⇒ `verified`（灵数：严格证明无实数解）+ 独立回代未推翻
- `h = 1-(x²+y²)`，域 ±2 ⇒ `violated`，反例 `x≈-0.8409, y=-1`；**回代校验 h = -0.707 < 0** ✓
- `h = 4-x²`，域 [-3,3] ⇒ `violated`；反例回代 h < 0 ✓（二元减号**未**被歧义判据误伤）
- 无 `hExpr` / 5 维状态 ⇒ `unverified`（工程边界，诚实降级）

**M2 假证明回归（FP-1，本轮新增 —— 这是 M2 可信度的实据）**

> 与 M4 变异测试同一逻辑：**一个永远返回 `verified` 的认证器毫无价值**。
> 故把已抓到的假阳性钉成永久回归，并主动构造相邻的错误输入验证 fail-closed。

| 用例 | 注入的问题 | 应得结果 | 实测 |
|---|---|---|---|
| **F-1** | 域写成数组 `[[-2,2],[-2,2]]`（FP-1 本体） | 绝不 `verified` | ✅ `unverified`，reason 点明"收到 Array" |
| F-2 | 同一问题合法对象域 | `violated` + 反例回代 h<0 | ✅ 反例 `x≈1.03e-8,y=0`，h≈−1 |
| F-3 | 键未声明 / 区间长度≠2 / 端点 `NaN`·`Infinity` / `lo≥hi` | 全部 fail-closed | ✅ 逐条 `unverified` |
| F-4 | 检查每个 `verified` 是否带复核证据 | 必带 `independentRecheck` | ✅ |
| F-5 | 不传 `domain` | 须标 `defaultedDomains` | ✅ 不隐瞒默认假设 |
| F-6 | `-x^2+1`（一元位置 `-a^b`） | 拒判 `ambiguous-expression` | ✅；消歧为 `-(x^2)+1` 后判别正确 |
| F-6e | 16 例锁歧义判据边界 | 二元减号不误伤、一元位置必拦 | ✅ 16/16 |
| F-7 | `_m2Eval` 优先级与非法输入 | `-3^2=-9`、`2^-3=0.125`、未绑定变量抛错 | ✅ |

> **F-1 是最该记住的一条**：它不是"算错了"，而是"**证明的前提被悄悄换掉，结论照样盖章**"。
> 这类缺陷不会让测试变红，只会让安全结论变假 —— 只能靠"**不信任自己的引擎**"这条原则抓出来。

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
5. **统一表达式语义（消掉歧义源，而非只拦歧义）**：现在对 `-a^b` 是**拒判**（安全但不便）。
   根治办法是与灵数约定同一套优先级（或在桥层做规范化重写），使两侧对同一字符串同义。
   ——在那之前，拒判是唯一诚实的选择。
6. **把 FP-1 这类"前提未验证"检查做成通则**：M2 的教训（`empty` 只在引擎**实际使用**的域上成立）
   在其它委派型判定上同样适用。凡"把外部引擎结论映射为本系统结论"的地方，都应有
   ①入口形态校验 ②独立复核 ③冲突可表达（`contradiction` 档）这三件套。目前只有 M2 有。
7. **构建报告可信性巡检**：本轮已修 `getBody` 重复计数与 `umd.length` 字节口径；
   其余对外报数（工具数、导出数、md5）应统一由脚本从**磁盘真实产物**读取，禁止手写常量。

### 不做（明确排除）

| 项 | 理由 |
|---|---|
| 微分流形状态空间（ℳ, g） | 我们的状态空间是 SE(2) 与 ℝᵏ；且**区间分析是欧氏坐标内的东西**，与流形抽象自相矛盾 |
| N 步联合可达集验证 | 计算爆炸；我们默认 fail-closed + 人工在环，用不上 |
| Zonotope 可达集 | 灵数 Krawczyk 已覆盖我们的认证需求，不重复造 |
| 密钥轮换进主线 | 单部署内核，属 nice-to-have，非模块核心 |
| 全集形式化证明 | 图灵完备 + 外部副作用 + 哥德尔边界 ⇒ **数学上不存在**，不追求 |
