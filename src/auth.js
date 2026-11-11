const $ = selector => document.querySelector(selector);
const dialog = $('#account-dialog');
let user = null;
let googleReady;
let loading = false;
async function api(path, body) {
  const response = await fetch(`/api/auth/${path}`, { cache: 'no-store', ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível conectar.');
  return data;
}
function renderUser(value) {
  user = value;
  $('#account-button').textContent = user?.name || 'Entrar';
  $('#account-button').setAttribute('aria-label', user ? `Abrir conta de ${user.name}` : 'Entrar com Google');
  $('#account-logout').hidden = !user;
  $('#google-button').hidden = !!user;
  $('#account-status').textContent = user ? `Conectado como ${user.email}.` : '';
}
function loadGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!googleReady) googleReady = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => fail(), 15000);
    function fail() { clearTimeout(timer); script.remove(); googleReady = null; reject(new Error('Não foi possível carregar o Google. Verifique sua conexão e tente novamente.')); }
    script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
    script.onload = () => { clearTimeout(timer); resolve(); }; script.onerror = fail;
    document.head.append(script);
  });
  return googleReady;
}
async function signIn() {
  if (loading || user) return;
  loading = true; $('#account-retry').hidden = true;
  $('#account-status').textContent = 'Preparando conexão com Google…';
  try {
    const { clientId } = await api('config');
    if (!clientId) { $('#account-status').textContent = 'O login com Google estará disponível quando a configuração do aplicativo for concluída. Você pode continuar ouvindo sem conta.'; return; }
    await loadGoogle();
    window.google.accounts.id.initialize({ client_id: clientId, auto_select: false, callback: async ({ credential }) => {
      $('#account-status').textContent = 'Verificando sua conta…';
      try { renderUser((await api('google', { credential })).user); }
      catch (error) { $('#account-status').textContent = error.message; }
    } });
    $('#google-button').replaceChildren();
    window.google.accounts.id.renderButton($('#google-button'), { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'pt-BR' });
    $('#account-status').textContent = 'Escolha sua conta para continuar.';
  } catch { $('#account-status').textContent = 'Login indisponível. Verifique sua conexão e tente novamente. Sua biblioteca local continua disponível.'; $('#account-retry').hidden = false; }
  finally { loading = false; }
}
$('#account-button').addEventListener('click', () => { dialog.showModal(); signIn(); });
$('#account-close').addEventListener('click', () => dialog.close());
$('#account-retry').addEventListener('click', signIn);
$('#account-logout').addEventListener('click', async () => {
  try { await api('logout', {}); window.google?.accounts.id.disableAutoSelect(); renderUser(null); await signIn(); }
  catch { $('#account-status').textContent = 'Não foi possível sair. Verifique sua conexão e tente novamente.'; }
});
api('session').then(data => renderUser(data.user)).catch(() => {});
const motion = $('#motion-toggle');
function setPaused(paused) {
  document.body.classList.toggle('motion-paused', paused);
  motion.setAttribute('aria-pressed', String(paused));
  motion.setAttribute('aria-label', paused ? 'Retomar animações' : 'Pausar animações');
  motion.title = motion.getAttribute('aria-label');
}
try { setPaused(localStorage.getItem('music-space-motion-paused') === 'true'); } catch { /* Storage is optional. */ }
motion.addEventListener('click', () => { const paused = !document.body.classList.contains('motion-paused'); setPaused(paused); try { localStorage.setItem('music-space-motion-paused', String(paused)); } catch { /* Storage is optional. */ } });
