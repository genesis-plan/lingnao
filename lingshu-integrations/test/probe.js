// probe.js — 实测线上协议是否跑通（用免费路径 honorPaid，无需 key）
const { solve, health, ENDPOINT } = require('../src/lingshu-client');

(async () => {
  const log = [];
  try {
    const h = await health();
    log.push('[health] version=' + (h.version || h.serverVersion || '?') +
      ' metering=' + (h.metering) + ' tools=' + JSON.stringify(h.tools || []));
  } catch (e) {
    log.push('[health] FAIL ' + e.message);
  }

  const cases = [
    'x^2 - 2 = 0',           // 代数（超越根）
    'sin(x) - 0.5 = 0',      // 三角
    'exp(x) - 3 = 0',        // 超越
    '3*x + 5*y = 7, 2*x - y = 1', // 方程组
  ];
  for (const expr of cases) {
    try {
      const r = await solve(expr, { honorPaid: true });
      if (r.isError) {
        log.push('[solve] ' + expr + ' → ERROR: ' + JSON.stringify(r.data));
      } else {
        const d = r.data || {};
        log.push('[solve] ' + expr + ' → certified=' + d.certified +
          ' proven=' + (d.provenCount != null ? d.provenCount : '?') +
          ' n=' + (d.solutions ? d.solutions.length : 0));
      }
    } catch (e) {
      log.push('[solve] ' + expr + ' → EXCEPTION ' + e.message);
    }
  }

  const out = 'ENDPOINT=' + ENDPOINT + '\n' + log.join('\n') + '\n';
  require('fs').writeFileSync(__dirname + '/probe.out', out);
  console.log(out);
})();
