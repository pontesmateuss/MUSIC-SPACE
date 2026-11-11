const $ = selector => document.querySelector(selector);
const motion = $('#motion-toggle');
function setPaused(paused) {
  document.body.classList.toggle('motion-paused', paused);
  motion.setAttribute('aria-pressed', String(paused));
  motion.setAttribute('aria-label', paused ? 'Retomar animações' : 'Pausar animações');
  motion.title = motion.getAttribute('aria-label');
}
try { setPaused(localStorage.getItem('music-space-motion-paused') === 'true'); } catch { /* Storage is optional. */ }
motion.addEventListener('click', () => { const paused = !document.body.classList.contains('motion-paused'); setPaused(paused); try { localStorage.setItem('music-space-motion-paused', String(paused)); } catch { /* Storage is optional. */ } });
