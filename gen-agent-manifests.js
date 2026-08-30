#!/usr/bin/env node
/**
 * gen-agent-manifests.js — 生成「给前沿大模型用」的接入清单（2026-08-30）
 *
 * 目的：让 Claude / GPT / Gemini 等模型及其 Agent 框架能直接消费灵脑的工具。
 *
 * 设计要点：**工具清单不从源码里手抄，而是真起 MCP 服务、走 tools/list 拿**。
 *   ① 与真实客户端所见完全一致，永远不会和代码不同步；
 *   ② 生成过程本身就是一次传输层端到端验证（传输坏了这里会直接失败）。
 *
 * 产出：
 *   llms.txt              —— LLM 发现用（llmstxt.org 新兴标准，中英双语）
 *   openai-tools.json     —— OpenAI function calling / Assistants / Agents SDK 格式
 *   anthropic-tools.json  —— Anthropic tool-use 格式
 *
 * 用法：node gen-agent-manifests.js
 */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const DESC_MAX = 1024;   // OpenAI function.description 建议上限

function fetchTools() {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [path.join(__dirname, 'lingnao-mcp.js')], {
      cwd: __dirname, stdio: ['pipe', 'pipe', 'pipe']
    });
    let buf = Buffer.alloc(0);
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; try { p.kill(); } catch (e) {} reject(new Error('tools/list 超时')); } }, 15000);
    p.stdout.on('data', d => {
      buf = Buffer.concat([buf, d]);
      let i;
      while ((i = buf.indexOf(0x0A)) !== -1) {
        const line = buf.slice(0, i).toString('utf8').trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        let m; try { m = JSON.parse(line); } catch (e) { continue; }
        if (m.id === 2 && m.result && Array.isArray(m.result.tools)) {
          done = true; clearTimeout(t);
          try { p.kill(); } catch (e) {}
          resolve(m.result.tools);
        }
      }
    });
    const send = o => p.stdin.write(JSON.stringify(o) + '\n');
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'gen-agent-manifests', version: '1' } } });
    setTimeout(() => send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }), 400);
    setTimeout(() => send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }), 800);
  });
}

function clip(s) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  return s.length > DESC_MAX ? s.slice(0, DESC_MAX - 1) + '…' : s;
}

