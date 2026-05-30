import { createServer, IncomingMessage, ServerResponse } from 'http';

const audioStore = new Map<string, Buffer>();
let server: ReturnType<typeof createServer> | null = null;
let serverPort = 0;

function startServer(): Promise<number> {
  return new Promise((resolve) => {
    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const id = req.url?.replace('/', '');
      const buf = id ? audioStore.get(id) : undefined;
      if (!buf) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'audio/wav',
        'Content-Length': buf.length,
        'Access-Control-Allow-Origin': '*',
      });
      res.end(buf);
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server!.address();
      serverPort = typeof addr === 'object' && addr ? addr.port : 0;
      resolve(serverPort);
    });
  });
}

export async function storeAudio(wavBuffer: Buffer): Promise<string> {
  if (!server) await startServer();
  const id = `tts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  audioStore.set(id, wavBuffer);
  return `http://127.0.0.1:${serverPort}/${id}`;
}
