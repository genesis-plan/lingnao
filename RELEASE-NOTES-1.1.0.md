# 灵脑 LingNao v3.1 / lingnao-mcp 1.1.0 发布说明

> 发布日期：2026-09-03
> 内核产品版本：v3.1（算法版本 ALGO_VERSION=3.1）
> MCP 包版本：lingnao-mcp@1.1.0
> 许可：非商业免费，商业使用须事先取得书面《商业授权协议》（见仓库 LICENSE）

## 本版本核心变更

### 一、形式化证明模块 M1–M4「那全修」九项全部落地（#244–#252）
- **#244** UMD 导出补齐 4 个符号（disconnectLLM / selfVerify / reflect / ReflectionBuffer），UMD 导出 246 → **250**
- **#245** 高风险动作经 `humanApproved:true` 放行时，写入 `AUTHZ` 审计事件并标注该布尔为调用方自证（selfAsserted）
- **#246** 审计账本缺签名密钥且未显式 opt-in 时 **fail-closed 拒启**（原 fail-open 漏洞已修）；保留 `insecureAudit:true` 开发期逃生口（可见告警，非静默）
- **#247** M2 安全证书语义诚实降级：verified 实为 h≥−1/B² 辅助域松弛，规格强制标注 `provenBound`
- **#248** `certifiedNumeric` 预算耗尽（truncated）一律降档 `truncated-unverified`，绝不把「未穷尽」说成「已证安全」
- **#249** M3 去「证明模块」包装，定性为三层裁决表达层（refuse / degrade-conservative / record-capability-limit）
- **#250** M4 完全中介参考监视器正则闭合 Function() / setTimeout('字符串') / with 三类逃逸（12 变异测试全抓）
- **#251** MCP 内核导出缺失即 `MCP_EXPORT_MISSING` 启动即抛（原 try/catch 静默吞）
- **#252** package.json `files` 清理不存在路径 + 新增三面导出逐名比对测试（内核/MCP/UMD）

### 二、许可模型（用户决策）
- 由 UNLICENSED 改为「非商业免费 + 商业授权」双态：package.json / glama.json 改为 `SEE LICENSE IN LICENSE`；README 顶部改为「非商业免费（含非商业 AI Agent），商业须授权」
- 与仓库既有 `灵脑商业授权许可协议`（LICENSE）一致，解开此前「免费分发自相矛盾」的合规缺口

### 三、版本与 MCP 同步
- 内核产品版本 v3.0 → v3.1；算法版本 3.0 → 3.1（审计可复现信息同步）
- MCP 包 1.0.0 → 1.1.0（package.json / glama.json / serverInfo 三处一致）
- glama.json 工具数描述修正 46 → 62（实测 TOOLS 数组）
- 重建 lingnao.umd.js（同步内核 3.1，250 导出）

## 验证实据（发布前全绿）
- `node lingnao-mcp.js --selftest` → exit 0（无回归）
- 三面导出比对：EXPORT_NAMES=250 / UMD=250 / 通过 24 失败 0
- 形式化证明模块：M2/M3 62 通过 / 0 失败（含 FP-1 假证明回归 44 项）
- 完全中介 M4：78 通过 / 0 失败
- 验证脚本已移出首页归档，不占根目录；核心自测随时 `npm test` 复跑

## 诚实边界（对外口径）
- 灵脑是**可审计、可复现的安全验证体系**（确定性、非 LLM、不幻觉），非概率型大脑
- M2 为数值安全不变式证书（带 h≥−1/B² 松弛 + 仓库外 TCB），非无松弛纯数学证明
- M1 / M4 为证明语言包装的静态/语法层检查；M3 为三层裁决表达层
- LLM 仅作理解层，不进入证明链；审计账本签名密钥即部署密钥（缺失则 fail-closed 拒启）

## 已知待办（不在本版本）
- 商标 / M2 专利新颖性检索：用户暂缓，优先级低于获取首个具名付费案例
- MCP 市场（mcp.so / Glama / PulseMCP）：需用户本机登录其账号网页提交；Smithery 待补 API Key
