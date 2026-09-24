# 灵脑 LingNao · 可审计确定性推理内核

[![License](https://img.shields.io/badge/license-非商业免费%20%2F%20商业须书面授权-blue)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-stdio-blue)](https://modelcontextprotocol.io)
[![Deterministic](https://img.shields.io/badge/core-deterministic%20%2F%20non--LLM-green)](docs/03-设计思想.md)
[![npm](https://img.shields.io/npm/v/lingnao-mcp)](https://www.npmjs.com/package/lingnao-mcp)

> **本地确定性、可审计的推理内核 —— 不是概率生成式大模型，不幻觉。**
> 单文件内核 `灵脑.html` 把「世界图 → A\* 可审计推理 → 物理载体执行 → 审计」封装为单一引擎，
> 对外以 **MCP stdio / 网页 / UMD 库**三种接口暴露。
> 零依赖 · 零服务器 · 可离线 · 非商业免费（含非商业 AI Agent），商业须授权。

- 仓库：`genesis-plan/lingnao` · npm：`lingnao-mcp` · 在线试用：[playground](https://hclj-1409755229.cos.ap-guangzhou.myqcloud.com/lingnao/playground.html) ／ [控制台](https://hclj-1409755229.cos.ap-guangzhou.myqcloud.com/lingnao/lingnao-console.html)

| | 说明 |
|---|---|
| **是** | 在世界图上做**最优且可审计**决策的内核；每步给依据链 + 七段审计报告；不可判定时诚实返回 𝕌 |
| **不是** | 语言模型（不生成文本、无世界知识）、符号 CAS、"绝对安全"的证明器，也不是"保证不漏"的完备判定器 |

---

## 30 秒上手

**① MCP 接入（推荐，给 AI 客户端用）** —— 不用开网页、不用服务器、不用本地装包：

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

**② 零安装网页** —— 双击 [`playground.html`](playground.html)（规划路径 + 七段审计 + 不幻觉分层，离线可用），
或 [`lingnao-console.html`](lingnao-console.html)（三步接入「身体 / 大模型 / 大脑」后开始干活）。

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
| 决策 | A\* 最优路径 + 硬/软约束 + RSG 推理状态图 + 系统 1 高置信快答，**同输入必得同输出** |
| 审计 | 七段审计报告（概要/轨迹/证据/约束/𝕌/证明证书/可复现）+ 霍尔证明证书 + 签名审计账本（哈希链 + HMAC） |
| 不幻觉 | LLM 只在感知（NL→JSON）与解释两端，强制标 `UNVERIFIED_LLM` + `mayHallucinate`，**绝不进入决策链与证明链** |
| 具身 | 声明式能力契约接入任意身体；规划 → SAFE-STOP → 执行 → 有界重规划闭环 |
| 接入设备 | 30 条协议登记（**仅 `ws`/`modbus-tcp`/`mqtt` 已实装真实驱动**）+ 17 张规范卡 + 9 类字节解码器，无硬件也能跑软件路径 |
| 工具数 | **62**（实测 `TOOLS` 数组）；其中 5 项需接入 KB 才可用，**如实单列不计入绿色通过** |
| 自测 | `--selftest` → **核心 52 项通过** + 如实披露 6 项已知未实现能力 |
| 依赖 | 零第三方运行时依赖；灵数求解器为**可选**依赖（缺失时 `algebraic_solve` 单项诚实降级） |

**不保证**：绝对安全、绝对正确、不漏解、能连所有真机。
M2 数值证书带 `h ≥ −1/B²` 辅助域松弛；M1/M4 为静态/语法层检查；
**副作用面完备性经自查工具检测为"不成立"**（`proveGateChain` 的结论只对走 `execute()` 的物理动作有效）。
这是设计上的诚实边界，不是待修缺陷 —— 详见 [04 · 技术参考](docs/04-技术参考.md) 第六节。

---

## 文档

| 文档 | 内容 |
|---|---|
| [01 · 产品作用](docs/01-产品作用.md) | 它是什么、解决什么问题、给谁用、能力与边界、对外口径红线 |
| [02 · 使用指南](docs/02-使用指南.md) | 三种形态上手、MCP 配置、环境变量、物理接入用法、自测与常见问题 |
| [03 · 设计思想](docs/03-设计思想.md) | 六条设计原则、不幻觉怎么做、fail-closed 落点、三面导出约束、有意不做的事 |
| [04 · 技术参考](docs/04-技术参考.md) | 仓库结构、62 工具全表、接入模块技术细节、M1–M4 摘要、验证体系与已知缺陷 |
| [05 · 应用场景](docs/05-应用场景.md) | 五类可落地场景（Agent 后端 / 具身 / 设备接入 / 合规审计 / 教学）与**不适用**场景 |
| [06 · 商业授权与收费](docs/06-商业授权与收费.md) | 许可模型、免费范围、商业授权范围、授权要素、发票与收款、商务流程 |
| [07 · 授权合同](docs/07-授权合同.md) | 商业授权合同模板、关键条款说明、签署流程 |
| [08 · 版本管理](docs/08-版本管理.md) | 版本号语义、发布前一致性清单、兼容性承诺、版本历史 |
| [09 · 项目历史](docs/09-项目历史.md) | 从"通用大脑"到可审计内核的阶段沿革与关键决策 |
| [10 · 形式化证明规格](docs/10-形式化证明规格.md) | M1–M4 的完整规格（附录） |
| [11 · 机器与协议目录](docs/11-机器与协议目录.md) | 设备类全集、协议标准出处、规范卡清单（附录） |

---

## 许可（摘要）

**非商业免费 + 商业须书面授权**（自有《灵脑商业授权许可协议》，**不是开源协议**）：

- **非商业用途免费**：个人学习 / 研究 / 教学 / 评测；非营利组织与教育机构内部使用；
  年营收 ≤ 100 万元的团队内部评估（同时运行实例 ≤ 3 个）。须保留版权与许可声明。
- **商业用途须事先取得书面授权**：任何以营利为目的的产品 / 服务 / 业务，SaaS / 云 / API 对外提供能力（**无论是否收费**），
  集成嵌入商业发行物，再分发 / 转授权 / 对外托管 —— 均须《商业授权协议》。
- 「灵脑 / LingNao」为版权方商标，本许可不授予商标使用权。

完整条款见 [LICENSE](LICENSE) ｜ 授权范围见 [06 · 商业授权与收费](docs/06-商业授权与收费.md) ｜ 合同见 [07 · 授权合同](docs/07-授权合同.md)

---

## 两个独立产品，勿混淆

| 产品 | 是什么 | 仓库 | npm |
|---|---|---|---|
| **灵脑 LingNao**（本仓库） | **大脑**：感知 / 规划 / 审计 / 学习 / 具身裁决 | `genesis-plan/lingnao` | `lingnao-mcp` |
| **灵数 LingShu** | **求解器**：方程组实数解（区间收缩 + Krawczyk 认证） | `genesis-plan/lingshu-solver` | `lingshu-solver` |

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

## 联系

- 商务 / 授权 / 反馈：553420544@qq.com（亦可用仓库 Issues）
- 版权方：广州市红尘灵境数字科技有限公司
