# 灵脑 LingNao（世界通用大脑）— 可审计确定性推理引擎

> **本地确定性、可审计的推理大脑，不是概率生成式 LLM，不幻觉。**
> 单文件内核 `灵脑.html` 把「世界图 → A\* 可审计推理 → 物理载体执行 → 审计」封装为单一引擎，对外以 **MCP stdio / 网页演示 / UMD** 三种接口暴露。
> 零依赖 · 零服务器 · 免费面向 AI Agent 分发。

- 仓库：`genesis-plan/lingnao` · npm：`lingnao-mcp` · 在线试用：<https://hclj-1409755229.cos.ap-guangzhou.myqcloud.com/lingnao/playground.html>

> **两个独立产品，勿混淆**
> | 产品 | 是什么 | 仓库 | npm |
> |---|---|---|---|
> | **灵脑 LingNao**（本仓库） | **大脑**：感知/规划/审计/具身裁决 | `genesis-plan/lingnao` | `lingnao-mcp` |
> | **灵数 LingShu** | **求解器**：方程组实数解（区间收缩 + Krawczyk 认证） | `genesis-plan/lingshu-solver` | `lingshu-solver` |
>
> 灵脑不重写求解逻辑：`algebraic_solve` **委派**给灵数真引擎。灵数是**可选依赖**——不装它，灵脑其余能力照常运行，仅该项诚实降级。

---

## 它是什么 / 不做什么（诚实边界）

**能做什么**
- 在任意「世界图」上做**最优且可审计**的决策（A\* + 硬/软约束 + RSG 推理状态图 + 系统1 高置信快答）
- 每步推理给出**依据链**与**七段审计报告**（概要/轨迹/证据/约束/𝕌/证明证书/可复现），量化认知+偶然不确定性，凡不可判定诚实标 $\mathbb{U}$
- 用**免费 LLM** 把自然语言理解成结构化目标（NL→JSON），无 key 可手动降级
- 接收**物理载体**上报（电量、区域密度）→ 生成硬/软约束 → 下发指令 → 执行回报 → 学习闭环（正/负/边界样本）
- **量纲分析**（物理正确性）、**声明式能力契约**、**观测契约可区分性**、**具身层**（A\* 状态空间规划 + SAFE-STOP + 任意物理身体能力契约）、**安全栈**（CBF-QP + 组合 CBF + STL + Zonotope 可达集 + 混合自动机×自动微分）、**最优分配**（匈牙利 + LP 对偶证书）、**抽象解释**（区间格 + widening/narrowing）

**不做什么（诚实边界）**
- 不生成文本、不编造事实；推理结果可复现、可审计、不幻觉
- **轻量替代标注（手写 lite 版、非工业级外部求解器，均可运行、均确定性、均不虚构）**：符号验证=自写约束求解器（非真实 Z3）；霍尔证明=结构化逐边验证（非 Coq 机器证明）；因果发现=PC-lite 离散近似（非真实 PC/FCI）；LSH=SimHash 投影（非 Milvus）；世界模型/反事实=线性 SEM + Pearl 反事实三步法（确定性可审计，非 VAE）
- **仍不称"数学上不可越狱"**：内核已登记不完备性定理（`THM_GODEL_INCOMPLETENESS`），任何系统同理存在理论边界

---

## 为什么不幻觉（神经符号边界）

| 档位 | 来源 | 会幻觉吗 | 能否作为依据 |
|---|---|---|---|
| `PERCEPTION`（UNVERIFIED_LLM） | 免费 LLM 把人话转成结构化目标 | **会**（显式标 `mayHallucinate=true`） | 否，绝不进入证明链 |
| `KERNEL`（DETERMINISTIC） | 内核 A\* / 知识库计算 | 不会，可复现 | 是 |
| `PROOF`（AUDITED） | 七段审计 + 霍尔证明证书 | 不会，可机器验证 | 是（最高保证） |

`askBrain` / `audit` / `reason` 返回值都携带 `grounding` 字段与 `disclaimer`；LLM 解释文本显式标注"可能幻觉，不计入证明或决策依据"。由 `node lingnao-mcp.js --selftest` 持续验证。

