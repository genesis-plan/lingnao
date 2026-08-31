# 更新日志 CHANGELOG

> 时间均为 +08:00。按真实提交时间（`git`）与当日工作顺序记录。
> 内核单一真源：`灵脑.html` → `build-umd.js` 抽取为 `lingnao.umd.js`（163 导出）→ `lingnao-mcp.js` 经 `vm` 沙箱运行同一份内核。
> 判定当前行为以**代码与测试**为准，过程稿（`docs/archive/`）仅反映决策当时想法。

## 2026-08-26

- **14:30** `cb2d571` 世界大脑 WorldBrain v1.0.0：可审计推理 MCP 服务（零依赖、免费面向 AI Agent 分发）
- **14:33** `92e2686`/`0d08313` README 增加 npm 安装与被动获客入口；同步 README 至 npm
- **14:53** `dfabcd1` 重做为模型卡 README + 架构白皮书（世界大脑 = 可审计推理大模型）
- **15:01** `5e28e43` rebrand：世界大脑 → 灵境 LingJing（世界通用大脑）；文件/包/仓库名统一清洗
- **15:54** `05d3117`/`403c98a` 灵境 v3.0 完整骨架全实装（28/28 自测 · 五层认知操作系统 · 20 MCP 工具）

## 2026-08-27

- **14:09** `033261d` 全维度完善灵境 v3.0 — 强化不幻觉置信分层 + 安全加固 + 工程落地

## 2026-08-28

