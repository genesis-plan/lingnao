# 灵脑 LingNao（世界通用大脑）— 可审计推理大模型

> **把它当成一个大模型来做**：灵脑是一个**本地确定性、可审计的推理大模型**，不是普通脚本、也不是概率生成式 LLM。
> 内核把「世界图 → A\* 可审计推理 → 物理载体执行 → 学习闭环」封装为单一引擎，对外以 **MCP stdio / 网页演示** 两种接口暴露。
> 零依赖 · 零服务器 · 免费面向 AI Agent 分发。

- 仓库（模型主仓，独立于灵数求解器 lingshu-solver）：<https://github.com/genesis-plan/lingnao>
- 架构白皮书：[ARCHITECTURE.md](./ARCHITECTURE.md)
- 直接使用：克隆仓库后 `node lingnao-mcp.js`（MCP stdio，零依赖）；或 npm 包 `npx lingnao-mcp`（已发布 `lingnao-mcp@3.1.0`）

> 🧪 **正在求测 / 求反馈**：我们做了一个「不幻觉、可审计」的通用大脑，请做 Agent / 机器人 / 严谨 AI 的朋友来跑、来挑刺。
> - 🟢 在线试用（零安装，双击即用）：<https://hclj-1409755229.cos.ap-guangzhou.myqcloud.com/lingnao/playground.html>
> - 🟢 在线试用「开始干活」控制台（三步接入身体/大模型/大脑 + 真实身体）：<https://hclj-1409755229.cos.ap-guangzhou.myqcloud.com/lingnao/lingnao-console.html>
> - 💬 求测帖 & 反馈：<https://github.com/genesis-plan/lingnao/discussions/1>
> - 🤖 AI Agent 零安装接入：`npx github:genesis-plan/lingnao`（46 工具）

---

## 模型卡（Model Card）

| 项 | 内容 |
|---|---|
| 模型名称 | 灵脑 LingNao（世界通用大脑 / WorldBrain） |
| 模型类型 | **可审计确定性推理大模型**（非概率生成式 LLM） |
| 内核 | 本地确定性 A\* 推理 + 七段审计 + 正·负·边界样本知识库，不经大模型、不幻觉 |
| 感知层 | **免费 LLM（OpenRouter `:free`）做 NL→JSON** + 贝叶斯滤波/Banach 信念收敛，把自然语言理解成结构化目标；无 key 可手动降级 |
| 定位 | 驱动一切具身 / 物理载体的透明决策大脑（五层认知操作系统全实装） |
| 接入 | MCP stdio（46 工具）/ 单文件网页演示（HTML，双击即用） |
| 许可 | MIT，免费、开源、面向 AI Agent 分发 |

**它能做什么**
- 在任意「世界图」上做**最优且可审计**的决策（系统2：A\* + 硬/软约束 + RSG 推理状态图；系统1：高置信经验快答）
- 每一步推理都给出**依据链**与**七段审计报告**（概要/轨迹/证据/约束/𝕌/形式化证明证书/可复现），并量化认知+偶然不确定性，凡不可判定诚实标 $\mathbb{U}$
- 用**免费 LLM** 把自然语言/状态描述理解成结构化目标（NL→JSON），零成本接入人类与载体
- 接收**物理载体**上报（电量、区域密度）→ 自动生成硬/软约束 → 下发指令 → 执行回报 → 学习闭环（正/负/边界样本）
- 经验知识库可查、可增、置信度随使用更新
- **量纲分析（物理正确性约束）**：SI 七基本量纲代数 + 量纲齐次性 + Buckingham π 定理。
  区间约束保证数值**不越界**，量纲约束保证数值**说得通** —— 把 3 秒加到长度字段这类物理上荒谬的动作，
  在**规划阶段**就被判定不可用，根本不会下发（34 项验证：`node test-dimension-layer.js`）
- **声明式能力契约**：物理身体以结构化契约 `{pre.require{min,max,gte,lte,eq}, effect{set,inc}}`
  接入，可被静态验证与区间传播；旧的函数式契约仍兼容，但会被诚实标注为「不可验证」
- **观测契约 + 可区分性**：设备可声明传感器噪声界，据此判定两个状态在数学上能否被区分；
  若某动作的效果落在噪声内（做了和没做分不出来），拒绝下发

