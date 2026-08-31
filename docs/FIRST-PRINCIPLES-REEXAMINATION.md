# 灵脑 LingNao — 第一性原理再审视

> 对照系：① 人类数学（范畴论 / 测度论 / 动力系统 / 因果 / 控制论）② 外部产品（Sora 2 / Genie 3 / Cosmos / JEPA-V2 / DreamerV3 / World Labs）③ 论文（AlphaProof·Lean / DeepMind AGI Safety / AlgebraicJulia / CBF / Pearl do-calculus）④ 世界前沿技术（主动推理·自由能 / j-stable 因果 / 保形预测 / 混合自动机）。
> 内核实况（源码确认）：`MathKernel` = 12 公理 / 25 定理 / 5 猜想 / 7 推理规则；`BrainTuple` 八元组 `𝔹=(X,h,b,f,U,V,Inv,M)` 全部落地为可运行、可审计对象。
> 标注约定：✅ 与前沿一致 / 正确第一性原理取舍；⚠️ 真实缺口；🚩 对外措辞有过度对标风险。

---

## 0. 方法：用什么尺子量「世界大脑」

第一性原理问题：**一个"世界通用大脑"在数学上最少需要哪些内在形式，且各自不可再约？**

我们不先入为主地接受现有八元组，而是从四个建模目标倒推，再用前沿反查每一项是否"够"或"过"：

- 目标 A **感知世界** → 需要状态 `X` 与观测 `h`
- 目标 B **作用于世界** → 需要身体 `b` 与动力学 `f` 与执行 `U`
- 目标 C **趋利避害（不含糊）** → 需要价值 `V` 与不变量 `Inv`
- 目标 D **不可逆伤害的不可约性** → 强制 `U` 带 `IRREVERSIBLE-HALT`（不是可选项，是公理级闸）
- 目标 E **他心 / 多智能体** → 需要 `M`（信念级）

---

## 1. 八元组的不可约性（从第一性原理重证）

逐项归约测试（若删去某元，是否仍有完备大脑）：

| 元 | 删去后果 | 结论 |
|---|---|---|
| `X` | 无状态→无法定义 h/f/V | **不可删** |
| `h` | 无观测→盲目，且违反"不幻觉"前提 | **不可删** |
| `b` | 无载体→f/U 无处落地（纯思辨） | **不可删** |
| `f` | 无动力学→规划无转移模型 | **不可删** |
| `U` | 无执行→只是预言机，不成"大脑" | **不可删** |
| `V` | 无价值→A* 的最优性无定义（THM_ASTAR_OPTIMAL 失基） | **不可删** |
| `Inv` | 无不变集→CBF/量纲/硬约束失去归拢点 | **不可删** |
| `M` | 无他心→退化成单体，非"世界"通用 | **不可删** |

**归并测试**：`U` 能否并入 `f`？不能——`f` 是"世界怎么变"，`U` 是"我能命令世界怎么变"，二者主体不同且 `U` 受 `IRREVERSIBLE-HALT` 单独约束。`Inv` 能否并入 `b`？不能——`Inv` 跨世界图与身体硬约束与量纲，是**全局禁集**而非载体属性。

**结论**：八元组是确定性内核的**最小充分基（irreducible sufficient basis）**。它不构成"过设计"。但 §4 会指出：在**随机 / 部分可观测**的开放世界扩展下，存在一个合理的**第 9 元候选 `B`（自身信念状态）**——这是内核当前的结构性缺口，不是八元组的错误。

---

## 2. 逐个内在形式 × 前沿对照

### 2.1 `X` 状态空间 — 图节点 ⊕ 连续身体
- **数学**：离散 Σ-代数（世界图）与连续状态流形（身体）的直和；严格说是**混合系统**的底空间。
- **前沿**：World Labs（3D 几何状态）、JEPA（潜空间状态）。
- **产品**：`X() = WORLD.nodes ⊕ Object.keys(getState())`。
- **判定**：✅ 离散部分扎实（A* 在其上可证最优）。⚠️ 连续部分只是 `getState()` 的键值快照，**无流形 / 混合自动机建模**；`f` 只用图边，连续动力学未被 `X` 显式承载。

### 2.2 `h` 观测通道 — 诚实退化
- **数学**：`h: X→O` 是投影 / 部分函数；观测盲区 = `X` 上"在 `O` 下不可区分"的等价类（商空间）。
- **前沿**：感知即潜空间预测（JEPA/V-JEPA 2）；产品反选"不编造观测"。
- **判定**：✅ **诚实退化（无 `O` 则返回 `ok:false`）是第一性原理的正确选择**——直接规避幻觉。⚠️ 但区分性仅用区间不相交（`distinguishable`），未用量化指标刻画"观测有多好"。前端已有 `entropyOf` / `expectedInfoGain` / `selectByInfoGain`，但 `h` 未消费——**观测质量无量化层**。