- **11:00** `cc6c70a` 吸收外部论文完善内核 + 提升仓库可发现性（自测 45/45）
- **11:42**/`11:53` `0bef121`/`b099505` 极简机器人示例 + 内核库导出（让别人能直接接入当大脑）
- **12:17**/`12:18** `70b02cd`/`af29d12` 真实机器人案例接入示例 + 修复 A\* 次优 bug
- **13:01** `1d0ea5e` 零安装接入 — UMD(build/selftest) + playground.html + mcp.example.json + README 修正
- **13:25** `584a150` README 顶部加醒目「求测/在线试用」入口
- **14:12**/`14:13** `5e7cd31`/`e201ae3` 常用指令实测脚本 demo-common.js（可复跑验证）
- **16:04**–**16:47** `59a6af2`/`9933c93`/`5c53514`/`24002df`/`2cee651`/`44d60b4` 灵境×外部通用大脑/认知架构消费对照、×国内小说超级大脑脑洞消费对照、能力构想（docs）
- **17:07** `5aeb702`/`279d754` 组合①垂直切片参考实现（个人财务深度分析 + 可审计决策 demo）
- **17:10**/`17:11** `50faa34`/`ca3a550` 二阶组合证明原型（双实例审计接口联邦 · 未验证输入闸断 autonomy）
- **17:49** `02fa30b`/`305afd5` 知识蒸馏引擎 KnowledgeDistillery（物质富裕第一步·组合①最小落地·离线可蒸馏 + 知识可逆）
- **17:56** `e303098`/`ff0e4c9` 知识蒸馏引擎升级为任意领域版（步骤化/工具化/语言化三步拆解，双领域零改动自测）
- **18:13** `910a6fb` 虚拟空间模块（目标地区仿真）+ 大脑循环调用发现错配/协调/分配
- **18:19** `2971175` 真实机器人机队资源分配示范（充电调度 + 负载均衡）
- **18:23** `f5eae23` 能力④ 数学建模（空间形式化为运输问题 + 最小代价最优分配，自实现可审计求解器）

## 2026-08-29

- **11:38** `81ad54c` 四路专家审查报告（架构/代码/功能诚实边界/产品市场）— 10 条 P0 共识与五阶段修复路线图
- **12:00** `80ba120` 修复专家审查 P0 项：审计 fail-closed（不再兜底 valid）、system1 尊重 hard 约束、reason 携带 opts 供自验证、删伪造证据引用、运输问题改最小费用流精确最优（供需拆点禁自满足假流）+ 回归锁、KB 签名修正与知识可逆真实生效、蒸馏审计诚实分级、federation 补 await + 序列化边界、finance 删硬编码兜底并标注合成数据；UMD/MCP 自测 45/45 全绿
- **12:29** `bc80532` 补完三根神经：① 记忆持久化（KB+感知增量落盘，重启不失忆）② 感知建图闭环（观测带存证写入世界图，冲突登记不静默改写，未确认不进证明链）③ 元认知接管调度（快答门槛按不确定性动态给定，探索模式产出确定性备选路径）；新增 brain-loop-demo 闭环演示
- **12:30** `8232edf` merge：合并远程（REST API 推入的蒸馏引擎与架构文档）；冲突一律保留本地
- **12:49** `8405416` 按 v3.0 骨架融合全部切片为统一大脑 — 内核建 CognitiveOS（能力按五层注册 + 统一认知循环 cognitiveCycle：感知→状态→元认知→推理→行动→学习→审计）；村庄/机队/资金三类切片降级为领域配置，共用同一张图 G 与同一套算法；math-model 委托内核求解器消除第二份大脑；修复硬约束未贯通分配层的绕过 bug
- **13:00** `f5f4ddc` fix(架构归位)：按 ARCHITECTURE.md 重写大脑结构 — ① 世界图第四分量 ℙ 由「概率」改回「命题」（三态：成立/不成立/不可判定→归入 𝕌 不猜）② 显式化七元组 𝔹=(𝕎,K,Φ,Ψ,Θ,Λ,Ξ) 与八层（第 6 层演化 / 第 8 层统一独立）③ 澄清村庄机队账本属「虚拟模拟空间」模块非大脑结构层
- **13:02** `35c286b` fix：新增 Memory.reset()（清档+清内存经验与感知增量）替代 clear()，修复自测第二轮起漂移；连跑四次确定性全过
- **18:10** `e50c14e` feat：具身层全量接入 MCP + 新增「开始干活」控制台与真实身体 WebSocket 桥
- **18:17** `c7facbd` docs：README 加「开始干活」控制台在线试用链接（COS 免安装）+ 分发入口补全
- **18:34** `8e77e60` dist：发布 npm 包 lingnao-mcp@3.1.0（具身层接入；当前 MCP 工具 47 个，含具身层 10 个）+ 补 mcp.json 与分发说明

## 2026-08-30（当日工作 · 工作区未提交）

### 数学栈补齐（内核 `灵脑.html` 单一真源 → 重建 UMD 163 导出）
- **控制与物理 AI 安全**：CBF-QP 安全滤子（`cbfFilter`/`cbfMargin` 凸 QP 解析投影）、组合 CBF（Hildreth 对偶 QP 多约束）；STL 定量语义鲁棒度 ρ；Zonotope 线性可达集过近似（sound）；混合自动机 × 自动微分（Gershgorin Lipschitz 界 + Zeno 检测）
- **连接契约层**：声明式能力契约 `pre/effect` 求值 + 观测契约可区分性（噪声界判定两状态可否区分）
- **量纲分析层**：SI 七基本量纲代数 + 齐次性拦截非法相加 + Buckingham π 定理
- **高等数学工具箱**：autodiff / 图着色 / 可平面性 / Hall 条件 / 装箱界 / Lyapunov 判据
- **最优分配**：匈牙利算法（Kuhn–Munkres + Jonker–Volgenant），返回 LP 对偶最优性证书 (u,v)，总互异性 ⇒ 整数 LP 最优，禁边诚实 `feasible:false`
- **抽象解释**：区间格（⊥/⊤、join/meet、偏序）+ widening ∇（保证收敛）+ narrowing △（精度回收，过近似声学不变），`absFixpoint` Kleene 迭代；不可判定处诚实标 𝕌

### IMA 知识库权威降级（用户确认"知识库不一定正确，不需要引用"）
- 代码内 `imaKnowledge.verified=false` + `IMA_DISCLAIMER`（外部第三方知识库、未经本产品验证、仅参考索引、不进入证明链）
- 审计证据标 `unverified:true`（来源 `external-reference`）；`explainWithLLM` 提示把 IMA 标为"外部参考索引（未经验证，仅供命名参考）"
- README / `docs/ima-map.md` 剥离"理论基座"表述，改为"外部未验证参考索引"

### 物理 AI 安全加固（真实身体桥）
- fail-closed：WebSocket `send()` 超时/错误**拒绝**而非静默成功
- 协议握手：`hello`/`hello-ack` + 主版本协商 `BODY_PROTOCOL='1.0'`，不符或无握手拒绝连接

### 审计与测试
- `audit-math-coverage.js` 改为可执行验证（实调用 + 语义探针，不引用未验证知识库）：**47/47 数学在位 · 125/125 导出函数 · UMD 167 · 14/14 探针通过 · 8 项未实装 · 4 项主动弃用**
- 新增测试：test-assign-absint.js（63）、test-highmath.js（22）、test-safety-stack.js（66）、test-bridge-handshake.js（8）、test-body-physics.js（24）；全回归绿

### 学习进化闭环接通（用户："写啊，接上最后一段虚线"）
- **此前断点**：`learn()`/`SelfLearn` 有完整学习器官，但① `learn()` 只打日志不落盘（经验库恒空）② 确认知识不回写规划（"统计得很好看但不影响决策"）。两处已修。
- **学习回流①（回避老失败的路）**：`execute()` 自动把每次真实结果（成功/偏差/失败）以节点名"从→到"写进 append-only 经验库 `SelfLearn.experience`；`learnedEdgePenalty(a,b)` 从经验反推转移成败率，对历史成功率低（<66%）的边加软惩罚；`edgeW` 与 `system1` 快答均消费该惩罚 → A* 下次绕开、`reason` 同一句话改主意。守恒：惩罚只抬代价不抬启发式，A* 仍最优。
- **学习回流②（启发式越用越准）**：`execute()` 成功路径写入 `PLAN_HISTORY`；`aStar` 用 `heuristicEvolve` 从已验证最优路径反向传播剩余代价，得可采纳且更强的融合启发式（Pearl 定理 max(欧氏, learned) 仍最优）；`_ACTIVE_H` 供一致性验证复用。
- 新增导出 `learnedEdgePenalty`/`recordPlanHistory`/`getPlanHistory`/`resetPlanHistory`（UMD 163→167）；新增演示 `examples/learn-and-avoid.js`（同一句 `reason(A,C)` 经反馈后由 A→C 改走 A→B→C，证明闭环生效）。
- 真实校验：全回归 11 项 PASS；唯一自测缺口仍为 `algebraic_solve` 依赖项。

### 文档精简（本次提交）
- **README.md**：工具数 46→**47**、UMD 导出 87→**163**、自测 51 项（注明 `algebraic_solve` 需 `lingshu-solver` 依赖，安装后 51/51）；新增"数学原理与安全栈"小节；补全遗漏的 11 个工具（`ask`/`explain`/`goal_directed`/`lingnao`/`ima_load`/`ima_query`/`sl_*`）；因果示例去除 `imaRef` 权威引用
- **docs/ima-map.md**：头部改"外部第三方知识库·未经验证·仅参考索引·不进入证明链"，废弃"理论基座"表述
- **docs/数学与模块现状总览.md**：模块清单 + 数学用量 + 蓝图文档 + 未实装数学 + 工程可行性分级
- **CHANGELOG.md**：本文件（按日期时间过程记录）

### 外部数学思想融合（用户："去看全世界的大脑产品/大模型/协议/算法，提炼本质数学思想融合进来"）
调研了业界协议层（MCP / A2A 1.0 / A2UI / AP2）、算法层（SayCan、保形预测、Thompson Sampling）、模型层（π0/GR00T、世界模型/JEPA、Diffusion Policy、CoT/ToT、RLHF/DPO）后，按"**零依赖 · 确定性 · 可审计 · 无需训练 · 补真实缺口**"五条筛选，融合三项（其余记入备注，不堆砌）：

1. **保形预测 Conformal Prediction**（Vovk–Gammerman–Shafer / split conformal）
   - 本质：唯一能在**有限样本、无分布假设**下给出覆盖保证的框架，只要求可交换性（弱于 i.i.d.）
   - 新增 `conformalQuantile` / `conformalInterval` / `conformalPValue` / `conformalIsAnomaly`
   - 意义：把灵脑"不幻觉"从**工程断言**升级为**统计保证**——此前 confidence/support 都是拍的，无任何覆盖保证
   - 附带：`checkPlausibility` 的手拍阈值（maxRate 等）可升级为数据驱动的保形异常检测，误报率被 α 严格控制而非人工定阈值
2. **SayCan 可供性概率分解**（Google, 2022）
   - 本质：`P(技能成功且有用) = P(有用|指令)〔Say〕 × p(c_π|s,l_π)〔Can〕`，c_π~Bernoulli，可供性即"成功=1"的价值函数
   - 新增 `affordanceOf` / `sayCanRank`
   - 意义：灵脑的 `pre/effect` 能力契约是**布尔**的（能做/不能做），升级为从真实反馈学到的**概率可供性**；且 Say/Can 两因子可**分离审计**（契合灵脑"每个结论都能拆出依据"）
3. **Thompson Sampling**（Beta 后验采样探索-利用）
   - 本质：从后验采样再择优，选中概率 ∝ 该臂为最优的后验概率，regret 有界（非 ε-greedy 盲目随机）
   - 新增 `thompsonSample`（自带 mulberry32 确定性 PRNG，满足灵脑可复现要求）
   - 意义：零成本复用——`SelfLearn` 的 reliability **已是 Beta(α,β) 后验**；此前 explore/exploit 是启发式拍的

**实证（蒙特卡洛，非信公式）**：保形覆盖在指数/正态/均匀/**柯西(重尾无均值)** 四种分布下均达 ≈0.90（理论 0.9016），证明分布无关性真成立；保形异常检测误报率 0.0398 ≤ α=0.05。新增 `test-external-math-fusion.js` **19/19 通过**；UMD 167→**174** 导出。
**备注（调研到但本次未融合）**：MCP/A2A 属接口标准化（N×M→N+M 复杂度坍缩 + 能力卡片 + 状态机），灵脑已有能力契约与 MCP 服务，暂不需重复；π0/GR00T/Diffusion Policy/流匹配 对应灵脑连续控制短板，但需神经网络权重，与"零依赖/不训练"定位冲突；CoT/ToT/Self-consistency 本质是树搜索与边缘化，灵脑 A*/RSG 已覆盖且更严谨；RLHF/DPO 需训练，不适用。

### 继续融合：形式框架 + 估计/控制/风险（用户："继续抽取，看以什么样的形式融合"）

**核心方法论：融合的「形式」比「思想本身」更决定成败。** 同一思想融成不同形式，效果可能相反。总结七种形式：

| 形式 | 改变什么 | 灵脑落点 | 实例 |
|---|---|---|---|
| A 代价项 | 优化目标（概率连乘 ↔ 对数代价可加） | `edgeW` | SayCan affordance、风险厌恶 |
| B 约束 | 可行域（收缩） | `hard`/`soft`/命题 ℙ | CBF、宪法 AI、量纲齐次 |
| C 证书 | **不改决策**，只加可验证输出 | 审计层 | 保形覆盖、LP 对偶、霍尔证书 |
| D 启发式 | 搜索速度（保持最优） | `heuristic`/`hOf` | heuristicEvolve（Pearl 定理） |
| E 选择器 | 多候选择优与探索 | 决策点 | Thompson Sampling |
| F 估计器 | 噪声观测 → 最优估计 | 感知层 | **卡尔曼**（本轮新增） |
| G 控制器 | 连续控制量 | 执行层 | **LQR**（本轮新增） |

**形式选错的实例（重要）**：CVaR 满足**次可加性但不可加** ⟹ `路径CVaR ≠ Σ 边CVaR` ⟹ **严禁**拆成边权塞进 A\* 的加性代价，只能作为形式 C（证书）对整条路径的情景集评估。已写入代码 `warning` 字段防误用。

本轮新增（UMD 174→**184**）：
- **④ 零依赖数值线性代数**：`matEye/matT/matMul/matAdd/matSub/matScale/matInv`（高斯-约旦部分主元；奇异/病态一律拒绝求逆，不给看似合理的错数）
- **⑤ 卡尔曼滤波**（形式 F 估计器）：`kalmanUpdate`。**填补真实缺口**——此前 `execute()` 直接 `setState(observed)`，**带噪观测被当成真值**。采用 **Joseph 形式** `P'=(I−KH)P(I−KH)ᵀ+KRKᵀ` 保证对称正定。实证：MSE 从 0.5089（现状：直接用观测）降至 **0.0841，改善 6.0×**。
- **⑥ LQR**（形式 G 控制器）：`lqrSolve`。填补连续控制缺口（MPC 需 QP/SDP，与零依赖冲突；LQR 只需 Riccati 迭代 + 矩阵求逆，**解析可解且在 LQ 假设下就是最优**）。稳定性判定：n≤2 用特征方程闭式解（精确），n≥3 回退 ‖·‖∞ 上界（Gershgorin，保守，判不出诚实标注）。
- **⑦ CVaR**（形式 C 证书）：`cvar`。一致性风险度量（Artzner 四公理）。

