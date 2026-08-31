# 贡献指南（CONTRIBUTING）

感谢你关注「灵脑 LingNao（世界通用大脑）」。本仓库定位为**可审计、确定性、不幻觉**的推理大模型内核，欢迎外部测试、反馈与代码贡献。

## 一、先跑通自测（验证不幻觉）
```bash
git clone https://github.com/genesis-plan/lingnao && cd lingnao
node lingnao-mcp.js --selftest
# 期望输出：SELFTEST OK — 全部 58 项工具验证通过
```
任何改动**必须**保证上述自测全绿，并新增对应断言。

## 二、如何提反馈
| 类型 | 入口 | 说明 |
|---|---|---|
| Bug | Issue 模板 `bug` | 附复现步骤 + `node lingnao-mcp.js --selftest` 完整输出 |
| 测试报告 | Issue 模板 `test-report` | 你跑起来的结果、发现、改进建议 |
| 功能建议 | Issue 模板 `feature` | 场景 + 建议方案 + 涉及模块 |
| 讨论 | GitHub Discussions | 用法分享、设计探讨 |
| 安全漏洞 | [SECURITY.md](./SECURITY.md) | **私信**，勿公开 Issue |

## 三、提 PR 前
1. 先开 Issue 讨论（避免重复劳动，尤其架构级改动）。
2. 分支从 `main` 切出：`git checkout -b fix/xxx`。
3. 改动后跑：`node lingnao-mcp.js --selftest` 必须全绿。
4. 遵守下方「诚实边界」约定。
5. PR 模板填写：关联 Issue、改动说明、自测状态、诚实边界自检。

## 四、诚实边界约定（硬要求）
- **不虚构**：凡未实装的能力，标注为「路线/待做」，不得写成已落地。
- **lite 标注**：手写轻量等价实现（Z3-lite / PC-lite / SimHash LSH / 线性 SEM）须保留 `lite` 标注，注明非工业级外部求解器。
- **不幻觉分层不被破坏**：`askBrain` / `audit` / `reason` 返回值的 `grounding` 字段与 `disclaimer` 提示不得移除或弱化；免费 LLM 感知结果（`UNVERIFIED_LLM`）不得进入证明链或决策依据。
- **确定性**：内核推理须可复现；新增随机性须显式隔离并标注。

## 五、代码组织
- `灵脑.html`：单文件演示 + **内控内核**（唯一真源，MCP 用 vm 抽取复用）。
- `lingnao-mcp.js`：MCP stdio 服务，从 `灵脑.html` 抽取内核，勿在 MCP 内重复实现内核逻辑。
- 内核标记：`// ==KERNEL START==` … `// ==KERNEL END==`；改动内核请在 `灵脑.html` 内，MCP 自动继承。

## 六、环境
- Node ≥ 18（不依赖第三方包，零 `npm install` 即可跑 MCP）。
- 免费 LLM 感知需 OpenRouter Key（参数或 env `OPENROUTER_API_KEY`），无 key 自动降级为手动。

## 七、文档规范（仓库整洁标准）

公共产品仓库的文档只服务两类人：**使用者**（装、配、调）与**贡献者**（fork、架构、提 PR）。**不记录内部过程**。

- 根目录只放：`README.md`（唯一使用者入口）、`LICENSE`、`CHANGELOG.md`（按版本、只写对用户重要的变更）、`CONTRIBUTING.md` / `CODE_OF_CONDUCT.md` / `SECURITY.md` / `.github/PULL_REQUEST_TEMPLATE.md`（OSS 惯例）。
- 深度技术（`ARCHITECTURE.md`、`AGENT-SETUP.md`、以及 `docs/` 下的 `MATHEMATICS.md`、`VERIFIABLE-PHYSICAL-AI.md`）给贡献者/高阶使用者，但**不写过程日记**。
- 内部思考、评审、调研过程稿**不进公共仓库**（留本地或私有权限）；`CHANGELOG` 不列逐小时提交日志、不附 commit hash。
