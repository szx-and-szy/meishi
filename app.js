const LOCATIONS = [
  '全部',
  '青春集市',
  '汤和路（东门向北）',
  '大学城',
  '南苑一楼',
  '南苑二楼',
  '南苑三楼',
  '北苑一楼',
  '毓秀餐厅',
  '北苑二楼',
  '北苑三楼',
  '北苑侧楼',
];

const VALID_LOCATIONS = LOCATIONS.filter(loc => loc !== '全部');

const STAR_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';

const RATING_SORT_OPTIONS = [
  { value: 'none', label: '无排序' },
  { value: 'desc', label: '由高到低' },
  { value: 'asc', label: '由低到高' },
];

const FALLBACK_COVER = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80';

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showError(message, duration = 3000) {
  let toast = document.getElementById('errorToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'errorToast';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #dc2626;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      z-index: 10000;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: opacity 0.3s;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = '1';
  if (toast._timeout) clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.style.opacity = '0';
  }, duration);
}

function showLoading(message = '加载中...') {
  let loader = document.getElementById('globalLoader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'globalLoader';
    loader.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(255,255,255,0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9998;
      font-size: 16px;
      color: #f97316;
    `;
    document.body.appendChild(loader);
  }
  loader.innerHTML = `<span>${escapeHtml(message)}</span>`;
  loader.style.display = 'flex';
}

function hideLoading() {
  const loader = document.getElementById('globalLoader');
  if (loader) loader.style.display = 'none';
}

async function safeApiCall(fn, errorMsg = '操作失败') {
  try {
    const result = await fn();
    if (result && result.error) {
      showError(`${errorMsg}：${result.error.message}`);
      return null;
    }
    return result;
  } catch (error) {
    console.error(errorMsg, error);
    showError(`${errorMsg}：${error.message}`);
    return null;
  }
}

const state = {
  currentLocation: LOCATIONS[0],
  ratingSort: 'none',
  search: '',
  selectedMerchantId: null,
  currentUser: null,
  bayesThreshold: 5,
  activeView: 'food',
  merchants: [],
  merchantImages: {},
  merchantReviews: {},
  editingReviewId: null,
  uploadedImageUrlPage: null,
  adminMerchantDetail: false,
  cachedAdminData: null,
  cachedAdminDataTime: 0,
  foodScrollPosition: 0,
  isLoading: false,
};

const supabaseConfig = window.__SUPABASE_CONFIG__ || {};
const supabaseUrl = supabaseConfig.url || '';
const supabaseAnonKey = supabaseConfig.anonKey || '';
const authEmailDomain = supabaseConfig.emailDomain || 'meishi.local';
let supabaseClient = null;
let supabasePromise = null;

async function ensureSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  if (window.supabase && typeof window.supabase.createClient === 'function') {
    supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
    return supabaseClient;
  }

  if (!supabasePromise) {
    supabasePromise = new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.async = true;
      script.onload = () => {
        if (window.supabase && typeof window.supabase.createClient === 'function') {
          supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
          resolve(supabaseClient);
          return;
        }
        resolve(null);
      };
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    });
  }

  return supabasePromise;
}

async function requireClient(errorMsg = 'Supabase SDK 加载失败，请检查网络或稍后重试') {
  const client = await ensureSupabaseClient();
  if (!client) showError(errorMsg);
  return client;
}

async function requireAuth(actionName) {
  if (!state.currentUser) {
    showError(`${actionName} 请先登录`);
    openAuthDialog();
    return null;
  }
  const client = await requireClient();
  if (!client) return null;
  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    showError('请先登录');
    return null;
  }
  return { client, user };
}

function isAdmin() {
  return ['admin', 'super_admin'].includes(state.currentUser?.role);
}

function invalidateAllCaches() {
  cachedPlatformAverage = null;
  state.cachedAdminData = null;
  state.cachedAdminDataTime = 0;
}

function studentIdToEmail(studentId) {
  return `${studentId}@${authEmailDomain}`;
}

function studentIdValid(studentId) {
  return /^202[0-9][0-9]{4}$/.test(studentId);
}

async function compressImage(file, maxWidth = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('图片压缩失败'));
        },
        'image/webp',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('图片加载失败'));
    };
    img.src = objectUrl;
  });
}

async function uploadImageToStorage(bucket, path, file, maxWidth = 1200, quality = 0.8) {
  const compressedBlob = await compressImage(file, maxWidth, quality);
  const client = await requireClient();
  if (!client) return null;

  const { error: uploadError } = await client.storage
    .from(bucket)
    .upload(path, compressedBlob, { contentType: 'image/webp' });

  if (uploadError) {
    showError(`图片上传失败：${uploadError.message}`);
    return null;
  }

  const { data: urlData } = client.storage.from(bucket).getPublicUrl(path);
  return urlData.publicUrl;
}

const els = {
  locationSelect: document.getElementById('locationSelect'),
  ratingSortSelect: document.getElementById('ratingSortSelect'),
  searchInput: document.getElementById('searchInput'),
  merchantList: document.getElementById('merchantList'),
  merchantDetail: document.getElementById('merchantDetail'),
  marketPanel: document.getElementById('marketPanel'),
  profilePanel: document.getElementById('profilePanel'),
  adminPanel: document.getElementById('adminPanel'),
  topbar: document.getElementById('topbar'),
  foodView: document.getElementById('foodView'),
  marketView: document.getElementById('marketView'),
  detailView: document.getElementById('detailView'),
  profileView: document.getElementById('profileView'),
  adminView: document.getElementById('adminView'),
  uploadMerchantView: document.getElementById('uploadMerchantView'),
  foodTabButton: document.getElementById('foodTabButton'),
  marketTabButton: document.getElementById('marketTabButton'),
  profileTabButton: document.getElementById('profileTabButton'),
  navSlider: document.getElementById('navSlider'),
  authDialog: document.getElementById('authDialog'),
  registerDialog: document.getElementById('registerDialog'),
  forgotPasswordDialog: document.getElementById('forgotPasswordDialog'),
  studentIdInput: document.getElementById('studentIdInput'),
  passwordInput: document.getElementById('passwordInput'),
  openRegisterButton: document.getElementById('openRegisterButton'),
  forgotPasswordButton: document.getElementById('forgotPasswordButton'),
  registerNicknameInput: document.getElementById('registerNicknameInput'),
  registerStudentIdInput: document.getElementById('registerStudentIdInput'),
  registerPasswordInput: document.getElementById('registerPasswordInput'),
  confirmLogin: document.getElementById('confirmLogin'),
  confirmRegister: document.getElementById('confirmRegister'),
  uploadMerchantNamePage: document.getElementById('uploadMerchantNamePage'),
  uploadMerchantLocationPage: document.getElementById('uploadMerchantLocationPage'),
  uploadMerchantCoverPage: document.getElementById('uploadMerchantCoverPage'),
  uploadMerchantDescPage: document.getElementById('uploadMerchantDescPage'),
  uploadMerchantPreviewPage: document.getElementById('uploadMerchantPreviewPage'),
  confirmMerchantUploadPage: document.getElementById('confirmMerchantUploadPage'),
  imageViewerDialog: document.getElementById('imageViewerDialog'),
  imageViewerImage: document.getElementById('imageViewerImage'),
  reviewDialog: document.getElementById('reviewDialog'),
  reviewRating: document.getElementById('reviewRating'),
  reviewContent: document.getElementById('reviewContent'),
  confirmReview: document.getElementById('confirmReview'),
  ratingSelector: document.getElementById('ratingSelector'),
  editProfileDialog: document.getElementById('editProfileDialog'),
  editNickname: document.getElementById('editNickname'),
  currentPassword: document.getElementById('currentPassword'),
  newPassword: document.getElementById('newPassword'),
  confirmNewPassword: document.getElementById('confirmNewPassword'),
  confirmEditProfile: document.getElementById('confirmEditProfile'),
};

function setActiveView(view) {
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

function showImageViewer(imageSrc) {
  if (!els.imageViewerDialog || !els.imageViewerImage) return;
  els.imageViewerImage.src = imageSrc;
  els.imageViewerDialog.showModal();
}

function closeImageViewer() {
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

let cachedPlatformAverage = null;

function getPlatformAverage() {
  if (cachedPlatformAverage !== null) return cachedPlatformAverage;
  const allReviews = Object.values(state.merchantReviews).flat();
  if (!allReviews.length) {
    cachedPlatformAverage = 0;
    return 0;
  }
  cachedPlatformAverage = allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length;
  return cachedPlatformAverage;
}

function bayesianScore(merchantId) {
  const reviews = state.merchantReviews[merchantId] || [];
  const reviewCount = reviews.length;
  if (reviewCount === 0) return 0;
  const allFiveStars = reviews.every(review => review.rating === 5);
  if (allFiveStars) return 5;
  const average = reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount;
  const globalAverage = getPlatformAverage();
  const m = state.bayesThreshold;
  return (reviewCount / (reviewCount + m)) * average + (m / (reviewCount + m)) * globalAverage;
}

function merchantSummary(merchant) {
  const reviews = state.merchantReviews[merchant.id] || [];
  const reviewCount = reviews.length;
  const average = reviewCount > 0
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount
    : 0;
  const bayes = bayesianScore(merchant.id);
  return {
    ...merchant,
    reviewCount,
    average,
    bayes,
    displayScore: bayes,
  };
}

function getFilteredMerchants() {
  let filtered = state.merchants
    .filter((merchant) => state.currentLocation === '全部' || merchant.location === state.currentLocation)
    .filter((merchant) => merchant.name.includes(state.search.trim()))
    .map(merchantSummary);

  if (state.ratingSort === 'desc') {
    filtered = filtered.sort((a, b) => b.bayes - a.bayes);
  } else if (state.ratingSort === 'asc') {
    filtered = filtered.sort((a, b) => a.bayes - b.bayes);
  } else {
    filtered = filtered.sort((a, b) => (b.displayScore * b.reviewCount) - (a.displayScore * a.reviewCount));
  }

  return filtered;
}

function renderLocationOptions() {
  els.locationSelect.innerHTML = LOCATIONS.map((location) => `<option value="${location}">${location}</option>`).join('');
  els.locationSelect.value = state.currentLocation;
}

function renderRatingSortOptions() {
  if (!els.ratingSortSelect) return;
  els.ratingSortSelect.innerHTML = RATING_SORT_OPTIONS.map((option) => `<option value="${option.value}">${option.label}</option>`).join('');
  els.ratingSortSelect.value = state.ratingSort;
}

function renderMerchants() {
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

function renderPhotoStrip(images, merchantName, editable = false, merchantId = '') {
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

function renderReviewList(reviews) {
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

function renderDetail() {
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

function renderProfile() {
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

async function loadCurrentUser() {
  const client = await ensureSupabaseClient();
  if (!client) return;

  const { data: { user }, error: authError } = await client.auth.getUser();

  if (authError || !user) {
    state.currentUser = null;
    renderProfile();
    renderAdmin();
    return;
  }

  const { data: profile, error } = await client
    .from('users')
    .select('student_id, nickname, role, avatar_url')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    state.currentUser = null;
    renderProfile();
    renderAdmin();
    return;
  }

  state.currentUser = {
    studentId: profile.student_id,
    nickname: profile.nickname,
    role: profile.role,
    avatarUrl: profile.avatar_url,
  };

  renderProfile();
  renderAdmin();
}

async function loadMerchants() {
  const client = await ensureSupabaseClient();
  if (!client) {
    state.merchants = [];
    renderMerchants();
    return;
  }

  const { data: merchantsData, error } = await client
    .from('merchants')
    .select(`
      id,
      name,
      location,
      cover_image_url,
      description,
      status,
      merchant_images(image_url, sort_order),
      reviews(
        id,
        rating,
        content,
        report_count,
        created_at,
        user_id,
        user_profiles(nickname, avatar_url)
      )
    `)
    .eq('status', 'approved');

  if (error || !merchantsData) {
    console.error('加载商家失败:', error);
    state.merchants = [];
    renderMerchants();
    return;
  }

  state.merchants = merchantsData.map(m => ({
    id: m.id,
    name: m.name,
    location: m.location,
    cover: m.cover_image_url || FALLBACK_COVER,
    description: m.description,
    status: m.status,
  }));

  state.merchantImages = {};
  state.merchantReviews = {};

  for (const m of merchantsData) {
    const images = m.merchant_images || [];
    state.merchantImages[m.id] = images
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(img => img.image_url);

    const reviews = m.reviews || [];
    state.merchantReviews[m.id] = reviews
      .filter(r => r.report_count < 20)
      .map(r => ({
        id: r.id,
        user: r.user_profiles?.nickname || '匿名用户',
        avatarUrl: r.user_profiles?.avatar_url || null,
        rating: r.rating,
        content: r.content,
        createdAt: r.created_at?.split('T')[0] || '',
        reportCount: r.report_count,
      }));
  }

  cachedPlatformAverage = null;
  renderMerchants();
}

async function loadAdminData(forceRefresh = false) {
  const CACHE_DURATION = 30000;
  const now = Date.now();

  if (!forceRefresh && state.cachedAdminData && (now - state.cachedAdminDataTime) < CACHE_DURATION) {
    return state.cachedAdminData;
  }

  const client = await requireClient();
  if (!client) return { pendingMerchants: [], reportedReviews: [] };

  const [pendingResult, reportedResult] = await Promise.all([
    client
      .from('merchants')
      .select('id, name, location, created_at, description, cover_image_url, merchant_images(image_url, sort_order)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    client
      .from('reviews')
      .select('id, rating, content, report_count, merchant_id, merchants(name)')
      .gte('report_count', 20)
      .order('report_count', { ascending: false })
  ]);

  const pendingWithImages = (pendingResult.data || []).map(m => ({
    ...m,
    images: (m.merchant_images || [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(img => img.image_url),
  }));

  state.cachedAdminData = {
    pendingMerchants: pendingWithImages,
    reportedReviews: reportedResult.data || [],
  };
  state.cachedAdminDataTime = now;

  return state.cachedAdminData;
}

async function renderAdmin() {
  if (!isAdmin()) {
    els.adminPanel.innerHTML = `
      <p class="muted">仅管理员可以进入此页面。</p>
      <button class="outline" data-action="setViewProfile">返回个人中心</button>
    `;
    return;
  }

  els.adminPanel.innerHTML = `
    <div class="profile-actions">
      <button class="secondary" data-action="renderAdminPendingMerchants">待审核商家</button>
      <button class="secondary" data-action="renderAdminReportedReviews">举报审核</button>
      <button class="secondary" data-action="renderAdminMerchantList">商家列表</button>
      <button class="outline" data-action="setViewProfile">返回个人中心</button>
    </div>
  `;
}

async function renderAdminPendingMerchants() {
  const { pendingMerchants } = await loadAdminData();

  const pendingHtml = pendingMerchants.length > 0
    ? pendingMerchants.map(m => {
        const imagesHtml = m.images && m.images.length > 0
          ? renderPhotoStrip(m.images, m.name)
          : '';
        const coverHtml = m.cover_image_url
          ? `<img src="${m.cover_image_url}" alt="${m.name} 封面" class="detail-cover" style="max-height: 150px;" loading="lazy" />`
          : '';
        return `
          <div class="review-card">
            <div class="review-row">
              <strong>${m.name}</strong>
              <span class="badge">${m.location}</span>
            </div>
            ${coverHtml}
            ${m.description ? `<p class="muted">${m.description}</p>` : ''}
            ${imagesHtml}
            <div class="profile-actions">
              <button class="primary" data-action="approveMerchant" data-merchant-id="${m.id}">通过</button>
              <button class="secondary" data-action="rejectMerchant" data-merchant-id="${m.id}">拒绝</button>
            </div>
          </div>
        `;
      }).join('')
    : '<p class="muted">暂无待审商家。</p>';

  els.adminPanel.innerHTML = `
    <div class="section-heading"><h3>待审商家</h3><span class="badge">${pendingMerchants.length} 家</span></div>
    <div class="review-list">${pendingHtml}</div>
    <div class="profile-actions">
      <button class="outline" data-action="renderAdmin">返回</button>
    </div>
  `;
}

async function renderAdminReportedReviews() {
  const { reportedReviews } = await loadAdminData();

  const reportedHtml = reportedReviews.length > 0
    ? reportedReviews.map(r => `
        <div class="review-card">
          <div class="review-row">
            <strong>${r.merchants?.name || '未知商家'}</strong>
            <span class="badge status-warning">${r.report_count} 次举报</span>
          </div>
          <p>${r.content || '<span class="muted">无内容</span>'}</p>
          <div class="profile-actions">
            <button class="primary" data-action="hideReview" data-review-id="${r.id}">隐藏评价</button>
            <button class="secondary" data-action="dismissReports" data-review-id="${r.id}">忽略举报</button>
          </div>
        </div>
      `).join('')
    : '<p class="muted">暂无达到 20 次举报的评价。</p>';

  els.adminPanel.innerHTML = `
    <div class="section-heading"><h3>举报审核队列</h3><span class="badge">${reportedReviews.length} 条</span></div>
    <div class="review-list">${reportedHtml}</div>
    <div class="profile-actions">
      <button class="outline" data-action="renderAdmin">返回</button>
    </div>
  `;
}

function renderAdminMerchantList(searchTerm = '') {
  const allMerchants = state.merchants;
  const merchants = searchTerm
    ? allMerchants.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : allMerchants;

  const listHtml = merchants.length > 0
    ? merchants.map(m => `
        <div class="merchant-card" data-action="selectAdminMerchant" data-merchant-id="${m.id}" style="cursor: pointer;">
          <img src="${m.cover}" alt="${m.name}" style="height: 140px;" loading="lazy" />
          <div class="merchant-content">
            <strong>${m.name}</strong>
            <p class="muted">${m.location}</p>
          </div>
        </div>
      `).join('')
    : '<p class="muted">暂无匹配的商家。</p>';

  els.adminPanel.innerHTML = `
    <div class="section-heading admin-list-header">
      <h3>商家列表</h3>
      <span class="badge badge-large">${merchants.length} 家</span>
    </div>
    <div class="search-box">
      <input type="text" id="adminMerchantSearch" placeholder="搜索商家名称..." value="${searchTerm}" data-action="filterAdminMerchants" />
    </div>
    <div class="merchant-list">${listHtml}</div>
  `;
}

function toggleEditSection(sectionId, show) {
  const editSection = document.getElementById(sectionId);
  if (editSection) editSection.style.display = show ? 'block' : 'none';
}

function renderAdminMerchantDetail() {
  const merchant = state.merchants.find(m => m.id === state.selectedMerchantId);
  if (!merchant) {
    els.adminPanel.innerHTML = `
      <p class="muted">商家不存在。</p>
      <button class="outline" data-action="renderAdminMerchantList">返回</button>
    `;
    return;
  }

  const images = state.merchantImages[merchant.id] || [];
  const imagesHtml = images.length > 0
    ? renderPhotoStrip(images, merchant.name, true, merchant.id)
    : '<p class="muted">暂无照片</p>';

  const merchantLocations = VALID_LOCATIONS;

  els.adminPanel.innerHTML = `
    <img class="detail-cover" src="${merchant.cover}" alt="${merchant.name} 封面图" loading="lazy" />
    <div class="section-heading">
      <label class="photo-upload-btn">
        <input type="file" accept="image/*" data-action="updateMerchantCover" data-merchant-id="${merchant.id}" />
        <span>修改封面</span>
      </label>
    </div>
    <div class="section-heading">
      <div>
        <h3 id="merchantNameDisplay">${merchant.name}</h3>
        <p class="muted" id="merchantLocationDisplay">${merchant.location}</p>
      </div>
      <label class="photo-upload-btn" style="cursor: pointer;">
        <span data-action="showEditMerchantName" data-merchant-id="${merchant.id}" data-current-name="${escapeHtml(merchant.name)}">修改名称</span>
      </label>
    </div>
    <div id="editMerchantNameSection" style="display: none; margin-top: 0.5rem;">
      <input type="text" id="editMerchantNameInput" maxlength="20" placeholder="请输入新的商家名称" style="width: 100%; margin-bottom: 0.5rem;" />
      <div class="profile-actions" style="margin-top: 0.5rem;">
        <button class="primary" data-action="saveMerchantName" data-merchant-id="${merchant.id}">保存</button>
        <button class="outline" data-action="cancelEditMerchantName">取消</button>
      </div>
    </div>
    <div class="section-heading">
      <h3>位置</h3>
      <label class="photo-upload-btn" style="cursor: pointer;">
        <span data-action="showEditMerchantLocation" data-merchant-id="${merchant.id}">修改位置</span>
      </label>
    </div>
    <div id="editMerchantLocationSection" style="display: none; margin-top: 0.5rem;">
      <select id="editMerchantLocationSelect" style="width: 100%; margin-bottom: 0.5rem;">
        ${merchantLocations.map(loc => `<option value="${loc}" ${loc === merchant.location ? 'selected' : ''}>${loc}</option>`).join('')}
      </select>
      <div class="profile-actions" style="margin-top: 0.5rem;">
        <button class="primary" data-action="saveMerchantLocation" data-merchant-id="${merchant.id}">保存</button>
        <button class="outline" data-action="cancelEditMerchantLocation">取消</button>
      </div>
    </div>
    ${merchant.description ? `<p>${merchant.description}</p>` : ''}
    <div class="section-heading">
      <h3>商家照片</h3>
      <label class="photo-upload-btn">
        <input type="file" accept="image/*" data-action="uploadMerchantImage" data-merchant-id="${merchant.id}" />
        <span>添加照片</span>
      </label>
    </div>
    ${imagesHtml}
    <div class="profile-actions">
      <button class="primary" data-action="deleteMerchant" data-merchant-id="${merchant.id}">删除商家</button>
      <button class="outline" data-action="renderAdminMerchantList">返回</button>
    </div>
  `;
}

async function deleteMerchant(merchantId) {
  if (!confirm('确定要删除该商家吗？此操作不可恢复。')) return;

  const client = await requireClient();
  if (!client) return;

  const result = await safeApiCall(
    () => client.from('merchants').delete().eq('id', merchantId),
    '删除失败'
  );
  if (!result) return;

  showError('商家已删除', 2000);
  await loadMerchants();
  renderAdminMerchantList();
}

async function saveMerchantName(merchantId) {
  const nameInput = document.getElementById('editMerchantNameInput');
  if (!nameInput) return;

  const newName = nameInput.value.trim();
  if (!newName) {
    showError('请输入商家名称');
    return;
  }
  if (newName.length > 20) {
    showError('商家名称不能超过20个字符');
    return;
  }

  const client = await requireClient();
  if (!client) return;

  const result = await safeApiCall(
    () => client.from('merchants').update({ name: newName }).eq('id', merchantId),
    '修改失败'
  );
  if (!result) return;

  showError('商家名称已修改', 2000);
  await loadMerchants();
  renderAdminMerchantDetail();
}

async function saveMerchantLocation(merchantId) {
  const locationSelect = document.getElementById('editMerchantLocationSelect');
  if (!locationSelect) return;

  const newLocation = locationSelect.value;

  const client = await requireClient();
  if (!client) return;

  const result = await safeApiCall(
    () => client.from('merchants').update({ location: newLocation }).eq('id', merchantId),
    '修改失败'
  );
  if (!result) return;

  showError('商家位置已修改', 2000);
  await loadMerchants();
  renderAdminMerchantDetail();
}

async function updateMerchantCover(merchantId, inputElement) {
  const file = inputElement.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showError('请选择图片文件');
    inputElement.value = '';
    return;
  }

  try {
    const fileName = `covers/${merchantId}/${Date.now()}.webp`;
    const coverUrl = await uploadImageToStorage('merchant-images', fileName, file, 1200, 0.8);
    if (!coverUrl) return;

    const client = await requireClient();
    if (!client) return;

    const { error: updateError } = await client
      .from('merchants')
      .update({ cover_image_url: coverUrl })
      .eq('id', merchantId);

    if (updateError) {
      showError(`封面更新失败：${updateError.message}`);
      return;
    }

    showError('封面已更新', 2000);
    await loadMerchants();
    renderAdminMerchantDetail();
  } catch (err) {
    showError(`操作失败：${err.message}`);
  }
}

function openAuthDialog() {
  if (!supabaseUrl || !supabaseAnonKey) {
    showError('请先在 window.__SUPABASE_CONFIG__ 中配置 Supabase URL 和 anon key');
    return;
  }
  requireClient().then(client => {
    if (client) els.authDialog.showModal();
  });
}

function selectMerchant(merchantId) {
  state.foodScrollPosition = window.scrollY;
  state.selectedMerchantId = merchantId;
  renderDetail();
  setActiveView('detail');
  window.scrollTo(0, 0);
}

function backToFood() {
  state.selectedMerchantId = null;
  setActiveView('food');
  setTimeout(() => {
    window.scrollTo(0, state.foodScrollPosition);
  }, 0);
}

async function reportReview(reviewId) {
  const auth = await requireAuth('举报评价');
  if (!auth) return;
  const { client, user } = auth;

  const { data: existingReport } = await client
    .from('review_reports')
    .select('id')
    .eq('review_id', reviewId)
    .eq('reporter_user_id', user.id)
    .single();

  if (existingReport) {
    showError('您已经举报过这条评价了');
    return;
  }

  const reportResult = await safeApiCall(
    () => client.from('review_reports').insert({
      review_id: reviewId,
      reporter_user_id: user.id,
      reason_type: 'other',
    }),
    '举报失败'
  );
  if (!reportResult) return;

  showError('举报成功，感谢您的反馈', 2000);
  await loadMerchants();
  renderDetail();
}

async function writeReview() {
  if (!state.currentUser) {
    showError('发布评价 请先登录');
    openAuthDialog();
    return;
  }

  if (!state.selectedMerchantId) {
    showError('请先选择一个商家');
    return;
  }

  const client = await requireClient();
  if (!client) return;

  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    showError('请先登录');
    return;
  }

  const { data: existingReview } = await client
    .from('reviews')
    .select('id, rating, content')
    .eq('merchant_id', state.selectedMerchantId)
    .eq('user_id', user.id)
    .single();

  const ratingSelector = document.getElementById('ratingSelector');
  const stars = ratingSelector.querySelectorAll('span');
  stars.forEach(star => star.innerHTML = STAR_SVG);

  if (existingReview) {
    els.reviewRating.value = existingReview.rating;
    els.reviewContent.value = existingReview.content || '';
    state.editingReviewId = existingReview.id;
    updateStarDisplay(existingReview.rating);
  } else {
    els.reviewRating.value = '5';
    els.reviewContent.value = '';
    state.editingReviewId = null;
    updateStarDisplay(5);
  }

  els.reviewDialog.showModal();
}

function updateStarDisplay(rating) {
  const ratingSelector = document.getElementById('ratingSelector');
  const stars = ratingSelector.querySelectorAll('span');
  stars.forEach((star, index) => {
    star.classList.toggle('rating-star-filled', index < rating);
    star.classList.toggle('rating-star-empty', index >= rating);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
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

  const splashScreen = document.getElementById('splashScreen');
  const minSplashTime = new Promise(resolve => setTimeout(resolve, 1200));

  await Promise.all([
    loadMerchants(),
    minSplashTime
  ]);

  if (splashScreen) {
    splashScreen.classList.add('fade-out');
    setTimeout(() => {
      splashScreen.remove();
    }, 500);
  }
});

function submitFeedback() {
  if (!state.currentUser) {
    showError('提交反馈 请先登录');
    openAuthDialog();
    return;
  }
  alert('反馈功能开发中，反馈问题或建议请联系安财经济学院融媒体中心QQ：3425749029。非常感谢您的反馈！');
}

async function approveMerchant(merchantId) {
  const client = await requireClient();
  if (!client) return;

  const { data: merchant, error: fetchError } = await client
    .from('merchants')
    .select('name, location, description, created_by, cover_image_url')
    .eq('id', merchantId)
    .single();

  if (fetchError) {
    showError(`获取商家信息失败：${fetchError.message}`);
    return;
  }

  const { data: existingMerchant } = await client
    .from('merchants')
    .select('id')
    .eq('name', merchant.name)
    .eq('location', merchant.location)
    .eq('status', 'approved')
    .neq('id', merchantId)
    .maybeSingle();

  if (existingMerchant) {
    const confirmMerge = confirm(`已存在同名同位置的商家，是否合并？\n\n合并后：\n- 新商家的评价将迁移至原商家\n- 新商家的图片将迁移至原商家\n- 新商家记录将被删除`);
    if (!confirmMerge) return;

    const { data: newMerchantReviews } = await client
      .from('reviews')
      .select('user_id, rating, content')
      .eq('merchant_id', merchantId);

    if (newMerchantReviews && newMerchantReviews.length > 0) {
      const userIds = newMerchantReviews.map(r => r.user_id);
      const { data: existingReviews } = await client
        .from('reviews')
        .select('user_id')
        .eq('merchant_id', existingMerchant.id)
        .in('user_id', userIds);

      const existingUserIds = new Set((existingReviews || []).map(r => r.user_id));

      const reviewsToInsert = newMerchantReviews
        .filter(r => !existingUserIds.has(r.user_id))
        .map(r => ({
          merchant_id: existingMerchant.id,
          user_id: r.user_id,
          rating: r.rating,
          content: r.content,
        }));

      if (reviewsToInsert.length > 0) {
        await client.from('reviews').insert(reviewsToInsert);
      }
    }

    if (merchant.cover_image_url) {
      const { data: existingImages } = await client
        .from('dish_images')
        .select('id')
        .eq('merchant_id', existingMerchant.id)
        .limit(1);

      if (!existingImages || existingImages.length === 0) {
        await client.from('dish_images').insert({
          merchant_id: existingMerchant.id,
          image_url: merchant.cover_image_url,
          uploaded_by: merchant.created_by,
        });
      }
    }

    const deleteResult = await safeApiCall(
      () => client.from('merchants').delete().eq('id', merchantId),
      '合并失败'
    );
    if (!deleteResult) return;

    showError('商家已合并至已有商家', 2000);
    invalidateAllCaches();
    await loadMerchants();
    await renderAdminPendingMerchants();
    return;
  }

  const approveResult = await safeApiCall(
    () => client.from('merchants').update({ status: 'approved' }).eq('id', merchantId),
    '审核通过失败'
  );
  if (!approveResult) return;

  if (merchant.description && merchant.description.trim() && merchant.created_by) {
    await client.from('reviews').insert({
      merchant_id: merchantId,
      user_id: merchant.created_by,
      rating: 5,
      content: merchant.description.trim(),
    });
  }

  showError('商家已通过审核', 2000);
  invalidateAllCaches();
  await loadMerchants();
  await renderAdminPendingMerchants();
}

async function rejectMerchant(merchantId) {
  const client = await requireClient();
  if (!client) return;

  const result = await safeApiCall(
    () => client.from('merchants').update({ status: 'rejected' }).eq('id', merchantId),
    '拒绝失败'
  );
  if (!result) return;

  showError('商家已被拒绝', 2000);
  state.cachedAdminData = null;
  state.cachedAdminDataTime = 0;
  await renderAdminPendingMerchants();
}

async function hideReview(reviewId) {
  const client = await requireClient();
  if (!client) return;

  const result = await safeApiCall(
    () => client.from('reviews').update({ status: 'hidden' }).eq('id', reviewId),
    '隐藏失败'
  );
  if (!result) return;

  showError('评价已隐藏', 2000);
  invalidateAllCaches();
  await loadMerchants();
  renderDetail();
}

async function dismissReports(reviewId) {
  const client = await requireClient();
  if (!client) return;

  const result = await safeApiCall(
    () => client.from('reviews').update({ report_count: 0 }).eq('id', reviewId),
    '忽略举报失败'
  );
  if (!result) return;

  showError('已忽略举报，举报计数已重置', 2000);
  state.cachedAdminData = null;
  state.cachedAdminDataTime = 0;
  await renderAdminReportedReviews();
}

async function uploadMerchantImage(merchantId, inputElement) {
  const file = inputElement.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showError('请选择图片文件');
    inputElement.value = '';
    return;
  }

  const auth = await requireAuth('上传图片');
  if (!auth) return;

  try {
    const fileName = `${merchantId}/${Date.now()}.webp`;
    const imageUrl = await uploadImageToStorage('merchant-images', fileName, file, 1200, 0.8);
    if (!imageUrl) return;

    const { data: existingImages } = await auth.client
      .from('merchant_images')
      .select('sort_order')
      .eq('merchant_id', merchantId)
      .order('sort_order', { ascending: false })
      .limit(1);

    const nextSortOrder = existingImages && existingImages.length > 0
      ? existingImages[0].sort_order + 1
      : 0;

    const { error: insertError } = await auth.client
      .from('merchant_images')
      .insert({
        merchant_id: merchantId,
        image_url: imageUrl,
        sort_order: nextSortOrder,
      });

    if (insertError) {
      showError(`图片保存失败：${insertError.message}`);
      return;
    }

    inputElement.value = '';
    showError('照片上传成功', 2000);
    await loadMerchants();
    renderDetail();
  } catch (err) {
    showError(`图片处理失败：${err.message}`);
  }
}

async function deleteMerchantImage(merchantId, imageUrl) {
  if (!confirm('确定要删除这张照片吗？')) return;

  const client = await requireClient();
  if (!client) return;

  const { error: deleteError } = await client
    .from('merchant_images')
    .delete()
    .eq('merchant_id', merchantId)
    .eq('image_url', imageUrl);

  if (deleteError) {
    showError(`删除失败：${deleteError.message}`);
    return;
  }

  try {
    const url = new URL(imageUrl);
    const pathParts = url.pathname.split('/');
    const bucketIndex = pathParts.findIndex(p => p === 'merchant-images');
    if (bucketIndex !== -1) {
      const filePath = pathParts.slice(bucketIndex + 1).join('/');
      await client.storage.from('merchant-images').remove([filePath]);
    }
  } catch (e) {
    console.warn('Storage file deletion skipped:', e);
  }

  showError('照片已删除', 2000);
  await loadMerchants();
  renderDetail();
}

function openEditProfile() {
  if (!state.currentUser) {
    showError('请先登录');
    return;
  }
  els.editNickname.value = state.currentUser.nickname || '';
  els.currentPassword.value = '';
  els.newPassword.value = '';
  els.confirmNewPassword.value = '';
  els.editProfileDialog.showModal();
}

async function logout() {
  const client = await ensureSupabaseClient();
  if (client) {
    await client.auth.signOut();
  }
  state.currentUser = null;
  renderProfile();
  renderAdmin();
  setActiveView('food');
  showError('已退出登录', 2000);
}

async function openMerchantUpload() {
  if (!state.currentUser) {
    showError('上传商家 请先登录');
    openAuthDialog();
    return;
  }
  const uploadLocations = VALID_LOCATIONS;
  els.uploadMerchantLocationPage.innerHTML = uploadLocations.map(loc => `<option value="${loc}">${loc}</option>`).join('');
  els.uploadMerchantNamePage.value = '';
  els.uploadMerchantCoverPage.value = '';
  els.uploadMerchantDescPage.value = '';
  els.uploadMerchantPreviewPage.innerHTML = '';
  state.uploadedImageUrlPage = null;
  setActiveView('uploadMerchant');
}

function cancelMerchantUploadPage() {
  els.uploadMerchantCoverPage.value = '';
  els.uploadMerchantPreviewPage.innerHTML = '';
  state.uploadedImageUrlPage = null;
  setActiveView('food');
}

function openAdminWorkbench() {
  if (!isAdmin()) {
    alert('仅管理员可进入管理员工作台。');
    return;
  }
  state.adminMerchantDetail = false;
  state.selectedMerchantId = null;
  setActiveView('admin');
  renderAdmin();
}

function resetPassword() {
  alert('此操作应通过 Supabase Edge Function 执行，并在函数内校验管理员身份。');
}

function filterAdminMerchants(searchTerm) {
  renderAdminMerchantList(searchTerm);
}

function selectAdminMerchant(merchantId) {
  state.selectedMerchantId = merchantId;
  state.adminMerchantDetail = true;
  renderAdminMerchantDetail();
}

function showEditMerchantName(merchantId, currentName) {
  const nameInput = document.getElementById('editMerchantNameInput');
  toggleEditSection('editMerchantNameSection', true);
  if (nameInput) {
    nameInput.value = currentName;
    nameInput.focus();
  }
}

function cancelEditMerchantName() {
  toggleEditSection('editMerchantNameSection', false);
}

function showEditMerchantLocation() {
  toggleEditSection('editMerchantLocationSection', true);
}

function cancelEditMerchantLocation() {
  toggleEditSection('editMerchantLocationSection', false);
}

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
};

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

let searchDebounceTimer = null;
els.searchInput.addEventListener('input', (event) => {
  state.search = event.target.value;
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    renderMerchants();
  }, 300);
});

els.foodTabButton.addEventListener('click', () => setActiveView('food'));
els.marketTabButton.addEventListener('click', () => setActiveView('market'));
els.profileTabButton.addEventListener('click', () => setActiveView('profile'));

els.confirmLogin.addEventListener('click', async (event) => {
  event.preventDefault();
  const studentId = els.studentIdInput.value.trim();
  const password = els.passwordInput.value.trim();
  if (!studentIdValid(studentId)) {
    showError('学号错误');
    return;
  }
  if (!password) {
    showError('请输入密码');
    return;
  }
  const client = await requireClient();
  if (!client) return;

  const email = studentIdToEmail(studentId);
  const { error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.includes('Invalid login credentials') || error.message.includes('user not found')) {
      if (password === studentId) {
        const { data, error: signUpError } = await client.auth.signUp({ email, password });
        if (signUpError) {
          showError(`自动注册失败：${signUpError.message}`);
          return;
        }
        const authUser = data.user;
        if (!authUser) {
          showError('自动注册失败：未返回用户信息');
          return;
        }
        if (!data.session) {
          showError('自动注册成功，但当前未建立登录会话。请在 Supabase Auth 设置中关闭 Confirm email 后重试');
          return;
        }
        const profileResult = await safeApiCall(
          () => client.from('users').insert({
            id: authUser.id,
            student_id: studentId,
            nickname: studentId,
            role: studentId === '20233897' ? 'super_admin' : 'user',
          }),
          '自动注册成功，但写入资料失败'
        );
        if (!profileResult) return;

        els.authDialog.close();
        els.passwordInput.value = '';
        showError('首次登录，建议尽快修改密码和昵称', 4000);
        await loadCurrentUser();
        setActiveView(state.activeView === 'admin' ? 'profile' : state.activeView);
        return;
      }
      showError('请先注册');
      els.authDialog.close();
      els.passwordInput.value = '';
      els.registerStudentIdInput.value = studentId;
      els.registerDialog.showModal();
      return;
    }
    showError(`登录失败：${error.message}`);
    return;
  }

  els.authDialog.close();
  els.passwordInput.value = '';
  await loadCurrentUser();
  setActiveView(state.activeView === 'admin' ? 'profile' : state.activeView);
});

async function init() {
  renderLocationOptions();
  renderRatingSortOptions();
  renderProfile();
  renderAdmin();
  setActiveView(state.activeView);
  await loadCurrentUser();
  await loadMerchants();
  renderDetail();
}

init();

els.uploadMerchantCoverPage.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) {
    els.uploadMerchantPreviewPage.innerHTML = '';
    state.uploadedImageUrlPage = null;
    return;
  }

  if (!file.type.startsWith('image/')) {
    showError('请选择图片文件');
    event.target.value = '';
    state.uploadedImageUrlPage = null;
    return;
  }

  els.uploadMerchantPreviewPage.innerHTML = '<p class="muted">图片处理中...</p>';

  try {
    const compressedBlob = await compressImage(file, 1200, 0.8);
    const reader = new FileReader();
    reader.onload = (e) => {
      els.uploadMerchantPreviewPage.innerHTML = `<img src="${e.target.result}" alt="预览" />`;
    };
    reader.readAsDataURL(compressedBlob);

    const auth = await requireAuth('上传图片');
    if (!auth) {
      state.uploadedImageUrlPage = null;
      return;
    }

    const fileName = `${auth.user.id}/upload_${Date.now()}.webp`;
    const uploadedUrl = await uploadImageToStorage('merchant-images', fileName, file, 1200, 0.8);
    if (!uploadedUrl) {
      state.uploadedImageUrlPage = null;
      return;
    }
    state.uploadedImageUrlPage = uploadedUrl;
  } catch (err) {
    showError(`图片处理失败：${err.message}`);
    state.uploadedImageUrlPage = null;
  }
});

document.addEventListener('change', async (event) => {
  if (event.target.id !== 'avatarInput') return;

  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showError('请选择图片文件');
    event.target.value = '';
    return;
  }

  const auth = await requireAuth('上传头像');
  if (!auth) return;

  try {
    const fileName = `${auth.user.id}/avatar.webp`;
    const { error: uploadError } = await auth.client.storage
      .from('avatars')
      .upload(fileName, await compressImage(file, 200, 0.8), {
        contentType: 'image/webp',
        upsert: true,
      });

    if (uploadError) {
      showError(`头像上传失败：${uploadError.message}`);
      return;
    }

    const { data: urlData } = auth.client.storage
      .from('avatars')
      .getPublicUrl(fileName);

    const avatarUrl = urlData.publicUrl + '?t=' + Date.now();

    const { error: updateError } = await auth.client
      .from('users')
      .update({ avatar_url: avatarUrl.split('?')[0] })
      .eq('id', auth.user.id);

    if (updateError) {
      showError(`头像更新失败：${updateError.message}`);
      return;
    }

    state.currentUser.avatarUrl = avatarUrl;
    const avatarImg = document.getElementById('profileAvatar');
    if (avatarImg) {
      avatarImg.src = avatarUrl;
    }
    showError('头像更新成功', 2000);
    await loadMerchants();
    renderDetail();
  } catch (err) {
    showError(`头像处理失败：${err.message}`);
  }
});

els.openRegisterButton.addEventListener('click', () => {
  els.authDialog.close();
  els.registerDialog.showModal();
});

els.forgotPasswordButton.addEventListener('click', () => {
  els.authDialog.close();
  els.forgotPasswordDialog.showModal();
});

els.confirmRegister.addEventListener('click', async (event) => {
  event.preventDefault();
  const studentId = els.registerStudentIdInput.value.trim();
  const nickname = els.registerNicknameInput.value.trim();
  const password = els.registerPasswordInput.value.trim();

  if (!nickname) {
    showError('请输入昵称');
    return;
  }
  if (nickname.length > 20) {
    showError('昵称不能超过20个字符');
    return;
  }
  if (!studentIdValid(studentId)) {
    showError('学号错误');
    return;
  }
  if (!password) {
    showError('请输入密码');
    return;
  }
  const client = await requireClient();
  if (!client) return;

  const email = studentIdToEmail(studentId);
  const { data, error } = await client.auth.signUp({
    email,
    password,
  });

  if (error) {
    showError(`注册失败：${error.message}`);
    return;
  }

  const authUser = data.user;
  if (!authUser) {
    showError('注册失败：未返回用户信息');
    return;
  }
  if (!data.session) {
    showError('注册成功，但当前未建立登录会话。请在 Supabase Auth 设置中关闭 Confirm email 后重试');
    return;
  }

  const profileResult = await safeApiCall(
    () => client.from('users').insert({
      id: authUser.id,
      student_id: studentId,
      nickname,
      role: studentId === '20233897' ? 'super_admin' : 'user',
    }),
    '注册成功，但写入资料失败'
  );
  if (!profileResult) return;

  els.registerDialog.close();
  els.registerNicknameInput.value = '';
  els.registerStudentIdInput.value = '';
  els.registerPasswordInput.value = '';
  await loadCurrentUser();
  setActiveView('profile');
});

els.confirmMerchantUploadPage.addEventListener('click', async (event) => {
  event.preventDefault();

  if (els.confirmMerchantUploadPage.disabled) return;

  const name = els.uploadMerchantNamePage.value.trim();
  const location = els.uploadMerchantLocationPage.value;
  const description = els.uploadMerchantDescPage.value.trim();

  if (!name) {
    showError('请输入商家名称');
    return;
  }
  if (name.length > 20) {
    showError('商家名称不能超过20个字符');
    return;
  }
  if (!location || !VALID_LOCATIONS.includes(location)) {
    showError('请选择有效的位置');
    return;
  }

  const existingMerchant = state.merchants.find(
    m => m.name === name && m.location === location
  );
  if (existingMerchant) {
    showError('该商家已存在');
    return;
  }

  els.confirmMerchantUploadPage.disabled = true;
  els.confirmMerchantUploadPage.textContent = '提交中...';
  showLoading('正在提交商家信息...');

  const auth = await requireAuth('提交商家');
  if (!auth) {
    els.confirmMerchantUploadPage.disabled = false;
    els.confirmMerchantUploadPage.textContent = '提交';
    hideLoading();
    return;
  }

  const result = await safeApiCall(
    () => auth.client.from('merchants').insert({
      name,
      location,
      cover_image_url: state.uploadedImageUrlPage || null,
      description: description || null,
      created_by: auth.user.id,
      status: 'pending',
    }),
    '提交失败'
  );

  els.confirmMerchantUploadPage.disabled = false;
  els.confirmMerchantUploadPage.textContent = '提交';
  hideLoading();

  if (!result) return;

  els.uploadMerchantCoverPage.value = '';
  els.uploadMerchantPreviewPage.innerHTML = '';
  state.uploadedImageUrlPage = null;
  showError('商家提交成功，等待管理员审核后即可显示', 3000);
  setActiveView('food');
});

els.confirmReview.addEventListener('click', async (event) => {
  event.preventDefault();
  const rating = parseInt(els.reviewRating.value, 10);
  const content = els.reviewContent.value.trim();

  if (!state.selectedMerchantId) {
    showError('请先选择一个商家');
    return;
  }

  const client = await requireClient();
  if (!client) return;

  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    showError('请先登录');
    return;
  }

  let result;
  if (state.editingReviewId) {
    result = await safeApiCall(
      () => client.from('reviews')
        .update({ rating, content, updated_at: new Date().toISOString() })
        .eq('id', state.editingReviewId),
      '提交失败'
    );
  } else {
    result = await safeApiCall(
      () => client.from('reviews').insert({
        merchant_id: state.selectedMerchantId,
        user_id: user.id,
        rating,
        content,
        status: 'visible',
        report_count: 0,
      }),
      '提交失败'
    );
  }

  if (!result) return;

  els.reviewDialog.close();
  els.reviewContent.value = '';
  state.editingReviewId = null;
  showError('评价提交成功', 2000);
  await loadMerchants();
  renderDetail();
});

els.confirmEditProfile.addEventListener('click', async (event) => {
  event.preventDefault();

  const newNickname = els.editNickname.value.trim();
  const currentPwd = els.currentPassword.value;
  const newPwd = els.newPassword.value;
  const confirmPwd = els.confirmNewPassword.value;

  if (!newNickname && !currentPwd && !newPwd) {
    showError('请至少修改一项内容');
    return;
  }

  if (newNickname && newNickname.length > 20) {
    showError('昵称不能超过20个字符');
    return;
  }

  if (newPwd || confirmPwd || currentPwd) {
    if (!currentPwd) {
      showError('请输入当前密码');
      return;
    }
    if (!newPwd) {
      showError('请输入新密码');
      return;
    }
    if (newPwd !== confirmPwd) {
      showError('两次输入的新密码不一致');
      return;
    }
    if (newPwd.length < 6) {
      showError('新密码至少6个字符');
      return;
    }
  }

  const client = await requireClient();
  if (!client) return;

  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    showError('请先登录');
    return;
  }

  if (currentPwd && newPwd) {
    const email = user.email;
    const { error: signInError } = await client.auth.signInWithPassword({
      email,
      password: currentPwd,
    });

    if (signInError) {
      showError('当前密码错误');
      return;
    }

    const { error: updateError } = await client.auth.updateUser({
      password: newPwd,
    });

    if (updateError) {
      showError(`密码修改失败：${updateError.message}`);
      return;
    }
  }

  if (newNickname && newNickname !== state.currentUser.nickname) {
    const nicknameResult = await safeApiCall(
      () => client.from('users').update({ nickname: newNickname }).eq('id', user.id),
      '昵称修改失败'
    );
    if (!nicknameResult) return;

    state.currentUser.nickname = newNickname;
  }

  els.editProfileDialog.close();
  showError('个人资料已更新', 2000);
  await loadCurrentUser();
});

window.addEventListener('beforeunload', () => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
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
