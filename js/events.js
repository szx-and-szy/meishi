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
    const panel = document.getElementById('marketPanel');
    if (!svg || !panel) return;

    const MIN_SCALE = 0.5;
    const MAX_SCALE = 5;
    const ZOOM_STEP = 1.25;

    let scale = 1;
    let translateX = 0;
    let translateY = 0;

    let initialDistance = 0;
    let initialScale = 1;
    let initialCenterX = 0;
    let initialCenterY = 0;
    let initialTranslateX = 0;
    let initialTranslateY = 0;

    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;

    function applyTransform(smooth) {
      if (smooth) {
        svg.style.transition = 'transform 0.15s ease-out';
      } else {
        svg.style.transition = 'none';
      }
      svg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    }

    function getDistance(touches) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function getCenter(touches) {
      return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2,
      };
    }

    panel.addEventListener('touchstart', (e) => {
      if (e.touches.length >= 2) e.preventDefault();
    }, { passive: false });

    panel.addEventListener('touchmove', (e) => {
      if (e.touches.length >= 2) e.preventDefault();
    }, { passive: false });

    svg.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        initialDistance = getDistance(e.touches);
        initialScale = scale;
        const center = getCenter(e.touches);
        initialCenterX = center.x;
        initialCenterY = center.y;
        initialTranslateX = translateX;
        initialTranslateY = translateY;
        isDragging = false;
      } else if (e.touches.length === 1) {
        isDragging = true;
        dragStartX = e.touches[0].clientX;
        dragStartY = e.touches[0].clientY;
        initialTranslateX = translateX;
        initialTranslateY = translateY;
      }
    }, { passive: false });

    svg.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const currentDistance = getDistance(e.touches);
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, initialScale * (currentDistance / initialDistance)));
        const center = getCenter(e.touches);
        const scaleRatio = newScale / initialScale;
        translateX = scaleRatio * initialTranslateX + (1 - scaleRatio) * initialCenterX + (center.x - initialCenterX);
        translateY = scaleRatio * initialTranslateY + (1 - scaleRatio) * initialCenterY + (center.y - initialCenterY);
        scale = newScale;
        applyTransform(false);
      } else if (e.touches.length === 1 && isDragging) {
        const deltaX = e.touches[0].clientX - dragStartX;
        const deltaY = e.touches[0].clientY - dragStartY;
        translateX = initialTranslateX + deltaX;
        translateY = initialTranslateY + deltaY;
        applyTransform(false);
      }
    }, { passive: false });

    svg.addEventListener('touchend', () => {
      isDragging = false;
    });

    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor));
      const rect = svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const scaleRatio = newScale / scale;
      translateX = mouseX - scaleRatio * (mouseX - translateX);
      translateY = mouseY - scaleRatio * (mouseY - translateY);
      scale = newScale;
      applyTransform(false);
    }, { passive: false });

    const zoomInBtn = document.getElementById('marketZoomIn');
    const zoomOutBtn = document.getElementById('marketZoomOut');
    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => {
        const newScale = Math.min(MAX_SCALE, scale * ZOOM_STEP);
        const scaleRatio = newScale / scale;
        const rect = svg.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        translateX = cx - scaleRatio * (cx - translateX);
        translateY = cy - scaleRatio * (cy - translateY);
        scale = newScale;
        applyTransform(true);
      });
    }
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => {
        const newScale = Math.max(MIN_SCALE, scale / ZOOM_STEP);
        const scaleRatio = newScale / scale;
        const rect = svg.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        translateX = cx - scaleRatio * (cx - translateX);
        translateY = cy - scaleRatio * (cy - translateY);
        scale = newScale;
        applyTransform(true);
      });
    }
  }

  initMarketPinchZoom();

  function initMarketBlockNumbers() {
    const svg = document.getElementById('marketSvg');
    if (!svg) return;
    const rects = Array.from(svg.querySelectorAll('rect'));
    const sorted = rects.slice().sort((a, b) => {
      const ay = parseFloat(a.getAttribute('y'));
      const by = parseFloat(b.getAttribute('y'));
      const ax = parseFloat(a.getAttribute('x'));
      const bx = parseFloat(b.getAttribute('x'));
      if (ay !== by) return ay - by;
      return ax - bx;
    });
    sorted.forEach((rect, i) => {
      const x = parseFloat(rect.getAttribute('x'));
      const y = parseFloat(rect.getAttribute('y'));
      const w = parseFloat(rect.getAttribute('width'));
      const h = parseFloat(rect.getAttribute('height'));
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x + w / 2);
      text.setAttribute('y', y + h / 2);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('font-size', '36');
      text.setAttribute('fill', '#6b7280');
      text.setAttribute('pointer-events', 'none');
      text.textContent = i + 1;
      svg.appendChild(text);
    });
  }

  initMarketBlockNumbers();

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