function main() {
  fetchTools().then(tools => {
    const n = tools.length;

    // ── 1) OpenAI function calling ────────────────────────────────
    const openai = tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: clip(t.description),
        parameters: t.inputSchema && Object.keys(t.inputSchema).length ? t.inputSchema : { type: 'object', properties: {} }
      }
    }));

    // ── 2) Anthropic tool use ─────────────────────────────────────
    const anthropic = tools.map(t => ({
      name: t.name,
      description: clip(t.description),
      input_schema: t.inputSchema && Object.keys(t.inputSchema).length ? t.inputSchema : { type: 'object', properties: {} }
    }));

    // ── 3) llms.txt（中英双语，英文在前：面向国外前沿模型）────────
    const names = tools.map(t => '`' + t.name + '`').join(', ');
    const llms = `# 灵脑 LingNao — a deterministic, auditable decision kernel for AI agents and robots

> LingNao is NOT a language model. It is a zero-dependency, deterministic kernel that
> decides **whether an action may be taken** and returns a traceable proof chain.
> When a question is undecidable it honestly returns U instead of guessing.
> LLM output is confined to perception/explanation and never enters the decision or proof chain.

## Why use it
- **Deterministic & reproducible** — identical input always yields identical output.
- **No hallucination** — the LLM only parses intent; planning is symbolic and auditable.
- **Mathematically grounded** — axioms → theorems → proof chains; every guarantee is traceable.
- **Safety stack** — CBF-QP safety filter, zonotope reachability, STL robustness, abstract interpretation.
- **Body-agnostic** — attach any robot via a declarative capability contract.

## Three ways to connect
1. **MCP (recommended)** — \`npx -y lingnao-mcp\`; config: see \`mcp.json\` / \`mcp.example.json\`.
   Works with Claude Desktop, Cursor, Cline, and any MCP client.
2. **Node library** — \`const K = require('./lingnao-mcp'); K.reason(start, goal)\` (no server started).
3. **Browser** — \`<script src="lingnao.umd.js"></script>\` then \`window.LingNao\` (zero install).

## Two separate products (do not confuse)
| Product | What it is | Repo | npm |
|---|---|---|---|
| **LingNao** (this) | **the brain** — perception, planning, audit, learning, embodied arbitration | genesis-plan/lingnao | lingnao-mcp |
| **LingShu** | **the solver** — real roots of equation systems (interval contraction + Krawczyk certification) | genesis-plan/lingshu-solver | lingshu-solver |

LingNao reimplements no solving logic: \`algebraic_solve\` **delegates** to LingShu.
LingShu is an **optional dependency** — without it LingNao still works, that one tool degrades honestly.

## Tools (${n} total)
${names}

### Recommended call sequence (plain reasoning)
1. \`world_info\` — inspect the world graph
2. \`set_world\` — (optional) load your own scenario
3. \`carrier_report\` — report physical state (battery/density) to derive hard/soft constraints
4. \`reason\` — auditable optimal plan (System 1 fast path + System 2 A* + RSG)
5. \`audit\` — seven-section audit report with proof certificate
6. \`learn\` — feed the real outcome back; confidence updates and flows into future planning

### Recommended call sequence (embodied / robots)
\`attach_body\` → \`plan_task\` → \`check_hard\` (SAFE-STOP before irreversible actions) →
\`execute_task\` → \`state_diff\` → replan (bounded by \`maxReplans\`)

## Honest limits
- No world knowledge, no open-domain language ability; perception degrades offline.
- World model is a lite linear SEM; causality is PC-lite; planning runs on finite graphs.
- Eight mathematical areas are not yet implemented (MPC, SOS/SDP barrier certificates,
  general LP solver, general nonlinear reachability, …). See \`docs/数学与模块现状总览.md\`.

---

# 灵脑 LingNao —— 面向 AI Agent 与机器人的确定性可审计决策内核

> 灵脑不是语言模型，而是一个零依赖的确定性内核：它裁决「这个动作能不能做」，
> 并给出可追溯的证明链；不可判定时诚实返回 𝕌，绝不编造。
> 大模型输出被严格限制在感知/解释两端，不进入决策链与证明链。

## 核心特性
- **确定性可复现**：同样输入必得同样输出
- **不幻觉**：LLM 只解析意图，规划与审计全在本地符号内核
- **数学可证**：公理 → 定理 → 证明链，每条保证可回溯
- **安全栈**：CBF-QP 安全滤子 / Zonotope 可达集 / STL 鲁棒度 / 抽象解释
- **具身无关**：用声明式能力契约接入任意物理身体

## 三种接入方式
1. **MCP（推荐）**：\`npx -y lingnao-mcp\`，配置见 \`mcp.json\`
2. **Node 库**：\`const K = require('./lingnao-mcp')\`（不自启服务）
3. **浏览器**：引入 \`lingnao.umd.js\`，零安装

## 两个独立产品，分属两个仓库
| 产品 | 是什么 | 仓库 | npm |
|---|---|---|---|
| **灵脑 LingNao**（本仓库） | **大脑**：感知 / 规划 / 审计 / 学习 / 具身裁决 | genesis-plan/lingnao | lingnao-mcp |
| **灵数 LingShu** | **求解器**：方程组实数解（区间收缩 + Krawczyk 认证） | genesis-plan/lingshu-solver | lingshu-solver |

灵脑不重写求解逻辑：\`algebraic_solve\` 委派给灵数真引擎。灵数是**可选依赖**，
不装它灵脑其余能力照常运行，仅该项诚实降级。

## 工具（共 ${n} 个）
${names}

## 诚实边界
- 无世界知识、无开放域语言能力；离线时感知降级
- 世界模型为 lite（线性 SEM）、因果为 PC-lite、规划基于有限图
- 8 类数学尚未实装（MPC、SOS/SDP 障碍证书、一般 LP 求解器、一般非线性可达集等）

## 更多
- README: ./README.md
- 架构白皮书: ./ARCHITECTURE.md
- 可验证物理 AI 定位: ./VERIFIABLE-PHYSICAL-AI.md
`;

    fs.writeFileSync(path.join(__dirname, 'openai-tools.json'), JSON.stringify(openai, null, 2), 'utf8');
    fs.writeFileSync(path.join(__dirname, 'anthropic-tools.json'), JSON.stringify(anthropic, null, 2), 'utf8');
    fs.writeFileSync(path.join(__dirname, 'llms.txt'), llms, 'utf8');

    console.log('OK 已生成接入清单（工具数 ' + n + '）');
    console.log('  llms.txt             ' + fs.statSync(path.join(__dirname, 'llms.txt')).size + ' bytes');
    console.log('  openai-tools.json    ' + fs.statSync(path.join(__dirname, 'openai-tools.json')).size + ' bytes');
    console.log('  anthropic-tools.json ' + fs.statSync(path.join(__dirname, 'anthropic-tools.json')).size + ' bytes');
  }).catch(e => {
    console.error('生成失败：' + e.message);
    process.exit(1);
  });
}

main();
