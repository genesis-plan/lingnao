# 世界大脑 WorldBrain — 可审计推理大模型

> **把它当成一个大模型来做**：世界大脑是一个**本地确定性、可审计的推理大模型**，不是普通脚本、也不是概率生成式 LLM。
> 内核把「世界图 → A\* 可审计推理 → 物理载体执行 → 学习闭环」封装为单一引擎，对外以 **MCP stdio / 网页演示** 两种接口暴露。
> 零依赖 · 零服务器 · 免费面向 AI Agent 分发。

- 仓库（模型主仓，独立于灵数求解器）：<https://github.com/genesis-plan/worldbrain>
- 架构白皮书：[ARCHITECTURE.md](./ARCHITECTURE.md)
- npm 安装：`npm install -g worldbrain-mcp`

---

## 模型卡（Model Card）

| 项 | 内容 |
|---|---|
| 模型名称 | 世界大脑 WorldBrain |
| 模型类型 | **可审计确定性推理大模型**（非概率生成式 LLM） |
| 内核 | 本地确定性 A\* 推理 + 五段审计 + 经验知识库，不经大模型、不幻觉 |
| 感知层 | 可选免费 LLM（OpenRouter `:free`）做 NL→JSON；无 key 可手动降级 |
| 定位 | 驱动一切具身 / 物理载体的透明决策大脑 |
| 接入 | MCP stdio（8 工具）/ 单文件网页演示（HTML，双击即用） |
| 许可 | MIT，免费、开源、面向 AI Agent 分发 |

**它能做什么**
- 在任意「世界图」上做**最优且可审计**的决策（A\* + 硬/软约束）
- 每一步推理都给出**依据链**与**五段审计报告**，凡不可判定诚实标 $\mathbb{U}$
- 接收**物理载体**上报（电量、区域密度）→ 自动生成硬/软约束 → 下发指令 → 执行回报 → 学习闭环
- 经验知识库可查、可增、置信度随使用更新

**它不做什么（诚实边界）**
- 不生成文本、不编造事实；推理结果可复现
- 不假装实现文档里只给名词、无算法的层（Banach 收敛 / PAC 界 / do 演算 / 世界模型 / 霍尔验证）——这些在代码内是显式 TODO 桩，不是已实现

---

## 快速接入

```bash
npm install -g worldbrain-mcp      # 全局安装，自带 bin
npx worldbrain-mcp --selftest      # 免安装验证（11/11 工具自检）
```

任何支持 MCP 的客户端（Claude Desktop / Cursor / Cline 等）复制配置即可接入，**不用开网页、不用服务器**：

```json
{
  "mcpServers": {
    "worldbrain": { "command": "worldbrain-mcp" }
  }
}
```

---

## 架构（摘要）

形式化七元组 $\mathbb{B}=(\mathbb{W},K,\Phi,\Psi,\Theta,\Lambda,\Xi)$，八层：感知 $\Phi$ / 学习 $\Psi$ / 知识库 $K$ / 推理 $\Theta$ / 因果 $\Lambda$ / 演化 / 审计 $\Xi$ / 统一。
详见 [ARCHITECTURE.md](./ARCHITECTURE.md)。

核心定理（可证）：有限世界图 + 可采纳欧氏启发式下，A\* **完备且最优**——要么返回最优路径，要么诚实标 $\mathbb{U}$。

---

## 工具接口（MCP，8 个）

| 能力 | 工具 | 说明 |
|---|---|---|
| 场景感知 | `world_info` / `set_world` | 看世界图结构，或导入你自己的场景（灭蚊器只是默认示例） |
| 可审计推理 | `reason` / `audit` | A\* 最优路径 + 每步依据 + $\mathbb{U}$ 诚实标记；五段审计报告 |
| 物理载体接入 | `carrier_report` | 载体上报电量/密度，自动生成硬/软约束 |
| 学习闭环 | `learn` / `knowledge_query` / `knowledge_add` | 执行回报 → 置信度更新；经验库可查可增 |

### `reason({start?, goal, hard?, soft?})`
```json
{ "start": "CHARGE", "goal": "C", "hard": ["A"], "soft": ["B"] }
```
→ `{ "status":"optimal", "path":["CHARGE","B","C"], "cost":6, "steps":[...], "note":"..." }`
不可判定时诚实返回 `{ "status":"unknown", "U": true, "reason":["目标不在世界图"] }`。

### `carrier_report({battery?, goal, density?})`
```json
{ "battery": 100, "goal": "A", "density": {"A":8,"B":3,"C":5} }
```
→ `{ "battery":100, "hard":[], "soft":["B"], "note":"电量充足" }`
电量 <20 时 `hard:["A","B","C"]`（禁止离开充电座）。

### `audit({start?, goal, hard?, soft?})`
→ `{ "summary":{}, "details":[], "evidence":[], "constraints":[], "unknown":[], "status":"valid" }`

### `learn({path, success})` / `knowledge_query` / `knowledge_add`
经验库增查与置信度更新（单步反馈 `±0.1`）。

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
| `worldbrain-mcp.js` | MCP 服务本体（stdio，零依赖，手写 JSON-RPC 2.0 分帧） |
| `世界大脑.html` | 单文件演示 + 内控内核（MCP 从此抽取复用，单一真源） |
| `ARCHITECTURE.md` | 架构白皮书（七元组 / 八层 / 诚实实装映射） |
| `README.md` | 本模型卡与接入指南 |
| `package.json` / `LICENSE` | 可安装包定义 / MIT 许可 |

> 部署时 `worldbrain-mcp.js` 与 `世界大脑.html` 需同目录（或设 `WORLDBRAIN_HTML` 环境变量）。

---

## 许可与分发

MIT。免费、开源、面向 AI Agent 分发。可作为软著 / 专利材料与被动获客入口。
