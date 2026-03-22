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

const state = {
  currentLocation: LOCATIONS[0],
  search: '',
  selectedMerchantId: null,
  currentUser: null,
  bayesThreshold: 5,
  activeView: 'food',
};

const merchants = [
  {
    id: 1,
    name: '南苑砂锅饭',
    location: '南苑一楼',
    cover: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80',
    images: [
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
    ],
    reviews: [
      { id: 101, user: '小林', avatar: '🧑‍🎓', rating: 5, content: '份量足，午高峰出餐很稳。', createdAt: '2026-03-18', reportCount: 0 },
      { id: 102, user: '阿周', avatar: '👩‍🎓', rating: 4, content: '口味偏重，但很下饭。', createdAt: '2026-03-19', reportCount: 1 },
      { id: 103, user: 'Momo', avatar: '🧑', rating: 5, content: '', createdAt: '2026-03-20', reportCount: 0 },
    ],
  },
  {
    id: 2,
    name: '北苑轻食碗',
    location: '北苑二楼',
    cover: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80',
    images: [
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=600&q=80',
    ],
    reviews: [
      { id: 201, user: 'Faye', avatar: '👩', rating: 5, content: '减脂期常点，鸡胸不柴。', createdAt: '2026-03-17', reportCount: 0 },
    ],
  },
  {
    id: 3,
    name: '青春集市烤冷面',
    location: '青春集市',
    cover: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80',
    images: [
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80',
    ],
    reviews: [
      { id: 301, user: '大王', avatar: '🧑‍🍳', rating: 3, content: '偏油，不过加肠很香。', createdAt: '2026-03-21', reportCount: 22 },
      { id: 302, user: 'Kiki', avatar: '👧', rating: 4, content: '晚上买的人很多。', createdAt: '2026-03-20', reportCount: 0 },
      { id: 303, user: 'Blue', avatar: '🧑', rating: 2, content: '这次有点凉。', createdAt: '2026-03-18', reportCount: 0 },
      { id: 304, user: 'Ray', avatar: '👨', rating: 5, content: '酱料味道不错。', createdAt: '2026-03-16', reportCount: 0 },
      { id: 305, user: 'June', avatar: '👩', rating: 4, content: '', createdAt: '2026-03-15', reportCount: 0 },
      { id: 306, user: 'Max', avatar: '🧑', rating: 5, content: '加蛋版本最值。', createdAt: '2026-03-14', reportCount: 0 },
    ],
  },
];

const els = {
  locationSelect: document.getElementById('locationSelect'),
  searchInput: document.getElementById('searchInput'),
  merchantList: document.getElementById('merchantList'),
  merchantDetail: document.getElementById('merchantDetail'),
  platformStats: document.getElementById('platformStats'),
  profilePanel: document.getElementById('profilePanel'),
  adminPanel: document.getElementById('adminPanel'),
  foodView: document.getElementById('foodView'),
  profileView: document.getElementById('profileView'),
  locationBar: document.getElementById('locationBar'),
  foodTabButton: document.getElementById('foodTabButton'),
  profileTabButton: document.getElementById('profileTabButton'),
  authDialog: document.getElementById('authDialog'),
  loginButton: document.getElementById('loginButton'),
  merchantButton: document.getElementById('merchantButton'),
  studentIdInput: document.getElementById('studentIdInput'),
  nicknameInput: document.getElementById('nicknameInput'),
  confirmLogin: document.getElementById('confirmLogin'),
};

function studentIdValid(studentId) {
  return /^202[0-9][0-9]{4}$/.test(studentId);
}

function setActiveView(view) {
  state.activeView = view;
  const isFoodView = view === 'food';
  els.foodView.classList.toggle('is-hidden', !isFoodView);
  els.profileView.classList.toggle('is-hidden', isFoodView);
  els.locationBar.classList.toggle('is-hidden', !isFoodView);
  els.foodTabButton.classList.toggle('active', isFoodView);
  els.profileTabButton.classList.toggle('active', !isFoodView);
}

function getPlatformAverage() {
  const reviews = merchants.flatMap((merchant) => merchant.reviews);
  return reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
}

