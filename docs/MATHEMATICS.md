# 灵脑数学内核 · 给数学家的审阅文档

> 本文档面向数学/理论计算机科学读者，说明灵脑（LingNao）的**数学内核**到底"实"到什么程度。
> 一句话定位：**它是一个 LCF 式的"结构可信"内核——定理只能由推理规则从公理派生、猜想永远不能当前提；但它对证明"内容"做的是文献断言 + 运行时核对，而不是机器检验。** 下文把这一点讲清楚，并列出我们希望被审视的具体位置。

---

## 0. 给数学家的三句话（先看这个）

1. **结构是真的，内容是分层的。** 内核保证：每一个 `thm` 都只能经由 7 条推理规则从「公理 / 已证明定理」构造出来；任何试图把"猜想"当前提的登记都会被 `verify()` 当场拒绝（测试里含篡改检测）。这是 LCF 思想（Milner 1972）的落地。但"内容"分两层（详见 §2.5）：`DERIVE` 装的是**文献出处 + 一段证明草图 + 一段运行时核对**，并非从公理机械推导的形式化证明；而 `COMPUTE` 不同——它要求登记时附一个 `check()` 函数，`verify()` 会**真正运行**它，返回 true 才算通过（这是真·机器检查，不是断言）。所以"De Bruijn 准则"在内核里：**结构上成立；内容上对 DERIVE 仅成立为文献断言，对 COMPUTE 则已是机器检查。**

2. **21 条定理都是教科书级标准结论，陈述正确；本产品的贡献是"集成 + 诚实层"，不是新数学。** 它们分别来自 Kalman(1960)、Bellman(1957)、Artzner et al.(1999)、Pearl(1995)、de Finetti、Vovk–Gammerman–Shafer、Cousot & Cousot(1977)、Rockafellar、Shapley(1953)、Kleene、Nagumo、Buckingham、Cauchy–Lipschitz、Weierstrass、Banach 等。每条陈述你都可以独立核对；内核的新意在于把这些结论**当成可审计的"证书"接进行动决策**，并在判不了时诚实标记 `𝕌`。

3. **它不自称证明辅助器（proof assistant）。** 它自称"裁决脑的地基"。把它当成"一份带依赖图的、可被程序独立复核的数学主张登记簿"，而不是 Coq/Lean，就不会误读。

---

## 1. 这是什么：LCF 可信核的结构

```
公理 (axiom)  ──仅经由──▶  推理规则 (rule)  ──仅产出──▶  定理 (theorem)
                                          ▲
                                          │ 拒绝（铁律③）
                                     猜想 (conjecture)
```

- **公理**：11 条无条件基础，每条都显式标注来源（见 §3）。
- **推理规则**：7 条，数量极小、逻辑上显然，因此内核整体可信：
  `AXIOM`（引用公理）、`MP`（假言推理）、`CONJ`（合取）、`INST`（全称实例化）、`TRANS`（传递）、`DERIVE`（数学推导，须注明 proof）、`COMPUTE`（计算/反射验证，`verify()` **实际执行**其 `check()`）。
- **铁律**：
  - ① `thm` 只能由规则产生，不可手写布尔位冒充。
  - ② 定理的前提必须是公理或已证明定理。
  - ③ **猜想一律不能作为任何定理的前提**（这是"结构上排除幻觉"的关键）。
- **证明链**：`proofChain(id)` 把任一定理回溯到它依赖的公理集合；`verifyAll()` 独立复核全部 21 条链是否闭合。

实测结果（见 §8 如何复现）：