### 2.3 `b` 身体 — 载体执行
- **数学**：具身认知；执行受控制 Barrier 函数 `B(x)≥0` 约束。
- **前沿**：CBF 即"力场"；CORE（VLM+CBF 上下文护栏）；模块化安全护栏（action/decision/human-centered）。
- **产品**：`BODY.caps` + `checkHard` + `cbfFilter/cbfCompose` + `IRREVERSIBLE-HALT`。
- **判定**：✅ 物理安全层齐备，与前沿一致。🚩 **"刀递人"语义危险不可见**：`checkHard` 是**句法**硬约束列表（字段/阈值），不是**语义**安全谓词（"此动作是否把危险物交给人"）。物理安全 ≠ 意图安全——这是前沿已承认的模块护栏缺口。

### 2.4 `f` 动力学 — 图边 + 诚实 `𝕌`
- **数学**：离散转移系统 / 确定性自动机；连续侧由 Picard–Lindelöf（THM_ODE_EXISTENCE）保证流存在唯一。
- **前沿**：世界模型学习——DreamerV3（RSSM 潜动力学）、Genie 3、Cosmos；`f` 从数据学。
- **产品**：`f(state,action)` = 命中 `WORLD.edges` 则返回图转移，否则**诚实返回 `𝕌`（不编造动力学）**。
- **判定**：✅ 已知动力学可审计、不幻觉，正确。⚠️ **`f` 无任何学习分量**——真实开放世界中 `f` 大多未知，诚实返回 `𝕌` 意味着**无法进入新物理环境**。这是最大的**可用性缺口**。
- **关键约束**：若补"学习的 `f`"，必须保持诚实边界——学习 `f` → `mayHallucinate` → **不进证明链**（铁律③）。`learnWorldModel` / `selfLearn` 已存在但 `f()` 未消费它们。

### 2.5 `U` 执行通道 — `IRREVERSIBLE-HALT`
- **数学**：动作空间 + fail-closed 守卫（哨兵模式）。
- **前沿**：模块化安全护栏；DeepMind 自主等级（ASL，6 级）。
- **产品**：`execute()` 四道 fail-closed：① `checkHard`（`SAFE-STOP`）② `IRREVERSIBLE-HALT` ③ `OBSERVATION-BLIND-SPOT` ④ `pre` 重校验；外加 `maxReplans` 防死循环。
- **判定**：✅ 与 CBF / 模块护栏前沿同构。⚠️ **无自主等级模型**——只有"不可逆"一个闸门，没有按能力风险触发 human-in-the-loop 的升级机制（对照 DeepMind ASL）。

### 2.6 `V` 价值 — 值迭代固定点
- **数学**：Banach 不动点（THM_BANACH_FP）+ 极值定理（THM_WEIERSTRASS）保证固定点存在最优。
- **前沿**：Bellman = 标准最优控制；主动推理（Friston）用自由能最小化。
- **判定**：✅ **选 Bellman 而非自由能是正确第一性原理取舍**——值迭代收敛可由 Banach 定理机证，自由能的变分近似难形式验证。产品不追自由能，正确。

### 2.7 `Inv` 不变量 — 硬约束 ∪ 物理包线 ∪ 量纲
- **数学**：不变集 + 量纲齐次性（Buckingham π）+ CBF 不变集 `B(x)≥0` + STL 定量语义。
- **前沿**：CBF 不变集；物理 AI 安全少有量纲层。
- **判定**：✅ **量纲分析层是差异化强项**（多数世界模型无物理正确性约束）；硬约束 / 物理包线 / 量纲三层**正交组合**扎实（`dimAdd` 异量纲返回 `null` 即拦截）。

### 2.8 `M` 他心 — 信念级
- **数学**：他心问题（中文房间）/ 信念后验（AX_PROB）。
- **前沿**：ToM 2.0 / 多智能体心智理论。
- **产品**：`registerAgent` / `beliefAbout` / `deceptionBound`（信念级，诚实标不可判定）。
- **判定**：✅ **诚实边界正确**——"已证明他心"列为猜想（CONJ_OTHER_MIND_REALITY），铁律③禁入证明链。⚠️ 仅建模**对他人的信念**，无**自身不确定性信念状态**（见 §4 第 9 元）。

---

## 3. 跨切层 × 前沿

