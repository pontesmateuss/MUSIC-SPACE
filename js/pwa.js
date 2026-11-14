/* Check for new application assets whenever the installed app opens. */
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
      .then(registration => registration.update())
      .catch(error => console.warn('Não foi possível atualizar o modo offline.', error));
  });
}

/* Browsers expose installation only where supported; standalone hides the CTA. */
(function () {
  const button = document.querySelector('#installApp');
  const standalone = matchMedia('(display-mode: standalone)');
  let promptEvent = null;
  const installedKey = 'musicspace.installed';
  function installed() {
    let remembered = false;
    try { remembered = localStorage.getItem(installedKey) === 'true'; } catch {}
    return standalone.matches || navigator.standalone === true || remembered;
  }
  function sync() { button.hidden = installed(); }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); promptEvent = event;
    // A new prompt means the browser considers this app installable again.
    try { localStorage.removeItem(installedKey); } catch {}
    sync();
  });
  window.addEventListener('appinstalled', () => {
    promptEvent = null;
    try { localStorage.setItem(installedKey, 'true'); } catch {}
    button.hidden = true;
  });
  standalone.addEventListener('change', sync);
  button.addEventListener('click', async () => {
    if (!promptEvent) { document.querySelector('#installHelp').showModal(); return; }
    const event = promptEvent; promptEvent = null;
    try { await event.prompt(); await event.userChoice; }
    catch { document.querySelector('#installHelp').showModal(); }
  });
  sync();
})();
