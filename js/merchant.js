import { state, els } from './state.js';
import { VALID_LOCATIONS, FALLBACK_COVER } from './constants.js';
import { ensureSupabaseClient, requireClient, requireAuth, openAuthDialog } from './supabase.js';
import { showError, safeApiCall, showLoading, hideLoading } from './utils.js';
import { compressImage, uploadImageToStorage } from './image.js';
import { renderMerchants, renderDetail, setActiveView } from './render.js';
import { setCachedPlatformAverage } from './scoring.js';

export async function loadMerchants() {
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

  setCachedPlatformAverage(null);
  renderMerchants();
}

export function selectMerchant(merchantId) {
  state.foodScrollPosition = window.scrollY;
  state.selectedMerchantId = merchantId;
  renderDetail();
  setActiveView('detail');
  window.scrollTo(0, 0);
}

export function backToFood() {
  state.selectedMerchantId = null;
  setActiveView('food');
  setTimeout(() => {
    window.scrollTo(0, state.foodScrollPosition);
  }, 0);
}

export function openMerchantUpload() {
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

export function cancelMerchantUploadPage() {
  els.uploadMerchantCoverPage.value = '';
  els.uploadMerchantPreviewPage.innerHTML = '';
  state.uploadedImageUrlPage = null;
  setActiveView('food');
}

export async function handleMerchantCoverChange(event) {
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
}

export async function handleMerchantUpload(event) {
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
}