**实证**：LQR 实测代价 1.77377 **精确等于**理论最优 `x₀ᵀPx₀`，且优于 6 组其它线性反馈（最优性定理成立）；双积分器（机器人最常用模型）收敛且稳定。CVaR：3000 次重尾试验**次可加性违反 0 次**，而 **VaR 违反 535 次** ⟹ 实证证明 VaR 不是一致性风险度量（会惩罚分散化）。新增 `test-control-estimation.js` **25/25**。
**组合定理**：卡尔曼(LQE) + LQR = LQG，由**分离原理**保证可独立设计再拼装仍最优；两个 Riccati 方程存在**对偶性**（控制向后 / 估计向前，A↔Aᵀ, B↔Cᵀ, Q↔W, R↔V）。**诚实边界**：LQG 最优性**不自动保证鲁棒性**（Doyle 1978），鲁棒裕度须单独校验。

### 第三轮融合：补上前两轮**自己引入的假设漏洞**（UMD 184→192）

**深化的方法论洞察**：每一次融合都会引入新的**假设**，而新假设本身就是新漏洞。
前两轮留下的四个洞，本轮逐一补上——这才是"以什么形式融合"的真正含义：

| 前轮引入 | 留下的假设漏洞 | 本轮补洞 | 形式 |
|---|---|---|---|
| 卡尔曼 | 只在**线性+高斯**下最优，非线性/非高斯连次优都谈不上 | 粒子滤波 | F 估计器 |
| 元认知 knowledgeGaps | 知道"缺什么"，却**不会主动去看** | EIG 期望信息增益 | E 选择器 |
| 审计层 | 只是**列出**证据，未**量化**每条证据贡献多少 | Shapley 值归因 | C 证书 |
| 保形预测 | 覆盖保证依赖**可交换性**；漂移后保证悄悄失效 | W₁ + 漂移检测 | C 证书 |

