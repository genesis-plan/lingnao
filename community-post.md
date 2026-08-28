# 灵境 LingJing · 求测 / 求反馈 帖子文案（多平台可复制版）

> 用途：把灵境推到外部「真实机器人 / AI Agent 社区」求测。GitHub Discussions 已自动发布（https://github.com/genesis-plan/lingjing/discussions/1），下面是去其他社区可直接粘贴的版本。
> 在线 Playground：https://hclj-1409755229.cos.ap-guangzhou.myqcloud.com/lingjing/playground.html
> 仓库：https://github.com/genesis-plan/lingjing

---

## 一、中文版（知乎 / V2EX / 机器人社区 / 微信群）

**标题**：做了一个「不说谎」的通用大脑，请做 Agent / 机器人的朋友来测

**正文**：

别的 LLM 会说"我可能错了"。我做的「灵境 LingJing」给每条结论打了三层可信标签，并附可复现的七段审计链——能在"不能出错"的地方用。

**不幻觉保证（三层）**
- PERCEPTION（可能幻觉）：免费 LLM 的自然语言理解层，绝不进证明链；
- KERNEL（确定性）：A\* 规划、因果推断等内核，数学可复现、不随随机种子漂移；
- PROOF（可验证）：七段审计 + 霍尔机器验证 + CoVe 自验证。

一句话：别的框架给"结论"，灵境告诉你是"哪一档、证据在哪、你能复现吗"。

**能干什么（都带自测）**
- 确定性 A\* 最优规划（含硬约束改道）
- 前门准则因果推断（有未观测混杂仍可识别）
- CoVe 自验证 + Reflexion 反思
- 36 个 MCP 工具，面向 AI Agent 免费分发

**零安装接入**
1. 网页一行：`<script src="https://cdn.jsdelivr.net/gh/genesis-plan/lingjing/lingjing.umd.js"></script>`
2. AI Agent / MCP 客户端：复制 `{ "mcpServers": { "lingjing": { "command": "npx", "args": ["github:genesis-plan/lingjing"] } } }`
3. 非技术双击即用：在线 Playground https://hclj-1409755229.cos.ap-guangzhou.myqcloud.com/lingjing/playground.html

真实机器人案例已建模（Amazon Kiva / Aethon TUG / Starship / 废墟搜救）。自测 45/45 全绿，不幻觉边界已诚实标注。

**求什么**：来跑、提 Issue、告诉我们哪条结论你不敢信。仓库 https://github.com/genesis-plan/lingjing

---

## 二、English 版（Reddit r/LocalLLaMA / HuggingFace / Hacker News）

**Title**: I built an auditable, non-hallucinating "general brain" — looking for Agent / robotics testers

**Body**:

Most LLMs say "I might be wrong." **LingJing (灵境)** tags every conclusion with a 3-tier confidence label and ships a reproducible 7-section audit trail — so you can use it where being wrong isn't an option.

**Anti-hallucination guarantee (3 tiers)**
- PERCEPTION (may hallucinate): free-LLM NL understanding layer, never enters the proof chain;
- KERNEL (deterministic): A\* planning, causal inference — mathematically reproducible, no seed drift;
- PROOF (verifiable): 7-section audit + Hoare-machine verification + CoVe self-verification.

One line: other frameworks give you a *conclusion*; LingJing tells you *which tier it's in, where the evidence is, and whether you can reproduce it*.

**What it does (all self-tested)**
- Deterministic optimal A\* planning (with hard-constraint rerouting)
- Front-door causal adjustment (identifiable even with unobserved confounders)
- CoVe self-verification + Reflexion
- 36 MCP tools, free for AI Agents

**Zero-install onboarding**
1. Browser: `<script src="https://cdn.jsdelivr.net/gh/genesis-plan/lingjing/lingjing.umd.js"></script>`
2. AI Agent / MCP client: `{ "mcpServers": { "lingjing": { "command": "npx", "args": ["github:genesis-plan/lingjing"] } } }`
3. Non-technical: live Playground https://hclj-1409755229.cos.ap-guangzhou.myqcloud.com/lingjing/playground.html

Real robots modeled (Amazon Kiva / Aethon TUG / Starship / rubble search-rescue). 45/45 self-tests green; hallucination boundaries honestly documented.

**What I'm asking**: run it, open an Issue, tell me which conclusion you don't trust. Repo: https://github.com/genesis-plan/lingjing

---

## 三、平台适配小贴士
- **Reddit r/LocalLLaMA**：用 English 版，标题加 `[P]`，末尾加一句 "feedback welcome, especially where it still feels like it's making things up"。
- **HuggingFace Discissions / Models**：挂 English 版，可附 Playground 链接当 demo。
- **V2EX / 知乎**：用中文版；知乎删链接风险高，正文留仓库名「genesis-plan/lingjing」让用户搜。
- **机器人社区（如 ROS Discourse / 古月居）**：强调"真实机器人案例 examples/real-robots.js + A\* 确定性改道"。
- **AI Agent 社群（如 Smithery / MCP 频道）**：强调 `npx github:genesis-plan/lingjing` 零安装 36 工具。
