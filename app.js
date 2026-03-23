const LOCATIONS = [
  '南苑一楼',
  '南苑二楼',
  '南苑三楼',
  '北苑一楼',
  '北苑二楼',
  '北苑三楼',
  '北苑侧楼',
  '青春集市',
];

const STAR_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';

const state = {
  currentLocation: LOCATIONS[0],
  search: '',
  selectedMerchantId: null,
  currentUser: null,
  bayesThreshold: 5,
  activeView: 'food',
  merchants: [],
  merchantImages: {},
  merchantReviews: {},
  editingReviewId: null,
  uploadedImageUrl: null,
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

function studentIdToEmail(studentId) {
  return `${studentId}@${authEmailDomain}`;
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
    .select('id, name, location, cover_image_url, description, status')
    .eq('status', 'approved');

  if (error || !merchantsData) {
    state.merchants = [];
    renderMerchants();
    return;
  }

  state.merchants = merchantsData.map(m => ({
    id: m.id,
    name: m.name,
    location: m.location,
    cover: m.cover_image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80',
    description: m.description,
    status: m.status,
  }));

  for (const merchant of state.merchants) {
    const { data: images } = await client
      .from('merchant_images')
      .select('image_url')
      .eq('merchant_id', merchant.id)
      .order('sort_order', { ascending: true });
    state.merchantImages[merchant.id] = images ? images.map(img => img.image_url) : [];
  }

  for (const merchant of state.merchants) {
    const { data: reviews } = await client
      .from('reviews')
      .select('id, rating, content, report_count, created_at, user_id')
      .eq('merchant_id', merchant.id)
      .eq('status', 'visible')
      .order('created_at', { ascending: false });
    
    if (reviews && reviews.length > 0) {
      const reviewsWithUser = [];
      for (const r of reviews) {
        const { data: user } = await client
          .from('users')
          .select('nickname, avatar_url')
          .eq('id', r.user_id)
          .single();
        reviewsWithUser.push({
          id: r.id,
          user: user?.nickname || '匿名用户',
          avatarUrl: user?.avatar_url || null,
          rating: r.rating,
          content: r.content,
          createdAt: r.created_at.split('T')[0],
          reportCount: r.report_count,
        });
      }
      state.merchantReviews[merchant.id] = reviewsWithUser;
    } else {
      state.merchantReviews[merchant.id] = [];
    }
  }

  renderMerchants();
}

const els = {
  locationSelect: document.getElementById('locationSelect'),
  searchInput: document.getElementById('searchInput'),
  merchantList: document.getElementById('merchantList'),
  merchantDetail: document.getElementById('merchantDetail'),
  profilePanel: document.getElementById('profilePanel'),
  adminPanel: document.getElementById('adminPanel'),
  topbar: document.getElementById('topbar'),
  foodView: document.getElementById('foodView'),
  detailView: document.getElementById('detailView'),
  profileView: document.getElementById('profileView'),
  adminView: document.getElementById('adminView'),
  locationBar: document.getElementById('locationBar'),
  foodTabButton: document.getElementById('foodTabButton'),
  profileTabButton: document.getElementById('profileTabButton'),
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
  merchantUploadDialog: document.getElementById('merchantUploadDialog'),
  uploadMerchantName: document.getElementById('uploadMerchantName'),
  uploadMerchantLocation: document.getElementById('uploadMerchantLocation'),
  uploadMerchantCover: document.getElementById('uploadMerchantCover'),
  uploadMerchantDesc: document.getElementById('uploadMerchantDesc'),
  uploadMerchantPreview: document.getElementById('uploadMerchantPreview'),
  confirmMerchantUpload: document.getElementById('confirmMerchantUpload'),
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

function studentIdValid(studentId) {
  return /^202[0-9][0-9]{4}$/.test(studentId);
}

async function compressImage(file, maxWidth = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
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
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('图片压缩失败'));
          }
        },
        'image/webp',
        quality
      );
    };
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = URL.createObjectURL(file);
  });
}