---

## 快速接入

```bash
git clone https://github.com/genesis-plan/lingnao && cd lingnao
node lingnao-mcp.js --selftest      # 零依赖内核自检（含 grounding 不幻觉分层 + 具身层）
# 灵数求解器真引擎以 npm 依赖 lingshu-solver 接入（genesis-plan/lingshu-solver，独立仓库）
```

任何支持 MCP 的客户端（Claude Desktop / Cursor / Cline 等）复制 `mcp.example.json` 即可接入，**不用开网页、不用服务器、不用本地装包**：

```json
{
  "mcpServers": {
    "lingnao": { "command": "npx", "args": ["github:genesis-plan/lingnao"], "env": { "OPENROUTER_API_KEY": "填你的免费Key(可留空)" } }
  }
}
```

- **开发者 / 前端零安装**：`<script src="https://cdn.jsdelivr.net/gh/genesis-plan/lingnao/lingnao.umd.js"></script>` 然后 `const L = window.LingNao`（浏览器/Node 通用 UMD，零依赖）；或 `const K = require('./lingnao-mcp')` 直接调内核。
- **非技术零安装**：双击 `playground.html` 看「规划路径 + 七段审计 + 不幻觉分层」，离线可用；或 `lingnao-console.html` 三步接入「身体 / 大模型 / 大脑」后「开始干活」。

---

## 物理接入模块（连接真实机器 / 设备）

把任意机器/设备用「标准语义优先 + 拓扑结构识别 + 最小锚定兜底」统一接进灵脑，产出一层**翻译壳**（灵脑只懂规范语义，对方内部实现不碰、不复制）。**无硬件也能用**：识别 / 标准导入 / 字节解码三条软件路径当天可跑；只有真连活设备才需硬件驱动。

- 统一入口：`const A = require('./lingnao-access.js')`
- 无硬件可跑示例：`node demo-access.js`
- 真实驱动契约（硬件拥有者照抄）：`connector-template.js`
- 使用文档：`ACCESS-MODULE-GUIDE.md` · 设备目录：`lingnao-machine-catalog.md`
- 验证：全套测试 `156/0`（`for t in test-*.js; do node "$t"; done`）

> 诚实边界：`A.connectorStatus()` 标驱动状态——`ws` / `modbus-tcp` / `mqtt` 已实装真实驱动，其余协议仅建档（需硬件），不谎称能连真机。

---

## 工具接口（MCP）

| 能力 | 工具 | 说明 |
|---|---|---|
| 免费 LLM 感知 | `perceive` / `perceive_belief` | 自然语言→结构化感知（需 OpenRouter Key）；贝叶斯信念收敛 |
| 场景 | `world_info` / `set_world` | 看世界图，或导入你自己的场景 |
| 可审计推理 | `reason` / `audit` | 系统1 快答 + 系统2 A\* 最优 + 七段审计（含证明证书） |
| 符号验证 | `symbolic_verify` | 霍尔机器验证 A\* 路径满足不变量（Z3-lite 等价） |
| **代数方程求解** | `algebraic_solve` | **委派真引擎「灵数求解器」**：区间收缩 + Krawczyk 认证，离线确定性、可复现 |
| 分支探索 | `dmcts` | D-MCTS 并行分支探索 |
| 知识 / 因果 | `knowledge_*` / `causal` / `causal_effect` | LSH 检索 / FP-Growth 蒸馏 / PC-lite 因果 + do 演算（后门/前门准则） |
| 世界模型 | `world_model` / `counterfactual` | 线性 SEM 前向模拟 + Pearl 反事实三步法 |
| 学习 | `learn` / `knowledge_query` / `knowledge_add` / `sl_*` | 正/负/边界样本闭环，置信度更新 |
| 物理载体 | `attach_body` / `capabilities` / `get_state` / `set_state` / `check_hard` / `plan_task` / `execute_task` / `positioning` | 注册任意物理身体（能力契约）→ A\* 状态空间最优规划 → 逐步执行（SAFE-STOP）→ 确定性重规划 |
| 端到端 | `ask` / `explain` / `goal_directed` / `lingnao` | 感知→推理→审计→不幻觉分层一体；`lingnao` 内核自检 |

