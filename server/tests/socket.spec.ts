import { io, Socket } from 'socket.io-client';

const BASE = process.env.BASE_URL || process.env.TEST_BASE_URL || 'http://localhost:3000';

describe('Socket smoke tests', () => {
  jest.setTimeout(20000);

  test('should reject unauthenticated socket connections', (done) => {
    const socket: Socket = io(BASE, {
      autoConnect: true,
      reconnection: false,
      timeout: 2000,
    } as any);

    let handled = false;

    socket.on('connect', () => {
      handled = true;
      socket.disconnect();
      done(new Error('Socket should not connect without auth token'));
    });

    socket.on('connect_error', (err: any) => {
      if (handled) return;
      handled = true;
      expect(err).toBeDefined();
      socket.close();
      done();
    });

    // safety fallback
    setTimeout(() => {
      if (!handled) {
        socket.close();
        done(new Error('Socket connection did not error within timeout'));
      }
    }, 5000);
  });
});