function setActiveView(view) {
  state.activeView = view;
  const isFoodView = view === 'food';
  const isDetailView = view === 'detail';
  const isProfileView = view === 'profile';
  const isAdminView = view === 'admin';
  const showFoodChrome = isFoodView;
  els.topbar.classList.toggle('is-hidden', !showFoodChrome);
  els.foodView.classList.toggle('is-hidden', !isFoodView);
  els.detailView.classList.toggle('is-hidden', !isDetailView);
  els.profileView.classList.toggle('is-hidden', !isProfileView);
  els.adminView.classList.toggle('is-hidden', !isAdminView);
  els.locationBar.classList.toggle('is-hidden', !showFoodChrome);
  els.searchInput.classList.toggle('is-hidden', !showFoodChrome);
  els.foodTabButton.classList.toggle('active', isFoodView || isDetailView);
  els.profileTabButton.classList.toggle('active', isProfileView || isAdminView);
}

function getPlatformAverage() {
  const allReviews = Object.values(state.merchantReviews).flat();
  if (!allReviews.length) return 0;
  return allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length;
}

function bayesianScore(merchantId) {
  const reviews = state.merchantReviews[merchantId] || [];
  const reviewCount = reviews.length;
  if (reviewCount === 0) return getPlatformAverage();
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
  return {
    ...merchant,
    reviewCount,
    average,
    bayes: bayesianScore(merchant.id),
  };
}

function getFilteredMerchants() {
  return state.merchants
    .filter((merchant) => merchant.location === state.currentLocation)
    .filter((merchant) => merchant.name.includes(state.search.trim()))
    .map(merchantSummary)
    .sort((a, b) => b.bayes - a.bayes);
}

function renderLocationOptions() {
  els.locationSelect.innerHTML = LOCATIONS.map((location) => `<option value="${location}">${location}</option>`).join('');
  els.locationSelect.value = state.currentLocation;
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
        <article class="merchant-card">
          <img src="${merchant.cover}" alt="${merchant.name} 封面图" />
          <div class="merchant-content">
            <div class="section-heading">
              <h3>${merchant.name}</h3>
              <span class="rating"><span class="rating-star">${STAR_SVG}</span>${merchant.bayes.toFixed(1)}</span>
            </div>
            <div class="merchant-meta">
              <span>${merchant.location}</span>
              <span>${merchant.reviewCount} 条评价</span>
            </div>
            <button class="primary" onclick="selectMerchant('${merchant.id}')">查看详情</button>
          </div>
        </article>
      `,
    )
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
  const reviewsHtml = reviews
    .map(
      (review) => {
        const avatarSrc = review.avatarUrl 
          ? review.avatarUrl 
          : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(review.user)}`;
        return `
          <div class="review-card">
            <div class="review-row review-card-top">
              <div class="review-user">
                <img src="${avatarSrc}" alt="${review.user}" class="review-avatar" />
                <strong>${review.user}</strong>
              </div>
              <button class="report-button" onclick="reportReview('${review.id}')">举报</button>
            </div>
            <div class="review-row">
              <span class="rating rating-small"><span class="rating-star">${STAR_SVG}</span>${review.rating}.0</span>
              <small>${review.createdAt}</small>
            </div>
            <p>${review.content || '<span class="muted">用户未填写文字评价。</span>'}</p>
          </div>
        `;
      },
    )
    .join('');

  const images = state.merchantImages[merchant.id] || [];
  const isAdmin = ['admin', 'super_admin'].includes(state.currentUser?.role);
  
  let photoStripHtml = '';
  if (images.length > 0) {
    if (isAdmin) {
      photoStripHtml = `<div class="photo-strip photo-strip-admin">${images
        .map((image, index) => `
          <div class="photo-item">
            <img src="${image}" alt="${merchant.name} 图片 ${index + 1}" />
            <button class="photo-delete-btn" onclick="deleteMerchantImage('${merchant.id}', '${image}')">×</button>
          </div>
        `)
        .join('')}</div>`;
    } else {
      photoStripHtml = `<div class="photo-strip">${images
        .map((image, index) => `<img src="${image}" alt="${merchant.name} 图片 ${index + 1}" />`)
        .join('')}</div>`;
    }
  }
  
  const adminPhotoUploadHtml = isAdmin
    ? `<div class="section-heading"><label class="photo-upload-btn"><input type="file" accept="image/*" onchange="uploadMerchantImage('${merchant.id}', this)" /><span>修改照片</span></label></div>`
    : '';

  els.merchantDetail.className = 'merchant-detail panel-stack';
  els.merchantDetail.innerHTML = `
    <img class="detail-cover" src="${merchant.cover}" alt="${merchant.name} 封面图" />
    <div class="section-heading">
      <div>
        <h3>${merchant.name}</h3>
        <p class="muted">${merchant.location}</p>
      </div>
      <span class="rating"><span class="rating-star">${STAR_SVG}</span>${summary.average.toFixed(1)}</span>
    </div>
    <div class="merchant-meta">
      <span>${summary.reviewCount} 条评价</span>
    </div>
    ${adminPhotoUploadHtml}
    ${photoStripHtml}
    <div class="section-heading"><h3>评价列表</h3><button class="primary" onclick="writeReview()">评价</button></div>
    <div class="review-list">${reviewsHtml}</div>
  `;
}

