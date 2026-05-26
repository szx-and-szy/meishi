import { state } from './js/state.js';
import { setupEventDelegation } from './js/events.js';
import { renderLocationOptions, renderRatingSortOptions, renderProfile, renderDetail, setActiveView } from './js/render.js';
import { loadCurrentUser } from './js/auth.js';
import { loadMerchants } from './js/merchant.js';
import { renderAdmin } from './js/admin.js';

async function init() {
  setupEventDelegation();
  renderLocationOptions();
  renderRatingSortOptions();
  renderProfile();
  renderAdmin();
  setActiveView(state.activeView);
  await loadCurrentUser();
  await loadMerchants();
  renderDetail();

  const splash = document.getElementById('splashScreen');
  if (splash) {
    splash.classList.add('fade-out');
    splash.addEventListener('transitionend', () => splash.remove());
  }
}

init();
