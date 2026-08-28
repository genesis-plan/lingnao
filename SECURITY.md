# 安全政策（Security Policy）

## 支持的版本
| 版本 | 状态 |
|---|---|
| v3.0（`main`） | ✅ 支持中 |

## 报告漏洞
**请勿公开提 Issue 披露漏洞。**

请通过以下私信通道报告：
- GitHub：仓库 `Security` 标签下的 **Private vulnerability reporting**（若已开启）；或
- 联系仓库所有者 **genesis-plan** 私信。

报告请包含：
1. 受影响模块（如 `reason` / `audit` / `causal_effect` / MCP 接入）
2. 复现步骤（最小可复现优先）
3. 潜在后果与影响范围
4. 是否涉及密钥或外部依赖

我们承诺在 **7 个工作日**内首次回应，并在确认后协调修复与负责任披露时间。

## 范围说明
- 本内核**不依赖任何第三方运行时包**，攻击面主要来自 MCP stdio 输入与外部 LLM 接入（OpenRouter）。输入校验与沙箱已在 `validateWorld` / `perceiveLLM` 处加固。
- 免费 LLM 感知结果默认标注 `UNVERIFIED_LLM` 且**不进入证明链**——若发现可绕过此边界的漏洞，请优先报告。