function renderProfile() {
  if (!state.currentUser) {
    els.profilePanel.innerHTML = `
      <div class="profile-actions">
        <button class="primary" onclick="openAuthDialog()">登录</button>
      </div>
    `;
    return;
  }

  const isAdmin = ['admin', 'super_admin'].includes(state.currentUser.role);
  const adminEntry = isAdmin
    ? '<button class="secondary" onclick="openAdminWorkbench()">管理员工作台</button>'
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
        <img src="${avatarUrl}" alt="头像" class="avatar" id="profileAvatar" />
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
      <button class="primary" onclick="openMerchantUpload()">上传商家</button>
      <button class="secondary" onclick="openEditProfile()">编辑个人资料</button>
      <button class="secondary" onclick="submitFeedback()">提交反馈</button>
      ${adminEntry}
      <button class="secondary" onclick="logout()">退出登录</button>
    </div>
  `;
}

async function loadAdminData() {
  const client = await ensureSupabaseClient();
  if (!client) return { pendingMerchants: [], reportedReviews: [] };

  const { data: pendingMerchants } = await client
    .from('merchants')
    .select('id, name, location, created_at, description, cover_image_url')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  const pendingWithImages = [];
  if (pendingMerchants && pendingMerchants.length > 0) {
    for (const m of pendingMerchants) {
      const { data: images } = await client
        .from('merchant_images')
        .select('image_url')
        .eq('merchant_id', m.id)
        .order('sort_order', { ascending: true });
      pendingWithImages.push({
        ...m,
        images: images ? images.map(img => img.image_url) : [],
      });
    }
  }

  const { data: reportedReviews } = await client
    .from('reviews')
    .select('id, rating, content, report_count, merchant_id, merchants(name)')
    .gte('report_count', 20)
    .order('report_count', { ascending: false });

  return {
    pendingMerchants: pendingWithImages,
    reportedReviews: reportedReviews || [],
  };
}

async function renderAdmin() {
  const isAdmin = ['admin', 'super_admin'].includes(state.currentUser?.role);
  if (!isAdmin) {
    els.adminPanel.innerHTML = `
      <p class="muted">仅管理员可以进入此页面。</p>
      <button class="secondary" onclick="setActiveView('profile')">返回个人中心</button>
    `;
    return;
  }

  els.adminPanel.innerHTML = `
    <div class="profile-actions">
      <button class="primary" onclick="renderAdminPendingMerchants()">待审核商家</button>
      <button class="secondary" onclick="renderAdminReportedReviews()">举报审核</button>
      <button class="secondary" onclick="setActiveView('profile')">返回个人中心</button>
    </div>
  `;
}

async function renderAdminPendingMerchants() {
  const { pendingMerchants } = await loadAdminData();

  const pendingHtml = pendingMerchants.length > 0
    ? pendingMerchants.map(m => {
        const imagesHtml = m.images && m.images.length > 0
          ? `<div class="photo-strip">${m.images.map((img, i) => `<img src="${img}" alt="${m.name} 图片 ${i + 1}" />`).join('')}</div>`
          : '';
        const coverHtml = m.cover_image_url
          ? `<img src="${m.cover_image_url}" alt="${m.name} 封面" class="detail-cover" style="max-height: 150px;" />`
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
              <button class="primary" onclick="approveMerchant('${m.id}')">通过</button>
              <button class="secondary" onclick="rejectMerchant('${m.id}')">拒绝</button>
            </div>
          </div>
        `;
      }).join('')
    : '<p class="muted">暂无待审商家。</p>';

  els.adminPanel.innerHTML = `
    <div class="section-heading"><h3>待审商家</h3><span class="badge">${pendingMerchants.length} 家</span></div>
    <div class="review-list">${pendingHtml}</div>
    <div class="profile-actions">
      <button class="secondary" onclick="renderAdmin()">返回</button>
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
            <button class="primary" onclick="hideReview('${r.id}')">隐藏评价</button>
            <button class="secondary" onclick="dismissReports('${r.id}')">忽略举报</button>
          </div>
        </div>
      `).join('')
    : '<p class="muted">暂无达到 20 次举报的评价。</p>';

  els.adminPanel.innerHTML = `
    <div class="section-heading"><h3>举报审核队列</h3><span class="badge">${reportedReviews.length} 条</span></div>
    <div class="review-list">${reportedHtml}</div>
    <div class="profile-actions">
      <button class="secondary" onclick="renderAdmin()">返回</button>
    </div>
  `;
}

