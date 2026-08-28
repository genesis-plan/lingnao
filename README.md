# 灵境 LingJing（世界通用大脑）— 可审计推理大模型

> **把它当成一个大模型来做**：灵境是一个**本地确定性、可审计的推理大模型**，不是普通脚本、也不是概率生成式 LLM。
> 内核把「世界图 → A\* 可审计推理 → 物理载体执行 → 学习闭环」封装为单一引擎，对外以 **MCP stdio / 网页演示** 两种接口暴露。
> 零依赖 · 零服务器 · 免费面向 AI Agent 分发。

- 仓库（模型主仓，独立于灵数求解器 lingshu-solver）：<https://github.com/genesis-plan/lingjing>
- 架构白皮书：[ARCHITECTURE.md](./ARCHITECTURE.md)
- 直接使用：克隆仓库后 `node lingjing-mcp.js`（MCP stdio，零依赖；npm 包待发布）

---

## 模型卡（Model Card）

| 项 | 内容 |
|---|---|
| 模型名称 | 灵境 LingJing（世界通用大脑 / WorldBrain） |
| 模型类型 | **可审计确定性推理大模型**（非概率生成式 LLM） |
| 内核 | 本地确定性 A\* 推理 + 七段审计 + 正·负·边界样本知识库，不经大模型、不幻觉 |
| 感知层 | **免费 LLM（OpenRouter `:free`）做 NL→JSON** + 贝叶斯滤波/Banach 信念收敛，把自然语言理解成结构化目标；无 key 可手动降级 |
| 定位 | 驱动一切具身 / 物理载体的透明决策大脑（五层认知操作系统全实装） |
| 接入 | MCP stdio（36 工具）/ 单文件网页演示（HTML，双击即用） |
| 许可 | MIT，免费、开源、面向 AI Agent 分发 |

**它能做什么**
- 在任意「世界图」上做**最优且可审计**的决策（系统2：A\* + 硬/软约束 + RSG 推理状态图；系统1：高置信经验快答）
- 每一步推理都给出**依据链**与**七段审计报告**（概要/轨迹/证据/约束/𝕌/形式化证明证书/可复现），并量化认知+偶然不确定性，凡不可判定诚实标 $\mathbb{U}$
- 用**免费 LLM** 把自然语言/状态描述理解成结构化目标（NL→JSON），零成本接入人类与载体
- 接收**物理载体**上报（电量、区域密度）→ 自动生成硬/软约束 → 下发指令 → 执行回报 → 学习闭环（正/负/边界样本）
- 经验知识库可查、可增、置信度随使用更新

**它不做什么（诚实边界）**
- 不生成文本、不编造事实；推理结果可复现、可审计、不幻觉
- **v3.0 完整骨架已全部确定性实装**（Node 校验 45/45）：感知(免费LLM + Banach 信念收敛) / 世界图(边概率P + LSH检索 + 规则蒸馏 + 认知图谱 + 元知识路由) / 系统1-2 + RSG / 符号Z3-lite 约束求解 / **代数方程系统求解（委派真引擎灵数求解器，区间收缩 + Krawczyk 认证，非 lite）** / 霍尔机器验证证明 / D-MCTS 分支探索 / 七段审计 / 正·负·边界样本 / 单步学习 + PAC 样本界 + do演算·PC因果 / 元认知层 / EDA 事件总线 + Data Fabric 版本化 + PrSTL 运行时安全停车 + 持续验证 / 物理载体接入
- **轻量替代标注（手写 lite 版、非工业级外部求解器，均可运行、均确定性、均不虚构）**：符号验证=自写约束求解器（非真实 Z3）；霍尔证明=结构化逐边验证（非 Coq 机器证明）；因果发现=PC-lite 离散近似（非真实 PC/FCI）；LSH=SimHash 投影（非 Milvus）；**世界模型/反事实已 lite 实装**（SEM 线性结构方程 + Pearl 反事实三步法，确定性可审计；文档原仅给 VAE/ADM-v2 等名词无定义，本实装为诚实 lite 等价，非 VAE）

---

## 为什么不幻觉（神经符号边界）

大模型会错，本质是**概率生成**：它从训练分布里"猜"下一个 token，没有真值约束，于是产生幻觉。灵境**刻意不做生成式 LLM**，而是把 LLM 严格限制在**感知 / 解释**两个前端，推理与审计全部在本地确定性内核：

| 档位 | 来源 | 会幻觉吗 | 能否作为依据 |
|---|---|---|---|
| `PERCEPTION`（UNVERIFIED_LLM） | 免费 LLM 把人话转成结构化目标 | **会**（显式标注 `_grounding.mayHallucinate=true`） | 否，绝不进入证明链 |
| `KERNEL`（DETERMINISTIC） | 内核 A\* / 知识库计算 | 不会，可复现 | 是 |
| `PROOF`（AUDITED） | 七段审计 + 霍尔证明证书 | 不会，可机器验证 | 是（最高保证） |

