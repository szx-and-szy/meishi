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
  const {
    data: { session },
  } = await client.auth.getSession();

  if (!session?.user) {
    state.currentUser = null;
    renderProfile();
    renderAdmin();
    return;
  }

  const { data: profile, error } = await client
    .from('users')
    .select('student_id, nickname, role')
    .eq('id', session.user.id)
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
  };

  renderProfile();
  renderAdmin();
}


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
};

function studentIdValid(studentId) {
  return /^202[0-9][0-9]{4}$/.test(studentId);
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
              <span class="badge">评分 ${merchant.bayes.toFixed(2)}</span>
            </div>
            <div class="merchant-meta">
              <span>${merchant.location}</span>
              <span>${merchant.reviewCount} 条评价</span>
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
          <div class="review-row review-card-top">
            <strong>${review.avatar} ${review.user}</strong>
            <button class="report-button" onclick="reportReview(${review.id})">举报</button>
          </div>
          <div class="review-row">
            <span class="badge">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</span>
            <small>${review.createdAt}</small>
          </div>
          <p>${review.content || '<span class="muted">用户未填写文字评价。</span>'}</p>
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
      <span>评价数 ${summary.reviewCount}</span>
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
      <div class="profile-actions">
        <button class="primary" onclick="openAuthDialog()">登录</button>
        <button class="secondary" onclick="openMerchantUpload()">上传商家</button>
      </div>
    `;
    return;
  }

  const adminEntry = ['admin', 'super_admin'].includes(state.currentUser.role)
    ? '<button class="secondary" onclick="openAdminWorkbench()">管理员工作台</button>'
    : '';

  els.profilePanel.innerHTML = `
    <div class="review-row">
      <strong>${state.currentUser.nickname}</strong>
      <span class="badge">${state.currentUser.role}</span>
    </div>
    <p class="muted">学号 ${state.currentUser.studentId} · 昵称每 7 天可修改一次 · 可删除自己的评价并重新发布。</p>
    <div class="profile-actions">
      <button class="primary" onclick="openMerchantUpload()">上传商家</button>
      <button class="secondary" onclick="submitFeedback()">提交反馈</button>
      ${adminEntry}
    </div>
  `;
}

function renderAdmin() {
  const isAdmin = ['admin', 'super_admin'].includes(state.currentUser?.role);
  if (!isAdmin) {
    els.adminPanel.innerHTML = `
      <p class="muted">仅管理员可以进入此页面。</p>
      <button class="secondary" onclick="setActiveView('profile')">返回个人中心</button>
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
    <div class="profile-actions">
      <button class="primary" onclick="resetPassword()">管理员重置密码</button>
      <button class="secondary" onclick="setActiveView('profile')">返回个人中心</button>
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
window.openMerchantUpload = () => {
  if (!requireLogin('上传商家')) return;
  alert('上传商家需要填写名称、位置，可补充最多 8 张商家图和最多 3 个菜品。');
};
window.openAdminWorkbench = () => {
  const isAdmin = ['admin', 'super_admin'].includes(state.currentUser?.role);
  if (!isAdmin) {
    alert('仅管理员可进入管理员工作台。');
    return;
  }
  setActiveView('admin');
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
  renderMerchants();
  renderDetail();
  renderProfile();
  renderAdmin();
  setActiveView(state.activeView);
  await loadCurrentUser();
}

init();


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