**它不做什么（诚实边界）**
- 不生成文本、不编造事实；推理结果可复现、可审计、不幻觉
- **v3.0 完整骨架已全部确定性实装**（UMD 导出 207 个函数；Node 自测 51 项，其中 `algebraic_solve` 需灵数求解器 `lingshu-solver` 依赖，安装后 51/51 全过）：感知(免费LLM + Banach 信念收敛) / 世界图(边概率P + LSH检索 + 规则蒸馏 + 认知图谱 + 元知识路由) / 系统1-2 + RSG / 符号Z3-lite 约束求解 / **代数方程系统求解（委派真引擎灵数求解器，区间收缩 + Krawczyk 认证，非 lite）** / 霍尔机器验证证明 / D-MCTS 分支探索 / 七段审计 / 正·负·边界样本 / 单步学习 + PAC 样本界 + do演算·PC因果 / 元认知层 / EDA 事件总线 + Data Fabric 版本化 + PrSTL 运行时安全停车 + 持续验证 / 物理载体接入 / **具身层（A\* 状态空间规划 + checkHard SAFE-STOP + maxReplans 护栏 + 任意物理身体能力契约）** / **安全栈（CBF-QP 安全滤子 + 组合 CBF + STL 定量语义 + Zonotope 可达集 + 混合自动机×自动微分）** / **最优分配（匈牙利算法 + LP 对偶证书）** / **抽象解释（区间格 + widening/narrowing 不动点）**
- **轻量替代标注（手写 lite 版、非工业级外部求解器，均可运行、均确定性、均不虚构）**：符号验证=自写约束求解器（非真实 Z3）；霍尔证明=结构化逐边验证（非 Coq 机器证明）；因果发现=PC-lite 离散近似（非真实 PC/FCI）；LSH=SimHash 投影（非 Milvus）；**世界模型/反事实已 lite 实装**（SEM 线性结构方程 + Pearl 反事实三步法，确定性可审计；文档原仅给 VAE/ADM-v2 等名词无定义，本实装为诚实 lite 等价，非 VAE）

---

## 数学原理与安全栈（内核已实装，可审计）

灵脑的可审计性不靠外部知识库背书，而靠内核里**已证明定理的可执行判据**。已实装并导出（UMD 207 函数）的数学层：

- **最优与图论**：A\* 完备最优（可采纳启发式）、D-MCTS 分支探索、运输问题最小费用流精确最优、匈牙利算法（Kuhn–Munkres，返回 LP 对偶最优性证书 (u,v)，总互异性 ⇒ 整数 LP 最优，禁边诚实 `feasible:false`）。
- **控制与物理 AI 安全**：CBF-QP 安全滤子（`cbfFilter`/`cbfMargin` 凸 QP 解析投影）、组合 CBF（Hildreth 对偶 QP 多约束）、STL 定量语义鲁棒度 ρ、Zonotope 线性可达集过近似（sound）、混合自动机 × 自动微分（Gershgorin Lipschitz 界 + Zeno 检测）。
- **形式化与验证**：霍尔路径机器验证、符号约束求解（自写 Z3-lite 等价）、STL/PrSTL 运行时安全停车、七段审计含证明证书。
- **抽象解释**：区间格（⊥/⊤、join/meet、偏序）+ **widening ∇**（保证收敛）+ **narrowing △**（精度回收，过近似声学不变），`absFixpoint` Kleene 迭代；不可判定处诚实标 $\mathbb{U}$。
- **量纲与契约**：SI 七基本量纲代数 + 齐次性 + Buckingham π；声明式能力契约（pre/effect）+ 观测契约可区分性。
- **因果与学习**：do 演算后门/前门准则、PC-lite 因果发现、线性 SEM 世界模型 + Pearl 反事实三步法、PAC 样本界、正/负/边界样本学习闭环。

> 诚实边界：MPC、Barrier Certificate（SOS/SDP）、PrSTL 之外的一般 LP 求解器、非线性 SEM、一般非线性可达集等 8 类数学**尚未实装**（理论上部分不可判定，或工程优先级靠后），审计脚本 `audit-math-coverage.js` 持续如实列出。详见 `docs/数学与模块现状总览.md`。

---

## 为什么不幻觉（神经符号边界）

大模型会错，本质是**概率生成**：它从训练分布里"猜"下一个 token，没有真值约束，于是产生幻觉。灵脑**刻意不做生成式 LLM**，而是把 LLM 严格限制在**感知 / 解释**两个前端，推理与审计全部在本地确定性内核：

| 档位 | 来源 | 会幻觉吗 | 能否作为依据 |
|---|---|---|---|
| `PERCEPTION`（UNVERIFIED_LLM） | 免费 LLM 把人话转成结构化目标 | **会**（显式标注 `_grounding.mayHallucinate=true`） | 否，绝不进入证明链 |
| `KERNEL`（DETERMINISTIC） | 内核 A\* / 知识库计算 | 不会，可复现 | 是 |
| `PROOF`（AUDITED） | 七段审计 + 霍尔证明证书 | 不会，可机器验证 | 是（最高保证） |

`askBrain` / `audit` / `reason` 返回值都携带 `grounding` 字段与 `disclaimer` 提示；LLM 解释文本显式标注"可能幻觉，不计入证明或决策依据"。这是产品定位的硬保证，并由 `node lingnao-mcp.js --selftest` 的 `grounding` 项持续验证。

---

## 快速接入

