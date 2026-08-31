# 灵脑代码架构重审（按数学思想 + 前沿技术）— 2026-08-31

> 目的：用户要求"按各种数学思想和前沿技术，重新审视架构；架构完了之后审视代码"。
> 本文是**架构审视 + 代码审视**的诊断与方案，不动内核逻辑；落地方案见 §4，由用户拍板。

---

## 0. 结论先行（三档）

- **已就位且正确（保留）**：内核数学工具极丰富（A\* / 因果 do-演算 / 卡尔曼·粒子 / CBF·LQR·Zonotope·STL·混合自动机 / 不精确概率 D-S / 守恒律 Noether / 他心 KD45 / 实践理论闭环 / minimax / 粗糙集 / f-散度 / 混沌 / 可计算性 / 量纲 Buckingham π…），均确定性、可审计、带诚实 UNKNOWN 边界。
- **架构层欠账（本次重审主线）**：
  1. 单文件 6177 行 `<script>`，平铺函数 + 注释分区，**无真正模块边界**；
  2. LCF 定理层是**叙述性字符串登记**，proof 不被小内核机检（能力→定理映射无加载期校验 ⇒ 证明链可静默漂移）；
  3. **按"算法类别"组织，未按"数学思想"组织**（用户主诉）——找"归纳思想"要跨 5 个注释区拼凑；
  4. 导出白名单 `EXPORT_NAMES` 手写维护，易漏；
  5. 全局可变状态（`WORLD`/`BODY`/`KBFabric`/`SEED`）隐式耦合，难单测。
- **代码质量欠账（审视清单 §5）**：工作区噪声文件、旧名残留、命名不一致、TODO 桩。

**一句话**：数学内容不缺（你一路补的思想都在）；真欠账是**组织**，不是**内容**。

---

## 1. 现状架构解剖（代码事实，非记忆）

`灵脑.html` = 单 `<script>`（`==KERNEL START==` @77 → `==KERNEL END==`），内部注释分区：

| 行段 | 内容 |
|---|---|
| 77–490 | 核心数据模型 / 世界图 WORLD / A\*+RSG / 系统1·2 / 目标导向决策 |
| 491–693 | SelfLearn 四层科学认知闭环（反思演化中枢） |
| 694–792 | 记忆桥 / Data Fabric |
| 793–1137 | 感知接口 / 外部 LLM 适配 / 解释层 / 不确定性量化 / 审计 |
| 1138–1210 | 自验证(Chain-of-Verification) / 反思 / 物理载体接入 / 全局别名 |
| 1210–1950 | v3.0 扩层：Banach·reconcile / LSH / 符号验证 / 霍尔 / MCTS / PAC / 因果 / 世界模型 / EDA / 元认知 / CognitiveOS |
| 1951–2362 | CognitiveOS 能力注册 / 具身层 / 量纲分析 |
| 2364–3303 | 高等数学工具箱（AD / 图论 / 开普勒 / Lyapunov / CBF / STL / Zonotope / 组合CBF / 混合自动机 / 启发式自演化） |
| 3304–3930 | 外部数学思想融合（conformal / SayCan / Thompson / 矩阵代数 / 卡尔曼 / LQR / CVaR / 粒子 / EIG / Shapley / 漂移检测） |
| 3931–4114 | **LCF 架构内核头**（公理→定理→猜想范式说明） |
| 4115+ | 公理层 / 定理层(`MathKernel.theorem`) / 猜想层 / `CAPABILITY_THEOREMS` 追溯桥梁 / 八元组 / 各类思想原语 |

**构建/入口契约**：`build-umd.js` 抽 `KERNEL` 段 → 包 UMD；`lingnao-mcp.js` 用**同一正则**抽同一段（单一真源）。导出 = 手写 `EXPORT_NAMES` 白名单 + 字面量 `{name:name}`。对外接口（MCP/Web/Node）共用同一产物 UMD。**单文件内核即发布契约**。

---

## 2. 核心问题（按"数学思想"审视）

### 2.1 未按思想归组（用户主诉）
"归纳"思想散落：`SelfLearn` 积累/验证(491)、`reconcile` Banach 收缩(1264)、八元组 `b` 可靠度、`f` 归纳、`pacSampleBound`(1477)、滤波(3510)、元认知熵(1918)——**无单一入口**。同理反证/反例/穷举/极限/建模/闭环/对抗/他心均跨区平铺。

### 2.2 定理层位置倒置 + 不被机检
LCF 头(3931)声称"定理是抽象数据类型，只有推理规则能构造"，但 `MathKernel.theorem(name, stmt, {proof, evidence})` 只是**字符串登记器**，`proof` 文本不被小内核机检（TCB = JS 运行时 + check 闭包，已诚实标注）。`CAPABILITY_THEOREMS` 是手写字符串数组，**无加载期校验** ⇒ 定理名拼错/删除不会报错，证明链静默漂移。这是 P3（DERIVE 缩 TCB）的真义未兑现。

### 2.3 单文件脆片
6177 行同作用域、函数全局平铺。本审计已踩 3 次语法坑（THM_ROUGHSET 重复证据行、localLinearize AD 退化、4307 引号冲突），均因单文件大改触发。diff 难 review、单点失败、无懒加载/tree-shake。

### 2.4 全局状态隐式耦合
`V_robust`/`getState` 隐式依赖全局 `BODY`；八元组方法隐式读写全局 `WORLD`/`BODY` ⇒ 模块间耦合靠全局变量，难独立单测。

