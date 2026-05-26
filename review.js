import { state, els } from './state.js';
import { STAR_SVG } from './constants.js';
import { requireClient, requireAuth, openAuthDialog } from './supabase.js';
import { showError, safeApiCall } from './utils.js';
import { renderDetail } from './render.js';
import { setCachedPlatformAverage } from './scoring.js';

export async function reportReview(reviewId) {
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
  return true;
}

export async function writeReview() {
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

export function updateStarDisplay(rating) {
  const ratingSelector = document.getElementById('ratingSelector');
  const stars = ratingSelector.querySelectorAll('span');
  stars.forEach((star, index) => {
    star.classList.toggle('rating-star-filled', index < rating);
    star.classList.toggle('rating-star-empty', index >= rating);
  });
}

export async function handleConfirmReview(event) {
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
  return true;
}

export function submitFeedback() {
  if (!state.currentUser) {
    showError('提交反馈 请先登录');
    openAuthDialog();
    return;
  }
  alert('反馈功能开发中，反馈问题或建议请联系安财经济学院融媒体中心QQ：3425749029。非常感谢您的反馈！');
}