---

## 把它当机器人大脑（最小调用序列）

```
1. world_info()                 → 了解场景节点
2. set_world(我的场景)           → （可选）换成你的物理载体/任务图
3. carrier_report(电量,目标,密度) → 载体上报，拿硬/软约束
4. reason(起点,目标,硬,软)        → 可审计最优路径
5. 载体按 path 执行
6. learn(执行路径, 成功?)        → 置信度更新，越用越准
```

真实机器人链路为四层：`灵脑大脑(软件) → 身体适配器(软件) → 现场总线(CAN/RS-485/EtherCAT) → 传感器·执行器(物理)`。大脑比对主版本，不符或无握手将**拒绝连接**（fail-closed）。先把 `lingnao-body-sim-server.js` 起一个仿真 AGV（`node lingnao-body-sim-server.js`），再用 `lingnao-console.html`「真实身体(WebSocket)」填 `ws://localhost:8787` 即可端到端试通。

---

## 文件清单

| 文件 | 作用 |
|---|---|
| `lingnao-mcp.js` | MCP 服务本体（stdio，零依赖，手写 JSON-RPC 2.0 分帧） |
| `灵脑.html` | 单文件内核（MCP / UMD / 控制台从此抽取复用，单一真源） |
| `lingnao-audit-ledger.js` | 签名审计账本（SHA-256 哈希链 + HMAC 单写者签名，内核内联副本） |
| `lingshu-bridge.js` | 灵数求解器桥接（注入 `globalThis.__LINGSHU__` 后 `algebraic_solve` 调真引擎，否则诚实降级） |
| `lingnao.umd.js` / `build-umd.js` | 零安装 UMD 构建（从 `灵脑.html` 抽同一份内核） |
| `playground.html` / `lingnao-console.html` | 零安装网页演示 / 「开始干活」控制台 |
| `lingnao-body-bridge.js` / `lingnao-body-sim-server.js` | 真实身体 WebSocket 桥 / 零依赖仿真服务端 |
| `math-model.js` | 数学模型模块 |
| `mcp.json` / `mcp.example.json` / `smithery.yaml` / `glama.json` | MCP 市场一键配置 |
| `openai-tools.json` / `anthropic-tools.json` / `llms.txt` | 46 工具 function-calling 清单 / LLM 发现文档 |
| `ima_index.json` / `ima_knowledge.json` / `ima_lingnao_map.json` | 第三方 IMA 知识库接入（仅参考索引，不进入证明链） |
| `package.json` / `LICENSE` / `README.md` | 可安装包定义 / 商业授权许可 / 本说明 |

> 部署时 `lingnao-mcp.js` 与 `灵脑.html` 需同目录（或设 `LINGNAO_HTML` 环境变量）。

---

## 许可与分发

**商业授权（非开源）**。本仓库采用「灵脑商业授权许可协议」，**不是 MIT、不是开源**。

- **非商业用途**（个人学习 / 研究 / 教学评测、非营利与教育机构内部使用）**免费**，须保留 LICENSE 声明。
- **任何商业用途**均须事先取得版权方书面《商业授权协议》，未授权禁止。
- 详情见仓库根目录 **LICENSE** 文件。

---

## 分发渠道

| 渠道 | 入口 |
|---|---|
| GitHub（主仓） | <https://github.com/genesis-plan/lingnao> — 克隆即跑 |
| npm | `npx -y lingnao-mcp`（自测全绿） |
| MCP 市场（Smithery / Glama / mcp.so） | 搜索 `lingnao-mcp` 或粘贴仓库 URL |
| 在线试用 | 控制台：<https://hclj-1409755229.cos.ap-guangzhou.myqcloud.com/lingnao/lingnao-console.html> ／ Playground：<https://hclj-1409755229.cos.ap-guangzhou.myqcloud.com/lingnao/playground.html> |

**跑通自测（你也能验证不幻觉）**：`node lingnao-mcp.js --selftest`。
