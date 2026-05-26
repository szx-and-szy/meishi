import { state } from './state.js';

let cachedPlatformAverage = null;

export function getCachedPlatformAverage() {
  return cachedPlatformAverage;
}

export function setCachedPlatformAverage(val) {
  cachedPlatformAverage = val;
}

export function getPlatformAverage() {
  if (cachedPlatformAverage !== null) return cachedPlatformAverage;
  const allReviews = Object.values(state.merchantReviews).flat();
  if (!allReviews.length) {
    cachedPlatformAverage = 0;
    return 0;
  }
  cachedPlatformAverage = allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length;
  return cachedPlatformAverage;
}

export function bayesianScore(merchantId) {
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

export function merchantSummary(merchant) {
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

export function getFilteredMerchants() {
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
