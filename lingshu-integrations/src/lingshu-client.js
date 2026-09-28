// lingshu-client.js
// 最小可用的 MCP Streamable HTTP 客户端，把「灵数求解器」当可信数学调用工具。
// 任何外部系统（Agent / A2A 节点 / 链上合约 / RPA / 灵境·灵脑）import 本文件即可调用。
//
// 用法：
//   const { solve, health } = require('./lingshu-client');
//   const r = await solve('x^2 - 2 = 0', { honorPaid: true });
//   // r.data.certified === true  →  结果带 Krawczyk 区间认证（可复现、不幻觉）
//
// 设计铁律（务必保留）：
//   1. 免费路径合法：honorPaid:true 声明即放行，不验证、不扣余额（信任制）。
//   2. 认证结果不丢：返回 data.certified / data.provenCount / data.solutions，供调用方自检。
//   3. 错误信封照 MCP 规范解析：工具错误以 result.isError:true + HTTP 200 返回，
//      文本在 result.content[0].text（JSON 字符串），绝不可只看 result 是否存在。

const ENDPOINT = (process.env.LINGSHU_ENDPOINT || 'https://hongchenlingjing.com/mcp').replace(/\/+$/, '');

async function rpc(method, params, sessionId) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;
  const body = (params === undefined)
    ? { jsonrpc: '2.0', method }
    : { jsonrpc: '2.0', id: 1, method, params };
  const res = await fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(body) });
  const newSid = res.headers.get('mcp-session-id') || sessionId;
  const text = await res.text();
  return { status: res.status, sid: newSid, text };
}

// 兼容 SSE（data: {...}）与纯 JSON 两种响应
function parseResult(text) {
  let s = (text || '').trim();
  if (s.includes('data:')) {
    const dataLines = s.split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim())
      .filter(Boolean);
    s = dataLines[dataLines.length - 1] || s;
  }
  return JSON.parse(s);
}

async function newSession() {
  const init = await rpc('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'lingshu-integration', version: '1.0.0' },
  });
  const sid = init.sid;
  if (!sid) throw new Error('MCP 握手未返回会话 ID；端点=' + ENDPOINT);
  // 通知服务端会话已建立（无需响应体）
  await rpc('notifications/initialized', undefined, sid);
  return sid;
}

async function callTool(name, args, sid) {
  const r = await rpc('tools/call', { name, arguments: args }, sid);
  return parseResult(r.text);
}

// 调用 solve。入参支持两种写法：
//   solve('x^2 - 2 = 0', { honorPaid: true })
//   solve(['x^2 - 2 = 0', 'y + 1 = 0'], { honorPaid: true })
// 线上 solve 工具的实参是 equations: string[]，这里自动归一化。
// 返回 { isError, raw, data } —— data 含 certified / provenCount / solutions / diagnostics 等。
async function solve(input, opts = {}) {
  let equations;
  if (Array.isArray(input)) equations = input;
  else if (typeof input === 'string') equations = [input];
  else if (input && Array.isArray(input.equations)) equations = input.equations;
  else if (input && typeof input.expression === 'string') equations = [input.expression];
  else throw new Error('solve 入参须为字符串 / 字符串数组 / {equations:[...]}');
  const sid = await newSession();
  const r = await callTool('solve', { equations, ...opts }, sid);
  const result = r.result;
  if (!result) {
    const err = new Error('solve 无 result 字段：' + JSON.stringify(r));
    err.raw = r;
    throw err;
  }
  const text = result.content && result.content[0] && result.content[0].text;
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = { parseError: String(e), text }; }
  return { isError: !!result.isError, raw: result, data };
}

// 调用 pay（建单 / 自助入账）
async function pay(opts = {}) {
  const sid = await newSession();
  const r = await callTool('pay', opts, sid);
  const result = r.result;
  const text = result && result.content && result.content[0] && result.content[0].text;
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = { parseError: String(e), text }; }
  return { isError: result ? !!result.isError : true, raw: result, data };
}

// 线上健康态（HTTP GET，非 MCP）
async function health() {
  const url = ENDPOINT.replace(/\/mcp\/?$/, '') + '/health';
  const res = await fetch(url);
  return res.json();
}

module.exports = { solve, pay, health, callTool, newSession, ENDPOINT };