- **⑧ 粒子滤波**（形式 F）：`particleFilterStep` / `effectiveSampleSize`。卡尔曼在**非线性非高斯**下失效的补充。实证：非线性观测 z=x² 的**双峰歧义**（z≈4 ⟹ x=±2 皆可），粒子滤波保持双峰 **52.7% / 47.3%**，收敛 |x|≈1.988（真值 2）——**任何单高斯方法都做不到**。系统重采样 + Neff 退化监控；全零似然判为"模型与观测矛盾"而非返回垃圾。
- **⑨ EIG 期望信息增益**（形式 E）：`entropyOf` / `expectedInfoGain` / `selectByInfoGain`。把"知道缺什么"变成"下一步该观测什么"。**互信息恒等式双重路径交叉验证**：`H(θ)−E[H(θ|O)]` 与 `H(O)−E[H(O|θ)]` 两条独立路径必须一致（实现自检）。实证：完美观测 EIG=ln2=H(prior)（信息全获取）；独立观测 EIG=0（不该浪费执行代价）；贪心 EIG 在次模目标下有 (1−1/e) 近似保证。
- **⑩ Shapley 值归因**（形式 C）：`shapleyValues`。审计从"列出证据"升级为"量化每条证据贡献多少"，且是**唯一**满足四公理（效率/哑元/对称/可加）的归因（Shapley 1953 唯一性定理）。**效率公理可自检**：Σφᵢ 必须 = v(N)−v(∅)，算完即验证，是可验证证书而非断言。n>16 自动降级蒙特卡洛排列采样避免 2ⁿ 爆炸。**诚实边界**：Shapley 衡量**贡献**不等于**因果**，不可当作因果证据。
- **⑪ 分布漂移检测**（形式 C）：`wasserstein1` / `driftCheck`。**保形预测的必要配套**——没有它，"覆盖 ≥ 90%"会在漂移下悄悄变成谎言。W₁ 一维有闭式解（排序配对即最优传输）；检测用校准期内部波动作零分布 + **复用 `conformalPValue`** ⟹ 误报率同样被 α 控制，零额外假设。实证：无漂移误报率 **2.0% ≤ α=5%**；真实漂移检出率 **100%**。