```bash
git clone https://github.com/genesis-plan/lingnao && cd lingnao   # 或直接使用 npm 包：npx lingnao-mcp
node lingnao-mcp.js --selftest      # 零依赖验证（51 项工具自检，含 grounding 不幻觉分层项 + 具身层；algebraic_solve 需 lingshu-solver 依赖，npm i 后 51/51 全过）
# 灵数求解器真引擎以 npm 依赖 lingshu-solver 接入（ genesis-plan/lingshu-solver ，独立仓库，已发 npm）
```

任何支持 MCP 的客户端（Claude Desktop / Cursor / Cline 等）复制 [`mcp.example.json`](./mcp.example.json) 即可接入，**不用开网页、不用服务器、不用本地装包**（`npx github:genesis-plan/lingnao` 自动拉仓库并暴露 46 个工具）：

```json
{
  "mcpServers": {
    "lingnao": { "command": "npx", "args": ["github:genesis-plan/lingnao"], "env": { "OPENROUTER_API_KEY": "填你的免费Key(可留空)" } }
  }
}
```

**开发者 / 前端零安装**：`<script src="https://cdn.jsdelivr.net/gh/genesis-plan/lingnao/lingnao.umd.js"></script>` 然后 `const L = window.LingNao`（浏览器/Node 通用 UMD，零依赖、零安装）；或 `git clone` 后 `const L = require('./lingnao.umd.js')`。
**非技术零安装**：双击 [`playground.html`](./playground.html) 即可看「规划路径 + 七段审计 + 不幻觉分层」，离线可用。

---

## 三步上手「开始干活」控制台（零安装，非技术也能用）

仓库自带单文件网页控制台 [`lingnao-console.html`](./lingnao-console.html)：把 **① 接入具身智能 → ② 接入外部大模型 → ③ 接入灵脑大脑** 做成三个连接面板，最后一颗 **开始干活** 按钮，自然语言任务 → 输出规划 + 执行 + 七段审计 + 不幻觉置信分层。

- **① 接入具身智能**：填身体配置 JSON（状态/硬约束/能力），点「连接身体」→ `setWorld`+`attachBody` 把机器人能力注册进大脑状态空间（**任何物理身体**都行：AGV / 机械臂 / 无人机，内核只认能力契约，不写死身体类型）。
- **② 接入外部大模型**：填 OpenRouter Key + 选模型 → `configureLLM`；自然语言任务经 `perceiveLLM` 翻成结构化意图。**不填 Key 也能干活**（降级结构化输入，大脑 100% 确定性运行）。
- **③ 接入灵脑大脑**：随页面载入 UMD（207 导出），点「自检」跑 `reason('CHARGE','C')` 验证就绪。
- **开始干活**：`plan_task`（A\*+hMax 状态空间最优）→ `doWork`（含 `check_hard` SAFE-STOP + `maxReplans` 护栏）→ `generateAudit`（七段审计）。输出 **规划 / 执行 / 审计 / 置信** 四标签，置信页显式标 `PERCEPTION(可能幻觉) / KERNEL(确定性) / PROOF(审计可验证)` 三档。
- **真实身体模式**：选「真实身体(WebSocket)」填 ws 地址 → 点连接 → 动作发往真身体执行（规划/审计不变）。协议见 [`lingnao-body-bridge.js`](./lingnao-body-bridge.js) + 零依赖仿真服务端 [`lingnao-body-sim-server.js`](./lingnao-body-sim-server.js)（先 `node lingnao-body-sim-server.js` 起一个仿真 AGV 即可端到端试通）。**接入你自己的真机器人**：灵脑**不直接连传感器**——真实链路是四层：

```
灵脑大脑(软件) → 身体适配器(软件,跑在上位机/PLC/ESP32) → 现场总线(CAN/RS-485 Modbus/EtherCAT) → 传感器·执行器(纯物理)
```

回 `hello-ack` 的是**第 2 层的适配器软件**，不是传感器本身——4-20mA 变送器、限位开关、编码器脉冲**根本没有回复通道**，只能由适配器轮询后合成状态。大脑比对主版本，不符或无握手将**拒绝连接**（fail-closed，防止破坏性协议变更静默失败）。

> **握手只证明"对端软件在线"，证明不了物理侧存活与数据真伪。** 因此本桥另设四道物理现实性守卫（`node test-body-physics.js` 24 项验证）：
> ① **心跳看门狗**——连续 `heartbeatTimeout`（默认 15s）无任何入站帧即判身体死亡并拒绝下发，防拔线 / MCU 复位 / WS 半开等**静默失效**；
> ② **数据新鲜度**——状态超过 `maxStateAge`（默认 15s）未刷新即视为陈旧，拒绝据此行动（30 秒前的读数对移动机器人无物理意义）；
> ③ **物理合理性**——量程 / 每秒最大变化率 / 连续同值卡死(stuck-at)，不通过则诚实标 $\mathbb{U}$ 并拒绝行动（量程须由接入方声明，大脑无法先验得知某个温度传感器的物理量程）；
> ④ **慢 ≠ 死**——长动作可用 `{type:'progress'}` 帧续期，超过 `maxActionTime` 总上限才拒绝（龙门移动 30s、回充对接 60s 都属正常，不该被固定 5s 超时误杀）；
> ⑤ **动作幂等**——`actionId` + `queryStatus(id)` 可查 `running/done/unknown`，超时后不盲目重试（避免重复投料 / 重复放电）。

