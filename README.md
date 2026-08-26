# 世界大脑 WorldBrain — 可审计推理 MCP 服务

> 驱动所有具身设备的透明决策大脑。把"世界图 → A* 可审计推理 → 物理载体执行 → 学习反馈"封装成标准 **MCP（Model Context Protocol）stdio 服务**，让任何 AI 智能体复制配置即可接入。

**零依赖 · 零服务器 · 免费面向 AI Agent 分发。** 仅用 Node.js 内置模块，内核与 `世界大脑.html` 单一真源。

---

## 零、安装（被动获客入口）

```bash
npm install -g worldbrain-mcp      # 全局安装，自带 bin
npx worldbrain-mcp --selftest      # 免安装验证
```

- 源码 / Issue：<https://github.com/genesis-plan/worldbrain-mcp>
- 任何支持 MCP 的客户端（Claude Desktop / Cursor / Cline 等）复制下方配置即可接入，**不用开网页、不用服务器**。

## 一、它是什么

世界大脑把一份"可审计推理"能力暴露给外部智能体：

| 能力 | 对应工具 | 说明 |
|---|---|---|
| 场景感知 | `world_info` / `set_world` | 先看世界图结构，或导入你自己的场景（灭蚊器只是默认示例） |
| 可审计推理 | `reason` / `audit` | A* 最优路径 + 每步依据 + 不可判定区域 𝕌 诚实标记 |
| 物理载体接入 | `carrier_report` | 载体上报电量/密度，自动生成硬/软约束 |
| 学习闭环 | `learn` / `knowledge_query` / `knowledge_add` | 执行回报 → 置信度更新；经验库可查可增 |

**确定性、不幻觉**：推理/审计/学习全在本地内核完成，不经 LLM。免费 LLM（OpenRouter `:free`）只用于网页版的"自然语言→结构化状态"感知（见 `世界大脑.html`），MCP 层面不依赖任何外部 API。

---

## 二、文件清单

| 文件 | 作用 |
|---|---|
| `worldbrain-mcp.js` | **MCP 服务本体**（stdio，零依赖） |
| `世界大脑.html` | 单文件演示 + 内控内核（MCP 从此抽取内核复用） |
| `README.md` | 本接入指南 |

> 部署时 `worldbrain-mcp.js` 与 `世界大脑.html` 必须放同一目录（或设 `WORLDBRAIN_HTML` 环境变量指向 html）。

---

## 三、快速接入（3 种客户端）

### 1. Claude Desktop

编辑 `claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "worldbrain": {
      "command": "node",
      "args": ["C:/你的路径/世界大脑/work/worldbrain-mcp.js"]
    }
  }
}
```

### 2. Cursor / Cline / 任意支持 MCP 的客户端

在 MCP 配置中加入：

```json
{
  "mcpServers": {
    "worldbrain": {
      "command": "node",
      "args": ["/abs/path/to/worldbrain-mcp.js"]
    }
  }
}
```

### 3. 命令行自测（验证服务器能跑）

```bash
node worldbrain-mcp.js --selftest
# 输出：SELFTEST OK — 全部 N 项工具验证通过
```

---

## 四、工具接口（外部智能体调用）

### `world_info()` → 当前世界图结构
```json
{ "nodes": ["CHARGE","A","B","C"], "edgeCount": 10, "edges": [...] }
```

### `set_world({nodes, edges, coord?})` → 导入你的场景
```json
{
  "nodes": ["S","A","B","T"],
  "edges": [{"from":"S","to":"A","w":2},{"from":"A","to":"T","w":3}],
  "coord": {"S":[0,0],"A":[3,0],"T":[6,0]}
}
```
→ `{ "ok": true, "nodes": ["S","A","B","T"], "edgeCount": 2 }`

### `reason({start?, goal, hard?, soft?})` → 可审计最优路径
```json
{ "start": "CHARGE", "goal": "C", "hard": ["A"], "soft": ["B"] }
```
→ `{ "status":"optimal", "path":["CHARGE","B","C"], "cost":6, "steps":[...], "note":"..." }`

不可判定时诚实返回：
```json
{ "status":"unknown", "U": true, "reason":["目标不在世界图"] }
```

### `carrier_report({battery?, goal, density?})` → 物理载体约束
```json
{ "battery": 100, "goal": "A", "density": {"A":8,"B":3,"C":5} }
```
→ `{ "battery":100, "hard":[], "soft":["B"], "note":"电量充足" }`
> 电量 <20 时 `hard:["A","B","C"]`（禁止离开充电座）。

### `audit({start?, goal, hard?, soft?})` → 五段审计报告
```json
{ "summary": {...}, "details": [...], "evidence": [...], "constraints": [...], "unknown": [], "status": "valid" }
```

### `learn({path, success})` → 学习闭环
```json
{ "path": ["CHARGE","A","C"], "success": true }
```
→ `{ "updated":[{"transition":"CHARGE→A","confidence":0.6}], "knowledgeBaseSize": 5 }`

### `knowledge_query({from?, to?})` / `knowledge_add({from, to, success?, confidence?, source?})`
经验库增查。

---

## 五、最小调用示例（智能体视角）

```
1. 调用 world_info()            → 了解当前场景有哪些节点
2. 调用 set_world(我的场景)      → （可选）换成你自己的物理载体/任务图
3. 调用 carrier_report(电量,目标,密度) → 载体上报，拿到硬/软约束
4. 调用 reason(起点,目标,硬,软)   → 得到可审计最优路径
5. 载体按 path 执行
6. 调用 learn(执行路径, 成功?)   → 置信度更新，越用越准
```

---

## 六、诚实边界（按产品口径，不虚构）

已确定性实装：推理（A*+约束）、审计（五段依据链）、知识库（经验+置信度）、学习（单步反馈）、物理载体接入、MCP 接入。

文档要求但**当前未实现**（代码内为 TODO 桩，未用名词堆砌假装实现）：
- 感知 Banach 不动点信念收敛（Layer1）
- PAC 学习样本复杂度界 / 知识蒸馏（Layer2/6）
- do演算因果发现（Layer5）
- 世界模型 / 反事实推理（Layer2 扩展）
- 霍尔逻辑形式化验证（Layer7 升级）
- LSH / 向量相似度检索（Layer3，当前为数组精确匹配）

数学保真范围内可证：在有限世界图 + 可采纳欧氏启发式下，A* **完备且最优**（找到最优路径，或诚实标 𝕌）。

---

## 七、许可与分发

免费、开源、面向 AI Agent 分发。可用于软著 / 专利材料与被动获客场景。