新增 `test-frontier-fusion.js` **24/24**。

### 架构级重新审视（用户："抽取所有人类数学思想，重新审视产品各方面是否符合现实规律"）

按数学思想的十大分支（结构/空间/变化/不确定性/离散/计算/对称/尺度/对偶/信息）逐项对照审视，发现并修正三处**不符合现实规律或不符合数学标准**的地方：

**审视①：抽象解释只做了一半 —— 只能证"安全"，不能证"危险"**
- 人类数学里的抽象解释是**双向**的（may 过近似 / must 欠近似）。灵脑只实现了 may，后果是**能力严重不对称**：遇到确定会违规的路径，也只能含糊标 𝕌，无法果断拒绝。对安全产品而言这比"算不快"严重得多。
- **修正**：新增 `absVerdict`，给出三值严格结论。关键洞察是**无需欠近似域、无需新假设**——同一个过近似即可得双向结论：设 R ⊆ inv（过近似），则 ① `inv ⊆ safe` ⟹ 确定安全；② `inv ∩ safe = ∅` ⟹ R ∩ safe = ∅ ⟹ **确定不安全**（纯集合论）；③ 其余才是真·𝕌。
- 效果对比（同一场景 inv=[10,∞), safe=[0,5]）：
  - 旧 `absSafe`：`{safe:false, U:true}` —— 信息被压扁，无法区分"真的会撞"和"只是证明不了"
  - 新 `absVerdict`：`UNSAFE, U=false` —— **确定不安全，可果断拒绝执行**
