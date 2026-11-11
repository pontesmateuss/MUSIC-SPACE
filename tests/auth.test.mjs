import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createAuthHandler } from '../scripts/auth.mjs';

test('Google session: origin protection, verification, cookie, expiry and logout', async t => {
  let time = Date.now();
  const handler = createAuthHandler({ clientId: 'test-client', origin: 'http://localhost', now: () => time, verify: async token => {
    if (token !== 'valid') throw new Error('Invalid token');
    return { sub: '123', name: 'Pessoa', email: 'test@example.com', email_verified: true };
  } });
  const server = http.createServer((req, res) => handler(req, res, req.url));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/auth/`;
  const post = (path, token, cookie, origin = 'http://localhost') => fetch(base + path, { method: 'POST', headers: { origin, 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify({ credential: token }) });
  assert.equal((await post('google', 'valid', null, 'https://attacker.test')).status, 403);
  assert.equal((await post('google', 'invalid')).status, 401);
  const login = await post('google', 'valid');
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly; SameSite=Lax/);
  const session = () => fetch(base + 'session', { headers: { cookie } }).then(r => r.json());
  assert.equal((await session()).user.id, '123');
  assert.equal((await post('logout', '', cookie)).status, 200);
  assert.equal((await session()).user, null);
  const login2 = await post('google', 'valid');
  time += 9 * 60 * 60 * 1000;
  assert.equal((await (await fetch(base + 'session', { headers: { cookie: login2.headers.get('set-cookie') } })).json()).user, null);
});
