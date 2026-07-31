#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

function run(args) {
  return spawnSync('docker', args, { stdio: 'inherit', shell: true });
}

function dockerInfo() {
  return spawnSync('docker', ['info'], { encoding: 'utf8', shell: true });
}

const info = dockerInfo();
if (info.status !== 0) {
  console.error(`
Docker daemon tidak berjalan.

Buka Docker Desktop, tunggu sampai status "Running", lalu ulangi:
  pnpm dev:restart

Cek cepat: docker info
`);
  process.exit(1);
}

let result = run(['compose', 'up', 'db', '-d', '--wait']);
if (result.status !== 0) {
  console.warn('docker compose --wait gagal; fallback tanpa --wait');
  result = run(['compose', 'up', 'db', '-d']);
  if (result.status !== 0) process.exit(result.status ?? 1);
  await sleep(3000);
}

process.exit(0);