- 可靠性实证：328 个具体模拟点**无一**落入安全区（UNSAFE 非误判）。UNKNOWN 分支还会给出"可能越界的部分"以指导精化。

**审视②：`sound: true` 是硬编码断言，不是结论**
- `absFixpoint` 里直接返回 `sound: true`，**没有任何验证**。声称"可靠"却不给证明，违反灵脑自己的可审计原则。
- **修正**：新增 `galoisCheck` / `galoisAlphaSet` / `galoisGammaContains`。抽象解释的正确性在数学上由 **Galois 连接**唯一保证：`α(c) ⊑ a ⟺ c ≤ γ(a)`。区间域上 α(S)=[minS,maxS]、γ([l,h])={x|l≤x≤h}，等价性可解析推导。提供**采样验证**（36 组 0 违反），把 sound 从断言变成可验证结论。

**审视③：𝕌 是布尔位，压扁了不确定性的信息**
- 灵脑最独特的卖点是"诚实标 𝕌"，但 𝕌 是一个布尔位，**无法区分"差一点就能判定"和"完全无知"**，导致决策过度保守。
- **自主设计**：新增 `beliefPlausibility` / `decideImprecise`，把 𝕌 升级为**不精确概率包络** `[belief, plausibility]`（Dempster–Shafer / Walley）：belief=证据确证下界，plausibility=未被否证上界，宽度即不确定性本身。
  - 统一了灵脑里原本分裂的三种表示：精确概率(w=0) / 区间集合(0<w<1) / 完全无知(w=1)
  - **𝕌 的严格语义**：阈值 θ 落在包络内。𝕌 从此不是"不知道"，而是"**还差 0.2 的 belief 才能判定**"——可量化、可指导补什么证据。
  - 决策三值：belief≥θ ⟹ ACCEPT（最坏也达标）；plausibility<θ ⟹ REJECT（最好也不达标）；否则 UNKNOWN。

新增 `test-architecture-review.js` **28/28**；UMD 192→**198**。

**审视后记录、但本轮未改的深层方向**（供后续决策）：
- **对偶未被系统化**：灵脑里散布着 A\* 的 g↔h、控制 Riccati↔估计 Riccati、LP 原问题↔对偶、前向推理↔后向证明、may↔must，本质都是"对偶/伴随"，但没有统一成架构原则。例如 A\* 只有前向 g + 启发 h，**没有双向搜索**（灵脑已有后向可达性 `goalDirected`，可与前向 A\* 组合成双向搜索）。
- **缺层次化/多尺度规划**：灵脑规划是单一尺度的 A\*；真实机器人需要任务→路径→轨迹→控制的层次（时序抽象 options/SMDP 是成熟理论）。灵脑的"系统1/系统2"是速度分层，不是抽象分层。
- **缺复杂度分级表**：部分未实装项（一般非线性可达集、POMDP 精确解 PSPACE-complete）是**理论上不可解**的，应建立"问题→复杂度类→可用近似"映射，避免试图解决不可解问题。
- **证书可统一为"对偶证书层"**：霍尔证书、LP 对偶、Lyapunov 函数、CBF、存储函数、势函数本质都是"用一个对偶变量/势函数证明性质、避免穷举"，可统一为架构中的一个正式层次。

### 【重大架构重构】底层改为数学内核：公理 → 定理 → 能力（用户："把整个产品都改，底层是公理、定理、被证明的猜想"）