async function openAuthDialog() {
  if (!supabaseUrl || !supabaseAnonKey) {
    alert('请先在 window.__SUPABASE_CONFIG__ 中配置 Supabase URL 和 anon key。');
    return;
  }
  const client = await ensureSupabaseClient();
  if (!client) {
    alert('Supabase SDK 加载失败，请检查网络或稍后重试。');
    return;
  }
  els.authDialog.showModal();
}

window.setActiveView = setActiveView;
window.openAuthDialog = openAuthDialog;

function requireLogin(actionName) {
  if (!state.currentUser) {
    alert(`${actionName} 需要先登录，系统将引导你进入学号登录。`);
    openAuthDialog();
    return false;
  }
  return true;
}

window.selectMerchant = (merchantId) => {
  state.selectedMerchantId = merchantId;
  renderDetail();
  setActiveView('detail');
};

window.reportReview = async (reviewId) => {
  if (!requireLogin('举报评价')) return;

  const client = await ensureSupabaseClient();
  if (!client) {
    alert('Supabase SDK 加载失败，请检查网络或稍后重试。');
    return;
  }

  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    alert('请先登录。');
    return;
  }

  const { data: existingReport } = await client
    .from('review_reports')
    .select('id')
    .eq('review_id', reviewId)
    .eq('reporter_user_id', user.id)
    .single();

  if (existingReport) {
    alert('您已经举报过这条评价了。');
    return;
  }

  const { error: reportError } = await client
    .from('review_reports')
    .insert({
      review_id: reviewId,
      reporter_user_id: user.id,
      reason_type: 'other',
    });

  if (reportError) {
    alert(`举报失败：${reportError.message}`);
    return;
  }

  alert('举报成功！感谢您的反馈。');
  await loadMerchants();
  renderDetail();
};

window.writeReview = async () => {
  if (!requireLogin('发布评价')) return;

  if (!state.selectedMerchantId) {
    alert('请先选择一个商家。');
    return;
  }

  const client = await ensureSupabaseClient();
  if (!client) {
    alert('Supabase SDK 加载失败，请检查网络或稍后重试。');
    return;
  }

  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    alert('请先登录。');
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
};

function updateStarDisplay(rating) {
  const ratingSelector = document.getElementById('ratingSelector');
  const stars = ratingSelector.querySelectorAll('span');
  stars.forEach((star, index) => {
    if (index < rating) {
      star.classList.remove('rating-star-empty');
      star.classList.add('rating-star-filled');
    } else {
      star.classList.remove('rating-star-filled');
      star.classList.add('rating-star-empty');
    }
  });
}

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

