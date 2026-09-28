// introspect.js — 看清 solve 返回结构 + 验证方程组分元素传参
const { solve } = require('../src/lingshu-client');
const fs = require('fs');

(async () => {
  const log = [];
  // 1) 完整结构
  const r1 = await solve('x^2 - 2 = 0', { honorPaid: true });
  log.push('=== x^2-2=0 完整 data ===');
  log.push(JSON.stringify(r1.data, null, 2).slice(0, 1500));

  // 2) 方程组：整串单元素 vs 分元素
  const whole = await solve('3*x + 5*y = 7, 2*x - y = 1', { honorPaid: true });
  log.push('=== 整串单元素 === certified=' + whole.data.certified + ' n=' + (whole.data.solutions ? whole.data.solutions.length : 0));
  const split = await solve(['3*x + 5*y = 7', '2*x - y = 1'], { honorPaid: true });
  log.push('=== 分元素数组 === certified=' + split.data.certified + ' n=' + (split.data.solutions ? split.data.solutions.length : 0));
  if (split.data.solutions) log.push(JSON.stringify(split.data.solutions.slice(0, 3)));

  // 3) 字段名探测
  const d = r1.data || {};
  log.push('=== 顶层字段 === ' + Object.keys(d).join(', '));
  fs.writeFileSync(__dirname + '/introspect.out', log.join('\n') + '\n');
  console.log(log.join('\n'));
})();
