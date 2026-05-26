import { state, els } from './state.js';
import { ensureSupabaseClient, requireClient, requireAuth, studentIdToEmail, studentIdValid } from './supabase.js';
import { showError, safeApiCall } from './utils.js';
import { compressImage } from './image.js';
import { renderProfile, renderDetail, setActiveView } from './render.js';
import { renderAdmin } from './admin.js';
import { setCachedPlatformAverage } from './scoring.js';

export async function loadCurrentUser() {
  const client = await ensureSupabaseClient();
  if (!client) return;

  const { data: { user }, error: authError } = await client.auth.getUser();

  if (authError || !user) {
    state.currentUser = null;
    renderProfile();
    renderAdmin();
    return;
  }

  const { data: profile, error } = await client
    .from('users')
    .select('student_id, nickname, role, avatar_url')
    .eq('id', user.id)
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
    avatarUrl: profile.avatar_url,
  };

  renderProfile();
  renderAdmin();
}

export async function logout() {
  const client = await ensureSupabaseClient();
  if (client) {
    await client.auth.signOut();
  }
  state.currentUser = null;
  renderProfile();
  renderAdmin();
  setActiveView('food');
  showError('已退出登录', 2000);
}

export function openEditProfile() {
  if (!state.currentUser) {
    showError('请先登录');
    return;
  }
  els.editNickname.value = state.currentUser.nickname || '';
  els.currentPassword.value = '';
  els.newPassword.value = '';
  els.confirmNewPassword.value = '';
  els.editProfileDialog.showModal();
}

export async function handleConfirmLogin(event) {
  event.preventDefault();
  const studentId = els.studentIdInput.value.trim();
  const password = els.passwordInput.value.trim();
  if (!studentIdValid(studentId)) {
    showError('学号错误');
    return;
  }
  if (!password) {
    showError('请输入密码');
    return;
  }
  const client = await requireClient();
  if (!client) return;

  const email = studentIdToEmail(studentId);
  const { error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.includes('Invalid login credentials') || error.message.includes('user not found')) {
      if (password === studentId) {
        const { data, error: signUpError } = await client.auth.signUp({ email, password });
        if (signUpError) {
          showError(`自动注册失败：${signUpError.message}`);
          return;
        }
        const authUser = data.user;
        if (!authUser) {
          showError('自动注册失败：未返回用户信息');
          return;
        }
        if (!data.session) {
          showError('自动注册成功，但当前未建立登录会话。请在 Supabase Auth 设置中关闭 Confirm email 后重试');
          return;
        }
        const profileResult = await safeApiCall(
          () => client.from('users').insert({
            id: authUser.id,
            student_id: studentId,
            nickname: studentId,
            role: studentId === '20233897' ? 'super_admin' : 'user',
          }),
          '自动注册成功，但写入资料失败'
        );
        if (!profileResult) return;

        els.authDialog.close();
        els.passwordInput.value = '';
        showError('首次登录，建议尽快修改密码和昵称', 4000);
        await loadCurrentUser();
        setActiveView(state.activeView === 'admin' ? 'profile' : state.activeView);
        return;
      }
      showError('请先注册');
      els.authDialog.close();
      els.passwordInput.value = '';
      els.registerStudentIdInput.value = studentId;
      els.registerDialog.showModal();
      return;
    }
    showError(`登录失败：${error.message}`);
    return;
  }

  els.authDialog.close();
  els.passwordInput.value = '';
  await loadCurrentUser();
  setActiveView(state.activeView === 'admin' ? 'profile' : state.activeView);
}