window.submitFeedback = () => {
  if (!requireLogin('提交反馈')) return;
  alert('反馈功能开发中，若有问题或建议请联系管理员安财经济学院融媒体中心QQ：3425749029，反馈被采纳将提供志愿学分。');
};

window.approveMerchant = async (merchantId) => {
  const client = await ensureSupabaseClient();
  if (!client) return;

  const { error } = await client
    .from('merchants')
    .update({ status: 'approved' })
    .eq('id', merchantId);

  if (error) {
    alert(`审核通过失败：${error.message}`);
    return;
  }

  alert('商家已通过审核！');
  await renderAdmin();
  await loadMerchants();
};

window.rejectMerchant = async (merchantId) => {
  const client = await ensureSupabaseClient();
  if (!client) return;

  const { error } = await client
    .from('merchants')
    .update({ status: 'rejected' })
    .eq('id', merchantId);

  if (error) {
    alert(`拒绝失败：${error.message}`);
    return;
  }

  alert('商家已被拒绝。');
  await renderAdmin();
};

window.hideReview = async (reviewId) => {
  const client = await ensureSupabaseClient();
  if (!client) return;

  const { error } = await client
    .from('reviews')
    .update({ status: 'hidden' })
    .eq('id', reviewId);

  if (error) {
    alert(`隐藏失败：${error.message}`);
    return;
  }

  alert('评价已隐藏。');
  await renderAdmin();
  await loadMerchants();
  renderDetail();
};

window.dismissReports = async (reviewId) => {
  const client = await ensureSupabaseClient();
  if (!client) return;

  const { error } = await client
    .from('reviews')
    .update({ report_count: 0 })
    .eq('id', reviewId);

  if (error) {
    alert(`忽略举报失败：${error.message}`);
    return;
  }

  alert('已忽略举报，举报计数已重置。');
  await renderAdmin();
};

window.uploadMerchantImage = async (merchantId, inputElement) => {
  const file = inputElement.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('请选择图片文件。');
    inputElement.value = '';
    return;
  }

  const client = await ensureSupabaseClient();
  if (!client) {
    alert('Supabase SDK 加载失败。');
    return;
  }

  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    alert('请先登录。');
    return;
  }

  try {
    const compressedBlob = await compressImage(file, 1200, 0.8);
    const fileName = `${merchantId}/${Date.now()}.webp`;

    const { error: uploadError } = await client.storage
      .from('merchant-images')
      .upload(fileName, compressedBlob, {
        contentType: 'image/webp',
      });

    if (uploadError) {
      alert(`图片上传失败：${uploadError.message}`);
      return;
    }

    const { data: urlData } = client.storage
      .from('merchant-images')
      .getPublicUrl(fileName);

    const imageUrl = urlData.publicUrl;

    const { data: existingImages } = await client
      .from('merchant_images')
      .select('sort_order')
      .eq('merchant_id', merchantId)
      .order('sort_order', { ascending: false })
      .limit(1);

    const nextSortOrder = existingImages && existingImages.length > 0
      ? existingImages[0].sort_order + 1
      : 0;

    const { error: insertError } = await client
      .from('merchant_images')
      .insert({
        merchant_id: merchantId,
        image_url: imageUrl,
        sort_order: nextSortOrder,
      });

    if (insertError) {
      alert(`图片保存失败：${insertError.message}`);
      return;
    }

    inputElement.value = '';
    alert('照片上传成功！');
    await loadMerchants();
    renderDetail();
  } catch (err) {
    alert(`图片处理失败：${err.message}`);
  }
};

window.deleteMerchantImage = async (merchantId, imageUrl) => {
  if (!confirm('确定要删除这张照片吗？')) return;

  const client = await ensureSupabaseClient();
  if (!client) {
    alert('Supabase SDK 加载失败。');
    return;
  }

  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    alert('请先登录。');
    return;
  }

  const { error: deleteError } = await client
    .from('merchant_images')
    .delete()
    .eq('merchant_id', merchantId)
    .eq('image_url', imageUrl);

  if (deleteError) {
    alert(`删除失败：${deleteError.message}`);
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

  alert('照片已删除！');
  await loadMerchants();
  renderDetail();
};

