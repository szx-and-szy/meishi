import { state, els } from './state.js';
import { LOCATIONS, STAR_SVG, RATING_SORT_OPTIONS, FALLBACK_COVER } from './constants.js';
import { escapeHtml } from './utils.js';
import { merchantSummary, getFilteredMerchants } from './scoring.js';
import { isAdmin } from './supabase.js';

export function setActiveView(view) {
  state.activeView = view;
  const isFoodView = view === 'food';
  const isDetailView = view === 'detail';
  const isMarketView = view === 'market';
  const isProfileView = view === 'profile';
  const isAdminView = view === 'admin';
  const isUploadMerchantView = view === 'uploadMerchant';
  const showFoodChrome = isFoodView;
  const showProfileTab = isProfileView || isAdminView;
  const showMarketTab = isMarketView;

  els.topbar.classList.toggle('is-hidden', !showFoodChrome);
  els.foodView.classList.toggle('is-hidden', !isFoodView);
  els.marketView.classList.toggle('is-hidden', !isMarketView);
  els.detailView.classList.toggle('is-hidden', !isDetailView);
  els.profileView.classList.toggle('is-hidden', !isProfileView);
  els.adminView.classList.toggle('is-hidden', !isAdminView);
  els.uploadMerchantView.classList.toggle('is-hidden', !isUploadMerchantView);
  els.searchInput.classList.toggle('is-hidden', !showFoodChrome);
  els.foodTabButton.classList.toggle('active', isFoodView || isDetailView || isUploadMerchantView);
  els.marketTabButton.classList.toggle('active', showMarketTab);
  els.profileTabButton.classList.toggle('active', showProfileTab);

  if (els.navSlider) {
    els.navSlider.classList.remove('pos-1', 'pos-2');
    if (showMarketTab) {
      els.navSlider.classList.add('pos-1');
    } else if (showProfileTab) {
      els.navSlider.classList.add('pos-2');
    }
  }
}

export function showImageViewer(imageSrc) {
  if (!els.imageViewerDialog || !els.imageViewerImage) return;
  els.imageViewerImage.src = imageSrc;
  els.imageViewerDialog.showModal();
}

export function closeImageViewer() {
  if (!els.imageViewerDialog) return;
  els.imageViewerDialog.close();
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    setTimeout(() => {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes');
    }, 10);
  }
}

export function renderLocationOptions() {
  els.locationSelect.innerHTML = LOCATIONS.map((location) => `<option value="${location}">${location}</option>`).join('');
  els.locationSelect.value = state.currentLocation;
}

export function renderRatingSortOptions() {
  if (!els.ratingSortSelect) return;
  els.ratingSortSelect.innerHTML = RATING_SORT_OPTIONS.map((option) => `<option value="${option.value}">${option.label}</option>`).join('');
  els.ratingSortSelect.value = state.ratingSort;
}

export function renderMerchants() {
  const filtered = getFilteredMerchants();
  if (!filtered.length) {
    els.merchantList.innerHTML = '<div class="card empty-state">当前条件下暂无商家。</div>';
    return;
  }

  els.merchantList.innerHTML = filtered
    .map(
      (merchant) => `
        <article class="merchant-card" data-action="selectMerchant" data-merchant-id="${merchant.id}">
          <img src="${escapeHtml(merchant.cover)}" alt="${escapeHtml(merchant.name)} 封面图" loading="lazy" onerror="this.src='${FALLBACK_COVER}'" />
          <div class="merchant-content">
            <div class="section-heading">
              <h3>${escapeHtml(merchant.name)}</h3>
              <span class="rating"><span class="rating-star">${STAR_SVG}</span>${merchant.reviewCount > 0 ? merchant.displayScore.toFixed(1) : '暂无评分'}</span>
            </div>
            <div class="merchant-meta">
              <span>${escapeHtml(merchant.location)}</span>
              <span>${merchant.reviewCount} 条评价</span>
            </div>
            <button class="primary" data-action="selectMerchant" data-merchant-id="${merchant.id}">查看详情</button>
          </div>
        </article>
      `,
    )
    .join('');
}

export function renderPhotoStrip(images, merchantName, editable = false, merchantId = '') {
  if (!images.length) return '';
  return `<div class="photo-strip">${images
    .map((image, index) => {
      const imgTag = `<img src="${escapeHtml(image)}" alt="${escapeHtml(merchantName)} 图片 ${index + 1}" loading="lazy" data-action="showImageViewer" data-image-src="${escapeHtml(image)}" onerror="this.style.display='none'" />`;
      if (editable) {
        return `<div class="photo-item">${imgTag}<button class="photo-delete-btn" data-action="deleteMerchantImage" data-merchant-id="${merchantId}" data-image-url="${escapeHtml(image)}">×</button></div>`;
      }
      return imgTag;
    })
    .join('')}</div>`;
}

