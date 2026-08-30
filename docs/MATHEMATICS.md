# 灵脑数学内核 · 给数学家的审阅文档

> 本文档面向数学/理论计算机科学读者，说明灵脑（LingNao）的**数学内核**到底"实"到什么程度。
> 一句话定位：**它是一个 LCF 式的"结构可信"内核——定理只能由推理规则从公理派生、猜想永远不能当前提；但它对证明"内容"做的是文献断言 + 运行时核对，而不是机器检验。** 下文把这一点讲清楚，并列出我们希望被审视的具体位置。

---

## 0. 给数学家的三句话（先看这个）

1. **结构是真的，内容是声称的。** 内核保证：每一个 `thm` 都只能经由 7 条推理规则从「公理 / 已证明定理」构造出来；任何试图把"猜想"当前提的登记都会被 `verify()` 当场拒绝（测试里含篡改检测）。这是 LCF 思想（Milner 1972）的落地。但是——`DERIVE`/`COMPUTE` 这两条规则里装的，是一条**文献出处 + 一段证明草图 + 一段运行时核对**，而不是从公理机械推导出的形式化证明。所以"De Bruijn 准则"在内核里**只在结构上成立，不在证明内容上成立**。

2. **16 条定理都是教科书级标准结论，陈述正确；本产品的贡献是"集成 + 诚实层"，不是新数学。** 它们分别来自 Kalman(1960)、Bellman(1957)、Artzner et al.(1999)、Pearl(1995)、de Finetti、Vovk–Gammerman–Shafer、Cousot & Cousot(1977)、Rockafellar、Shapley(1953)、Kleene、Nagumo、Buckingham 等。每条陈述你都可以独立核对；内核的新意在于把这些结论**当成可审计的"证书"接进行动决策**，并在判不了时诚实标记 `𝕌`。

3. **它不自称证明辅助器（proof assistant）。** 它自称"裁决脑的地基"。把它当成"一份带依赖图的、可被程序独立复核的数学主张登记簿"，而不是 Coq/Lean，就不会误读。

---

## 1. 这是什么：LCF 可信核的结构

```
公理 (axiom)  ──仅经由──▶  推理规则 (rule)  ──仅产出──▶  定理 (theorem)
                                          ▲
                                          │ 拒绝（铁律③）
                                     猜想 (conjecture)
```

- **公理**：10 条无条件基础，每条都显式标注来源（见 §3）。
- **推理规则**：7 条，数量极小、逻辑上显然，因此内核整体可信：
  `AXIOM`（引用公理）、`MP`（假言推理）、`CONJ`（合取）、`INST`（全称实例化）、`TRANS`（传递）、`DERIVE`（数学推导，须注明 proof）、`COMPUTE`（计算/反射验证）。
- **铁律**：
  - ① `thm` 只能由规则产生，不可手写布尔位冒充。
  - ② 定理的前提必须是公理或已证明定理。
  - ③ **猜想一律不能作为任何定理的前提**（这是"结构上排除幻觉"的关键）。
- **证明链**：`proofChain(id)` 把任一定理回溯到它依赖的公理集合；`verifyAll()` 独立复核全部 16 条链是否闭合。

实测结果（见 §8 如何复现）：

```
verifyAll: ok=true,  theorems=16, axioms=10, conjectures=3, maxDepth=3
verdict  : 全部 16 条定理证明链闭合，均可回溯至公理（无可信缺口）
proofAudit: capabilities=27, proven=27, unproven=0
```

---

## 2. 它**不是**什么（关键边界，避免误读）

| 你可能在想的 | 实际情况 |
|---|---|
| "这是另一个 Coq/Lean？" | 不是。`verify()` 只检查**形式合法性**（规则存在、前提合法、链到公理），**不检查证明内容是否正确**。 |
| "这些定理被程序证明了？" | 没有。它们被**登记**为"引用自文献 X，陈述为 Y，并有运行时核对 Z"。证明正确性依赖原始论文。 |
| "运行时核对能当证明吗？" | 不能。蒙特卡洛 / 有限样本核对（如保形覆盖 ≈0.90、CVaR 3000 次重尾 0 违反）是**支持性证据**，不是证明。 |
| "所以可以放心用？" | 对**已满足前提**的标准情形，结论可靠（因为是标准定理）。但**证书成立的前提必须在运行时确实成立**（见 §7.2），否则证书失效——产品靠标记 `𝕌` 来诚实暴露这一点。 |

