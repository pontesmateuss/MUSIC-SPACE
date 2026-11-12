/* Check for new application assets whenever the installed app opens. */
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
      .then(registration => registration.update())
      .catch(error => console.warn('Não foi possível atualizar o modo offline.', error));
  });
}