export async function handleConfirmRegister(event) {
  event.preventDefault();
  const studentId = els.registerStudentIdInput.value.trim();
  const nickname = els.registerNicknameInput.value.trim();
  const password = els.registerPasswordInput.value.trim();

  if (!nickname) {
    showError('请输入昵称');
    return;
  }
  if (nickname.length > 20) {
    showError('昵称不能超过20个字符');
    return;
  }
  if (!studentIdValid(studentId)) {
    showError('学号错误');
    return;
  }
  if (!password) {
    showError('请输入密码');
    return;
  }
  const client = await requireClient();
  if (!client) return;

  const email = studentIdToEmail(studentId);
  const { data, error } = await client.auth.signUp({
    email,
    password,
  });

  if (error) {
    showError(`注册失败：${error.message}`);
    return;
  }

  const authUser = data.user;
  if (!authUser) {
    showError('注册失败：未返回用户信息');
    return;
  }
  if (!data.session) {
    showError('注册成功，但当前未建立登录会话。请在 Supabase Auth 设置中关闭 Confirm email 后重试');
    return;
  }

  const profileResult = await safeApiCall(
    () => client.from('users').insert({
      id: authUser.id,
      student_id: studentId,
      nickname,
      role: studentId === '20233897' ? 'super_admin' : 'user',
    }),
    '注册成功，但写入资料失败'
  );
  if (!profileResult) return;

  els.registerDialog.close();
  els.registerNicknameInput.value = '';
  els.registerStudentIdInput.value = '';
  els.registerPasswordInput.value = '';
  await loadCurrentUser();
  setActiveView('profile');
}

export async function handleConfirmEditProfile(event) {
  event.preventDefault();

  const newNickname = els.editNickname.value.trim();
  const currentPwd = els.currentPassword.value;
  const newPwd = els.newPassword.value;
  const confirmPwd = els.confirmNewPassword.value;

  if (!newNickname && !currentPwd && !newPwd) {
    showError('请至少修改一项内容');
    return;
  }

  if (newNickname && newNickname.length > 20) {
    showError('昵称不能超过20个字符');
    return;
  }

  if (newPwd || confirmPwd || currentPwd) {
    if (!currentPwd) {
      showError('请输入当前密码');
      return;
    }
    if (!newPwd) {
      showError('请输入新密码');
      return;
    }
    if (newPwd !== confirmPwd) {
      showError('两次输入的新密码不一致');
      return;
    }
    if (newPwd.length < 6) {
      showError('新密码至少6个字符');
      return;
    }
  }

  const client = await requireClient();
  if (!client) return;

  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    showError('请先登录');
    return;
  }

  if (currentPwd && newPwd) {
    const email = user.email;
    const { error: signInError } = await client.auth.signInWithPassword({
      email,
      password: currentPwd,
    });

    if (signInError) {
      showError('当前密码错误');
      return;
    }

    const { error: updateError } = await client.auth.updateUser({
      password: newPwd,
    });

    if (updateError) {
      showError(`密码修改失败：${updateError.message}`);
      return;
    }
  }

  if (newNickname && newNickname !== state.currentUser.nickname) {
    const nicknameResult = await safeApiCall(
      () => client.from('users').update({ nickname: newNickname }).eq('id', user.id),
      '昵称修改失败'
    );
    if (!nicknameResult) return;

    state.currentUser.nickname = newNickname;
  }

  els.editProfileDialog.close();
  showError('个人资料已更新', 2000);
  await loadCurrentUser();
}

export async function handleAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showError('请选择图片文件');
    event.target.value = '';
    return;
  }

  const auth = await requireAuth('上传头像');
  if (!auth) return;

  try {
    const fileName = `${auth.user.id}/avatar.webp`;
    const { error: uploadError } = await auth.client.storage
      .from('avatars')
      .upload(fileName, await compressImage(file, 200, 0.8), {
        contentType: 'image/webp',
        upsert: true,
      });

    if (uploadError) {
      showError(`头像上传失败：${uploadError.message}`);
      return;
    }

    const { data: urlData } = auth.client.storage
      .from('avatars')
      .getPublicUrl(fileName);

    const avatarUrl = urlData.publicUrl + '?t=' + Date.now();

    const { error: updateError } = await auth.client
      .from('users')
      .update({ avatar_url: avatarUrl.split('?')[0] })
      .eq('id', auth.user.id);

    if (updateError) {
      showError(`头像更新失败：${updateError.message}`);
      return;
    }

    state.currentUser.avatarUrl = avatarUrl;
    const avatarImg = document.getElementById('profileAvatar');
    if (avatarImg) {
      avatarImg.src = avatarUrl;
    }
    showError('头像更新成功', 2000);
  } catch (err) {
    showError(`头像处理失败：${err.message}`);
  }
}
