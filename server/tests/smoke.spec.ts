import axios from 'axios';

const BASE = process.env.BASE_URL || process.env.TEST_BASE_URL || 'http://localhost:3000';

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