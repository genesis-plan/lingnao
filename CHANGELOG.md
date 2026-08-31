# 更新日志 CHANGELOG

> 本文件只记录**对用户重要的版本变更**。内部逐小时开发过程不列入（以 git 提交历史为准）。

## v1.0.0（2026-08-31）— 首个正式发布

灵脑 LingNao 首个正式发布：**可审计、确定性的通用大脑推理引擎**（非概率生成式 LLM、不幻觉），对外以 MCP stdio 暴露 **46 个工具**，免费面向 AI Agent 分发。

- **核心能力（46 工具）**：免费 LLM 感知（NL→JSON）/ 世界图 / A* 可审计推理 / 七段审计 + 霍尔机器验证证明 / 代数方程系统求解（委派独立产品「灵数求解器」，区间收缩 + Krawczyk 认证）/ 因果 do 演算 / 元认知 / 具身层（A* 状态空间规划 + checkHard SAFE-STOP + maxReplans 护栏 + 任意物理身体能力契约）。
- **架构脊柱**：机检证明账本（verifyLedger）、防火墙（PERCEPTION 入口逐点拦截 + 确定性降级）、八元组 `BrainTuple` 单一真源、思想索引 `LingNaoThinking`。
- **算法确定性/可审计优化**：A* 二叉最小堆、dmcts 确定性（mulberry32 替代 Math.random）、全随机源消除。
- **分发落地**：GitHub Release v1.0.0、npm `lingnao-mcp@1.0.0`（UNLICENSED 非开源）、COS 在线试用页（`/lingnao/`）、MCP 三清单（Glama / mcp.so / PulseMCP / Smithery 自动收录）。
- **诚实边界（对外照讲）**：lite 实现已标注 —— 符号验证=自写约束求解器（非 Z3）、霍尔证明=结构化逐边验证（非 Coq）、因果发现=PC-lite 离散近似（非真实 PC）、LSH=SimHash（非 Milvus）；不幻觉置信分层 GROUNDING 三档（PERCEPTION 可能幻觉 / KERNEL 确定性 / PROOF 审计可验证）；LLM 感知 `mayHallucinate` 绝不进证明链；具身执行=确定化重规划工程近似（非 POMDP 最优）；无数据飞轮、不学习（无训练）。

## 前身命名（历史）

灵脑的产品前身历经命名演变：**世界大脑 WorldBrain**（2026-08-26）→ **灵境 LingJing**（v3.0 五层认知 OS）→ **灵脑 LingNao**（当前）。旧产品线 `lingjing-mcp@3.1.0` 已弃用；灵脑作为独立产品自 **1.0.0** 起算。
