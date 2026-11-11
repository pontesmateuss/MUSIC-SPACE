import { randomBytes } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';

export function createAuthHandler({ clientId = process.env.GOOGLE_CLIENT_ID, origin = process.env.APP_ORIGIN, verify, now = Date.now } = {}) {
  const client = new OAuth2Client(clientId);
  const sessions = new Map();
  const lifetime = 8 * 60 * 60 * 1000;
  const verifyToken = verify || (async credential => (await client.verifyIdToken({ idToken: credential, audience: clientId })).getPayload());
  return async (req, res, pathname) => {
    if (!pathname.startsWith('/api/')) return false;
    const send = (status, body, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }); res.end(JSON.stringify(body)); return true; };
    const expectedOrigin = origin || 'http://localhost:4173';
    const secure = expectedOrigin.startsWith('https://');
    const cookieName = secure ? '__Host-music_space_session' : 'music_space_session';
    const cookie = value => `${cookieName}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${value ? lifetime / 1000 : 0}${secure ? '; Secure' : ''}`;
    const id = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    for (const [key, value] of sessions) if (value.expires <= now()) sessions.delete(key);
    if (pathname === '/api/auth/config' && req.method === 'GET') return send(200, { clientId: clientId || null });
    if (pathname === '/api/auth/session' && req.method === 'GET') return send(200, { user: sessions.get(id)?.user || null });
    if (!['/api/auth/google', '/api/auth/logout'].includes(pathname)) return send(404, { error: 'Rota não encontrada.' });
    if (req.method !== 'POST') return send(405, { error: 'Método inválido.' });
    if (req.headers.origin !== expectedOrigin || req.headers['content-type']?.split(';')[0] !== 'application/json') return send(403, { error: 'Origem da solicitação inválida.' });
    if (pathname.endsWith('/logout')) { sessions.delete(id); return send(200, { user: null }, { 'Set-Cookie': cookie('') }); }
    if (!clientId) return send(503, { error: 'O login Google ainda não foi configurado.' });
    try {
      let body = '';
      for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 16384) return send(413, { error: 'Solicitação muito grande.' }); }
      const { credential } = JSON.parse(body);
      if (typeof credential !== 'string' || !credential) return send(400, { error: 'Credencial ausente.' });
      const payload = await verifyToken(credential);
      if (!payload?.sub || !payload.email_verified) return send(401, { error: 'Conta Google não verificada.' });
      const user = { id: payload.sub, name: payload.name || 'Sua conta', email: payload.email };
      sessions.delete(id);
      if (sessions.size >= 10000) return send(503, { error: 'Tente novamente em alguns minutos.' });
      const sessionId = randomBytes(32).toString('hex');
      sessions.set(sessionId, { user, expires: now() + lifetime });
      return send(200, { user }, { 'Set-Cookie': cookie(sessionId) });
    } catch { return send(401, { error: 'Não foi possível validar o login. Tente novamente.' }); }
  };
}
