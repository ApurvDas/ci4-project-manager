// Serves a stamped copy of web/ on :8124, exactly as the deploy builds it, so the service worker
// registers (it never does in plain local dev). The offline test runs against this.
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';

const dir = mkdtempSync(join(tmpdir(), 'pm-stamped-')).replaceAll('\\', '/'); // bash wants forward slashes
cpSync('web', dir, { recursive: true });
execFileSync('bash', ['scripts/stamp-version.sh', dir, 'e2e'], { stdio: 'inherit' });

const server = spawn(process.execPath, ['node_modules/http-server/bin/http-server', dir, '-p', '8124', '-c-1', '-s'], { stdio: 'inherit' });
const stop = () => { server.kill(); rmSync(dir, { recursive: true, force: true }); process.exit(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
