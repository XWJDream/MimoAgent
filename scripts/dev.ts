import { spawn, ChildProcess } from 'child_process';
import { createServer } from 'vite';
import { join } from 'path';

async function main() {
  // Start Vite dev server
  const vite = await createServer({
    configFile: './vite.config.ts',
  });
  await vite.listen();
  const port = vite.config.server.port || 5173;
  const url = `http://localhost:${port}`;
  console.log(`Vite dev server: ${url}`);

  // Start Electron using npx
  const electron = spawn(
    'npx',
    ['electron', '.'],
    {
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        VITE_DEV_SERVER_URL: url,
      },
    }
  ) as ChildProcess;

  electron.on('close', () => {
    vite.close();
    process.exit(0);
  });
}

main().catch(console.error);
