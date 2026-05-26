import { state, els, getSearchDebounceTimer, setSearchDebounceTimer } from './state.js';
import { showError } from './utils.js';
import { setActiveView, renderMerchants, renderDetail, showImageViewer, closeImageViewer } from './render.js';
import { loadMerchants, selectMerchant, backToFood, openMerchantUpload, cancelMerchantUploadPage, handleMerchantUpload, handleMerchantCoverChange } from './merchant.js';
import { reportReview, writeReview, handleConfirmReview, submitFeedback, updateStarDisplay } from './review.js';
import { openAuthDialog, isAdmin } from './supabase.js';
import { loadCurrentUser, logout, openEditProfile, handleConfirmLogin, handleConfirmRegister, handleConfirmEditProfile, handleAvatarUpload } from './auth.js';
import { renderAdmin, renderAdminPendingMerchants, renderAdminReportedReviews, renderAdminMerchantList, renderAdminMerchantDetail, deleteMerchant, saveMerchantName, saveMerchantLocation, updateMerchantCover, approveMerchant, rejectMerchant, hideReview, dismissReports, uploadMerchantImage, deleteMerchantImage, selectAdminMerchant, filterAdminMerchants, showEditMerchantName, cancelEditMerchantName, showEditMerchantLocation, cancelEditMerchantLocation, openAdminWorkbench } from './admin.js';

const actionHandlers = {
  selectMerchant: (el) => selectMerchant(el.dataset.merchantId),
  backToFood: () => backToFood(),
  showImageViewer: (el) => showImageViewer(el.dataset.imageSrc),
  closeImageViewer: () => closeImageViewer(),
  reportReview: (el) => reportReview(el.dataset.reviewId),
  writeReview: () => writeReview(),
  openAuthDialog: () => openAuthDialog(),
  openMerchantUpload: () => openMerchantUpload(),
  openEditProfile: () => openEditProfile(),
  submitFeedback: () => submitFeedback(),
  logout: () => logout(),
  openAdminWorkbench: () => openAdminWorkbench(),
  setViewProfile: () => setActiveView('profile'),
  renderAdmin: () => renderAdmin(),
  renderAdminPendingMerchants: () => renderAdminPendingMerchants(),
  renderAdminReportedReviews: () => renderAdminReportedReviews(),
  renderAdminMerchantList: () => renderAdminMerchantList(),
  selectAdminMerchant: (el) => selectAdminMerchant(el.dataset.merchantId),
  deleteMerchant: (el) => deleteMerchant(el.dataset.merchantId),
  approveMerchant: (el) => approveMerchant(el.dataset.merchantId),
  rejectMerchant: (el) => rejectMerchant(el.dataset.merchantId),
  hideReview: (el) => hideReview(el.dataset.reviewId),
  dismissReports: (el) => dismissReports(el.dataset.reviewId),
  deleteMerchantImage: (el) => deleteMerchantImage(el.dataset.merchantId, el.dataset.imageUrl),
  showEditMerchantName: (el) => showEditMerchantName(el.dataset.merchantId, el.dataset.currentName),
  cancelEditMerchantName: () => cancelEditMerchantName(),
  saveMerchantName: (el) => saveMerchantName(el.dataset.merchantId),
  showEditMerchantLocation: () => showEditMerchantLocation(),
  cancelEditMerchantLocation: () => cancelEditMerchantLocation(),
  saveMerchantLocation: (el) => saveMerchantLocation(el.dataset.merchantId),
  updateMerchantCover: (el) => updateMerchantCover(el.dataset.merchantId, el),
  uploadMerchantImage: (el) => uploadMerchantImage(el.dataset.merchantId, el),
  filterAdminMerchants: (el) => filterAdminMerchants(el.value),
  cancelMerchantUploadPage: () => cancelMerchantUploadPage(),
};

export function setupEventDelegation() {
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (actionHandlers[action]) {
      e.preventDefault();
      actionHandlers[action](target);
    }
  });

  document.addEventListener('input', (e) => {
    if (e.target.dataset.action === 'filterAdminMerchants') {
      filterAdminMerchants(e.target.value);
    }
  });

  document.addEventListener('change', (e) => {
    const action = e.target.dataset.action;
    if (action === 'updateMerchantCover' || action === 'uploadMerchantImage') {
      if (actionHandlers[action]) actionHandlers[action](e.target);
    }
  });

  els.locationSelect.addEventListener('change', (event) => {
    state.currentLocation = event.target.value;
    renderMerchants();
  });

  if (els.ratingSortSelect) {
    els.ratingSortSelect.addEventListener('change', (event) => {
      state.ratingSort = event.target.value;
      renderMerchants();
    });
  }

  els.searchInput.addEventListener('input', (event) => {
    state.search = event.target.value;
    const currentTimer = getSearchDebounceTimer();
    if (currentTimer) clearTimeout(currentTimer);
    setSearchDebounceTimer(setTimeout(() => {
      renderMerchants();
    }, 300));
  });

  els.foodTabButton.addEventListener('click', () => setActiveView('food'));
  els.marketTabButton.addEventListener('click', () => setActiveView('market'));
  els.profileTabButton.addEventListener('click', () => setActiveView('profile'));

  els.confirmLogin.addEventListener('click', handleConfirmLogin);

  els.confirmRegister.addEventListener('click', handleConfirmRegister);

  els.uploadMerchantCoverPage.addEventListener('change', handleMerchantCoverChange);

  els.confirmMerchantUploadPage.addEventListener('click', handleMerchantUpload);

  els.confirmReview.addEventListener('click', handleConfirmReview);

  els.confirmEditProfile.addEventListener('click', handleConfirmEditProfile);

  els.openRegisterButton.addEventListener('click', () => {
    els.authDialog.close();
    els.registerDialog.showModal();
  });

  els.forgotPasswordButton.addEventListener('click', () => {
    els.authDialog.close();
    els.forgotPasswordDialog.showModal();
  });

  document.addEventListener('change', async (event) => {
    if (event.target.id !== 'avatarInput') return;
    await handleAvatarUpload(event);
  });

  document.addEventListener('DOMContentLoaded', () => {
    const ratingSelector = document.getElementById('ratingSelector');
    if (ratingSelector) {
      ratingSelector.addEventListener('click', (e) => {
        const star = e.target.closest('span');
        if (star) {
          const value = parseInt(star.dataset.value, 10);
          els.reviewRating.value = value;
          updateStarDisplay(value);
        }
      });
    }
  });

  function initMarketPinchZoom() {
    const svg = document.getElementById('marketSvg');
    if (!svg) return;

    let scale = 1;
    let lastDist = 0;

    function getDistance(t1, t2) {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.hypot(dx, dy);
    }

    svg.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        lastDist = getDistance(e.touches[0], e.touches[1]);
      }
    }, { passive: true });

    svg.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = getDistance(e.touches[0], e.touches[1]);
        const delta = dist / lastDist;
        scale = Math.min(5, Math.max(0.5, scale * delta));
        svg.style.transform = `scale(${scale})`;
        lastDist = dist;
      }
    }, { passive: false });

    svg.addEventListener('touchend', () => {
      lastDist = 0;
    });
  }

  initMarketPinchZoom();

  window.addEventListener('beforeunload', () => {
    const timer = getSearchDebounceTimer();
    if (timer) {
      clearTimeout(timer);
      setSearchDebounceTimer(null);
    }
    const toast = document.getElementById('errorToast');
    if (toast && toast._timeout) {
      clearTimeout(toast._timeout);
    }
    const loader = document.getElementById('globalLoader');
    if (loader) {
      loader.remove();
    }
  });
}