### 2.5 导出白名单手写
`EXPORT_NAMES` 需手动维护，新增原语忘加即不导出（本轮已手动加 ~10 次，易漏）。

---

## 3. 推荐架构（按数学思想 + 前沿技术分层）

```
L6 接口层      MCP stdio │ Web console │ UMD(单文件可审计产物)
   │
L5 编排层      CognitiveOS(统一认知循环) │ 具身层(attachBody) │ 感知-LLM 适配 │ 审计(Ξ)
   │
L4 领域引擎    estimation(卡尔曼/粒子) │ causal(do/PC/反事实) │
              control(CBF/LQR/Zonotope/STL/混合自动机) │
              mathbase(AD/矩阵/图论/量纲) │ fusion(conformal/Shapley/CVaR/EIG/drift)
   │
L3 八元组内核  BrainTuple 𝔹=(X,h,b,f,U,V,Inv,M,B)  ← 组合 L2 原语
   │
L2 数学思想原语（按"思想"归组，单一入口 LingNaoThinking）
   ├ 推理思想  induction / contradiction / counterexample / exhaustion / limit
   ├ 建模思想  assumptions / localLinearize / variableScreening
   ├ 他心思想  nestedBelief(KD45)
   ├ 闭环思想  theoryPracticeLoop
   ├ 对抗鲁棒  minimax / V_robust / CBF / conformal / CVaR
   └ 不可预测  D-S包络 / roughSet / fDivergence / chaos / decidability / conservation
   │
L1 证明内核(LCF 真机检)  公理 │ 定理(闭包校验) │ 猜想(禁入证明链) │ CAPABILITY 追溯(构建期校验)
   │
L0 基座        确定性运行时 │ 不精确概率 │ 不可判定区 𝕌
```

**关键改变**：L2 把"数学思想"从平铺函数提升为**显式分组命名空间**（单一入口 `LingNaoThinking`），L1 把"证明链"从叙述性升级为**结构性机检**。

---

## 4. 重构路线（两方案，方向用户拍板）

### 方案 A（推荐·低风险·保留单文件可审计契约）
单文件 `灵脑.html` 仍是内核真源与 UMD 真源，内部加：
1. `LingNaoThinking` 思想归组索引对象（把已落地原语按"数学思想"聚合，提供单一入口；**零风险，只加聚合代码，不动已有函数**）；
2. `MathKernel.theorem` 闭包机检：proof 引用的定理名必须已注册且非 CONJECTURE，否则**加载即抛错**（叙述性→结构性证明链）；
3. `CAPABILITY_THEOREMS` 加载期自检：遍历 value 校验定理名存在；
4. `EXPORT_NAMES` 改为从 `LingNaoThinking` 等命名空间**自动派生**（防漏导出）。
- 优点：零契约改动、零风险、立即可做、保留"单文件可审计"卖点。
- 缺点：物理文件仍单文件（6177→~6300 行）。

### 方案 B（激进·源码模块化 + 构建聚合，产物仍单 UMD）
`src/` 拆多文件（按 L0–L6 + 思想分组），`build-umd.js` 改为拼接 `src/*.js` 再包 UMD；`lingnao-mcp.js` 直接 require 聚合产物（对外契约不变：仍是单 UMD）。
- 优点：真模块化、可 tree-shake、diff 清晰、可单测每层。
- 缺点：动构建链、需重测、工作量大、可能引入聚合顺序坑。

**独立判断**：方案 A 当下 ROI 最高——用最小改动把"按思想归组 + 证明链机检"两个你点名的能力做实，且不破坏已验证全绿的单文件契约。方案 B 是工程债清理，收益是维护性、成本是动构建链；建议先 A、B 待发布前或你明确要时再做。

---

## 5. 代码审视清单（待办，本轮先列不改动）

- [ ] **工作区噪声清理**：`灵境.html.bak`(193KB) / `_待删除_乱码副本/` / `legacy/` / `demo-*`(11个) / `test-*`(20+，含 `test-architecture-review.js`·`refactor-lingjing.js` 旧名残留) — 部分应移 archive 或删。
- [ ] **重复/冗余**：`conformalQuantile/Interval/PValue/IsAnomaly` 与 `conformalPValue` 命名重叠易混；`brain-loop-demo.js`/`brain-unified-demo.js` 疑似旧版 demo 重复。
- [ ] **TODO 桩**：1171 行"启发式更新；PAC…未实现"；`simulate`/`counterfactual` 数值估计依赖孪生网络未实装（已诚实标注）。
- [ ] **命名不一致**：`WORLD`(全局) vs `BrainTuple`(对象)；`b`(八元组可靠度) vs `belief`；`f` vs `learnedF` 别名。
- [ ] **全局状态耦合**：`V_robust`/`getState` 隐式依赖 `BODY`/`WORLD` 全局。
- [ ] **测试覆盖**：核心八元组 55 + MCP 51 绿；方案 B 拆文件后需补每层单测。

---

## 6. 下一步（方向用户拍板，AI 不替定）

- **A**：按方案 A 落地（我直接干，跑 `test-tuple-eight` + `lingnao-mcp --selftest` 验证全绿）；
- **B**：拆 `src/` 多文件（动构建链，需重测）；
- **C**：先把 §5 噪声文件清理一轮。

> 硬约束未破：npm / COS / Release / Smithery 仍待用户明确说"发"才动。