**此前根本问题**：灵脑的"保证"全是**事后标注**——`sound: true` 硬编码、`verified` 布尔位、`grounding` 人工分层。声称可靠却不给证明，这违反灵脑自己的可审计原则（上一轮审视已发现 `sound:true` 是断言）。

**采用的范式：LCF 可信内核架构**（Logic of Computable Functions，Milner 1972；Coq/Isabelle/HOL 的共同祖先）
核心思想：把"定理"做成**抽象数据类型**，只有内核的推理规则才能构造它 ⟹ 任何持有 `thm` 的地方，它**必然已被证明**（可靠性由构造过程保证，而非信任调用方）。满足 De Bruijn 准则：证明可被独立的小内核复核。

**三条铁律（内核不变量）**
1. 公理（axiom）无条件接受，但必须**显式声明来源**，可审计，不偷加
2. 定理（theorem）只能由推理规则从【公理 / 已证明定理】派生
3. **猜想（conjecture）即使有大量数值证据，也永远不能作为任何定理的前提** ⟹ 未被证明的东西绝不污染证明链。这是"不幻觉"最硬的形式化

**内核现状**
- **公理 10 条**（全部注明出处）：`AX_LOGIC` 经典逻辑 / `AX_SET` ZFC / `AX_REAL` 有序完备域 / `AX_PROB` Kolmogorov 概率公理 / `AX_ORDER` 偏序与完备格 / `AX_EXCH` 可交换性 / `AX_LINEAR` 叠加原理 / `AX_GAUSS` 高斯封闭性 / `AX_MEASURE_OPT` Bellman 最优性原理 / `AX_CONVEX` 凸分离
- **推理规则 7 条**（刻意极少 ⟹ 内核可信）：AXIOM / MP / CONJ / INST / TRANS / DERIVE / COMPUTE
- **定理 16 条**（全部带证明链 + 证据）：Kleene 不动点、抽象解释 soundness（Galois）、A\* 最优性、匈牙利对偶最优、Shapley 唯一性、Beta 共轭、保形覆盖、CVaR 一致性、卡尔曼最小方差、粒子滤波一致性、LQR 最优、LQG 分离原理、CBF 前向不变、Zonotope 可靠性、do-演算、Buckingham π
- **猜想 3 条**（隔离，禁止作前提）：POMDP 确定化重规划的近似界、一般非线性可达性、启发式自演化单调性

**追溯桥梁**：新增 `CAPABILITY_THEOREMS` + `theoremOf(cap)`——把 27 个上层能力映射到支撑它的定理，再回溯到公理。问"凭什么可靠"，答案不再是一个布尔位，而是**一条证明链**。
```
theoremOf('lqg') → THM_LQG_SEPARATION + THM_KALMAN_MINVAR + THM_LQR_OPTIMAL
                 → 公理 [AX_GAUSS, AX_PROB, AX_LINEAR, AX_MEASURE_OPT, AX_CONVEX]（深度 3）
```

**验证结果**：`kernelVerify()` 全部 16 条定理证明链**闭合**，最大深度 3；`proofAudit()` 能力覆盖 **27/27**；9 条公理真正支撑了产品（AX_PROB 支撑 11 个能力、AX_CONVEX 8 个、AX_LINEAR 6 个）。

**内核自身也被检验**：新增 `test-math-kernel.js` **33/33**，其中**篡改检测**是关键——绕过 `theorem()` 接口直接注入假定理、注入循环依赖，**均被 `verify()` 抓出**；污染后 `verifyAll()` 立即失败，清除后恢复，重复验证一致（De Bruijn 可复核性）。

**过程中修掉内核自身一个真 bug**：`proofChain` 的 `seen` 集未在**所有**返回路径出栈，导致 DAG 中"同一公理被两条路径引用"（如 AX_LINEAR 同时支撑卡尔曼与 LQR）被误判为循环 ⟹ 2 条定理假性失效。改用 try/finally 统一出栈修复。**这正好说明内核必须自己经得起它要求的检验。**

新增导出 `MathKernel` / `CAPABILITY_THEOREMS` / `theoremOf` / `proofAudit` / `kernelVerify` / `kernelStatus` / `kernelFoundation` / `kernelProve` / `kernelConjectures`；UMD 198→**207**。