---

## 3. 公理（10 条，全部显式溯源）

| ID | 领域 | 陈述 | 来源 |
|---|---|---|---|
| `AX_LOGIC` | 逻辑基础 | 经典一阶逻辑：排中律、无矛盾律、假言推理可靠 | Frege / Russell–Whitehead |
| `AX_SET` | 数学基础 | 集合论 ZFC：外延、并集、幂集、选择（限于可数） | Zermelo–Fraenkel + Choice |
| `AX_REAL` | 分析学 | 实数是有序完备域：域公理 + 序公理 + 戴德金完备性 | Dedekind / Cantor |
| `AX_PROB` | 概率论 | 概率测度公理（Kolmogorov）：非负、规范 P(Ω)=1、可数可加 | Kolmogorov (1933) |
| `AX_ORDER` | 序/格论 | 偏序：自反、反对称、传递；完备格任意子集有上/下确界 | Birkhoff 格论 |
| `AX_EXCH` | 统计学 | 可交换性：联合分布对任意排列不变（弱于 i.i.d.） | de Finetti |
| `AX_LINEAR` | 线性系统 | 叠加原理：齐次性 + 可加性 ⟹ 响应可分解 | 线性空间公理 |
| `AX_GAUSS` | 概率论 | 高斯由均值与协方差完全确定；线性变换与条件化后仍为高斯 | 高斯共轭封闭性 |
| `AX_MEASURE_OPT` | 最优控制 | 最优性原理：全局最优策略的任意后缀也最优（Bellman） | Bellman (1957) |
| `AX_CONVEX` | 凸分析 | 凸集分离定理：凸函数一阶条件是最优性充要条件 | Rockafellar |

---

## 4. 定理（16 条）

每一行：`from` 是它依赖的公理/定理（即证明链根基），`depth` 是到公理的最长链长，`source` 是所引文献，`evidence` 是运行时核对。

