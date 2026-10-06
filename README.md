[English](README.en.md) | [推理方法学与数学定理（地基文档）](docs/00-推理引擎原理与方法学.md) | [API 接入指南](https://hongchenlingjing.com/reason/integrate.html) | [Playground](https://hongchenlingjing.com/reason/)

# 灵脑 LingNao · 任意智能体的确定性推理服务

[![License](https://img.shields.io/badge/license-非商业免费%20%2F%20商业须书面授权-blue)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-stdio-blue)](https://modelcontextprotocol.io)
[![Non-LLM](https://img.shields.io/badge/core-non--LLM%20%2F%20deterministic-green)](docs/03-设计思想.md)
[![npm](https://img.shields.io/badge/npm-lingnao--mcp-blue)](https://www.npmjs.com/package/lingnao-mcp)

> **灵脑是面向「任意智能体」的确定性推理服务层——不做验证、不做审计，只做推理。**
> 无论你的智能体跑在 Claude、GPT、自研 agent 还是机器人控制器上，只要它能发 MCP 调用，就能用同一个网关 `lingnao`（`op` + `args` → 结构化结论）拿到**确定性、不幻觉、可复现**的推理。
> 推理能力由真实数学定理支撑：A\*/确定性 MCTS 做深思规划，do-演算做因果推理，PAC/VC 维做不确定性界，**Baire 纲 / 紧致性 / 代数簇 / 范德瓦尔登 / Cauchy–Lipschitz / Bertrand / 鸽笼原理 / 霍尔匹配 / Erdős–Szekeres / 欧拉路径** 共 10 个真实定理做数学健全性压力测试。
> 完整方法学与定理清单见 [docs/00-推理引擎原理与方法学.md](docs/00-推理引擎原理与方法学.md)。

- 仓库：`genesis-plan/lingnao` · npm：`lingnao-mcp` · 在线试用：[playground](https://hclj-1409755229.cos.ap-guangzhou.myqcloud.com/lingnao/playground.html) ／ [控制台](https://hclj-1409755229.cos.ap-guangzhou.myqcloud.com/lingnao/lingnao-console.html)

| | 说明 |
|---|---|
| **是** | **确定性推理服务层**：对智能体/机器人的规划、因果、世界模型、数学健全性做符号推理；同输入必得同输出；不可判定时诚实返回 𝕌（弃权） |
| **不是** | 语言模型（不生成文本、无世界知识）、审计器、认证器、"绝对安全"的证明器、通用数学定理证明器（Coq/Lean 类），也不是验证/裁判层 |

---

## 为什么"任意智能体"都能用

这不是营销话术，而是**接口设计 + 内核性质**共同保证的：

| 性质 | 含义 | 对任意智能体的意义 |
|---|---|---|
| **单一网关** | 只暴露 1 个工具 `lingnao`，靠 `op` 分派 51 项能力 | 任何 MCP 客户端一行配置即可接入，无需为某家 LLM 定制 |
| **智能体无关语义** | 入参/出参都是结构化 JSON，`op` 是稳定键名 | 不要求智能体说中/英、不绑定任何框架、不依赖特定模型 |
| **确定性内核** | 同输入 ⇒ 同输出 | 推理可复现、可比对，能直接集成进任何决策回路 |
| **无神经网络在环** | 推理全是符号/数值确定性计算；可选 LLM 仅在"感知 NL→JSON"与"解释"两端，强制标 `UNVERIFIED_LLM` **且绝不进入推理链** | 不幻觉、不编造、不被 prompt 注入改写出错答案 |
| **三态诚实语义** | 真 / 假 / 想不了（𝕌 弃权），fail-closed | 智能体拿到的是"可被机器消费"的结论，而非需再判断的自然语言 |
| **可复现推理账本** | 推理链由 Hoare 逻辑闭合（proof ledger） | 任意智能体都能拿到"为何得此结论"的可验证轨迹 |

---

## 方法学与数学定理（地基）

灵脑的推理能力由**真实数学定理**支撑，不是启发式打分。五大前沿逐一对应：

| # | 前沿 | 方法 | 数学定理 / 形式基础 | 对应 `op` |
|---|---|---|---|---|
| ① | **深思规划** | 可搜索推理（非一遍直出） | A\*（可采纳启发式下最优）；确定性 MCTS（UCB1）；Bellman 值迭代 | `reason` · `dmcts` · `plan_task` · `h_max` · `goal_directed` |
| ② | **因果推理** | 因果图 + do-演算 | Pearl 因果阶梯；do-演算（后门/前门准则）；反事实三步法 | `causal` · `causal_effect` · `counterfactual` |
| ③ | **不确定性理论** | 样本复杂度界 + 保角预测 | PAC（Valiant 1984）+ VC 维：`m ≥ (d_VC·ln(1/ε)+ln(1/δ))/ε²` | `pac_bound` |
| ④ | **数学健全性压力测试** | 真实定理做健全性检验 | **Baire 纲 / 紧致性 / 代数簇(Zariski) / 范德瓦尔登(Ramsey) / Cauchy–Lipschitz / Bertrand / 鸽笼原理(Dirichlet) / 霍尔匹配(Hall) / Erdős–Szekeres / 欧拉路径(Euler)** | `baire_trap` · `compactness_trap` · `variety_trap` · `van_der_waerden_trap` · `cauchy_lipschitz_trap` · `bertrand_trap` · `pigeonhole_trap` · `hall_trap` · `erdos_szekeres_trap` · `euler_path_trap` · `run_deterministic_traps` |
| ⑤ | **世界模型 / 反事实 / 元认知 / 自演化** | SEM + 不动点 + Hoare + FCA | 结构方程模型；Banach 不动点；Hoare 逻辑 `{P}C{Q}`；形式概念分析 FCA | `world_model` · `perceive_belief` · `meta` · `knowledge_*` · `sl_*` · `ima_*` |
| ＋ | **具身决策** | 声明式能力契约 + 有界重规划闭环 | 规划→执行→SAFE-STOP→有界重规划（`maxReplans`） | `attach_body` · `get_state`/`set_state`/`state_diff` · `positioning` |

> 逐条定理出处、保证内容与 `op` 对应关系，见 [docs/00-推理引擎原理与方法学.md](docs/00-推理引擎原理与方法学.md)。
> 诚实注记：因果/世界模型为 lite 实现（PC-lite 发现、线性 SEM），规划基于有限图；但每个结论都来自确定性符号计算，可复现、不幻觉，数学健全性由真实定理保证。

---

## 30 秒上手

**① MCP 接入（推荐，给任意 AI 客户端用）** —— 不用开网页、不用服务器、不用本地装包：

```json
{
  "mcpServers": {
    "lingnao": {
      "command": "npx",
      "args": ["github:genesis-plan/lingnao"],
      "env": { "OPENROUTER_API_KEY": "填你的免费Key（可留空）" }
    }
  }
}
```

npm 稳定版同款：`{ "command": "npx", "args": ["-y", "lingnao-mcp"] }`（见 [`mcp.json`](mcp.json) ／ [`mcp.example.json`](mcp.example.json)）

**② 零安装网页** —— 双击 [`playground.html`](playground.html)（A\* 规划 + 因果 + 数学健全性陷阱，离线可用），或 [`lingnao-console.html`](lingnao-console.html)（接入身体/大模型/大脑后开始干活）。

**③ 开发者**

```bash
git clone https://github.com/genesis-plan/lingnao && cd lingnao
node lingnao-mcp.js --selftest      # 零依赖内核自检
node build-umd.js                   # 从内核真源重建 UMD（导出 250）
```

- Node 库：`const K = require('./lingnao-mcp')`（直接调内核，不自启服务）
- 浏览器：`<script src="https://cdn.jsdelivr.net/gh/genesis-plan/lingnao/lingnao.umd.js"></script>` → `window.LingNao`

---

## 能力边界（诚实声明）

| 维度 | 说明 |
|---|---|
| 决策/规划 | A\* 最优路径 + 硬/软约束 + RSG 推理状态图 + 系统 1 高置信快答，**同输入必得同输出** |
| 因果 | do-演算（后门/前门调整）估计因果效应、反事实推演；确定性因果图，无 LLM 编造 |
| 数学健全性 | 十类确定性陷阱（Baire/紧致/代数簇/范德瓦尔登/柯西-利普希茨/Bertrand/鸽笼/霍尔匹配/Erdős–Szekeres/欧拉路径），**真实定理保证** |
| 不幻觉 | LLM 只在感知（NL→JSON）与解释两端，强制标 `UNVERIFIED_LLM` + `mayHallucinate`，**绝不进入推理链** |
| 具身 | 声明式能力契约接入任意身体；规划 → SAFE-STOP → 执行 → 有界重规划闭环 |
| 工具暴露 | **1 个网关工具 `lingnao`**（`op` 参数收编 51 项推理能力）；其中 6 项需接入 KB 才可用，**如实单列不计入绿色通过** |
| 自测 | `--selftest` → 核心通过 + 如实披露 6 项已知未实现能力（KB 未接入） |
| 依赖 | 零第三方运行时依赖；灵数求解器为**可选**依赖（缺失时 `algebraic_solve` 单项诚实降级） |

**不保证**：绝对安全、绝对正确、不漏解、能连所有真机。这是设计上的诚实边界，不是待修缺陷。

---

## 能力目录（51 项推理能力，单网关 `lingnao`）

MCP 对外只暴露 **1 个工具** `lingnao`：`arguments = { "op": 能力名, "args": 参数 }`，按旧名直调会被拒绝并返回指引。

`world_info` · `set_world` · `perceive` · `reason` · `carrier_report` · `learn` · `knowledge_query` · `knowledge_add` · `meta` · `perceive_belief` · `knowledge_ann` · `knowledge_distill` · `cog_graph` · `algebraic_solve` · `world_model` · `counterfactual` · `causal_effect` · `dmcts` · `goal_directed` · `pac_bound` · `ask` · `explain` · `causal` · `event_publish` · `knowledge_fabric` · `ima_load` · `ima_query` · `sl_record` · `sl_discover` · `sl_monitor` · `sl_status` · `attach_body` · `capabilities` · `get_state` · `set_state` · `state_diff` · `h_max` · `plan_task` · `execute_task` · `positioning` · `bertrand_trap` · `compactness_trap` · `van_der_waerden_trap` · `baire_trap` · `variety_trap` · `cauchy_lipschitz_trap` · `pigeonhole_trap` · `hall_trap` · `erdos_szekeres_trap` · `euler_path_trap` · `run_deterministic_traps`

### 推荐调用序列（纯推理）

1. `world_info` — 查看世界图 𝕎
2. `set_world` —（可选）载入你自己的场景
3. `carrier_report` — 上报物理状态（电量/密度）以推导硬/软约束
4. `reason` — 深思规划（系统 1 快答 + 系统 2 A\* + RSG）
5. `dmcts` —（可选）确定性 MCTS 多候选探索
6. `causal` / `causal_effect` / `counterfactual` — 因果与反事实推演
7. `pac_bound` — 评估所需样本量（不确定性理论）
8. `learn` — 把真实结果反馈回经验库，置信度流入未来规划

### 推荐调用序列（具身 / 机器人）

`attach_body` → `plan_task` → `execute_task`（每步 SAFE-STOP）→ `state_diff` → 有界重规划（`maxReplans`）

---

## 两个独立产品，勿混淆

| 产品 | 是什么 | 仓库 | npm |
|---|---|---|---|
| **灵脑 LingNao**（本仓库） | **推理服务**：感知 / 规划 / 因果 / 世界模型 / 数学健全性 / 具身决策 | `genesis-plan/lingnao` | `lingnao-mcp` |
| **灵数 LingShu** | **求解器**：方程组实数解（区间收缩 + Krawczyk） | `genesis-plan/lingshu-solver` | `lingshu-solver` |

灵脑**不重写求解逻辑**：`algebraic_solve` **委派**给灵数真引擎。灵数是**可选依赖** —— 不装它，其余能力照常运行，仅该项诚实降级。

---

## 分发渠道

| 渠道 | 入口 |
|---|---|
| GitHub（主仓） | <https://github.com/genesis-plan/lingnao> — 克隆即跑 |
| npm | `npx -y lingnao-mcp` |
| MCP 市场 | Smithery / Glama / mcp.so 搜索 `lingnao-mcp`，或粘贴仓库 URL |
| 在线试用 | [控制台](https://hclj-1409755229.cos.ap-guangzhou.myqcloud.com/lingnao/lingnao-console.html) ／ [Playground](https://hclj-1409755229.cos.ap-guangzhou.myqcloud.com/lingnao/playground.html) |

---

## 许可（摘要）

**非商业免费 + 商业须书面授权**（自有《灵脑商业授权许可协议》，**不是开源协议**）：

- **非商业用途免费**：个人学习 / 研究 / 教学 / 评测；非营利组织与教育机构内部使用；年营收 ≤ 100 万元的团队内部评估（同时运行实例 ≤ 3 个）。须保留版权与许可声明。
- **商业用途须事先取得书面授权**：任何以营利为目的的产品 / 服务 / 业务，SaaS / 云 / API 对外提供能力（**无论是否收费**），集成嵌入商业发行物，再分发 / 转授权 / 对外托管 —— 均须《商业授权协议》。
- 「灵脑 / LingNao」为版权方商标，本许可不授予商标使用权。

完整条款见 [LICENSE](LICENSE) ｜ 授权范围见 [06 · 商业授权与收费](docs/06-商业授权与收费.md)

---

## 联系

- 商务 / 授权 / 反馈：553420544@qq.com（亦可用仓库 Issues）
- 版权方：广州市红尘灵境数字科技有限公司

---

## 诚实注记（已知待办）

- `knowledge_query` / `knowledge_add` / `knowledge_ann` / `knowledge_distill` / `cog_graph` 需接入 KB 知识库，未接入时恒返 `available:false`；自测中如实单列为「已知未实现能力」，不计入绿色通过。
- 物理接入模块 30 条协议中仅 `ws` / `modbus-tcp` / `mqtt` 已实装真实驱动，其余为「仅建档、需硬件」。
- `docs/01–11` 为历史技术文档，仍含「审计/验证」旧口径，正逐步与本文档及 [docs/00](docs/00-推理引擎原理与方法学.md) 对齐（后续收尾任务）；本文档与方法学文档为对外权威口径。
- 验证/审计类能力（`audit`/`certify`/`verify`/`prove`/`runtime_monitor` 等）已**从对外网关能力清单中移除**（不再暴露、不再挂名），仅保留为内核内部资产；灵脑对外只做推理。
