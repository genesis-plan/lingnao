# 灵脑 LingNao 变更日志

## v3.1 / lingnao-mcp 1.1.1 — 2026-09-04（待发版，修1）

- **修1（消除 selftest 假绿，诚实性修复）**：
  - `selftest` 的 `finish()` 旧版静默丢弃 `unimpl` 数组、仍打印"全部 X 项工具验证通过"并 exit(0)，致 6 个 KB 未接入能力被谎称已绿。现如实披露"已知未实现能力 N 项"并改用"核心 X 项工具验证通过"措辞，不再以"全绿"暗示产品能力完整。
  - MCP 工具清单 `knowledge_query / knowledge_add / knowledge_ann / knowledge_distill / cog_graph` 描述加诚实标注（需接入 KB 知识库；未接入时恒返 available:false，属已知未实现能力）。
  - 回归：重跑 `--selftest`，核心 52 项通过 + 如实披露 6 项已知未实现（kb-summary/knowledge_query/knowledge_add/knowledge-ann/knowledge-distill/cog-graph），无 FAIL、exit 0。
- 注：KB 知识库（经验库/LSH/FP-Growth/认知图谱）为可选依赖，当前未接入；接入后上述能力方可启用。"62 工具"对外宣称含这些项时须同步标注"需接入 KB"。

## v3.1 / lingnao-mcp 1.1.0 — 2026-09-03（已发布）
- **npm**：`npm i lingnao-mcp@1.1.0` / `npx -y lingnao-mcp@1.1.0`
  https://www.npmjs.com/package/lingnao-mcp
- **GitHub Release**：https://github.com/genesis-plan/lingnao/releases/tag/v1.1.0
- **在线试用页**（纯前端，数据不出浏览器）：
  https://hclj-1409755229.cos.ap-guangzhou.myqcloud.com/lingnao/index.html
- 发布说明：见 `RELEASE-NOTES-1.1.0.md`
- 核心变更：形式化证明模块 M1–M4「那全修」九项落地（#244–#252）；许可改非商业免费/商业授权；审计账本缺密钥 fail-closed 拒启；UMD 250 导出；glama 工具数 62

## v1.0.0 — 2026-08-30（已发布）
- 架构定型 + 仓库精简
- GitHub Release：https://github.com/genesis-plan/lingnao/releases/tag/v1.0.0

---
许可：非商业免费，商业使用须事先取得书面《商业授权协议》（见 `LICENSE`）。