| ID | 领域 | 陈述 | from (根基) | depth | 来源 | 运行时核对 |
|---|---|---|---|---|---|---|
| `THM_KLEENE` | 序理论 | 单调函数 F 在完备格上 lfp 存在；Kleene 迭代（配 widening）收敛到过近似 | `AX_ORDER` | 2 | Kleene 不动点定理 | `absFixpoint` 即其实现 |
| `THM_ABSINT_SOUND` | 抽象解释 | Galois 连接 α(c)⊑a ⟺ c≤γ(a) ⟹ 抽象解释 sound | `AX_ORDER`,`THM_KLEENE` | 3 | Cousot & Cousot (1977) | `galoisCheck` 36 组 0 违反 |
| `THM_ASTAR_OPTIMAL` | 图搜索 | 启发式一致 ⟹ A* 最优 | `AX_ORDER`,`AX_MEASURE_OPT` | 2 | 标准 A* 理论 | `verifyHeuristicConsistency` 每次实测 |
| `THM_HUNGARIAN_OPTIMAL` | 组合优化 | 对偶可行 ∧ 互补松弛 ∧ 强对偶 ⟹ 分配整数最优 | `AX_CONVEX` | 2 | 全单模 + 强对偶 | 返回 (u,v) 对偶证书 |
| `THM_SHAPLEY_UNIQUE` | 博弈论 | 满足四公理的归因唯一，由 Shapley 公式给出 | `AX_SET` | 2 | Shapley (1953) | 每次自检效率公理 |
| `THM_BAYES_CONJUGACY` | 贝叶斯 | Beta 是 Bernoulli 共轭先验 ⟹ 后验可精确递推 | `AX_PROB` | 2 | 共轭性 | `SelfLearn` 可靠度递推 |
| `THM_CONFORMAL_COVERAGE` | 统计推断 | 可交换 ⟹ P(Y∈Ĉ) ≥ 1−α（有限样本、分布无关） | `AX_EXCH`,`AX_PROB` | 2 | Vovk–Gammerman–Shafer | 4 分布蒙特卡洛 ≈0.90 |
| `THM_CVAR_COHERENT` | 风险理论 | CVaR 满足四性 ⟹ 一致性风险度量 | `AX_PROB`,`AX_CONVEX` | 2 | Artzner et al. (1999) | 3000 次重尾：CVaR 0 违反 / VaR 535 |
| `THM_KALMAN_MINVAR` | 状态估计 | 线性+高斯 ⟹ 卡尔曼最小方差无偏（高斯下即后验均值） | `AX_GAUSS`,`AX_PROB`,`AX_LINEAR` | 2 | Kalman (1960) | MSE 较直接观测改善 6.0× |
| `THM_PARTICLE_CONSISTENT` | 蒙特卡洛 | 重要采样粒子近似 N→∞ 一致收敛（有限 N 为近似） | `AX_PROB` | 2 | 大数定律 | 双峰歧义保持 ±2 |
| `THM_LQR_OPTIMAL` | 最优控制 | 线性+二次代价 ⟹ u=−Kx（K 由 DARE）最优 | `AX_LINEAR`,`AX_MEASURE_OPT`,`AX_CONVEX` | 2 | Kalman (1960) 动态规划 | 代价精确等于理论下界 |
| `THM_LQG_SEPARATION` | 随机控制 | 卡尔曼与 LQR 可独立设计，组合仍 LQG 最优（分离原理） | `AX_LINEAR`,`AX_PROB`,`AX_MEASURE_OPT`,`AX_CONVEX` | 2 | Wonham (1968) 分离原理 | 两 Riccati 对偶性；独立性前提取文献，未运行时核验 |
| `THM_CBF_INVARIANCE` | 安全控制 | ∃h 使 L_f h+L_g h·u ≥ −α(h) ⟹ 安全集前向不变 | `AX_REAL`,`AX_CONVEX` | 2 | Nagumo 前向不变性 | `cbfFilter` 返回可行性+margin |
| `THM_ZONOTOPE_SOUND` | 可达性 | Zonotope 对线性变换与 Minkowski 和封闭 ⟹ 可达集过近似可信 | `AX_LINEAR`,`AX_SET` | 2 | 生成元表示封闭性 | `zonoReach.sound` 由本定理支撑 |
| `THM_DO_CALCULUS` | 因果推断 | 满足后门/前门准则 ⟹ P(Y\|do(X)) 可由观测识别 | `AX_PROB` | 2 | Pearl (1995) do-演算 | 合成数据 ACE 还原真值 |
| `THM_BUCKINGHAM_PI` | 量纲分析 | 量纲变换下不变 ⟹ 可化为无量纲 π 齐次函数 | `AX_REAL` | 2 | Buckingham π 定理 | `dimAdd` 异量纲相加返回 null |

> **证明性质统一说明**：表中 `source` 列是结论的**原始出处**，`evidence` 列是产品内的**运行时核对**。这两者都不等于"内核从公理推出了该结论"。内核里该定理的 `proof` 字段是一段指向 `source` 的草图；`verify()` 只确认登记结构合法。

---

## 5. 猜想（3 条，明确未证明，禁止进入证明链）

| ID | 领域 | 陈述 | 现有证据 | 诚实状态 |
|---|---|---|---|---|
| `CONJ_POMDP_APPROX` | 规划 | 确定化重规划在部分可观下后悔有界 | 工程广泛有效；精确 POMDP 为 PSPACE-complete，无一般近似保证 | 未证明，仅用经验 |
| `CONJ_NONLINEAR_REACH` | 可达性 | 一般非线性系统可达集可由有限步过近似任意逼近 | 一般非线性可达性不可判定；仅受限系统类成立 | 未证明，划界已知 |
| `CONJ_HEURISTIC_EVOLVE_MONOTONE` | 启发式 | 融合学习启发式在重复执行下单调改善且不破坏可采纳性 | 可采纳性由 Pearl 定理保证；"效率单调改善"仅实验支持 | 半证明，半猜想 |

这 3 条**永远不会**出现在任何定理的前提里——这是内核结构性保证的，不是约定。

---

## 6. 证明深度：仅一条链到深度 3

- `THM_ABSINT_SOUND`：公理 → `THM_KLEENE` → `THM_ABSINT_SOUND`（深度 3）

`THM_LQG_SEPARATION` 已改为 `DERIVE`（Wonham 1968 分离原理，独立定理），直接挂在支撑公理上，深度 2。其余 15 条深度均为 2（直接挂在公理或单个中间定理上）。**最大深度仅 3**——这是有意为之：链越短越可被人类逐条复核，也越难藏匿"裸断言"。代价是内核不做任何深的形式化发展。

依赖图见 [`kernel-dag.svg`](./kernel-dag.svg)。

