import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import process from 'node:process';
import electronPath from 'electron';

const server = await createServer({ configFile: 'vite.config.mjs' });
await server.listen();
const url = server.resolvedUrls.local[0].replace(/\/$/, '');
console.log(`\n  Vite ready: ${url}\n`);

const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: url, NODE_ENV: 'development' },
});

child.on('close', async () => {
  await server.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  child.kill();
  process.exit(0);
});