function bayesianScore(merchant) {
  const reviewCount = merchant.reviews.length;
  const average = merchant.reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount;
  const globalAverage = getPlatformAverage();
  const m = state.bayesThreshold;
  return (reviewCount / (reviewCount + m)) * average + (m / (reviewCount + m)) * globalAverage;
}

function merchantSummary(merchant) {
  const reviewCount = merchant.reviews.length;
  const average = merchant.reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount;
  return {
    ...merchant,
    reviewCount,
    average,
    bayes: bayesianScore(merchant),
  };
}

function getFilteredMerchants() {
  return merchants
    .filter((merchant) => merchant.location === state.currentLocation)
    .filter((merchant) => merchant.name.includes(state.search.trim()))
    .map(merchantSummary)
    .sort((a, b) => b.bayes - a.bayes);
}

function renderLocationOptions() {
  els.locationSelect.innerHTML = LOCATIONS.map((location) => `<option value="${location}">${location}</option>`).join('');
  els.locationSelect.value = state.currentLocation;
}

function renderStats() {
  const pendingMerchantCount = 3;
  const queuedReports = merchants.flatMap((merchant) => merchant.reviews).filter((review) => review.reportCount >= 20).length;
  const totalReviews = merchants.flatMap((merchant) => merchant.reviews).length;
  const stats = [
    ['平台均分', getPlatformAverage().toFixed(2)],
    ['有效评价', totalReviews],
    ['待审商家', pendingMerchantCount],
    ['举报队列', queuedReports],
  ];
  els.platformStats.innerHTML = stats
    .map(([label, value]) => `<div class="stat"><div class="eyebrow">${label}</div><strong>${value}</strong></div>`)
    .join('');
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
              <span class="badge">贝叶斯 ${merchant.bayes.toFixed(2)}</span>
            </div>
            <div class="merchant-meta">
              <span>${merchant.location}</span>
              <span>${merchant.reviewCount} 条评价</span>
              <span>均分 ${merchant.average.toFixed(1)}</span>
            </div>
            <button class="primary" onclick="selectMerchant(${merchant.id})">查看详情</button>
          </div>
        </article>
      `,
    )
    .join('');
}

function renderDetail() {
  const merchant = merchants.find((item) => item.id === state.selectedMerchantId);
  if (!merchant) {
    els.merchantDetail.className = 'merchant-detail empty-state';
    els.merchantDetail.textContent = '请选择一家商家查看详情。';
    return;
  }
  const summary = merchantSummary(merchant);
  const reviewsHtml = merchant.reviews
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(
      (review) => `
        <div class="review-card">
          <div class="review-row">
            <strong>${review.avatar} ${review.user}</strong>
            <small>${review.createdAt}</small>
          </div>
          <div class="review-row">
            <span class="badge">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</span>
            <small class="${review.reportCount >= 20 ? 'status-warning' : 'muted'}">举报 ${review.reportCount}</small>
          </div>
          <p>${review.content || '<span class="muted">用户未填写文字评价。</span>'}</p>
          <button class="secondary" onclick="reportReview(${review.id})">举报评价</button>
        </div>
      `,
    )
    .join('');

  els.merchantDetail.className = 'merchant-detail panel-stack';
  els.merchantDetail.innerHTML = `
    <img class="detail-cover" src="${merchant.cover}" alt="${merchant.name} 封面图" />
    <div class="section-heading">
      <div>
        <h3>${merchant.name}</h3>
        <p class="muted">${merchant.location}</p>
      </div>
      <span class="badge">总分 ${summary.average.toFixed(1)}</span>
    </div>
    <div class="merchant-meta">
      <span>贝叶斯评分 ${summary.bayes.toFixed(2)}</span>
      <span>评价数 ${summary.reviewCount}</span>
      <span>封面图可由管理员修改</span>
    </div>
    <div class="photo-strip">${merchant.images
      .map((image, index) => `<img src="${image}" alt="${merchant.name} 图片 ${index + 1}" />`)
      .join('')}</div>
    <div class="section-heading"><h3>评价列表</h3><button class="primary" onclick="writeReview()">评价</button></div>
    <div class="review-list">${reviewsHtml}</div>
  `;
}

function renderProfile() {
  if (!state.currentUser) {
    els.profilePanel.innerHTML = `
      <p class="muted">游客可以浏览内容；评价、举报、上传商家、反馈与个人中心需要登录。</p>
      <button class="primary" onclick="openAuthDialog()">去登录</button>
    `;
    return;
  }

  els.profilePanel.innerHTML = `
    <div class="review-row">
      <strong>${state.currentUser.nickname}</strong>
      <span class="badge">${state.currentUser.role}</span>
    </div>
    <p class="muted">学号 ${state.currentUser.studentId} · 昵称每 7 天可修改一次 · 可删除自己的评价并重新发布。</p>
    <div class="stat"><div class="eyebrow">我的能力</div><strong>上传商家 / 发布评价 / 举报评价 / 提交反馈</strong></div>
    <button class="secondary" onclick="submitFeedback()">提交反馈</button>
  `;
}

function renderAdmin() {
  const isAdmin = ['admin', 'super_admin'].includes(state.currentUser?.role);
  if (!isAdmin) {
    els.adminPanel.innerHTML = `
      <p class="muted">管理员可审核商家、处理举报、警告或限评用户，并通过 Edge Functions 重置密码。</p>
      <div class="stat"><div class="eyebrow">超级管理员</div><strong>20233897</strong></div>
    `;
    return;
  }

  const reportQueue = merchants.flatMap((merchant) =>
    merchant.reviews.filter((review) => review.reportCount >= 20).map((review) => `${merchant.name} / 评价 ${review.id}`),
  );

  els.adminPanel.innerHTML = `
    <div class="stat"><div class="eyebrow">待审商家</div><strong>3 家</strong></div>
    <div class="stat"><div class="eyebrow">举报审核队列</div><strong>${reportQueue.length} 条</strong></div>
    <p class="muted">支持商家审核、举报处理、警告、限评、编辑封面图、按学号重置密码为学号本身。</p>
    <ul>${reportQueue.map((item) => `<li>${item}</li>`).join('') || '<li>当前无达到 20 次举报的评价。</li>'}</ul>
    <button class="primary" onclick="resetPassword()">管理员重置密码</button>
  `;
}

function openAuthDialog() {
  els.authDialog.showModal();
}

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
};
window.reportReview = (reviewId) => {
  if (!requireLogin('举报评价')) return;
  alert(`已打开举报流程（示例）。同一用户对同一评价最多举报一次。评价 ID：${reviewId}`);
};
window.writeReview = () => {
  if (!requireLogin('发布评价')) return;
  alert('已打开评价表单（示例）。同一用户对同一商家仅保留 1 条有效评价，再次提交视为更新。');
};
window.submitFeedback = () => {
  if (!requireLogin('提交反馈')) return;
  alert('已打开反馈表单（示例）。');
};
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

els.loginButton.addEventListener('click', openAuthDialog);
els.foodTabButton.addEventListener('click', () => setActiveView('food'));
els.profileTabButton.addEventListener('click', () => setActiveView('profile'));
els.merchantButton.addEventListener('click', () => {
  if (!requireLogin('上传商家')) return;
  alert('上传商家需要填写名称、位置，可补充最多 8 张商家图和最多 3 个菜品。');
});

els.confirmLogin.addEventListener('click', (event) => {
  event.preventDefault();
  const studentId = els.studentIdInput.value.trim();
  const nickname = els.nicknameInput.value.trim() || '新同学';
  if (!studentIdValid(studentId)) {
    alert('学号格式错误，必须匹配 ^202[0-9][0-9]{4}$。');
    return;
  }
  state.currentUser = {
    studentId,
    nickname,
    role: studentId === '20233897' ? 'super_admin' : 'user',
  };
  els.authDialog.close();
  renderProfile();
  renderAdmin();
  setActiveView(state.activeView);
});

function init() {
  renderLocationOptions();
  renderStats();
  renderMerchants();
  renderDetail();
  renderProfile();
  renderAdmin();
  setActiveView(state.activeView);
}

init();
