import axios from 'axios';
import { createServer } from 'http';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

// Import only the Express app, not the full start() bootstrap
// (avoids needing a live DB/Redis in CI for these endpoint checks)
import { app } from '../src/server';

let server: Server;
let BASE: string;

beforeAll(async () => {
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  BASE = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  );
});

describe('Smoke tests - HTTP endpoints', () => {
  jest.setTimeout(20000);

  test('GET /health responds with status ok', async () => {
    const res = await axios.get(`${BASE}/health`, { timeout: 5000 });
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('status', 'ok');
    expect(res.data).toHaveProperty('timestamp');
  });

  test('GET /metrics responds with metrics object', async () => {
    const res = await axios.get(`${BASE}/metrics`, { timeout: 5000 });
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('requests');
    expect(res.data).toHaveProperty('activeWebSocketConnections');
  });
});