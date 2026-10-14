import { spawnSync } from 'node:child_process';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv({ path: path.join(root, '.env') });
loadEnv({ path: path.resolve(root, '../../apps/api-pgm/.env') });

const databaseURL = process.env.DATABASE_URL || '';
if (!databaseURL) {
  console.error('DATABASE_URL tidak ditemukan. Isi packages/shared-pgm/.env atau apps/api-pgm/.env.');
  process.exit(1);
}

let name = '';
try {
  const parsed = new URL(databaseURL);
  name = decodeURIComponent(parsed.pathname.replace(/^\//, '').split('?')[0] || '');
} catch {
  console.error('DATABASE_URL tidak valid');
  process.exit(1);
}

if (!name || name === 'aisi_db' || name === 'dakwah_db') {
  console.error(
    `Tolak database "${name || '(kosong)'}". Perintah PGM tidak boleh memakai database AISI (aisi_db / dakwah_db).`,
  );
  process.exit(1);
}

console.log(`Database PGM: ${name}`);

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Perintah sesudah pengecekan database kosong.');
  process.exit(1);
}

const result = spawnSync(args[0], args.slice(1), {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
