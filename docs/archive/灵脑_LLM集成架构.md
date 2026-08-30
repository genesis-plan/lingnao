# 灵脑 LingNao · 免费 LLM 集成架构（感知层 + 解释层）

> 本文档说明「一天 50 次」的 OpenRouter 免费模型如何真正用于完善灵脑产品：
> 它在 v3.0 五层认知 OS 中占据 **①感知层（NL→结构化）** 与新增的 **③解释层（推理结果→大白话）**，
> 把 IMA 数学库资料文档 **接地（grounding）** 到自然语言，而非用于生成代码。

## 1. 架构位置（你给的方向：用免费 API 完善产品）

```
用户大白话 ──①感知层──▶ perceiveLLM(openrouter/free) ──▶ 结构化目标{goal,battery,density,entities}
                                                          │
                                  ②推理引擎(确定性·可审计·不幻觉) reason()/goalDirected()/dmcts()
                                  命中 IMA 数学库(431条) 作为证据 imaRef
                                                          │
结果(路径/依据/不确定性/IMA引用) ──③解释层──▶ explainWithLLM(openrouter/free) ──▶ 中文大白话
                                                       ↑ grounding：把 ima_<编号> 标题喂给模型
```

- **① 感知层**：`perceiveLLM` —— 免费 LLM 把中文状态/目标描述转为 JSON（文档 Layer1）。
- **② 推理引擎（已有，确定性）**：A\*+RSG / 目标导向 / MCTS / 贝叶斯 / 切比雪夫 / IMA 检索。不依赖 LLM，保证不幻觉。
- **③ 解释层（本次新增）**：`explainWithLLM` —— 免费 LLM 把可审计推理结果 + 命中的 IMA 资料，讲成非技术用户能读懂的中文。

## 2. 对应代码（文件：灵脑.html 内核；lingnao-mcp.js 服务）

| 函数 | 位置 | 作用 | 真消费的数学/资料 |
|---|---|---|---|
| `perceiveLLM(text, key)` | 灵脑.html ~L569 | NL→JSON 感知 | 感知层（文档 Layer1） |
| `reason()` 主推理 IMA 注入 | 灵脑.html ~L253 | 未知/低置信时检索 IMA 证据 | ima_378/365 |
| `explainWithLLM(result, key)` | 灵脑.html ~L602 | 推理结果+IMA→中文 | 把 `imaKnowledge.get(id)` 标题作为引用资料喂给模型 |
| `askBrain(text, key)` | 灵脑.html ~L622 | 端到端编排：感知→推理→解释 | 上述三者 |
| `askBrainLogic` / `explainLogic` | lingnao-mcp.js | MCP 工具后端 | 同上 |
| MCP 工具 `ask` / `explain` | lingnao-mcp.js TOOLS | 暴露给智能体调用 | 同上 |

## 3. 资料文档的利用（IMA 数学库 431 条）

- `ima_knowledge.json`（知识壳）经 `loadIMAKB` 吸收进 `imaKnowledge` store。
- 主推理 `reason()` 在未知/低置信时调 `KB.imaQuery` 检索相关公理/定理，注入 `imaRef`，审计报告真引用 `ima_<编号>`。
- **解释层把资料用起来**：`explainWithLLM` 收集 `reason` 的 `imaRef`（及 `imaEvidence`），用 `imaKnowledge.get(id)` 取出标题（如 `ima_286 目标导向决策框架`），作为"引用的数学资料"一并交给免费 LLM，使解释**有据可依、不编造**。
- 若推理未显式引用 IMA，解释层按 `goal` 关键词回退检索 3 条，保证资料始终被利用。

## 4. 实测发现（诚实记录，非虚构）

- **`deepseek/deepseek-r1:free` 已停免费**（HTTP 404：「This model is unavailable for free. The paid version is available now - use this slug instead: deepseek/deepseek-r1」）。
- 改用 **`openrouter/free`**（自动路由到当前可用免费模型）：实测 HTTP 200，返回 `{"goal":"C"}`，正是产品期望的结构化 JSON。
- 产品两处模型硬编码（`perceiveLLM` / `explainWithLLM`）已统一切换为 `openrouter/free`。

## 5. 额度策略（免费档 50 次/天 · 20 RPM）

- 内核维护 `_llmCache`（Map，按 请求内容 哈希）：相同「理解」或「解释」命中缓存，**不重复烧额度**。
- `perceiveLLM` / `explainWithLLM` 仅在用户主动「理解并规划」时触发；确定性推理与 IMA 检索**不消耗** LLM 额度。
- MCP 工具 `ask` 一次调用内含 1 次感知 + 1 次解释 = 最多 2 次/问；智能体应缓存结果。

## 6. 诚实边界

- 免费 LLM 是灵脑运行时的「耳朵（理解人话）+ 嘴巴（讲人话）」，**不是**代码生成器或架构设计器；确定性推理、可审计证明、IMA 数学仍由内核完成。
- 免费模型能力有限、偶发不稳定；感知失败时优雅降级（返回 `mode:'manual'` 与错误），解释失败时仍输出原始推理结果供用户自查。
- 未 publish NPM、未 push 仓库（遵守先做好产品、最后统一推的硬约束）。