window.openEditProfile = () => {
  if (!state.currentUser) {
    alert('请先登录。');
    return;
  }
  els.editNickname.value = state.currentUser.nickname || '';
  els.currentPassword.value = '';
  els.newPassword.value = '';
  els.confirmNewPassword.value = '';
  els.editProfileDialog.showModal();
};

window.logout = async () => {
  const client = await ensureSupabaseClient();
  if (client) {
    await client.auth.signOut();
  }
  state.currentUser = null;
  renderProfile();
  renderAdmin();
  setActiveView('food');
  alert('已退出登录。');
};
window.openMerchantUpload = async () => {
  if (!requireLogin('上传商家')) return;
  els.uploadMerchantLocation.innerHTML = LOCATIONS.map(loc => `<option value="${loc}">${loc}</option>`).join('');
  els.uploadMerchantName.value = '';
  els.uploadMerchantCover.value = '';
  els.uploadMerchantDesc.value = '';
  els.uploadMerchantPreview.innerHTML = '';
  state.uploadedImageUrl = null;
  els.merchantUploadDialog.showModal();
};
window.openAdminWorkbench = () => {
  const isAdmin = ['admin', 'super_admin'].includes(state.currentUser?.role);
  if (!isAdmin) {
    alert('仅管理员可进入管理员工作台。');
    return;
  }
  setActiveView('admin');
};
window.renderAdminPendingMerchants = renderAdminPendingMerchants;
window.renderAdminReportedReviews = renderAdminReportedReviews;
window.resetPassword = () => {
  alert('此操作应通过 Supabase Edge Function 执行，并在函数内校验管理员身份。');
};

els.locationSelect.addEventListener('change', (event) => {
  state.currentLocation = event.target.value;
  renderMerchants();
});

els.searchInput.addEventListener('input', (event) => {
  state.search = event.target.value;
  renderMerchants();
});

els.foodTabButton.addEventListener('click', () => setActiveView('food'));
els.profileTabButton.addEventListener('click', () => setActiveView('profile'));

els.confirmLogin.addEventListener('click', async (event) => {
  event.preventDefault();
  const studentId = els.studentIdInput.value.trim();
  const password = els.passwordInput.value.trim();
  if (!studentIdValid(studentId)) {
    alert('学号格式错误，必须匹配 ^202[0-9][0-9]{4}$。');
    return;
  }
  if (!password) {
    alert('请输入密码。');
    return;
  }
  const client = await ensureSupabaseClient();
  if (!client) {
    alert('Supabase SDK 加载失败，请检查网络或稍后重试。');
    return;
  }

  const email = studentIdToEmail(studentId);
  const { error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    alert(`登录失败：${error.message}`);
    return;
  }

  els.authDialog.close();
  els.passwordInput.value = '';
  await loadCurrentUser();
  setActiveView(state.activeView === 'admin' ? 'profile' : state.activeView);
});

async function init() {
  renderLocationOptions();
  renderProfile();
  renderAdmin();
  setActiveView(state.activeView);
  await loadCurrentUser();
  await loadMerchants();
  renderDetail();
}

init();

els.uploadMerchantCover.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) {
    els.uploadMerchantPreview.innerHTML = '';
    return;
  }

  if (!file.type.startsWith('image/')) {
    alert('请选择图片文件。');
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    els.uploadMerchantPreview.innerHTML = `<img src="${e.target.result}" alt="预览" />`;
  };
  reader.readAsDataURL(file);
});