> 零安装：同目录放 `lingnao.umd.js`，双击本页即可（无需服务器）。
> ⚠️ 浏览器直连大模型会把 Key 暴露前端，仅限本地演示；正式部署应走服务端代理。具身执行为确定化重规划近似，非 POMDP 最优。

```bash
node lingnao-body-sim-server.js          # 终端1：起仿真真身体（默认 ws://localhost:8787）
# 双击 lingnao-console.html → ①连接身体 → 选「真实身体(WebSocket)」填 ws://localhost:8787 → 连接 → 开始干活
```

---

## 架构（摘要）

形式化七元组 $\mathbb{B}=(\mathbb{W},K,\Phi,\Psi,\Theta,\Lambda,\Xi)$，八层：感知 $\Phi$ / 学习 $\Psi$ / 知识库 $K$ / 推理 $\Theta$ / 因果 $\Lambda$ / 演化 / 审计 $\Xi$ / 统一。
详见 [ARCHITECTURE.md](./ARCHITECTURE.md)。

核心定理（可证）：有限世界图 + 可采纳欧氏启发式下，A\* **完备且最优**——要么返回最优路径，要么诚实标 $\mathbb{U}$。

---

## 工具接口（MCP，46 个）

| 能力 | 工具 | 说明 |
|---|---|---|
| 免费 LLM 感知 | `perceive` | 自然语言/状态描述 → 结构化感知（需 OpenRouter Key：参数或 env `OPENROUTER_API_KEY`） |
| 贝叶斯信念收敛 | `perceive_belief` | 贝叶斯滤波迭代 + Banach 压缩映射收敛检测（离散信念→不动点） |
| 场景感知 | `world_info` / `set_world` | 看世界图结构，或导入你自己的场景（灭蚊器只是默认示例；边可带 `p` 概率） |
| 可审计推理 | `reason` / `audit` | 系统1 快答 + 系统2 A\* 最优 + RSG 推理状态图 + 每步依据 + $\mathbb{U}$；七段审计报告（含证明证书/可复现） |
| 符号验证 | `symbolic_verify` | 霍尔机器验证 A\* 路径满足不变量（手写 Z3-lite 等价） |
| **代数方程求解** | `algebraic_solve` | **委派真引擎「灵数求解器」(lingshu-solver)**：区间收缩 + Krawczyk 认证，离线确定性、可复现；解实数方程组（≤6 变量，支持 sin/cos/exp/log/sqrt 等），返回 certified/tier/residual |
| 分支探索 | `dmcts` | D-MCTS 并行分支探索 + 回溯，返回多候选最优路径 |
| 知识检索/蒸馏 | `knowledge_ann` / `knowledge_distill` / `cog_graph` | LSH 近似检索 / FP-Growth 规则蒸馏 / 认知图谱 |
| 因果 | `causal` / `causal_effect` | PC-lite 因果发现 + do 演算（后门准则 / **前门准则**，见 `causal_effect` 的 `mediator` 参数） |
| 世界模型 | `world_model` / `counterfactual` | 学结构方程 SEM（手写最小二乘）并前向模拟下一状态；反事实推理（Pearl 三步法 abduction→action→prediction，lite 等价，确定性可审计；非 VAE/ADM-v2） |
| 学习理论 | `pac_bound` | PAC 学习定理样本复杂度下界 |
| 物理载体接入 | `carrier_report` | 载体上报电量/密度，自动生成硬/软约束 |
| 学习闭环 | `learn` / `knowledge_query` / `knowledge_add` | 执行回报 → 正/负样本置信度更新；经验库可查可增 |
| 元认知 | `meta` | 第五层元认知协调（熵/一致性/缺口/仲裁/探索-利用） |
| 事件总线 | `event_publish` | EDA 事件发布（感知/推理/学习/审计/元认知） |
| 数据编排 | `knowledge_fabric` | Data Fabric 知识库版本化（commit/list/diff） |
| 运行时验证 | `runtime_monitor` / `continuous_verify` | PrSTL 安全停车 / 仓库级持续验证管道 |
| **具身层（机器人 / 物理身体）** | `attach_body` / `capabilities` / `get_state` / `set_state` / `state_diff` / `check_hard` / `h_max` / `plan_task` / `execute_task` / `positioning` | 注册任意物理身体（能力契约 `id/pre/effect/cost/ground` + 硬约束禁区）→ 大脑内 A\* 状态空间最优规划 → 逐步执行（`check_hard` SAFE-STOP）→ 观测偏差→确定性重规划（`maxReplans` 护栏）；`positioning` 返回产品定位。机器人侧用 `plan_task` 产出动作序列自行驱动真身体，或经 stdio 调用 |
| 端到端 / 解释 | `ask` / `explain` | `ask`：感知→推理→审计→不幻觉分层一体；`explain`：LLM 解释文本（标注可能幻觉，不计入证明链） |
| 目标导向 / 自检 | `goal_directed` / `lingnao` | `goal_directed`：目标导向 A\* 有界推理；`lingnao`：内核自检 / 状态快照 |
| 外部知识库（第三方） | `ima_load` / `ima_query` | 载入 / 查询第三方 IMA 知识库（**verified:false，仅参考索引，不进入证明链**） |
| 自我学习闭环 | `sl_discover` / `sl_record` / `sl_validate` / `sl_monitor` / `sl_status` | 学习四层闭环：发现 / 记录 / 验证 / 监控 / 状态（正·负·边界样本置信度更新） |

