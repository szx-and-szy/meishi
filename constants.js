export const LOCATIONS = [
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

export const VALID_LOCATIONS = LOCATIONS.filter(loc => loc !== '全部');

export const STAR_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';

export const RATING_SORT_OPTIONS = [
  { value: 'none', label: '无排序' },
  { value: 'desc', label: '由高到低' },
  { value: 'asc', label: '由低到高' },
];

export const FALLBACK_COVER = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80';