document.addEventListener('change', async (event) => {
  if (event.target.id !== 'avatarInput') return;

  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('请选择图片文件。');
    event.target.value = '';
    return;
  }

  const client = await ensureSupabaseClient();
  if (!client) {
    alert('Supabase SDK 加载失败。');
    return;
  }

  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    alert('请先登录。');
    return;
  }

  try {
    const compressedBlob = await compressImage(file, 200, 0.8);
    const fileName = `${user.id}/avatar.webp`;

    const { error: uploadError } = await client.storage
      .from('avatars')
      .upload(fileName, compressedBlob, {
        contentType: 'image/webp',
        upsert: true,
      });

    if (uploadError) {
      alert(`头像上传失败：${uploadError.message}`);
      return;
    }

    const { data: urlData } = client.storage
      .from('avatars')
      .getPublicUrl(fileName);

    const avatarUrl = urlData.publicUrl;

    const { error: updateError } = await client
      .from('users')
      .update({ avatar_url: avatarUrl })
      .eq('id', user.id);

    if (updateError) {
      alert(`头像更新失败：${updateError.message}`);
      return;
    }

    state.currentUser.avatarUrl = avatarUrl;
    const avatarImg = document.getElementById('profileAvatar');
    if (avatarImg) {
      avatarImg.src = avatarUrl;
    }
    alert('头像更新成功！');
    await loadMerchants();
    renderDetail();
  } catch (err) {
    alert(`头像处理失败：${err.message}`);
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
    alert('请输入昵称。');
    return;
  }
  if (!studentIdValid(studentId)) {
    alert('学号格式错误，必须匹配 ^202[0-9][0-9]{4}$。');
    return;
  }
  if (!password) {
    alert('请输入密码。');
    return;
  }
  const client = await ensureSupabaseClient();
  if (!client) {
    alert('Supabase SDK 加载失败，请检查网络或稍后重试。');
    return;
  }

  const email = studentIdToEmail(studentId);
  const { data, error } = await client.auth.signUp({
    email,
    password,
  });

  if (error) {
    alert(`注册失败：${error.message}`);
    return;
  }

  const authUser = data.user;
  if (!authUser) {
    alert('注册失败：未返回用户信息。');
    return;
  }
  if (!data.session) {
    alert('注册成功，但当前未建立登录会话。请在 Supabase Auth 设置中关闭 Confirm email 后重试。');
    return;
  }

  const { error: profileError } = await client.from('users').insert({
    id: authUser.id,
    student_id: studentId,
    nickname,
    role: studentId === '20233897' ? 'super_admin' : 'user',
  });

  if (profileError) {
    alert(`注册成功，但写入资料失败：${profileError.message}`);
    return;
  }

  els.registerDialog.close();
  els.registerNicknameInput.value = '';
  els.registerStudentIdInput.value = '';
  els.registerPasswordInput.value = '';
  await loadCurrentUser();
  setActiveView('profile');
});

els.confirmMerchantUpload.addEventListener('click', async (event) => {
  event.preventDefault();
  
  if (els.confirmMerchantUpload.disabled) return;
  
  const name = els.uploadMerchantName.value.trim();
  const location = els.uploadMerchantLocation.value;
  const description = els.uploadMerchantDesc.value.trim();

  if (!name) {
    alert('请输入商家名称。');
    return;
  }
  if (name.length > 20) {
    alert('商家名称不能超过20个字符。');
    return;
  }

  els.confirmMerchantUpload.disabled = true;
  els.confirmMerchantUpload.textContent = '提交中...';

  const client = await ensureSupabaseClient();
  if (!client) {
    alert('Supabase SDK 加载失败，请检查网络或稍后重试。');
    els.confirmMerchantUpload.disabled = false;
    els.confirmMerchantUpload.textContent = '提交';
    return;
  }

  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    alert('请先登录。');
    els.confirmMerchantUpload.disabled = false;
    els.confirmMerchantUpload.textContent = '提交';
    return;
  }

  let coverImageUrl = state.uploadedImageUrl;

  const file = els.uploadMerchantCover.files[0];
  if (file && !coverImageUrl) {
    try {
      const compressedBlob = await compressImage(file, 1200, 0.8);
      const fileName = `${user.id}/${Date.now()}.webp`;

      const { error: uploadError } = await client.storage
        .from('merchant-images')
        .upload(fileName, compressedBlob, {
          contentType: 'image/webp',
        });

      if (uploadError) {
        alert(`图片上传失败：${uploadError.message}`);
        els.confirmMerchantUpload.disabled = false;
        els.confirmMerchantUpload.textContent = '提交';
        return;
      }

      const { data: urlData } = client.storage
        .from('merchant-images')
        .getPublicUrl(fileName);

      coverImageUrl = urlData.publicUrl;
    } catch (err) {
      alert(`图片处理失败：${err.message}`);
      els.confirmMerchantUpload.disabled = false;
      els.confirmMerchantUpload.textContent = '提交';
      return;
    }
  }

  const { error } = await client.from('merchants').insert({
    name,
    location,
    cover_image_url: coverImageUrl || null,
    description: description || null,
    created_by: user.id,
    status: 'pending',
  });

  if (error) {
    alert(`提交失败：${error.message}`);
    els.confirmMerchantUpload.disabled = false;
    els.confirmMerchantUpload.textContent = '提交';
    return;
  }

  els.confirmMerchantUpload.disabled = false;
  els.confirmMerchantUpload.textContent = '提交';
  els.merchantUploadDialog.close();
  state.uploadedImageUrl = null;
  alert('商家提交成功！等待管理员审核后即可显示。');
});

