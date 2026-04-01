/**
 * 🤖 MINND Test Auto-Fill Bot
 * Usage : coller dans la console sur /test/pma/pass/[testId]
 * Arrêter : window.BOT = false
 */

window.BOT = true;

function pickAnswer() {
  return Math.floor(Math.random() * 5) + 5; // 5, 6, 7, 8 ou 9
}

function isSaving() {
  return !!document.querySelector('.pointer-events-none');
}

function clickNext() {
  if (!window.BOT) {
    console.log('🛑 Bot arrêté');
    return;
  }

  if (isSaving()) {
    setTimeout(clickNext, 150);
    return;
  }

  const val = pickAnswer();
  const btn = document.querySelector(`button[aria-label="${val}"]`);

  if (!btn) {
    console.log('✅ Bot terminé — test complété ou page changée');
    window.BOT = false;
    return;
  }

  const progress = document.querySelector('.text-muted-foreground');
  console.log(`🤖 ${progress ? progress.textContent : ''} → réponse ${val}`);
  btn.click();

  setTimeout(clickNext, 300);
}

console.log('🤖 Bot démarré | Arrêter : window.BOT = false');
setTimeout(clickNext, 500);
