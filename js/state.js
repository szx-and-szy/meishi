import { LOCATIONS } from './constants.js';

export const state = {
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

export const els = {
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

let _searchDebounceTimer = null;

export function getSearchDebounceTimer() {
  return _searchDebounceTimer;
}

export function setSearchDebounceTimer(timer) {
  _searchDebounceTimer = timer;
}
