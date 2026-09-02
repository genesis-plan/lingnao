# 灵脑 × 灵数求解器 —— 内部代数验证委派（A 选项落地）报告

> 日期：2026-09-02 ｜ 产品：灵脑 LingNao（确定性可审计推理内核）｜ 依赖：灵数求解器 lingshu-solver（Krawczyk 认证）
> 范围：把灵脑内部"确定性验证的算术部分"中**真正属于方程求解**的那一块，从 lite 浮点升级为灵数求解器的 Krawczyk 区间认证，并真正接入安全栈与自测。

## 0. 结论（先说诚实事实）
**A 选项已落地并验证通过（7/7 全过），但必须先划清边界——这不是"灵脑所有数值验证都变认证了"。**

灵数求解器是**方程求解器**（解 `f(x)=0` + 严格证明无实数解），它**只能**升级灵脑内部"解代数方程 / 证无实数解"这一类验证。灵脑内部标 "lite" 的其余算术——**区间算术 `itv*` / 自动微分 `dual*` / QP 统一 `clfCbfUnified`**——灵数**替换不了**，本工作也**没有假装替换**（详见 §5 诚实残余）。

所以 A 的真实成果是：**灵脑内部"需要解 `f(x)=0` 或证无实数解"的代数验证，现在统一走 `certifiedNumeric` 委派灵数，拿到 Krawczyk 认证；灵数不可达时诚实降级，绝不退回裸浮点假装认证。**

## 1. 改动清单（内核 `灵脑.html`，外科级）
| # | 位置 | 改动 |
|---|---|---|
| 1 | 新增 `certifiedNumeric(args)`（约 algebraicSolve 之后） | 内部确定性代数验证层，委派灵数；`provenNoSolution` 真升级；不可达诚实降级 `available:false` |
| 2 | 定理注册区（~4930） | 注册 `THM_KRAWCZYK_CERTIFY`，`by:'DELEGATE'`（诚实标注证明权外委灵数，非灵脑自证） |
| 3 | `generateAudit` 安全层（plan.hoare 之后） | 新增 `safety.certifiedAlgebraic` 切片：调用方 `opts.algebraic` 提供安全代数条件方程 → 走灵数认证；`provenNoSolution→safe` |
| 4 | `safetyLayersReport`（clfCbf 之后） | 新增 `safety.certifiedAlgebraic` 层：接收 `control.algebraic` |
| 5 | `continuousVerify` 自测 | 新增「代数认证层」检查，每次变更锻炼该路径（格式良构、不抛错） |
| 6 | `__WB` 导出 | `certifiedNumeric` / `safetyLayersReport` 暴露给 MCP / UMD 层 |

**校验点**：内核安全闸（13 硬门）与既有 6 项修复**零改动**，本次为纯加法；公开安全套件回归 13/13 + 13/13 ALL GREEN。

## 2. 验证结果（7/7 ALL GREEN，见 `_cert_a_verify_results.json`）
| 检查 | 结果 | 说明 |
|---|---|---|
| NO-BRIDGE-DEGRADE | PASS | 灵数未接入时 `certifiedNumeric` 返回 `available:false, tier:'lite-unverified'`，不假装认证 |
| BRIDGE-CERTIFIED | PASS | 注入桥后解 `x²+y²=25, x+y=7` → (4,3) 或 (3,4)，`certified:true`，`certifiedRadius`/`residual` 透传 |
| PROVE-NO-SOLUTION | PASS | 灵数证明 `x²+1=0` 在实数域**严格无解**（`provenNoSolution:true`）——这是 lite 浮点**永远做不到**的真升级 |
| AUDIT-SLICE | PASS | `generateAudit` 暴露 `safety.certifiedAlgebraic` 切片，引用已注册 `THM_KRAWCZYK_CERTIFY` |
| SAFETY-REPORT-SLICE | PASS | `safetyLayersReport` 暴露 certifiedAlgebraic 层 |
| CONTINUOUS-VERIFY | PASS | 仓库级持续验证全过（新「代数认证层」路径被实际锻炼） |
| THEOREM-REGISTERED | PASS | 定理注册 API 存在且运行内核安全层已实际引用该定理（诚实 `by:DELEGATE`） |

## 3. 真升级点（为什么这次不是空话）
- **`provenNoSolution`**：灵数全局分支定界穷尽后返回 `resultType='empty'`，即**严格证明"该代数安全条件在实数域无解"**。浮点采样只能"找到解"，**永远无法证明无解**——这是把"确定性"从工程主张往数学事实推近的一步（仍依赖灵数引擎的可靠性，已诚实标注为 `DELEGATE`）。
- **Krawczyk 认证盒**：解的 `certifiedRadius` 给出"真实根必落在区间 `[v-r, v+r]`"的机器可检验保证，残余 `residual` 直报。

## 4. 部署事实（必须知道）
- `certifiedNumeric` 的证明权来自 `globalThis.__LINGSHU__`（由 `lingnao-mcp.js` 在另一仓注入灵数桥）。**不注入则诚实降级**，不影响内核任何安全闸。
- 调用方（UMD / Agent）通过 `opts.algebraic = {equations, variables, domain}` 把"自己的安全代数条件"交给灵脑认证——灵脑不臆造你的动力学，只提供**认证引擎**。
- 密钥/桥均不入源码（沿用前轮部署密钥约定）。

## 5. 诚实残余（不夸大）
1. **灵数只覆盖"方程求解"**：区间算术、自动微分、QP 这三类 lite 算术**未被本工作触及**，也非灵数能力范围。它们仍是内核自身的 lite 实现（内核已自注"未做 IEEE 754 逐算法核定"）。要把这三类也升级，需另立对应认证支线（如区间算术接区间库、QP 接认证求解器），不在 A 范围。
2. **证明权外委**：`THM_KRAWCZYK_CERTIFY` 的 `by:'DELEGATE'`——严谨性依赖灵数求解器本身正确。灵脑不重写求解逻辑，仅消费其认证结果（这是诚实边界，不是缺陷）。
3. **仍不能说"数学上不可越狱"**：哥德尔不完备已注册为定理；A 升级的是"代数验证精度"，不触及越狱/安全逻辑闸门。
4. **真·多模型独立评审仍未做**：OpenRouter 免费档限流（见前轮），"外部专家团"目前仅单一可达模型视角。

## 6. 交付物
- `_cert_a_report.md`（本文件）
- `_cert_a_verify.js`（验证 harness，可复跑）
- `_cert_a_verify_results.json`（结构化结果）
- `灵脑.html`（已改内核，未推送 git —— 维持 4 个本地提交不推送惯例）