`askBrain` / `audit` / `reason` 返回值都携带 `grounding` 字段与 `disclaimer` 提示；LLM 解释文本显式标注"可能幻觉，不计入证明或决策依据"。这是产品定位的硬保证，并由 `node lingjing-mcp.js --selftest` 的 `grounding` 项持续验证。

---

## 快速接入

```bash
git clone https://github.com/genesis-plan/lingjing && cd lingjing   # 克隆仓库（npm 包待发布，先仓库直用）
node lingjing-mcp.js --selftest      # 零依赖验证（45/45 工具自检，含 grounding 不幻觉分层项）
# 灵数求解器真引擎以 npm 依赖 lingshu-solver 接入（ genesis-plan/lingshu-solver ，独立仓库，已发 npm）
```

任何支持 MCP 的客户端（Claude Desktop / Cursor / Cline 等）复制配置即可接入，**不用开网页、不用服务器**：

```json
{
  "mcpServers": {
    "lingjing": { "command": "lingjing-mcp" }
  }
}
```

---

## 架构（摘要）

形式化七元组 $\mathbb{B}=(\mathbb{W},K,\Phi,\Psi,\Theta,\Lambda,\Xi)$，八层：感知 $\Phi$ / 学习 $\Psi$ / 知识库 $K$ / 推理 $\Theta$ / 因果 $\Lambda$ / 演化 / 审计 $\Xi$ / 统一。
详见 [ARCHITECTURE.md](./ARCHITECTURE.md)。

核心定理（可证）：有限世界图 + 可采纳欧氏启发式下，A\* **完备且最优**——要么返回最优路径，要么诚实标 $\mathbb{U}$。

---

## 工具接口（MCP，36 个）

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
→ `{ "ace":1, "adjustSet":["x"], "auditable":true, "deterministic":true, "imaRef":["ima_304","ima_301"], "grounding":{"tier":"DETERMINISTIC"} }`
> 在 y=2x+a 的合成数据上 ACE(a→y)=1 精确还原真值；确定性、可审计，呼应 IMA 因果资料 ima_304 / ima_301。

前门（存在未观测混杂、后门失效时，传 `mediator`）：
```json
{ "samples":[{"state":{"X":1,"M":0.5},"next":{"Y":0.9}}, …], "cause":"X", "effect":"Y", "mediator":"M" }
```
→ `{ "ace":0.25, "method":"front-door-adjustment-linear-SEM", "mediator":"M", "handlesUnobservedConfounder":true, "auditable":true, "imaRef":["ima_304","ima_301"], "grounding":{"tier":"DETERMINISTIC"} }`
> 吸收 Pearl 前门准则：X→M→Y 且 U→X,U→Y（未观测混杂）时，后门失效，但前门 ACE=α·β 仍可识别（自测合成数据精确还原 0.25）。前门三条件由调用方声明。

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

## 文件清单

| 文件 | 作用 |
|---|---|
| `lingjing-mcp.js` | MCP 服务本体（stdio，零依赖，手写 JSON-RPC 2.0 分帧） |
| `灵境.html` | 单文件演示 + 内控内核（MCP 从此抽取复用，单一真源） |
| `ARCHITECTURE.md` | 架构白皮书（七元组 / 八层 / 诚实实装映射） |
| `README.md` | 本模型卡与接入指南 |
| `package.json` / `LICENSE` | 可安装包定义 / MIT 许可 |

> 部署时 `lingjing-mcp.js` 与 `灵境.html` 需同目录（或设 `LINGJING_HTML` 环境变量）。

---

## 许可与分发

MIT。免费、开源、面向 AI Agent 分发。可作为软著 / 专利材料与被动获客入口。

---

## 论文消费与学术对齐

本产品持续吸收外部前沿思想并诚实标注实装状态，详见 [灵境_论文消费对照.md](./灵境_论文消费对照.md)（do-calculus 前门准则、CoVe 自验证、Reflexion 反思、Tree-of-Thoughts、神经符号边界的逐篇对照与自测证据）。

## 反馈、测试与贡献（欢迎外部打磨）

- **提 Bug / 测试报告 / 功能建议**：用仓库 Issue 模板（`bug` / `test-report` / `feature` 三类）。
- **讨论与用法分享**：GitHub Discussions（仓库 Discussions 标签）。
- **跑通自测（你也能验证不幻觉）**：`node lingjing-mcp.js --selftest` → 应看到 `SELFTEST OK — 全部 45 项`。
- **贡献代码**：见 [CONTRIBUTING.md](./CONTRIBUTING.md)（含最小复现步骤与测试要求）。
- **安全/漏洞报告**：见 [SECURITY.md](./SECURITY.md)（请先私信，勿公开 Issue）。
