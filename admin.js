import { state, els } from './state.js';
import { VALID_LOCATIONS } from './constants.js';
import { requireClient, requireAuth, isAdmin, invalidateAllCaches } from './supabase.js';
import { showError, safeApiCall } from './utils.js';
import { uploadImageToStorage } from './image.js';
import { renderPhotoStrip } from './render.js';
import { setCachedPlatformAverage } from './scoring.js';

export function toggleEditSection(sectionId, show) {
  const editSection = document.getElementById(sectionId);
  if (editSection) editSection.style.display = show ? 'block' : 'none';
}

export async function loadAdminData(forceRefresh = false) {
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

export async function renderAdmin() {
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

export async function renderAdminPendingMerchants() {
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

export async function renderAdminReportedReviews() {
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

export function renderAdminMerchantList(searchTerm = '') {
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

export function renderAdminMerchantDetail() {
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
        <span data-action="showEditMerchantName" data-merchant-id="${merchant.id}" data-current-name="${merchant.name}">修改名称</span>
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

export async function deleteMerchant(merchantId) {
  if (!confirm('确定要删除该商家吗？此操作不可恢复。')) return;

  const client = await requireClient();
  if (!client) return;

  const result = await safeApiCall(
    () => client.from('merchants').delete().eq('id', merchantId),
    '删除失败'
  );
  if (!result) return;

  showError('商家已删除', 2000);
  return true;
}

export async function saveMerchantName(merchantId) {
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
  return true;
}

export async function saveMerchantLocation(merchantId) {
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
  return true;
}

export async function updateMerchantCover(merchantId, inputElement) {
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
    return true;
  } catch (err) {
    showError(`操作失败：${err.message}`);
  }
}

export async function approveMerchant(merchantId) {
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
    setCachedPlatformAverage(null);
    return 'merged';
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
  setCachedPlatformAverage(null);
  return 'approved';
}

export async function rejectMerchant(merchantId) {
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
  return true;
}

export async function hideReview(reviewId) {
  const client = await requireClient();
  if (!client) return;

  const result = await safeApiCall(
    () => client.from('reviews').update({ status: 'hidden' }).eq('id', reviewId),
    '隐藏失败'
  );
  if (!result) return;

  showError('评价已隐藏', 2000);
  invalidateAllCaches();
  setCachedPlatformAverage(null);
  return true;
}

export async function dismissReports(reviewId) {
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
  return true;
}

export async function uploadMerchantImage(merchantId, inputElement) {
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
    return true;
  } catch (err) {
    showError(`图片处理失败：${err.message}`);
  }
}

export async function deleteMerchantImage(merchantId, imageUrl) {
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
  return true;
}

export function selectAdminMerchant(merchantId) {
  state.selectedMerchantId = merchantId;
  state.adminMerchantDetail = true;
  renderAdminMerchantDetail();
}

export function filterAdminMerchants(searchTerm) {
  renderAdminMerchantList(searchTerm);
}

export function showEditMerchantName(merchantId, currentName) {
  const nameInput = document.getElementById('editMerchantNameInput');
  toggleEditSection('editMerchantNameSection', true);
  if (nameInput) {
    nameInput.value = currentName;
    nameInput.focus();
  }
}

export function cancelEditMerchantName() {
  toggleEditSection('editMerchantNameSection', false);
}

export function showEditMerchantLocation() {
  toggleEditSection('editMerchantLocationSection', true);
}

export function cancelEditMerchantLocation() {
  toggleEditSection('editMerchantLocationSection', false);
}

export function openAdminWorkbench() {
  if (!isAdmin()) {
    alert('仅管理员可进入管理员工作台。');
    return;
  }
  state.adminMerchantDetail = false;
  state.selectedMerchantId = null;
}