### `perceive({text, apiKey?})`
```json
{ "text": "电量80，目标去C区，A区蚊子很多" }
```
→ `{ "ok": true, "mode":"llm", "percept": {"goal":"C","battery":80,"density":{"A":8},"confidence":0.9} }`
无 key 降级：`{ "ok":false, "mode":"manual", "error":"未提供 OpenRouter API Key" }`。

### `reason({start?, goal, hard?, soft?, system1Only?})`
```json
{ "start": "CHARGE", "goal": "C", "hard": ["A"], "soft": ["B"] }
```
→ `{ "status":"optimal", "usedSystem":"2", "path":["CHARGE","B","C"], "cost":6, "rsg":{"branchCount":5,"pruneCount":1,"optimalPath":[...]}, "steps":[...] }`
不可判定时诚实返回 `{ "status":"unknown", "U": true, "reason":["目标不在世界图"] }`。

### `carrier_report({battery?, goal, density?})`
```json
{ "battery": 100, "goal": "A", "density": {"A":8,"B":3,"C":5} }
```
→ `{ "battery":100, "hard":[], "soft":["B"], "note":"电量充足" }`
电量 <20 时 `hard:["A","B","C"]`（禁止离开充电座）。

### `audit({start?, goal, hard?, soft?})`
→ `{ "summary":{}, "details":[], "evidence":[], "constraints":[], "unknown":[], "uncertainty":{}, "proof":{"hoare":"{P} C {Q}"}, "reproducible":{}, "status":"valid" }`

### `ask({text})`（端到端，含不幻觉分层）
```json
{ "text": "从充电座出发去 C 点，电量充足" }
```
→ `{ "ok":true, "percept":{...}, "reason":{"status":"optimal","path":["CHARGE","B","C"],"grounding":{"tier":"DETERMINISTIC"}}, "explanation":{"ok":true,"text":"…","grounding":{"tier":"UNVERIFIED_LLM"},"disclaimer":"LLM 解释可能含错误（幻觉）…"}, "grounding":{"tiers":{...}}, "disclaimer":"感知(percept)来自免费 LLM，可能幻觉…决策依据来自 reason(确定性内核) 与 audit(审计证明)" }`
> `percept`（感知）标注 `UNVERIFIED_LLM` 可能幻觉；`reason`（推理）标注 `DETERMINISTIC` 不幻觉——这就是"不幻觉"的机器可读边界。

### `causal_effect({samples, cause, effect, mediator?})`（do-演算，后门/前门准则，反事实因果）

后门（默认，需 effect 的其余父节点已观测）：
```json
{ "samples":[{"state":{"x":1},"action":{"a":0},"next":{"y":2}}, …], "cause":"a", "effect":"y" }
```
→ `{ "ace":1, "adjustSet":["x"], "auditable":true, "deterministic":true, "grounding":{"tier":"DETERMINISTIC"} }`
> 在 y=2x+a 的合成数据上 ACE(a→y)=1 精确还原真值；确定性、可审计。**不引用任何外部知识库作为正确性依据**——因果结论由本产品内置的 do 演算/后门准则代码自证，回归测试可复现。

前门（存在未观测混杂、后门失效时，传 `mediator`）：
```json
{ "samples":[{"state":{"X":1,"M":0.5},"next":{"Y":0.9}}, …], "cause":"X", "effect":"Y", "mediator":"M" }
```
→ `{ "ace":0.25, "method":"front-door-adjustment-linear-SEM", "mediator":"M", "handlesUnobservedConfounder":true, "auditable":true, "grounding":{"tier":"DETERMINISTIC"} }`
> 吸收 Pearl 前门准则：X→M→Y 且 U→X,U→Y（未观测混杂）时，后门失效，但前门 ACE=α·β 仍可识别（自测合成数据精确还原 0.25）。前门三条件由调用方声明。结论由内置代码自证，**不依赖任何外部知识库**。

### `learn({path, success})` / `knowledge_query` / `knowledge_add`
经验库增查与置信度更新（成功=正样本 +0.1 / 失败=负样本 -0.1）。

---

## 最小调用序列（智能体视角）

