#!/usr/bin/env node
/**
 * Angular CLI launcher.
 *
 * This project is on Angular 8 / webpack 4, which hashes modules with MD4.
 * OpenSSL 3 (bundled with Node 17+) removed MD4 from the default provider, so a
 * plain `ng serve` dies with ERR_OSSL_EVP_UNSUPPORTED. Re-enabling the legacy
 * provider is the documented workaround and only affects webpack's internal
 * build hashing -- no application code uses it.
 *
 * Done here rather than inline in package.json so the scripts work on Windows
 * too, where `FOO=bar cmd` is not valid shell syntax.
 */
const { spawn } = require('child_process');
const path = require('path');

const LEGACY_FLAG = '--openssl-legacy-provider';
const [major] = process.versions.node.split('.').map(Number);

const env = Object.assign({}, process.env);
if (major >= 17 && (env.NODE_OPTIONS || '').indexOf(LEGACY_FLAG) === -1) {
  env.NODE_OPTIONS = (env.NODE_OPTIONS ? env.NODE_OPTIONS + ' ' : '') + LEGACY_FLAG;
}

const ng = path.join(__dirname, '..', 'node_modules', '@angular', 'cli', 'bin', 'ng');
const child = spawn(process.execPath, [ng].concat(process.argv.slice(2)), {
  stdio: 'inherit',
  env
});

child.on('exit', (code, signal) => {
  if (signal) { process.kill(process.pid, signal); return; }
  process.exit(code === null ? 1 : code);
});
