export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function showError(message, duration = 3000) {
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

export function showLoading(message = '加载中...') {
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

export function hideLoading() {
  const loader = document.getElementById('globalLoader');
  if (loader) loader.style.display = 'none';
}

export async function safeApiCall(fn, errorMsg = '操作失败') {
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