```
1. world_info()                → 了解场景节点
2. set_world(我的场景)          → （可选）换成你的物理载体/任务图
3. carrier_report(电量,目标,密度) → 载体上报，拿硬/软约束
4. reason(起点,目标,硬,软)       → 可审计最优路径
5. 载体按 path 执行
6. learn(执行路径, 成功?)       → 置信度更新，越用越准
```

---

## 把它当机器人大脑：极简示例（别人也能直接跑）

仓库内置一个**可直接运行的真示例** [`examples/simple-robot.js`](./examples/simple-robot.js)：一台在 `CHARGE / A / B / C` 网格里移动的地面机器人，接收一句中文口语指令，由灵脑完成「感知 → 规划 → 执行 → 审计」。

它本身就是对「不幻觉」边界的最小演示：**感知用免费 LLM（可能幻觉，标 `UNVERIFIED_LLM`），规划/审计用本地确定性内核（标 `DETERMINISTIC` / `AUDITED`，可复现、可验证）**。任何人 clone 后把 `K.reason` / `K.generateAudit` 接到自己的机器人控制器即可。

```bash
# 离线（零成本，演示确定性内核）：
node examples/simple-robot.js "去C点"
# 带免费 API（真正调用 OpenRouter free 做感知，每天 50 次免费额度）：
OPENROUTER_API_KEY=sk-or-... node examples/simple-robot.js "机器人电量低，去C点充电"
```

真实运行输出（节选，已用免费 API 实测）：

```
[ROBOT] 指令(人话): 机器人电量只剩 20% 了，赶紧去C点充电
   感知结果: {"goal":"前往C点充电","battery":20,"confidence":0.95,
               "_grounding":{"tier":"UNVERIFIED_LLM","mayHallucinate":true}} [llm, 可能幻觉 → 仅用于理解]
[BRAIN] 灵脑规划(确定性内核):  CHARGE → A → C | 代价 7.2426 | 置信档 DETERMINISTIC
[AUDIT] 审计: 证明 {P} C {Q} | verified: true | 自验证 PASS | 不幻觉保证: 决策依据全部来自确定性内核/审计
```

三种接入方式，任选其一即可让别人/别的项目使用灵脑：

| 方式 | 适用 | 怎么用 |
|---|---|---|
| **MCP 服务**（推荐给 AI 客户端） | Claude Desktop / Cursor / Cline 等 | 见上方 `mcpServers` 配置，`lingnao-mcp` 暴露 46 个工具（含具身层 10 个） |
| **库 require**（推荐给开发者/机器人） | Node 项目直接调内核 | `const K = require('./lingnao-mcp'); K.reason(start, goal)`（不自启服务） |
| **浏览器单文件** | 非技术用户 / 演示 | 双击 `灵脑.html`，用大白话让大脑理解并规划 |

> 内核是「单一真源」：`lingnao-mcp.js` 通过 vm 从 `灵脑.html` 抽取同一份内核实跑，三种方式行为完全一致。

### 真实机器人案例接入（网上真实部署，灵脑当大脑）

[`examples/real-robots.js`](./examples/real-robots.js) 把 **4 个真实、可考据的机器人部署案例**用灵脑世界图建模后接入大脑，每个都跑「免费 LLM 感知(可能幻觉) → 灵脑 A* 确定性规划(不幻觉) → 七段审计(可验证)」，并演示**硬约束改道**（通道被占/结构不稳时内核确定性重规划）。案例与公开来源：

| 案例 | 真实背景（来源） | 任务（世界图建模为节点+边+代价） |
|---|---|---|
| **Amazon Kiva / Proteus 仓储机器人** | 2012 以 7.75 亿收购 Kiva；2025.7 破 100 万台(amalytix/aboutamazon)；SLAM 自由导航、自动回充 | 把货架货送到拣货站；硬约束演示：A1 通道被占 → 改道 `DOCK→A2→STATION`（代价 7.24→8.49） |
| **Aethon TUG 医院配送机器人** | 全球 1000+ 站点、超 1 万台；SLAM 导航、呼叫电梯/开门、ISO 13482(robotwale/aethon) | 把药房药品送到 B 病区：`DOCK→ELEV→WARD_B`（代价 5） |
| **Starship 校园/人行道配送机器人** | 累计超 1000 万次配送、1400 万英里；约 99% 自主 L4、载货约 10kg、单次 $1.99(starship.xyz) | 食堂取餐送宿舍：`HUB→QUAD→DORM`（代价 5，真调免费 API 实测解析出 DORM） |
| **废墟搜救机器人（CMU / DARPA SubT / 土耳其震区）** | CMU 蛇形参与委内瑞拉震区；2023 土耳其 M7.8 部署热成像探测；DARPA SubT 多机自主建图(robotage/automate) | 基地抵疑似幸存者区；硬约束演示：COMMS 失效 → 改道 `BASE→Z2→Z3→SURV`（代价 6→7） |