els.confirmReview.addEventListener('click', async (event) => {
  event.preventDefault();
  const rating = parseInt(els.reviewRating.value, 10);
  const content = els.reviewContent.value.trim();

  if (!state.selectedMerchantId) {
    alert('请先选择一个商家。');
    return;
  }

  const client = await ensureSupabaseClient();
  if (!client) {
    alert('Supabase SDK 加载失败，请检查网络或稍后重试。');
    return;
  }

  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    alert('请先登录。');
    return;
  }

  let error;
  if (state.editingReviewId) {
    const result = await client
      .from('reviews')
      .update({ rating, content, updated_at: new Date().toISOString() })
      .eq('id', state.editingReviewId);
    error = result.error;
  } else {
    const result = await client.from('reviews').insert({
      merchant_id: state.selectedMerchantId,
      user_id: user.id,
      rating,
      content,
      status: 'visible',
      report_count: 0,
    });
    error = result.error;
  }

  if (error) {
    alert(`提交失败：${error.message}`);
    return;
  }

  els.reviewDialog.close();
  els.reviewContent.value = '';
  state.editingReviewId = null;
  alert('评价提交成功！');
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
    alert('请至少修改一项内容。');
    return;
  }

  if (newNickname && newNickname.length > 20) {
    alert('昵称不能超过20个字符。');
    return;
  }

  if (newPwd || confirmPwd || currentPwd) {
    if (!currentPwd) {
      alert('请输入当前密码。');
      return;
    }
    if (!newPwd) {
      alert('请输入新密码。');
      return;
    }
    if (newPwd !== confirmPwd) {
      alert('两次输入的新密码不一致。');
      return;
    }
    if (newPwd.length < 6) {
      alert('新密码至少6个字符。');
      return;
    }
  }

  const client = await ensureSupabaseClient();
  if (!client) {
    alert('Supabase SDK 加载失败。');
    return;
  }

  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    alert('请先登录。');
    return;
  }

  if (currentPwd && newPwd) {
    const email = user.email;
    const { error: signInError } = await client.auth.signInWithPassword({
      email,
      password: currentPwd,
    });

    if (signInError) {
      alert('当前密码错误。');
      return;
    }

    const { error: updateError } = await client.auth.updateUser({
      password: newPwd,
    });

    if (updateError) {
      alert(`密码修改失败：${updateError.message}`);
      return;
    }
  }

  if (newNickname && newNickname !== state.currentUser.nickname) {
    const { error: nicknameError } = await client
      .from('users')
      .update({ nickname: newNickname })
      .eq('id', user.id);

    if (nicknameError) {
      alert(`昵称修改失败：${nicknameError.message}`);
      return;
    }

    state.currentUser.nickname = newNickname;
  }

  els.editProfileDialog.close();
  alert('个人资料已更新！');
  await loadCurrentUser();
});
