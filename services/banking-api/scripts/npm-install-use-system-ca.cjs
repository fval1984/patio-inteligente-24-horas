/**
 * Repassa NODE_OPTIONS=--use-system-ca ao npm (útil em Windows com proxy/CA extra).
 * Node 22+: ver https://nodejs.org/api/cli.html#--use-system-ca
 */
const { spawnSync } = require('child_process');
const prior = process.env.NODE_OPTIONS || '';
const merged = prior.includes('use-system-ca')
  ? prior
  : `${prior} --use-system-ca`.trim();
const env = { ...process.env, NODE_OPTIONS: merged };
const extra = process.argv.slice(2);
const r = spawnSync('npm', ['install', ...extra], { stdio: 'inherit', shell: true, env });
process.exit(r.status === null ? 1 : r.status);
