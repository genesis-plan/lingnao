# 灵脑 LingNao v1.0.0 — 首个正式发布

可审计、确定性、不幻觉的通用大脑（WorldBrain）。把「世界图 → A* 可审计推理 → 物理载体执行 → 学习闭环」封装为标准 MCP stdio 服务，零依赖、免费面向 AI Agent 分发。

## 本版架构定型（①②③④ 全部完成）

- **① 机检证明账本**：`verifyLedger()` + 启动自检，能力→定理映射闭合 + 推导链闭合，断裂即内核拒绝启动。
- **② 信任防火墙全链**：`FIREWALL` + 唯一通道 `liftToBelief()`（D-S 包络，永不成公理）；所有 PERCEPTION 规划入口（aStar / dmcts / goalDirected）入口扫感知边、污染即诚实降级 grounding 为 PERCEPTION；`execute` 末道物理拦截。
- **③ 去全局化**：删裸全局 `let WORLD`/`const BODY`，建 `_STATE` 单一真相源 + `getWorld()/getBody()` 访问器；232 处读点机械解耦，裸全局态真消除（`K.WORLD===undefined`）。
- **④ 思想索引** `LingNaoThinking`：11 类数学思想挂 `MathKernel.thinking`。

## 算法第一性原理优化

- A* open 集换二叉堆 O(log n)；
- dmcts 改确定性（mulberry32 取代 Math.random，全仓库随机源清零，可复现可审计）；
- goalDirected 补确定性档。

## 验证

- 八元组 tuple 测试 **56/56**
- MCP 自测 **58/58**（46 个工具，每项含多断言）
- `npm test`：内核自测 + MCP stdio 传输层（NDJSON / Content-Length 双帧）**9/9**
- 多轮回归一致（确定性 → 可复现）

## 接入

- MCP：`npx -y lingnao-mcp`（可选 `OPENROUTER_API_KEY`；留空则 100% 确定性降级运行）
- Node 库：`const K = require('lingnao-mcp')`
- 浏览器：引入 `lingnao.umd.js`

## 诚实边界

- 非开源（UNLICENSED）：非商业用途免费，商业用途须取得版权方（红尘灵境 / 太白）书面授权。
- 不幻觉置信分层：PERCEPTION 可能幻觉 / KERNEL 确定性 / PROOF 审计可验证；LLM 感知 `mayHallucinate` 绝不进证明链。
- 8 类数学尚未实装（MPC、SOS/SDP 障碍证书、一般 LP、一般非线性可达集等）；灵数求解器为可选依赖，不装则 `algebraic_solve` 诚实降级。
