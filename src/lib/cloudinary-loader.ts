import type { ImageLoader } from 'next/image';

const cloudinaryLoader: ImageLoader = ({ src, width, quality }) => {
  // ★ Strip _cb cache-bust suffix — Cloudinary URLs already include version
  // numbers (/v12345/) that change on upload, so _cb is unnecessary.
  // More importantly, _cb causes preload/Image URL mismatch: the <link rel="preload">
  // in page.tsx uses the clean URL, but if the loader returns _cb URLs,
  // the browser downloads the image TWICE.
  let cleanSrc = src;
  if (src.includes('_cb=')) {
    cleanSrc = src.replace(/\?_cb=\d+_[^/&\s]*/, '');
    // Also handle _cb as part of existing query params
    cleanSrc = cleanSrc.replace(/&_cb=\d+_[^/&\s]*/, '');
  }

  // ★ Video URLs — return as-is (Next.js Image can't render videos,
  // but the AvatarMedia component handles video separately via <video> tag)
  if (cleanSrc.includes('/video/upload/') || cleanSrc.includes('/video/') || cleanSrc.endsWith('.mp4') || cleanSrc.endsWith('.webm')) {
    return cleanSrc;
  }

  // ★ Cloudinary: inject f_auto + q_auto + width + c_limit
  if (cleanSrc.includes('res.cloudinary.com')) {
    // If URL already has Cloudinary transformation params (from getOptimizedCloudinaryUrl),
    // the image is already optimized — return as-is without re-processing.
    if (cleanSrc.includes('/image/upload/f_') || cleanSrc.includes('/image/upload/q_')) {
      return cleanSrc;
    }
    const optimizedWidth = Math.min(width, 1920);
    return cleanSrc.replace(
      '/image/upload/',
      `/image/upload/f_auto,q_auto:good,w_${optimizedWidth},c_limit/`
    );
  }

  // ★ YouTube thumbnails — YouTube CDN already optimizes, return as-is
  if (src.includes('img.youtube.com') || src.includes('i.ytimg.com')) {
    return src;
  }

  // ★ Local images (/logo1.webp, dll) — add width query param for cache busting
  if (src.startsWith('/')) {
    const separator = src.includes('?') ? '&' : '?';
    return `${src}${separator}w=${Math.min(width, 1920)}`;
  }

  // ★ Fallback: return as-is for any other external URLs
  return src;
};

export default cloudinaryLoader;