**【已落地 20:10】内核重构完整收尾**：`absFixpoint` 与 `zonoReach` 此前的硬编码 `sound: true` 断言已移除，改为返回 `basis` 字段引用支撑定理（`THM_ABSINT_SOUND` / `THM_ZONOTOPE_SOUND`），且 `sound` 由 `MathKernel.get(定理ID)` **派生**而非硬编码。至此"标注彻底消失、全部由内核派生"的重构目标达成；审计 `audit-math-coverage.js`、测试 `test-assign-absint.js` / `test-safety-stack.js` 仍全绿（`.sound` 现在读的是内核派生值）。

### 已知缺口（诚实标注，非缺陷）
- `algebraic_solve` 自测 FAIL(1)：仅因可选依赖 `lingshu-solver` 未 `npm install`；安装后 51/51 全过
- 8 类数学未实装：MPC、Barrier Certificate(SOS/SDP)、PrSTL 之外一般 LP 求解器、非线性 SEM、一般非线性可达集、Zeno 形式排除、关系抽象域（八边形/多面体，新 B 可做）等；详见 `docs/数学与模块现状总览.md`

---

### 待办（用户已决策，未执行）
- 仓库清理：**暂不删除** GitHub 3 个 fork + worldbrain-mcp（用户："修，仓库先不删"）
- npm：lingnao-mcp 已发布；lingjing-mcp 弃用待 deprecate（需凭据，未做）
- 上述 2026-08-30 工作**尚未 git 提交**（工作区 90 文件改动，含早期 rebrand 改名）

## 2026-08-31（架构定型 + 仓库精简 + 首个正式发布）

### 架构脊柱重大重构（①②③④ 全部完成 + 验证 + 推送 remote main）
- ① **机检证明账本** `verifyLedger()` + 启动自检：能力→定理映射闭合 + 推导链闭合，断裂即内核拒绝启动
- ② **信任防火墙全链** `FIREWALL` + 唯一通道 `liftToBelief()`（D-S 包络，永不成公理）；PERCEPTION 规划入口 aStar / dmcts / goalDirected 入口扫感知边、污染即诚实降级 grounding 为 PERCEPTION + `execute` 末道物理拦截
- ③ **去全局化** 删裸全局 `let WORLD`/`const BODY`，建 `_STATE` 单一真相源 + `getWorld()/getBody()` 访问器；232 处读点机械解耦（裸全局态真消除，`K.WORLD===undefined`）
- ④ **思想索引** `LingNaoThinking` 11 类数学思想挂 `MathKernel.thinking`
- **算法第一性原理优化** A* open 集换二叉堆 O(log n)；dmcts 改确定性（mulberry32 取代 Math.random，全仓库随机源清零）；goalDirected 补确定性档
- **验证** tuple 56/56、MCP 自测 58/58、npm test（自测+传输 9/9）全绿；多轮回归一致

### 仓库精简（发布前清理）
- 删垃圾目录：`_待删除_乱码副本/`（乱码）、`legacy/worldbrain-mcp/`（被灵脑取代的旧产品）
- 文档归档：冗余审计过程稿（ARCH-FIRST-PRINCIPLES / ARCH-RESTRUCTURE / MATH-THINKING-AUDIT / HUMAN-MATH-INVENTORY / MATH-FIRST-PRINCIPLES-AUDIT / FIRST-PRINCIPLES-REEXAMINATION / 数学与模块现状总览 / ima-map / kernel-formal.json）→ `docs/archive/`
- 脚本归整：所有 `test-*.js`/`selftest-umd.js` → `test/`；`demo-*/`/`brain-*/`/`gen-*/`/`*-demo.js`/`virtual-world.js`/`knowledge-distillery.js`/`audit-math-coverage.js`/`ima_lingnao_map.js` → `examples/`；同步修正 package.json `files`/`scripts` 与 README/AGENT-SETUP 引用路径（修复挪动后的相对引用，双测试复跑全绿）
- 内核：无 debugger、无重复定义；深度死代码删除因紧邻发布风险高、扫描误报多，保留靠测试兜底

### 发布（进行中，见下方各平台）
- GitHub Release v1.0.0（tag 见仓库）
- npm `lingnao-mcp@1.0.0`（UNLICENSED，非开源；免费面向 AI Agent 分发）
- COS 在线试用页 `/lingnao/`（playground.html / lingnao-console.html）
- 注册市场：mcp.so / Glama / PulseMCP 提交（mcp.json 已备）；Smithery 待 Key（用户未提供，暂未收录）