```
verifyAll: ok=true,  theorems=21, axioms=11, conjectures=4, maxDepth=3
verdict  : 全部 21 条定理证明链闭合，均可回溯至公理（无可信缺口）
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

## 2.5 两层信任：内核到底"检查"了什么（用数学思想重做后的核心）

把"可信"拆成两层，才不会夸大也不会低估：

- **Tier 0 —— 机器检查（真正由程序执行）**
  1. *出处合法性*：`verify()` 对每条定理确认——规则存在、前提都是公理/已证定理（非猜想）、证明链无环、可回溯到公理。这层对所有 21 条定理都跑（篡改检测见 §7 与 `test-math-kernel.js`）。
  2. *计算验证*：`COMPUTE` 规则要求登记时附 `check()` 函数，`verify()` **实际运行**它，返回 true 才算通过。`THM_IA_INCLUSION`（区间加法包含性）即此例：它用有限样本表实算 `[a,b]+[c,d]⊆[a+c,b+d]`，审计时真跑、不靠断言。

- **Tier 1 —— 文献断言（内容需外部核验）**
  - 20 条 `DERIVE` 定理：登记的是"引用自文献 X、陈述为 Y、并有运行时核对 Z"。`proof` 字段是一段指向 `source` 的草图。`verify()` **不检查这段证明在形式上是否正确**——正确性依赖原始论文。运行时核对（蒙特卡洛、对偶证书等）是**支持性证据，不是证明**。

> 一句话：**Tier 0 保证"登记没造假、COMPUTE 结论真算过"；Tier 1 保证"陈述是标准数学结论、且标了出处和证据"。** 内核从不声称 Tier 1 已被机器证明。把 Tier 1 升级为机器证明的正确路径是 §9 的 Lean/Coq 形式化。

配套说明：7 条推理规则里，`CONJ` 已可通过 `MathKernel.conjoin(a,b)` **真实构造** A∧B；`COMPUTE` 已如上**真实执行**；`AXIOM/MP/INST/TRANS` 已登记为合法规则，但当前 21 条定理均用 `DERIVE`（文献派生）而非逐条手工拼装——这是刻意的：内核是"数学主张登记簿"，不是交互式证明器。

---

## 3. 公理（11 条，全部显式溯源）

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
| `AX_CONTINUITY` | 拓扑/分析 | 在标准拓扑/度量空间（ℝⁿ 欧氏、测度与函数空间的弱/强拓扑）中极限、收敛、连续映射良定义；局部 Lipschitz 的 f 使动力学流 φ_t 存在唯一 | 标准拓扑与泛函分析；Cauchy–Lipschitz |

---

## 4. 定理（21 条）

每一行：`from` 是它依赖的公理/定理（即证明链根基），`depth` 是到公理的最长链长，`source` 是所引文献，`evidence` 是运行时核对。标 ★ 者为本次用数学思想审视后新增（见 §6.5）。

| ID | 领域 | 陈述 | from (根基) | depth | 来源 | 运行时核对 |
|---|---|---|---|---|---|---|
| `THM_KLEENE` | 序理论 | 单调函数 F 在完备格上 lfp 存在；Kleene 迭代（配 widening）收敛到过近似 | `AX_ORDER` | 2 | Kleene 不动点定理 | `absFixpoint` 即其实现 |
| `THM_ABSINT_SOUND` | 抽象解释 | Galois 连接 α(c)⊑a ⟺ c≤γ(a) ⟹ 抽象解释 sound | `AX_ORDER`,`THM_KLEENE` | 3 | Cousot & Cousot (1977) | `galoisCheck` 36 组 0 违反 |
| ★ `THM_ODE_EXISTENCE` | 常微分方程 | f 局部 Lipschitz ⟹ ẋ=f(x,u) 的解 φ_t 局部存在唯一 | `AX_REAL`,`AX_CONTINUITY` | 2 | Cauchy–Lipschitz / Picard–Lindelöf | CBF/可达集/LQR 的"流"都建立于此 |
| ★ `THM_WEIERSTRASS` | 实分析 | 紧集上连续函数必取到最大/最小值 ⟹ 最优值存在 | `AX_REAL`,`AX_CONVEX`→含 `AX_CONTINUITY` | 2 | 极值定理 | LQR/匈牙利/CBF 的"最优解存在"依赖之 |
| ★ `THM_BANACH_FP` | 泛函分析 | 完备度量空间上压缩映射有唯一不动点，迭代收敛 | `AX_REAL`,`AX_CONTINUITY` | 2 | Banach 不动点定理 | 值迭代/策略迭代/A* 一致收敛性的地基 |
| ★ `THM_LLN` | 概率极限 | 独立同分布样本均值依概率收敛到期望 | `AX_PROB`,`AX_REAL` | 2 | 大数定律（Chebyshev） | 粒子滤波/蒙特卡洛一切收敛断言的地基 |
| `THM_ASTAR_OPTIMAL` | 图搜索 | 启发式一致 ⟹ A* 最优 | `AX_ORDER`,`AX_MEASURE_OPT` | 2 | 标准 A* 理论 | `verifyHeuristicConsistency` 每次实测 |
| `THM_HUNGARIAN_OPTIMAL` | 组合优化 | 对偶可行 ∧ 互补松弛 ∧ 强对偶 ⟹ 分配整数最优 | `AX_LINEAR`,`AX_CONVEX` | 2 | 全单模 + 强对偶 | 返回 (u,v) 对偶证书 |
| `THM_SHAPLEY_UNIQUE` | 博弈论 | 满足四公理的归因唯一，由 Shapley 公式给出 | `AX_SET` | 2 | Shapley (1953) | 每次自检效率公理 |
| `THM_BAYES_CONJUGACY` | 贝叶斯 | Beta 是 Bernoulli 共轭先验 ⟹ 后验可精确递推 | `AX_PROB` | 2 | 共轭性 | `SelfLearn` 可靠度递推 |
| `THM_CONFORMAL_COVERAGE` | 统计推断 | 可交换 ⟹ P(Y∈Ĉ) ≥ 1−α（有限样本、分布无关） | `AX_EXCH`,`AX_PROB` | 2 | Vovk–Gammerman–Shafer | 4 分布蒙特卡洛 ≈0.90 |
| `THM_CVAR_COHERENT` | 风险理论 | CVaR 满足四性 ⟹ 一致性风险度量 | `AX_PROB`,`AX_CONVEX` | 2 | Artzner et al. (1999) | 3000 次重尾：CVaR 0 违反 / VaR 535 |
| `THM_KALMAN_MINVAR` | 状态估计 | 线性+高斯 ⟹ 卡尔曼最小方差无偏（高斯下即后验均值） | `AX_GAUSS`,`AX_PROB`,`AX_LINEAR` | 2 | Kalman (1960) | MSE 较直接观测改善 6.0× |
| `THM_PARTICLE_CONSISTENT` | 蒙特卡洛 | 重要采样粒子近似 N→∞ 一致收敛（有限 N 为近似） | `AX_PROB`,`THM_LLN` | 3 | 大数定律 | 双峰歧义保持 ±2 |
| `THM_LQR_OPTIMAL` | 最优控制 | 线性+二次代价 ⟹ u=−Kx（K 由 DARE）最优 | `AX_LINEAR`,`AX_MEASURE_OPT`,`AX_CONVEX`,`THM_WEIERSTRASS` | 3 | Kalman (1960) 动态规划 | 代价精确等于理论下界 |
| `THM_LQG_SEPARATION` | 随机控制 | 卡尔曼与 LQR 可独立设计，组合仍 LQG 最优（分离原理） | `AX_LINEAR`,`AX_PROB`,`AX_MEASURE_OPT`,`AX_CONVEX` | 2 | Wonham (1968) 分离原理 | 两 Riccati 对偶性；独立性前提取文献，未运行时核验 |
| `THM_CBF_INVARIANCE` | 安全控制 | ∃h 使 L_f h+L_g h·u ≥ −α(h) ⟹ 安全集前向不变 | `AX_REAL`,`AX_CONVEX`,`THM_ODE_EXISTENCE`,`THM_WEIERSTRASS` | 3 | Nagumo 前向不变性 | `cbfFilter` 返回可行性+margin |
| `THM_ZONOTOPE_SOUND` | 可达性 | Zonotope 对线性变换与 Minkowski 和封闭 ⟹ 可达集过近似可信 | `AX_LINEAR`,`AX_SET` | 2 | 生成元表示封闭性 | `zonoReach.sound` 由本定理支撑 |
| `THM_DO_CALCULUS` | 因果推断 | 满足后门/前门准则 ⟹ P(Y\|do(X)) 可由观测识别 | `AX_PROB` | 2 | Pearl (1995) do-演算 | 合成数据 ACE 还原真值 |
| `THM_BUCKINGHAM_PI` | 量纲分析 | 量纲变换下不变 ⟹ 可化为无量纲 π 齐次函数 | `AX_REAL` | 2 | Buckingham π 定理 | `dimAdd` 异量纲相加返回 null |
| ★ `THM_IA_INCLUSION` | 区间算术 | [a,b]+[c,d] ⊆ [a+c,b+d]（COMPUTE：verify 实际运行有限样本核对） | （无前提，Tier0 机器检查） | 1 | 区间算术定义 | `verify()` 运行 `check()` 返回 true |
| `THM_MODEL_FREE_CBF` | 安全控制（无模型） | RBF 核从 safe/unsafe 轨迹学得分离屏障 h，h>0 判安全；前向不变性仅在经验裕度内局部成立 | `AX_REAL` | 1 | Kernel-Based Learning of Safety Barriers (JAIR 2026) 思想；Romdlony&Jayawardhana 2016 CLBF 数据驱动版 | 训练符号一致率≥0.9 才判 safe；样本不足/不可分诚实标 𝕌（非 THM_CBF_INVARIANCE 的 Tier0 全局保证） |
| `THM_COUNTERFACTUAL_AUDIT` | 审计/安全 | 对计划每步施加硬干预（remove/negate-premise/flip-effect），存在关键步 ⇒ 反事实脆弱（当前安全但非鲁棒） | `AX_SET` | 1 | Project Ariadne (Khanzadeh 2026) 结构因果硬干预思想 | 缺 premise/effect 信息步 ⇒ 诚实标 𝕌 |
| `THM_GODEL_INCOMPLETENESS` | 安全边界（元） | 有限护栏规则集不可覆盖无限对抗提示空间 ⇒ 绝对安全在数学上不可能；须标记第三类（不可判定）并保守处理 | `AX_SET`,`AX_REAL` | 1（采纳外部证明，非自证） | Vassilev (NIST, IEEE S&P 2026) 哥德尔不完备性形式化 | 灵脑"第三类集合 + 𝕌 标记"即其工程落地；本定理为采纳外部同行评议结论，内核不重证 |

> **证明性质统一说明**：表中 `source` 列是结论的**原始出处**，`evidence` 列是产品内的**运行时核对**。这两者都不等于"内核从公理推出了该结论"（★ 中 `THM_ODE_EXISTENCE` 等四条是 `DERIVE`：文献派生草图；唯 `THM_IA_INCLUSION` 是 `COMPUTE`：内核真正执行计算验证，见 §2.5）。内核里 `DERIVE` 定理的 `proof` 字段是一段指向 `source` 的草图；`verify()` 只确认登记结构合法（并对 `COMPUTE` 实跑 `check()`）。

---

## 5. 猜想（4 条，明确未证明，禁止进入证明链）

| ID | 领域 | 陈述 | 现有证据 | 诚实状态 |
|---|---|---|---|---|
| `CONJ_POMDP_APPROX` | 规划 | 确定化重规划在部分可观下后悔有界 | 工程广泛有效；精确 POMDP 为 PSPACE-complete，无一般近似保证 | 未证明，仅用经验 |
| `CONJ_NONLINEAR_REACH` | 可达性 | 一般非线性系统可达集可由有限步过近似任意逼近 | 一般非线性可达性不可判定；仅受限系统类成立（依赖 `AX_CONTINUITY` 下的流良定义） | 未证明，划界已知 |
| `CONJ_HEURISTIC_EVOLVE_MONOTONE` | 启发式 | 融合学习启发式在重复执行下单调改善且不破坏可采纳性 | 可采纳性由 Pearl 定理保证；"效率单调改善"仅实验支持 | 半证明，半猜想 |
| `CONJ_NUMERIC_SOUND` | 数值分析 | IEEE-754 浮点运算是 ℝ 运算的 δ-有界近似，全部数值结论在误差带内保持 sound | 全部定理在 ℝ 上成立，实装用双精度；区间/zonotope 过近似正是为吞掉该 δ 而设计，精确 δ 边界需 IEEE 754-2019 逐算法核定 | 未证明（诚实：本内核未做浮点 sound 的逐算法认证） |

这 4 条**永远不会**出现在任何定理的前提里——这是内核结构性保证的，不是约定。其中 `CONJ_NUMERIC_SOUND` 是本次审视后补上的"实现诚实"缺口：所有 `DERIVE` 定理在 ℝ 上成立，但产品跑在浮点上，二者之间的桥梁此前未被任何公理/定理覆盖。

---

## 6. 证明深度：4 条链到深度 3

深度 3 的链（本次审视后增至 4 条，因诚实地把"被隐式依赖却未登记"的中间定理显式化了）：

- `THM_ABSINT_SOUND`：公理 → `THM_KLEENE` → `THM_ABSINT_SOUND`（深度 3）
- `THM_CBF_INVARIANCE`：公理 → `THM_ODE_EXISTENCE` / `THM_WEIERSTRASS` → `THM_CBF_INVARIANCE`（深度 3）
- `THM_LQR_OPTIMAL`：公理 → `THM_WEIERSTRASS` → `THM_LQR_OPTIMAL`（深度 3）
- `THM_PARTICLE_CONSISTENT`：公理 → `THM_LLN` → `THM_PARTICLE_CONSISTENT`（深度 3）

其余 17 条深度为 2（直接挂在公理或单个中间定理上），`THM_IA_INCLUSION` 为 `COMPUTE` 深度 1。**最大深度仅 3**——这是有意为之：链越短越可被人类逐条复核，也越难藏匿"裸断言"。代价是内核不做任何深的形式化发展。

依赖图（由 `kernel-formal.json` 自动生成，计数永不手写硬编码）见 [`kernel-dag.svg`](./kernel-dag.svg)；重生成命令见 §8。

---

## 6.5 用数学的思想重新审视内核：本次增补了什么、为什么

用户要求"用数学的思想审视现有的东西，包括公理定理是否需要其它的"。下面是本次的审视结论与动作。**审视的出发点**：把内核当成一份"行动决策的数学地基"来检验——凡是上层能力在推理中**实际用到**、却在内核里**没有对应公理/定理支撑**的数学前提，都是缺口。

### 6.5.1 审视发现的 5 个缺口（此前未显式登记）

1. **没有连续性 / 拓扑公理。** 八元组里的动力学 `f`、可达集、以及一切"收敛"（Kleene 迭代、粒子滤波 N→∞）都预设了一个拓扑/度量空间。此前内核只有 `AX_REAL`（ℝ 的代数与序），没有"极限/连续/流良定义"的公理。→ **补 `AX_CONTINUITY`**。

2. **常微分方程解的存在唯一性（Cauchy–Lipschitz）被使用却从未陈述。** `THM_CBF_INVARIANCE`、`THM_ZONOTOPE_SOUND`、可达性分析、LQR 全部默认"解流 φ_t(x) 存在"。但 `THM_CBF_INVARIANCE` 的 `proof` 写的是 Nagumo 前向不变性——它**本身就以流的存在为前提**。→ **补 `THM_ODE_EXISTENCE`**，并让 CBF 真正引用它。

3. **"最优值存在"被默认，却无极值定理。** 每条最优控制/最优分配定理都暗含"最优解**存在**"。但存在性需要紧性 + 连续性（Weierstrass），此前内核没有这条。没有它，"最优性"只能谈下界，谈不上"取到"。→ **补 `THM_WEIERSTRASS`**，并让 LQR / CBF 引用它。

4. **Banach 不动点是迭代收敛的真正引擎，却缺失。** Kleene 覆盖了序格上的单调不动点；但值迭代、策略迭代、一致启发式 A* 的收敛是**度量空间上的压缩映射**收敛，属 Banach 不动点。两条互补，此前只有 Kleene 一条。→ **补 `THM_BANACH_FP`**。

5. **大数定律（LLN）在粒子滤波证明里被口头引用，却未登记。** `THM_PARTICLE_CONSISTENT` 的 `proof` 写"大数定律：加权经验测度 → 后验测度"，但 LLN 是可由 `AX_PROB`+`AX_REAL` 派生的**定理**，不是公理，应当显式登记。→ **补 `THM_LLN`**，并让粒子滤波真正引用它。

### 6.5.2 审视发现的"依赖登记偏弱"（已修正）

- `THM_HUNGARIAN_OPTIMAL` 原只引 `AX_CONVEX`；但"LP 最优解自动整数"靠约束矩阵**全单模**（线性代数），应补 `AX_LINEAR`。→ 已补。
- `THM_CBF_INVARIANCE`、`THM_LQR_OPTIMAL` 原未引存在性/流；→ 已补 `THM_ODE_EXISTENCE` + `THM_WEIERSTRASS`（见 §4 from 列）。

### 6.5.3 审视发现的最薄弱处（实现诚实）

- **ℝ 与 IEEE-754 浮点之间的桥梁此前完全空白。** 所有 `DERIVE` 定理在 ℝ 上成立，但产品实装用双精度浮点，舍入误差可能让"sound"在边界处失效。→ **补 `CONJ_NUMERIC_SOUND`**（诚实标记为未证明的猜想：精确 δ 边界需逐算法按 IEEE 754-2019 核定，本内核未做）。区间/zonotope 过近似之所以设计成"过近似"，正是为了吞掉这个 δ——这是现有的缓解，不是证明。

### 6.5.4 审视后**未**改动的（刻意保持最小信任面）

- `AX_SET`(ZFC) 被 `THM_SHAPLEY_UNIQUE`/`THM_ZONOTOPE_SOUND` 引用偏重（Shapley 其实只需有限集组合、Zonotope 只需向量空间）——但 ZFC 作为"集合/向量存在"的基础可辩护，未拆分。
- `AX_MEASURE_OPT`(Bellman 最优性原理) 严格说是动态规划**推导出的定理**而非物理定律；但作为"我们操作的问题类具备最优子结构/马尔可夫性"的假设性公理保留，并在 §7.2 标注其边界。
- 未新增"信息论/熵"公理：Shannon 熵 H=−∫p log p 可由 `AX_PROB`+`AX_REAL` 派生，无需独立公理。

> **审视结论**：内核的数学地基从"10 公理 / 16 定理"升级为"11 公理 / 21 定理 / 4 猜想"，新增项全部是**上层能力已在用的、此前隐式依赖**的标准数学，而非新创；最大证明深度保持 3。这让"每个能力凭什么可靠"的答案更完整，也把"浮点 vs 实数"这一真正未决处诚实地暴露为 `CONJ_NUMERIC_SOUND`。

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

**7.6 两层信任已落地，但 Tier 1 仍是文献断言（本次重做的关键诚实点）。** 本次审视后，`COMPUTE` 不再是装饰：`verify()` 确实运行 `THM_IA_INCLUSION` 的 `check()`（Tier 0 机器检查，见 §2.5）。但其余 20 条 `DERIVE` 定理的内容正确性仍依赖原始论文，内核只做结构复核 + 运行时证据。数学家特别应盯住两点：(a) `THM_LQG_SEPARATION` 的"估计误差/控制独立性"前提仅取自文献、未运行时核验（§7.1）；(b) `CONJ_NUMERIC_SOUND` 暴露的"浮点 vs 实数"桥梁尚未被任何公理/定理闭合——这是目前最真实的未决项，不是措辞问题。

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

机器可读的完整登记（公理/定理/猜想原文、依赖、根源）见 [`kernel-formal.json`](./kernel-formal.json)；证明依赖图见 [`kernel-dag.svg`](./kernel-dag.svg)。两者都**由代码单一真源自动生成**，不会与内核背离：

```bash
cd /d/Projects/genesis-plan/lingnao
node build-umd.js            # 从 灵脑.html 单一真源重建 UMD（内核实况）
node gen-kernel-formal.js    # 由 UMD 抽取 → docs/kernel-formal.json（含每条定理的计算 depth/axioms）
node gen-kernel-dag.js       # 由 kernel-formal.json → docs/kernel-dag.svg（分层 DAG，计数自动同步）
```

> 设计要点：内核是单一真源（`灵脑.html` → `lingnao.umd.js`），`kernel-formal.json` 与 `kernel-dag.svg` 都是**衍生产物**，改内核后跑上面三条即同步；文档里的计数/依赖表（§3–§6）也以 `kernel-formal.json` 为准，不再手写硬编码。

---

## 9. 邀请：把"结构可信"升级为"内容可信"

内核现在的状态是**结构可信、内容声称**。对数学严谨性而言，最有价值的下一步是：

> 把 §3 的 11 条公理 + §4 的 21 条定理**陈述**移植到 Lean 4 / Coq，用真正的证明辅助器把 `proof` 草图补成可机器检验的推导（其中 `THM_IA_INCLUSION` 已是 `COMPUTE`，可在 Lean 里直接写成可执行的 `decidable` 命题）。

这样灵脑就从"一份可被程序复核的依赖登记簿"升级为"一份可被证明辅助器验证的数学基础"——届时 `verify()` 的结构检查与 Lean/Coq 的内容检查互补，任何一条定理的"凭什么可靠"都能给出**端到端**答案。

我们欢迎数学/形式化方法方向的读者：
- 核对其余定理陈述的精确性；
- 指出 §7 中任何一处我们高估了自身的地方；
- 或直接参与把内核形式化到 Lean/Coq 的工作。

**核心原则不变：** 凡追不到一条证明链的结论，灵脑宁可标 `𝕌`（不可判定），也绝不冒充已证明。这是它作为"裁决脑"对数学诚实的承诺。