### 3.1 LCF 可信内核（铁律①②③）
- **数学**：LCF（Milner 1972）= 定理即抽象数据类型，De Bruijn 准则（小内核可复核）。
- **前沿**：AlphaProof / Lean **真正机检**；mathlib ~20 万定理但数据稀缺。
- **判定**：✅ 架构正确——`COMPUTE` 规则是**真机检**（`galoisCheck` 36 样本 0 违反、`verifyHeuristicConsistency` 每次规划实测）。🚩 **`DERIVE` 定理仅"存证可溯"非"机器证明"**——证明文是字符串 + 可选 `check()` 闭包，字符串本身不被小内核机检。TCB 是 JS 运行时 + `check` 闭包，不是独立证明核。建议措辞从"LCF 可信内核"降级为 **"LCF-架构内核（COMPUTE 机验 / DERIVE 存证可溯）"**，避免对 AlphaProof 过度对标。

### 3.2 量纲分析（Buckingham π）
- **数学**：量纲矩阵零空间 → `n−r` 个独立 π 群；π 项数对不上 ⇒ 模型漏变量。
- **前沿**：物理 AI 安全极少此层。
- **判定**：✅ **独特差异化强项**，`unwrapDimValue` / `checkDimensions` 把量纲嵌入能力契约体检。

### 3.3 因果（doQuery / causalDiscovery / counterfactual）
- **数学**：Pearl 阶梯（关联 / 干预 / 反事实）+ do-calculus。
- **前沿**：j-stable 因果（层叠 / sheaf + do-calculus，机制随 regime 变）；ARCADIA（agentic 因果发现）。
- **判定**：✅ 三档齐全（`causalEffect` / `doQuery` / `counterfactual`）。⚠️ `causalDiscovery` 是 PC-lite 离散近似（诚实自标），但**未暴露可识别性假设**（faithfulness / 无环）与置信区间——审计大脑应显式标注"此因果结论建立在哪些假设上、区间多宽"。

### 3.4 保形预测 / 区间抽象（conformal / itv / abs）
- **数学**：可交换性（AX_EXCH）+ 抽象解释 Galois 连接（THM_ABSINT_SOUND）。
- **前沿**：保形预测是分布外不确定量化 SOTA。
- **判定**：✅ 已接（`conformalQuantile` / `itv` / `absFixpoint`），与诚实边界一致——不确定性被**量化**而非隐藏。

---

## 4. 第一性原理下暴露的缺口（独立判断，非捧）

按 ROI 排序：

1. **`f` 无学习分量（最大可用性缺口）**——开放世界 `f` 大多未知，诚实返回 `𝕌` = 不能进新环境。需补"学习的 `f`"，但诚实分层（学习 `f` → `mayHallucinate` → 不进证明链）。
2. **无自身信念状态 `B(X)`（第 9 元候选）**——部分可观测下只有点估计 + 盲区布尔，无 `Δ(X)` 信念分布。建议补 `B`（信念态）或 `Σ`（可知事件 σ-代数）。这是开放世界具身的必需。
3. **语义安全谓词缺失**——物理安全 ≠ 意图安全（"刀递人"）。需 intent-level 安全谓词，或显式声明"物理安全、意图未验"。
4. **无自主等级 / 人机协同升级**——仅 `IRREVERSIBLE-HALT` 一个闸门；对照 DeepMind ASL，需按能力风险触发 human-in-the-loop。
5. **LCF 措辞过度对标**——`DERIVE` 定理非机检；建议"LCF-架构内核（COMPUTE 机验 / DERIVE 存证）"。
6. **因果可识别性未显式标注**——暴露假设 + 区间。
7. **`f` 应为混合动力学**（离散事件 + 连续流）——当前仅图边；`hybridAutomaton` / `hybridStep` 已存在但未接 `f`。
8. **无自然语言 → 公理 自动形式化管线**——IMA 417 公理人工策展，不 scale 到"人类所有数学思想"。需 autoformalization（对标 AlphaProof 8000 万自动形式化语句）。

---

## 5. 产品做对了什么（应 affirm，别改）

- **执行优先**：闭环效用 > 视觉保真——与前沿自身结论（IntPhys 2：所有模型随机 50% vs 人 96.4%；Physics-IQ 最佳 24–42%）一致。产品没追视觉世界模型，正确。
- **诚实退化**：不编造观测 / 动力学——正确第一性原理选择，从根上规避幻觉。
- **量纲物理正确性层**：差异化强项，前沿少有。
- **四道 fail-closed 闸门**：与 CBF / 模块护栏前沿同构。
- **他心诚实标注为猜想**：哲学严谨，铁律③守住证明链纯度。

---

## 6. 建议的最小可执行切片（独立判断，方向由你拍板）

