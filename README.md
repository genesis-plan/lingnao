# 灵境 LingJing（世界通用大脑）— 可审计推理大模型

> **把它当成一个大模型来做**：灵境是一个**本地确定性、可审计的推理大模型**，不是普通脚本、也不是概率生成式 LLM。
> 内核把「世界图 → A\* 可审计推理 → 物理载体执行 → 学习闭环」封装为单一引擎，对外以 **MCP stdio / 网页演示** 两种接口暴露。
> 零依赖 · 零服务器 · 免费面向 AI Agent 分发。

- 仓库（模型主仓，独立于灵数求解器 lingshu-solver）：<https://github.com/genesis-plan/lingjing>
- 架构白皮书：[ARCHITECTURE.md](./ARCHITECTURE.md)
- npm 安装：`npm install -g lingjing-mcp`

---

## 模型卡（Model Card）

| 项 | 内容 |
|---|---|
| 模型名称 | 灵境 LingJing（世界通用大脑 / WorldBrain） |
| 模型类型 | **可审计确定性推理大模型**（非概率生成式 LLM） |
| 内核 | 本地确定性 A\* 推理 + 七段审计 + 正·负·边界样本知识库，不经大模型、不幻觉 |
| 感知层 | **免费 LLM（OpenRouter `:free`）做 NL→JSON** + 贝叶斯滤波/Banach 信念收敛，把自然语言理解成结构化目标；无 key 可手动降级 |
| 定位 | 驱动一切具身 / 物理载体的透明决策大脑（五层认知操作系统全实装） |
| 接入 | MCP stdio（20 工具）/ 单文件网页演示（HTML，双击即用） |
| 许可 | MIT，免费、开源、面向 AI Agent 分发 |

**它能做什么**
- 在任意「世界图」上做**最优且可审计**的决策（系统2：A\* + 硬/软约束 + RSG 推理状态图；系统1：高置信经验快答）
- 每一步推理都给出**依据链**与**七段审计报告**（概要/轨迹/证据/约束/𝕌/形式化证明证书/可复现），并量化认知+偶然不确定性，凡不可判定诚实标 $\mathbb{U}$
- 用**免费 LLM** 把自然语言/状态描述理解成结构化目标（NL→JSON），零成本接入人类与载体
- 接收**物理载体**上报（电量、区域密度）→ 自动生成硬/软约束 → 下发指令 → 执行回报 → 学习闭环（正/负/边界样本）
- 经验知识库可查、可增、置信度随使用更新

**它不做什么（诚实边界）**
- 不生成文本、不编造事实；推理结果可复现、可审计、不幻觉
- **v3.0 完整骨架已全部确定性实装**（Node 校验 28/28）：感知(免费LLM + Banach 信念收敛) / 世界图(边概率P + LSH检索 + 规则蒸馏 + 认知图谱 + 元知识路由) / 系统1-2 + RSG / 符号Z3-lite 约束求解 / 霍尔机器验证证明 / D-MCTS 分支探索 / 七段审计 / 正·负·边界样本 / 单步学习 + PAC 样本界 + do演算·PC因果 / 元认知层 / EDA 事件总线 + Data Fabric 版本化 + PrSTL 运行时安全停车 + 持续验证 / 物理载体接入
- **轻量替代标注（手写 lite 版、非工业级外部求解器，均可运行、均确定性、均不虚构）**：符号验证=自写约束求解器（非真实 Z3）；霍尔证明=结构化逐边验证（非 Coq 机器证明）；因果发现=PC-lite 离散近似（非真实 PC/FCI）；LSH=SimHash 投影（非 Milvus）；**世界模型/反事实未做**（文档仅给名词无算法）

---

## 快速接入

```bash
npm install -g lingjing-mcp      # 全局安装，自带 bin
npx lingjing-mcp --selftest      # 免安装验证（28/28 工具自检）
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

## 工具接口（MCP，20 个）

| 能力 | 工具 | 说明 |
|---|---|---|
| 免费 LLM 感知 | `perceive` | 自然语言/状态描述 → 结构化感知（需 OpenRouter Key：参数或 env `OPENROUTER_API_KEY`） |
| 贝叶斯信念收敛 | `perceive_belief` | 贝叶斯滤波迭代 + Banach 压缩映射收敛检测（离散信念→不动点） |
| 场景感知 | `world_info` / `set_world` | 看世界图结构，或导入你自己的场景（灭蚊器只是默认示例；边可带 `p` 概率） |
| 可审计推理 | `reason` / `audit` | 系统1 快答 + 系统2 A\* 最优 + RSG 推理状态图 + 每步依据 + $\mathbb{U}$；七段审计报告（含证明证书/可复现） |
| 符号验证 | `symbolic_verify` | 霍尔机器验证 A\* 路径满足不变量（手写 Z3-lite 等价） |
| 分支探索 | `dmcts` | D-MCTS 并行分支探索 + 回溯，返回多候选最优路径 |
| 知识检索/蒸馏 | `knowledge_ann` / `knowledge_distill` / `cog_graph` | LSH 近似检索 / FP-Growth 规则蒸馏 / 认知图谱 |
| 因果 | `causal` | PC-lite 因果发现 + do 演算查询（后门准则） |
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
