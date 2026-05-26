import { state } from './state.js';
import { showError } from './utils.js';

const supabaseConfig = window.__SUPABASE_CONFIG__ || {};
export const supabaseUrl = supabaseConfig.url || '';
export const supabaseAnonKey = supabaseConfig.anonKey || '';
export const authEmailDomain = supabaseConfig.emailDomain || 'meishi.local';

let supabaseClient = null;
let supabasePromise = null;

export async function ensureSupabaseClient() {
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

export async function requireClient(errorMsg = 'Supabase SDK 加载失败，请检查网络或稍后重试') {
  const client = await ensureSupabaseClient();
  if (!client) showError(errorMsg);
  return client;
}

export async function requireAuth(actionName) {
  if (!state.currentUser) {
    showError(`${actionName} 请先登录`);
    openAuthDialog();
    return null;
  }
  const client = await requireClient();
  if (!client) return null;
  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    showError('请先登录');
    return null;
  }
  return { client, user };
}

export function isAdmin() {
  return ['admin', 'super_admin'].includes(state.currentUser?.role);
}

export function invalidateAllCaches() {
  state.cachedAdminData = null;
  state.cachedAdminDataTime = 0;
}

export function studentIdToEmail(studentId) {
  return `${studentId}@${authEmailDomain}`;
}

export function studentIdValid(studentId) {
  return /^202[0-9][0-9]{4}$/.test(studentId);
}

function openAuthDialog() {
  if (!supabaseUrl || !supabaseAnonKey) {
    showError('请先在 window.__SUPABASE_CONFIG__ 中配置 Supabase URL 和 anon key');
    return;
  }
  requireClient().then(client => {
    if (client) {
      const authDialog = document.getElementById('authDialog');
      if (authDialog) authDialog.showModal();
    }
  });
}

export { openAuthDialog };
