# 让外国前沿大模型使用灵脑（LingNao）

灵脑通过 **MCP（Model Context Protocol）stdio** 暴露 46 个工具。任何支持 MCP 的客户端
（Claude Desktop / Cursor / Cline / ChatGPT / OpenAI Agents SDK / 各 Agent 框架）都能直接调用，
让大模型在"说"之外获得**可证明、可审计、确定性、带安全门**的决策与行动能力。

> 灵脑（大脑）与灵数（Lingshu，求解器）是两个独立产品、分属两个仓库。
> 灵数（`algebraic_solve` 依赖）为**可选依赖**：不装时其余 46 个工具照常工作，仅代数求解降级。

---

## 一、先把大脑跑起来（任选其一）

**方式 A — 从 npm（推荐，待发布 1.0.0 后）**
```bash
npx -y lingnao-mcp            # 启动 MCP stdio 服务
```

**方式 B — 从源码（当前已推送的仓库）**
```bash
git clone https://github.com/genesis-plan/lingnao
cd lingnao
node lingnao-mcp.js           # 零依赖启动；可选：npm i lingshu-solver 启用代数求解
```

启动后服务在 stdio 上监听 JSON-RPC；客户端负责发 `initialize` / `tools/list` / `tools/call`。

---

## 二、给各客户端写接入配置

所有配置的本质都是同一件事：告诉客户端"用 `node` 跑这个脚本"。

### 1) Claude Desktop
编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`（macOS）或
`%APPDATA%\Claude\claude_desktop_config.json`（Windows）：

```json
{
  "mcpServers": {
    "lingnao": {
      "command": "node",
      "args": ["D:/Projects/genesis-plan/lingnao/lingnao-mcp.js"]
    }
  }
}
```
（用 `npx -y lingnao-mcp` 时把 args 改为 `["-y", "lingnao-mcp"]`。）

### 2) Cursor
写在项目或用户级 `.cursor/mcp.json`：
```json
{
  "mcpServers": {
    "lingnao": { "command": "node", "args": ["D:/Projects/genesis-plan/lingnao/lingnao-mcp.js"] }
  }
}
```

### 3) Cline（VS Code 扩展）
`settings.json` 中加入：
```json
{
  "cline.mcpServers": {
    "lingnao": { "command": "node", "args": ["D:/Projects/genesis-plan/lingnao/lingnao-mcp.js"] }
  }
}
```

### 4) ChatGPT 桌面端 / OpenAI Agents SDK
ChatGPT 桌面端在「连接器 / Connectors」里添加 MCP stdio 服务（命令同上）。
在代码里用 OpenAI Agents SDK 时，直接加载已生成的 `openai-tools.json`：
```python
from agents import Agent, MCPServerStdio
server = MCPServerStdio(name="lingnao", params={"command":"node",
            "args":["D:/Projects/genesis-plan/lingnao/lingnao-mcp.js"]})
agent = Agent(name="robot-planner", mcp_servers=[server], instructions="...")
```
（Anthropic 生态可用 `anthropic-tools.json`；二者均由 `gen-agent-manifests.js` 实时生成。）

---

## 三、给模型上下文（llms.txt）

把仓库根目录的 **`llms.txt`** 放进项目的上下文/知识库。它是 [llmstxt.org](https://llmstxt.org)
规范的中英双语索引，模型读它即可知道自己有哪些工具、能做什么、边界在哪（比如"判不了会标 𝕌"）。
英文在前，专为海外模型优化。

---

## 四、真实会话示例（见 `examples/foreign-llm-demo.js`）

```bash
node examples/foreign-llm-demo.js
```

该脚本**真实启动灵脑服务并走完整 MCP 会话**：模拟一个海外用户用英文提出
"仓库机器人从 CHARGE 到 B，禁区 M 不可进入，执行前请规划+每步过安全门+给审计链"，
然后依次真调用 `set_world → reason → check_hard（每步）→ audit`，返回：

- `reason`：`status:"optimal"`，路径 `CHARGE→C→B`，代价 4，硬约束 M 已被剪枝；
- `check_hard`（每步）：`{ok:true}` —— fail-closed 安全门放行；
- `audit`：`proofVerified:true`、`constraints.M.passed:true`、`noHallucination:true`，
  附霍尔证明证书 `{CHARGE∈W} A* {inv} {B∈W ∧ 最优cost=4}`。

**关键差异**：决策全在确定性内核，无 LLM 参与循环；同一个输入永远得到同一结果，
且可追到证明链。这是普通大模型/框架没有的"裁决层"。

---

## 五、已知限制（诚实声明）

- **工具描述为中文**：名字与 schema 是 ASCII，海外模型能解析，但 46 条中文描述会让
  调用准确率打折。建议改用中英双语（见仓库待办）。
- **感知层会标 `UNVERIFIED_LLM`**：自然语言理解来自可选 LLM，可能错，绝不进入证明链/决策。
- **灵数求解器为可选**：未安装时 `algebraic_solve` 诚实降级（不报错、不污染自测）。
- 发布 1.0.0 前 `npx lingnao-mcp` 尚不可用，请用方式 B（源码）。
