import { requireClient } from './supabase.js';
import { showError } from './utils.js';

export async function compressImage(file, maxWidth = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('图片压缩失败'));
        },
        'image/webp',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('图片加载失败'));
    };
    img.src = objectUrl;
  });
}

export async function uploadImageToStorage(bucket, path, file, maxWidth = 1200, quality = 0.8) {
  const compressedBlob = await compressImage(file, maxWidth, quality);
  const client = await requireClient();
  if (!client) return null;

  const { error: uploadError } = await client.storage
    .from(bucket)
    .upload(path, compressedBlob, { contentType: 'image/webp' });

  if (uploadError) {
    showError(`图片上传失败：${uploadError.message}`);
    return null;
  }

  const { data: urlData } = client.storage.from(bucket).getPublicUrl(path);
  return urlData.publicUrl;
}