| 切片 | 内容 | ROI | 代码量 |
|---|---|---|---|
| **A** | 补"学习的 `f`" + 诚实分层（消费 `learnWorldModel`/`selfLearn`） | 最高（解锁开放世界） | 中 |
| **B** | 补自身信念状态 `B`/`Σ`（部分可观测） | 高（具身必需） | 中 |
| **C** | LCF 措辞降级 + 因果可识别性显式标注 | 高（零代码、纯诚实对齐） | 低 |
| **D** | 自主等级 + human-in-the-loop 触发 | 中（安全合规） | 中 |
| **E** | `f` 接混合自动机（离散+连续） | 中 | 低（已备 `hybridAutomaton`） |

> 诚实结论：八元组形态本身**成立且不可约**；真正的短板不在"形态"，而在**形态未被喂进开放世界所需的随机 / 学习 / 信念分量**。补这些分量时，必须守住产品立身之本——**确定性内核不被概率分量污染**（铁律③ + grounding 分层）。

---

## 7. 已落地（2026-08-31，用户指令"全改"）

把 §3 缺口 A/B/C/D 全部实现进内核 `灵脑.html`，自测 51/51 + 八元组验收 23/23 全过。

### A. 学习的 `f` + 诚实分层 ✅
- `BrainTuple.f(state, action, opts)` 改为三分支混合动力学：
  - 图边 / 具身预测 → `GROUNDING.KERNEL`（确定性）
  - 学习的 `f`（`setLearnedDynamics` 注入 `learnWorldModel` 线性 SEM）→ `GROUNDING.PERCEPTION`，`mayHallucinate:true`、`usableInProof:false`（**不进证明链**）
  - 二者皆无 → 诚实返回 `𝕌`
- 新增定理 `THM_DYNAMICS_LAYERED`（COMPUTE，带 `check` 闭包）、猜想 `CONJ_LEARNED_F_SOUND`（保真性未证明，禁入证明链）。
- 效果：开放世界未知 `f` 现在可用学习的 `f` 探索，但永远标记为幻觉级、不污染确定性推理。

### B. 自身信念态 `B`（第九元扩展） ✅
- `BrainTuple.B(candidates)` 初始化 `Δ(X)` 上的加权分布；`B_update(obs)` 用观测刷新后验（复用全局 `reconcile`）；熵度量不确定性。
- 诚实标注 `BELIEF-LEVEL` / conjecture 级，**禁入证明链**。
- 新增定理 `THM_BELIEF_LEVEL`（COMPUTE，带 `check`）。
- 效果：部分可观测下大脑维持信念分布而非单点估计，规划可据熵保守/请求更多观测。

### C. LCF 措辞降级 + 因果假设标注 ✅
- 内核头与 `kernelStatus()` 称谓由"LCF 可信内核"改为 **「LCF-架构内核（COMPUTE 机验 / DERIVE 存证）」**，并显式标注 TCB = JS 运行时 + check 闭包；DERIVE 定理字符串不被小证明核机检（避免被 AlphaProof/Lean 专家拆穿）。
- 新增 `CAUSAL_ASSUMPTIONS`（linearity / acyclicity / faithfulness / noUnobservedConfounder / causalSufficiency），挂到 `learnWorldModel`、`causalEffect` 前门/后门返回，审计时亮出因果前提。

### D. 自主等级 + 人机协同 ✅
- 新增 `AUTONOMY`（L0–L5，参照 DeepMind ASL），`riskTierOf(cap)` 给每动作风险等级。
- `execute()` 新增分级闸门：仅当 `opts.humanInTheLoop` 或 `opts.autonomyLevel` 显式启用时，风险等级 > 自主等级且未获人类授权 → `HUMAN-IN-THE-LOOP` 停机。**默认不启用**，保留原 `IRREVERSIBLE-HALT` 行为，且不可逆闸始终最高优先（位于分级段之前）。
- 新增定理 `THM_AUTONOMY_GATE`（DERIVE）。

### 验证
- `node build-umd.js` → `lingnao.umd.js`（导出 209，含 `BrainTuple`/`AUTONOMY`）
- `node test-tuple-eight.js` → 23/23（新增 B / 学习的 f / AUTONOMY 验收）
- `node lingnao-mcp.js --selftest` → 51/51

### 仍待办（本次未做，方向由你拍板）
- E：`f` 接 `hybridAutomaton`/`hybridStep`（离散事件+连续流混合动力学）——代码量低，已备。
- 语义安全谓词（意图级，"刀递人"危险）：当前 `checkHard` 仍为句法硬约束，未覆盖意图安全。
- 自然语言→公理自动形式化管线（对标 AlphaProof 8000 万自动形式化语句）：IMA 公理仍人工策展。
- 发 `lingnao-mcp` npm / 补传 COS `/lingnao/` / 打灵脑 GitHub Release / Smithery 收录——按硬约束待你放行。
