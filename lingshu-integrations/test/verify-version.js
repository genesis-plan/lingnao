const { solve } = require('../src/lingshu-client');
(async () => {
  const r = await solve(['3*x+5*y=7', '2*x-y=1'], { honorPaid: true });
  const d = r.data || {};
  const diag = d.diagnostics || {};
  console.log(JSON.stringify({
    isError: r.isError,
    solverVersion: diag.solverVersion,
    certified: d.certified,
    solutionCount: d.solutionCount,
    provenCount: diag.provenCount
  }, null, 2));
})().catch(e => { console.error('ERR', e && e.message); process.exit(1); });
