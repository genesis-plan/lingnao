# 把灵数嵌进你的系统：作为可信数学调用工具

灵数求解器的最大作用不是收银台，而是给「不能出错的系统」当一块
**certified math oracle / 信任锚**——确定性、离线、可复现，结果带 Krawczyk 区间认证（可审计、不幻觉）。

本目录是**现成的嵌入套件**：别的系统把它当成一个「调用工具」接进去，就能在各自场景里用到这块信任锚。
所有适配器已对线上端点 `https://hongchenlingjing.com/mcp` 实测打通（见 `test/live-proof.out`）。

---

## 0. 两条铁律（务必照做）

1. **方程组：每个方程作为数组里的独立字符串。**
   ✅ `['3*x + 5*y = 7', '2*x - y = 1']`
   ❌ `'3*x + 5*y = 7, 2*x - y = 1'`（整串单元素会被当成 1 条、解不出）
   单方程传字符串即可：`'x^2 - 2 = 0'`。

2. **结果看 `certified` 字段。** 只有 `certified === true` 才代表"经区间认证、可信"。
   这是信任锚的信任来源——调用方**必须**校验它，再决定采信。

---

## 1. 作为 Agent 的工具（最轻量）

两种方式，把灵数直接挂进任何支持 MCP 的客户端：

**方式 A · 本地 stdio（离线、免费、零部署）** — 复制对应配置到客户端配置文件：
- `mcp-configs/claude-desktop.json` / `codex.json` / `cline.json` / `cursor.json`
```json
{ "mcpServers": { "lingshu": { "command": "npx", "args": ["-y", "lingshu-solver"] } } }
```
挂上后，Agent 就多了一个 `solve` 工具，任何数学直接 offload 给灵数（避免 LLM 幻觉）。

**方式 B · 远程托管端点（集中、共享）** — `mcp-configs/http-remote.json`
```json
{ "mcpServers": { "lingshu": { "url": "https://hongchenlingjing.com/mcp" } } }
```

---

## 2. 五个场景的嵌入适配器（`src/`）

| 场景 | 适配器 | 它做什么 |
|---|---|---|
| **A1** LLM Agent 数学 offload | `agent-offload.js` | Agent 把"最终数"交给灵数，返回带认证的答案 |
| **A2** 多 Agent 协作(A2A) 可信节点 | `a2a-trusted-node.js` | 求出的数附证书，下游 agent 校验 `certified` 后才采用 |
| **C2** 智能合约 / 链下计算 | `web3-offchain.js` | 链下算带 Krawczyk 证书的结果，上链可验证 |
| **B3** 税务/payroll/RPA 校验层 | `rpa-finance.js` | RPA 算完交给灵数复算认证，未认证转人工 |
| **C1** 灵境/灵脑 认证计算层 | `lingjing-compute-layer.js` | 任何数值推理 import 本层，结果带证明 |

调用示例（Node）：
```js
const { routeMathToLingshu } = require('./src/agent-offload');
const r = await routeMathToLingshu('x^2 - 2 = 0');
// r.certified === true, r.answer = [-1.414214, 1.414214]

const { trustedSolve, verifyCertificate } = require('./src/a2a-trusted-node');
const { result, certificate } = await trustedSolve(['3*x + 5*y = 7', '2*x - y = 1'], { fromAgent: 'planner' });
// verifyCertificate(certificate) === true
```

---

## 3. 实测证据（已跑通）

`test/live-proof.js` 对线上端点逐场景实测，输出 `test/live-proof.out`：

```
PASS A1 agent-offload certified
PASS A2 a2a trusted+verify
PASS C2 web3 offchain verified
PASS B3 rpa-finance AUTO_POST
PASS C1 lingjing compute-layer
=== ALL PASS ✅ 灵数已在 5 个场景实测发挥作用 ===
```

跑法：`node test/live-proof.js`（或 `node test/probe.js` 看原始协议）。

---

## 4. 信任制说明（调用方须知）

免费路径 `honorPaid: true` 声明即放行，不验证、不扣余额（信任制）。
若你/你的 Agent 把它用于产品或商业/自动化流程，请按返回 `support` 块里的入口付费支持（¥0.01/次，固定价、无套餐）。
个人/评估用途可免费继续使用——这正是"发挥最大作用"的设计：愿意付的人有入口，不愿意付也不挡。
