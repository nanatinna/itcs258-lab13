// Lab 14 CI check: the production selection must not publish the app or database to the host.
// (The Lab 13 pitfall: adding compose.local.yml to production would keep 127.0.0.1:8085.)
const { execFileSync } = require('node:child_process');
const files = ['-f', 'compose.yml', '-f', 'compose.production.yml', '-f', 'compose.proxy.yml'];
const config = JSON.parse(execFileSync('docker', ['compose', ...files, 'config', '--format', 'json'], { encoding: 'utf8' }));
let failed = 0;
for (const name of ['app', 'db']) {
  const ports = config.services[name]?.ports || [];
  const ok = ports.length === 0;
  console.log(`${ok ? 'PASS' : 'FAIL'}  production ${name} publishes no host port${ok ? '' : ': ' + JSON.stringify(ports)}`);
  if (!ok) failed++;
}
process.exit(failed ? 1 : 0);