---

## 7. 需要数学家审视的几点（诚实清单，欢迎挑刺）

**7.1 分离原理的登记方式（已修正）。** 原 `THM_LQG_SEPARATION` 用 `CONJ` 从卡尔曼+LQR 推出，已改为 `DERIVE`（Wonham 1968 分离原理，独立定理），`from` 改为支撑公理 `AX_LINEAR`/`AX_PROB`/`AX_MEASURE_OPT`/`AX_CONVEX`，证明深度由 3 降为 2，并在 `proof` 注明"估计误差/控制独立性"前提取文献、本内核未运行时核验其证书。这是**登记标签修正，不影响陈述正确性**。

**7.2 证书成立依赖运行时前提，内核不替你验证前提。** 例如：
- `THM_KALMAN_MINVAR` 要求"线性 + 高斯"。若实际系统非线性/非高斯，证书即失效；
- `THM_CONFORMAL_COVERAGE` 要求"可交换性"。若数据存在分布漂移/时序相关，覆盖保证失效。
产品的诚实机制是：当无法验证前提时标记 `𝕌`（不可判定），而不是冒充已证明。但这是**运行时诚实**，不是**前提自动验证**——数学家应关注：哪些前提目前**根本没有运行时检查**（即"默认可用"），那是最薄弱处。

**7.3 `sound` 标记是"由定理派生"而非"由实现证明"。** `absFixpoint` / `zonoReach` 现返回 `basis:'THM_ABSINT_SOUND'` / `'THM_ZONOTOPE_SOUND'`，`sound` 由 `MathKernel.get(id)` 派生。但内核并**没有证明"本次具体实现正确实例化了 Galois 连接 / 生成元表示"**——`galoisCheck`(36 组)、`zonoReach` 的 sound 标记是**合理性核对**，不是实现正确性证明。这一步若要闭环，需要把实现本身形式化。

**7.4 证据是有限样本的。** 所有 `evidence` 中的蒙特卡洛数字都是有限样本经验，支持但不证明。

**7.5 没有"负结果"登记。** 内核目前只登记"成立的"。诸如"一般非线性可达性不可判定"（见 `CONJ_NONLINEAR_REACH` 证据）这类**已知不可为**，仅作为猜想证据出现，未上升为带证明的"不可能定理"。这是未来可补的方向。

---

## 8. 如何复现与独立复核

```bash
cd /d/Projects/genesis-plan/lingnao
node -e "const L=require('./lingnao.umd.js'); \
  console.log(JSON.stringify(L.kernelVerify(),null,1)); \
  console.log(JSON.stringify(L.proofAudit().verdict)); \
  console.log(JSON.stringify(L.theoremOf('safety')));"
# 篡改检测：试图把猜想当定理前提会被拒绝
node test-math-kernel.js     # 含 33 项，其中含"非法前提应被拒"的防篡改用例
```

`verifyAll()` 的判定是**独立的、可重复的**——它不读取任何外部状态，只遍历内核内的 `thm` 集合回溯链，符合 De Bruijn 准则的"可独立复核"精神（注意：是结构复核，非内容复核，见 §2）。

机器可读的完整登记（公理/定理/猜想原文、依赖、根源）见 [`kernel-formal.json`](./kernel-formal.json)。

---

## 9. 邀请：把"结构可信"升级为"内容可信"

内核现在的状态是**结构可信、内容声称**。对数学严谨性而言，最有价值的下一步是：

> 把 §3 的 10 条公理 + §4 的 16 条定理**陈述**移植到 Lean 4 / Coq，用真正的证明辅助器把 `proof` 草图补成可机器检验的推导。

这样灵脑就从"一份可被程序复核的依赖登记簿"升级为"一份可被证明辅助器验证的数学基础"——届时 `verify()` 的结构检查与 Lean/Coq 的内容检查互补，任何一条定理的"凭什么可靠"都能给出**端到端**答案。

我们欢迎数学/形式化方法方向的读者：
- 核对其余定理陈述的精确性；
- 指出 §7 中任何一处我们高估了自身的地方；
- 或直接参与把内核形式化到 Lean/Coq 的工作。

**核心原则不变：** 凡追不到一条证明链的结论，灵脑宁可标 `𝕌`（不可判定），也绝不冒充已证明。这是它作为"裁决脑"对数学诚实的承诺。