export function renderReviewList(reviews) {
  return reviews
    .map((review) => {
      const avatarSrc = review.avatarUrl
        ? escapeHtml(review.avatarUrl)
        : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(review.user)}`;
      return `
        <div class="review-card">
          <div class="review-row review-card-top">
            <div class="review-user">
              <img src="${avatarSrc}" alt="${escapeHtml(review.user)}" class="review-avatar" loading="lazy" onerror="this.src='https://api.dicebear.com/7.x/initials/svg?seed=U'" />
              <strong>${escapeHtml(review.user)}</strong>
            </div>
            <button class="report-button" data-action="reportReview" data-review-id="${review.id}">举报</button>
          </div>
          <div class="review-row">
            <span class="rating rating-small"><span class="rating-star">${STAR_SVG}</span>${review.rating}.0</span>
            <small>${escapeHtml(review.createdAt)}</small>
          </div>
          <p>${review.content ? escapeHtml(review.content).replace(/\n{3,}/g, '\n\n').replace(/\n/g, '<br>') : '<span class="muted">用户未填写文字评价。</span>'}</p>
        </div>
      `;
    })
    .join('');
}

export function renderDetail() {
  const merchant = state.merchants.find((item) => item.id === state.selectedMerchantId);
  if (!merchant) {
    els.merchantDetail.className = 'merchant-detail empty-state';
    els.merchantDetail.textContent = '请选择一家商家查看详情。';
    return;
  }
  const summary = merchantSummary(merchant);
  const reviews = state.merchantReviews[merchant.id] || [];
  const images = state.merchantImages[merchant.id] || [];

  els.merchantDetail.className = 'merchant-detail panel-stack';
  els.merchantDetail.innerHTML = `
    <button class="detail-back-button primary" data-action="backToFood">返回</button>
    <img class="detail-cover" src="${escapeHtml(merchant.cover)}" alt="${escapeHtml(merchant.name)} 封面图" data-action="showImageViewer" data-image-src="${escapeHtml(merchant.cover)}" onerror="this.src='${FALLBACK_COVER}'" />
    <div class="section-heading">
      <div>
        <h3>${escapeHtml(merchant.name)}</h3>
        <p class="muted">${escapeHtml(merchant.location)}</p>
      </div>
      <span class="rating"><span class="rating-star">${STAR_SVG}</span>${summary.reviewCount > 0 ? summary.displayScore.toFixed(1) : '暂无评分'}</span>
    </div>
    <div class="merchant-meta">
      <span>${summary.reviewCount} 条评价</span>
    </div>
    ${renderPhotoStrip(images, merchant.name)}
    <div class="section-heading"><h3>评价列表</h3><button class="primary" data-action="writeReview">评价</button></div>
    <div class="review-list">${renderReviewList(reviews)}</div>
  `;
}

export function renderProfile() {
  if (!state.currentUser) {
    els.profilePanel.innerHTML = `
      <div class="profile-header">
        <div class="avatar-wrapper">
          <div class="avatar avatar-empty"></div>
        </div>
        <div class="profile-info">
          <strong>请注册/登录</strong>
        </div>
      </div>
      <div class="profile-actions">
        <button class="primary" data-action="openAuthDialog">登录</button>
      </div>
    `;
    return;
  }

  const adminEntry = isAdmin()
    ? '<button class="secondary" data-action="openAdminWorkbench">管理员工作台</button>'
    : '';

  const roleLabels = {
    'super_admin': '超级管理员',
    'admin': '管理员',
    'user': '用户',
  };
  const roleClass = state.currentUser.role === 'super_admin' ? 'badge-dark' : '';
  const avatarUrl = state.currentUser.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(state.currentUser.nickname);

  els.profilePanel.innerHTML = `
    <div class="profile-header">
      <div class="avatar-wrapper">
        <img src="${avatarUrl}" alt="头像" class="avatar" id="profileAvatar" loading="lazy" />
        <label class="avatar-upload">
          <input type="file" accept="image/*" id="avatarInput" />
          <span>更换</span>
        </label>
      </div>
      <div class="profile-info">
        <strong>${state.currentUser.nickname}</strong>
        <span class="badge ${roleClass}">${roleLabels[state.currentUser.role] || state.currentUser.role}</span>
      </div>
    </div>
    <div class="profile-actions">
      <button class="primary" data-action="openMerchantUpload">上传商家</button>
      <button class="secondary" data-action="openEditProfile">编辑个人资料</button>
      <button class="secondary" data-action="submitFeedback">提交反馈</button>
      ${adminEntry}
      <button class="outline" data-action="logout">退出登录</button>
    </div>
  `;
}