> 诚实边界：每个 world 是依据公开规格**简化的教学模型**（真实仓库/医院地图远比这复杂），但规划内核、审计、不幻觉保证与真实部署用的是同一套灵脑代码。任何人 clone 后把 `K.reason` / `K.generateAudit` 接到自己的机器人控制器即可。

```bash
node examples/real-robots.js                 # 离线(零成本)，跑全部 4 例
node examples/real-robots.js warehouse       # 只跑某案例
node examples/real-robots.js --llm           # 真调 OpenRouter free 做感知（每天 50 次免费）
```

---

## 文件清单

| 文件 | 作用 |
|---|---|
| `lingnao-mcp.js` | MCP 服务本体（stdio，零依赖，手写 JSON-RPC 2.0 分帧） |
| `灵脑.html` | 单文件演示 + 内控内核（MCP 从此抽取复用，单一真源） |
| `ARCHITECTURE.md` | 架构白皮书（七元组 / 八层 / 诚实实装映射） |
| `README.md` | 本模型卡与接入指南 |
| `package.json` / `LICENSE` | 可安装包定义 / MIT 许可 |
| `examples/simple-robot.js` | 极简机器人示例（免费 LLM 感知 + 确定性内核规划/审计，真可跑，证明别人能接入当大脑） |
| `examples/real-robots.js` | 4 个真实机器人案例接入（Amazon Kiva / Aethon TUG / Starship / 废墟搜救），含硬约束改道演示，离线零成本可跑 |
| `lingnao.umd.js` | **零安装 UMD**（浏览器/Node 通用）：`build-umd.js` 从 `灵脑.html` 单一真源抽取同一份内核自动构建；`<script>` 或 `require` 一行接入，开发者/前端最易用入口 |
| `build-umd.js` | UMD 构建脚本（抽内核→包 UMD），单一真源，改内核后重跑即同步 |
| `selftest-umd.js` | UMD 自测（`node selftest-umd.js` 直接 require 验证 reason/审计/前门因果/不幻觉分层），别人也能跑 |
| `playground.html` | 零安装网页 Playground（双击即用，引用 `lingnao.umd.js`），可视化规划+审计+不幻觉分层 |
| `mcp.example.json` | 智能体零安装 MCP 配置（`npx github:genesis-plan/lingnao`），复制即用 |
| `lingnao-console.html` | 零安装「开始干活」控制台（三步接入 + 开始干活按钮，模拟/真实 WebSocket 双模式），非技术用户首选入口 |
| `lingnao-body-bridge.js` | 真实身体 WebSocket 桥（零依赖，实现 bodyAdapter 契约：大脑→动作 / 身体→观测态）。注意真实链路为**四层**（大脑→适配器软件→现场总线→物理器件），握手对象是**适配器**而非传感器；另含心跳看门狗 / 新鲜度 / 物理合理性 / progress 续期 / 幂等查询五道物理现实性守卫 |
| `lingnao-body-sim-server.js` | 零依赖真身体仿真服务端（手工 RFC6455），模拟 AGV，供端到端验证真实桥（已支持 hello-ack 与 ping/pong） |
| `test-console-wiring.js` / `test-real-bridge.js` | 控制台接线 / 真实桥无头验证（9/9 通过），别人可复跑 |
| `test-body-physics.js` | **身体桥物理现实性验证（24 项）**：心跳判死、不误杀回 pong 的身体、陈旧状态拒绝、progress 证明慢≠死、maxActionTime 封顶、量程/变化率/卡死校验、动作幂等查询 |
| `smithery.yaml` | Smithery MCP 市场清单（stdio 启动 + 可选 OPENROUTER_API_KEY） |
| `mcp.json` | 标准 MCP 客户端一键配置（`npx -y lingnao-mcp`，可选 OPENROUTER_API_KEY） |
| `LingNao_Brain_Review_Brief_EN.md` | 英文外部评审简报（Embodied Brain 契约最小实装说明） |
| `VERIFIABLE-PHYSICAL-AI.md` | **可验证物理 AI 定位**：与产业界「三道门槛」（泛化性/可靠性/持续学习）的对齐，量纲分析的作用，以及 4 条诚实边界 |
| `test-contract-layer.js` | 连接契约层验证（32 项）：声明式契约求值、硬约束 fail-closed、观测可区分性、不可逆动作拦截 |
| `test-dimension-layer.js` | 量纲分析层验证（34 项）：量纲代数、齐次性、Buckingham π、物理荒谬动作不进入规划 |
| `test-mcp-stdio-transport.js` | **MCP stdio 传输层验证（9 项）**：NDJSON（现代 MCP 客户端）与 Content-Length（旧客户端）双帧格式握手 + `tools/list` + 端到端 `tools/call`。**必须独立存在**——`--selftest` 直接调内核函数、绕开传输层，传输坏了自测照样全绿 |
| `gen-agent-manifests.js` | 生成「给前沿大模型用」的接入清单：真起 MCP 服务走 `tools/list` **实时抓取**（与客户端所见一致、永不过期），产出 `llms.txt` / `openai-tools.json` / `anthropic-tools.json` |
| `llms.txt` | LLM 发现文档（中英双语，[llmstxt.org](https://llmstxt.org) 标准）：给大模型/爬虫读的项目说明、接入方式、推荐调用顺序、诚实边界 |
| `openai-tools.json` / `anthropic-tools.json` | 46 个工具的 function-calling / tool-use 清单，供 OpenAI Agents SDK、各家 function calling 框架直接加载 |
| `docs/` `docs/archive/` `legacy/` | 文档导览见上文；过程稿归档 16 篇；WorldBrain 历史归档 |

> 部署时 `lingnao-mcp.js` 与 `灵脑.html` 需同目录（或设 `LINGNAO_HTML` 环境变量，旧名 `LINGJING_HTML` 仍兼容）。

---

## 分发到各平台（让别人实际用起来）

| 渠道 | 怎么上 | 状态 / 入口 |
|---|---|---|
| **GitHub（主仓）** | 已推 `genesis-plan/lingnao`（`worldbrain` 远端） | <https://github.com/genesis-plan/lingnao> — 克隆即跑，零安装 |
| **MCP 市场：Smithery** | 已备 `smithery.yaml`（stdio + 可选 Key）；登录 smithery.ai → Import from npm: `lingnao-mcp`，或给我 Smithery Key 我来跑 | 仓库已备 `smithery.yaml` |
| **MCP 市场：mcp.so / Glama / PulseMCP** | 已随 npm 包 `lingnao-mcp` 自动收录（关键词 mcp）；也可在站点粘贴仓库 URL 或根目录 `mcp.json` | 搜索 `lingnao-mcp` 或访问仓库 |
| **在线试用（免安装）** | 双击 `lingnao-console.html`（同目录需 `lingnao.umd.js`）；或静态托管后给链接 | 控制台：<https://hclj-1409755229.cos.ap-guangzhou.myqcloud.com/lingnao/lingnao-console.html> ／ Playground：<https://hclj-1409755229.cos.ap-guangzhou.myqcloud.com/lingnao/playground.html> |
| **npm** | ✅ 已发布 `lingnao-mcp@3.1.0`：`npm i -g lingnao-mcp` 或 `npx lingnao-mcp`（自测 51 项，algebraic_solve 需 lingshu-solver 依赖，`npm i` 后 51/51 全过） | `npx -y lingnao-mcp` |

> 让别人用的三种方式（任选其一）：① 双击 `lingnao-console.html`（人）② `node lingnao-mcp.js`（AI 客户端 stdio，46 工具）③ 把「身体配置」换成你的机器人上报的能力/状态/硬约束（真机器人）。

---

## 许可与分发

MIT。免费、开源、面向 AI Agent 分发。可作为软著 / 专利材料与被动获客入口。

---

## 论文消费与学术对齐

本产品持续吸收外部前沿思想并诚实标注实装状态，详见 [docs/archive/灵脑_论文消费对照.md](./docs/archive/灵脑_论文消费对照.md)（do-calculus 前门准则、CoVe 自验证、Reflexion 反思、Tree-of-Thoughts、神经符号边界的逐篇对照与自测证据）。

## 文档导览

| 位置 | 内容 |
|---|---|
| 顶层 7 个 md | 面向使用者与贡献者：`README` / `ARCHITECTURE` / `CONTRIBUTING` / `CODE_OF_CONDUCT` / `SECURITY` / `VERIFIABLE-PHYSICAL-AI` / `LingNao_Brain_Review_Brief_EN` |
| `docs/` | 仍具参考价值但不放顶层：`ima-map.md`（**外部**第三方知识库 IMA 的条目索引，未经本产品验证，仅作命名参考，不构成正确性依据）、`community-post.md`（对外发帖草稿） |
| `docs/archive/` | **过程稿归档**（16 篇）：产品蓝图、专家审查报告、论文消费对照、超级大脑构想、各类 v3 骨架对照等调研与评审记录。保留用于追溯设计演进，**不代表当前状态** |
| `legacy/worldbrain-mcp/` | 「世界大脑 WorldBrain」历史归档（2026-08-26 的早期命名，5 个工具已全部并入灵脑） |

> 判断当前行为请以**代码与测试**为准，过程稿仅反映决策当时的想法。

## 反馈、测试与贡献（欢迎外部打磨）

- **提 Bug / 测试报告 / 功能建议**：用仓库 Issue 模板（`bug` / `test-report` / `feature` 三类）。
- **讨论与用法分享**：GitHub Discussions（仓库 Discussions 标签）。
- **跑通自测（你也能验证不幻觉）**：`node lingnao-mcp.js --selftest` → 应看到 `SELFTEST OK — 全部 51 项`。
- **贡献代码**：见 [CONTRIBUTING.md](./CONTRIBUTING.md)（含最小复现步骤与测试要求）。
- **安全/漏洞报告**：见 [SECURITY.md](./SECURITY.md)（请先私信，勿公开 Issue）。
