// 三面导出一致性测试（修复 #244 / #252）
//
// 内核 灵脑.html 是导出真源；lingnao.umd.js（浏览器/Node）与 lingnao-mcp.js（__exp）是分发面。
// 历史事故：UMD 白名单 EXPORT_NAMES 漂移，漏掉 disconnectLLM/selfVerify/reflect/ReflectionBuffer
// 以及证明模块 M1-M3，导致 <script>/require 部署者调不到（"M1-M4 已落地"在分发面不成立）；
// 且 MCP 的 _PROOF_MODULE 用 try/catch 静默吞缺失（#251），漂移时不报错。
//
// 本测试把三面逐一比对，任何一面「列了名却导出 undefined」即失败（fail-closed，不靠口头保证）：
//   · build-umd.js 的 EXPORT_NAMES 每个名字在 UMD 中必须是已定义导出（不是 undefined）
//   · 4 个曾被漏掉的符号 + 7 个证明模块名在 UMD 中必须齐备且为函数
//   · MCP 的 _PROOF_MODULE 每个名字在 UMD 中必须已定义（否则 #251 启动即抛）
const fs = require('fs');
const path = require('path');

const UMD = require('./lingnao.umd.js'); // Node 分支：vm 抽内核实跑
const umdKeys = new Set(Object.keys(UMD));

const buildSrc = fs.readFileSync(path.join(__dirname, 'build-umd.js'), 'utf8').replace(/\/\/[^\n]*/g, ''); // 剥行注释，避免注释里的 'getBody' 被当重名
const expBlock = buildSrc.match(/const EXPORT_NAMES\s*=\s*\[([\s\S]*?)\];/);
if (!expBlock) { console.log('EXPORT_NAMES_NOT_FOUND'); process.exit(1); }
const exportNames = (expBlock[1].match(/'([^']+)'/g) || []).map(function (s) { return s.slice(1, -1); });

const mcpSrc = fs.readFileSync(path.join(__dirname, 'lingnao-mcp.js'), 'utf8');
const pmBlock = mcpSrc.match(/_PROOF_MODULE\s*=\s*\[([\s\S]*?)\];/);
const proofModules = pmBlock ? (pmBlock[1].match(/'([^']+)'/g) || []).map(function (s) { return s.slice(1, -1); }) : [];

let pass = 0, fail = 0;
function ok(c, msg) { if (c) pass++; else { fail++; console.log('  FAIL: ' + msg); } }

// （1）EXPORT_NAMES 每个名字在 UMD 中必须是已定义导出（不是 undefined）
//     这是最危险的漂移方向：列了名、内核却没定义 ⇒ UMD 导出一个 undefined，部署者调用即崩。
let undefinedExports = [];
exportNames.forEach(function (n) {
  if (UMD[n] === undefined) undefinedExports.push(n);
});
ok(undefinedExports.length === 0, 'UMD 中不得有 undefined 导出（列名但内核未定义）：' + undefinedExports.join(','));

// （2）4 个曾被 UMD 漏掉的符号必须齐备且为函数/数组（修复 #244 回归）
['disconnectLLM', 'selfVerify', 'reflect', 'ReflectionBuffer'].forEach(function (n) {
  ok(UMD[n] !== undefined, 'UMD 应导出 ' + n + '（修复 #244 回归）');
  ok(typeof UMD[n] === 'function' || Array.isArray(UMD[n]), 'UMD.' + n + ' 应为函数/数组');
});

// （3）证明模块在分发面必须齐备（MCP 缺一则 #251 启动即抛）
//     注意：proveGateChain/certifySafetyInvariant/verdictThreeLayer/proveCompleteMediation 是函数；
//           GATE_SPEC/EffectGate/EFFECT_KINDS 是数据/对象——只要求「已定义导出」，不要求函数。
['proveGateChain', 'GATE_SPEC', 'certifySafetyInvariant', 'verdictThreeLayer',
 'proveCompleteMediation', 'EffectGate', 'EFFECT_KINDS'].forEach(function (n) {
  ok(UMD[n] !== undefined, 'UMD 应导出证明模块 ' + n);
});

// （4）MCP _PROOF_MODULE 每个名字在 UMD 中必须已定义（否则 MCP 启动抛 MCP_EXPORT_MISSING）
proofModules.forEach(function (n) {
  ok(UMD[n] !== undefined, 'MCP _PROOF_MODULE 名 "' + n + '" 在 UMD 中须已定义（否则 #251 启动即抛）');
});

// （5）信息性：UMD 导出数 = EXPORT_NAMES 去重数（构建报数须真实）
const uniq = exportNames.filter(function (n, i) { return exportNames.indexOf(n) === i; });
if (uniq.length !== exportNames.length) {
  console.log('  NOTE EXPORT_NAMES 存在重名 ' + (exportNames.length - uniq.length) + ' 个');
}
ok(umdKeys.size === uniq.length, 'UMD 导出数(' + umdKeys.size + ') 应等于 EXPORT_NAMES 去重数(' + uniq.length + ')');

console.log('=== test-export-faces === EXPORT_NAMES=' + uniq.length + '  UMD=' + umdKeys.size +
  '  证明模块=' + proofModules.length + '  通过 ' + pass + '  失败 ' + fail);
process.exit(fail ? 1 : 0);
