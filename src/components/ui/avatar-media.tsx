'use client';

import Image from 'next/image';
import { cn, isVideoUrl, isCloudinaryUrl, getVideoPosterUrl, getOptimizedVideoUrl } from '@/lib/utils';

interface AvatarMediaProps {
  /** Avatar URL — can be image or video (mp4, Cloudinary /video/upload/, etc.) */
  src: string;
  /** Alt text for accessibility */
  alt: string;
  /** Additional CSS classes */
  className?: string;
  /** Image fill mode — uses absolute positioning (for hero banners) */
  fill?: boolean;
  /** Width for explicit sizing (non-fill mode) */
  width?: number;
  /** Height for explicit sizing (non-fill mode) */
  height?: number;
  /** Sizes attribute for Next.js Image optimization */
  sizes?: string;
  /** Object fit class */
  objectFit?: 'cover' | 'contain' | 'fill';
  /** Object position class (default: center 37% for avatars) */
  objectPosition?: string;
  /** Whether to lazy load (default: true) */
  loading?: 'lazy' | 'eager';
  /** Whether to unoptimize the image (for Cloudinary external URLs) */
  unoptimized?: boolean;
  /** Video specific: auto play (default: false — only plays inside profile modal) */
  autoPlay?: boolean;
  /** Video specific: loop (default: true) */
  loop?: boolean;
  /** Video specific: muted (default: true — required for autoplay) */
  muted?: boolean;
  /** Video specific: plays inline (default: true — required for autoplay on mobile) */
  playsInline?: boolean;
  /** Priority loading for above-the-fold content */
  priority?: boolean;
  /** Additional inline styles (merged with internal objectPosition) */
  style?: React.CSSProperties;
}

/**
 * AvatarMedia — Renders an image OR video based on the URL type.
 *
 * - For image URLs: uses Next.js <Image> component with Cloudinary loader
 * - For video URLs (mp4, Cloudinary /video/upload/): shows poster/thumbnail by default
 *   Pass autoPlay={true} ONLY inside the player profile modal
 *
 * Usage:
 * ```tsx
 * // Image avatar
 * <AvatarMedia src={avatarSrc} alt={gamertag} fill />
 *
 * // Video avatar (auto-detected)
 * <AvatarMedia src="https://res.cloudinary.com/.../video/upload/v123/avatars/clip.mp4" alt={gamertag} fill />
 * ```
 */
export function AvatarMedia({
  src,
  alt,
  className,
  fill = false,
  width,
  height,
  sizes,
  objectFit = 'cover',
  objectPosition = 'center 37%',
  loading = 'lazy',
  unoptimized: unoptimizedProp,
  autoPlay = false,
  loop = true,
  muted = true,
  playsInline = true,
  priority = false,
  style,
}: AvatarMediaProps) {
  if (!src) return null;

  // ★ Auto-detect Cloudinary URLs → unoptimized to avoid srcSet issues on Vercel.
  // With custom loader + unoptimized=false, next/image generates srcSet with
  // multiple Cloudinary URLs at different widths. On Vercel production, the
  // browser may fail to select the correct srcSet entry, resulting in blank images.
  // Setting unoptimized=true uses a single <img src> directly — more reliable.
  const unoptimized = unoptimizedProp ?? isCloudinaryUrl(src);

  const isVideo = isVideoUrl(src);
  const objectFitClass = objectFit === 'cover' ? 'object-cover' : objectFit === 'contain' ? 'object-contain' : 'object-fill';

  if (isVideo) {
    const videoSrc = autoPlay ? getOptimizedVideoUrl(src) : '';
    const posterSrc = getVideoPosterUrl(src);

    const mergedStyle = { objectPosition, ...style };
    // When not autoplaying, only load the poster image (not the video file)
    // This saves significant bandwidth — video only loads when profile modal opens
    const preloadStrategy = autoPlay ? 'auto' : 'none';

    // ★ Thumbnail-only mode (default): show poster image, no video download
    // Video <source> is only set when autoPlay=true (inside profile modal)
    // This means 0 bytes of video data for listing pages, fast poster-only display
    if (fill) {
      return (
        <video
          src={videoSrc || undefined}
          poster={posterSrc || undefined}
          autoPlay={autoPlay}
          loop={loop}
          muted={muted}
          playsInline={playsInline}
          className={cn('absolute inset-0 w-full h-full', objectFitClass, className)}
          style={mergedStyle}
          aria-label={alt}
          preload={preloadStrategy}
        />
      );
    }

    return (
      <video
        src={videoSrc || undefined}
        poster={posterSrc || undefined}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        playsInline={playsInline}
        width={width}
        height={height}
        className={cn(objectFitClass, className)}
        style={mergedStyle}
        aria-label={alt}
        preload={preloadStrategy}
      />
    );
  }

  const mergedStyle = { objectPosition, ...style };

  // Image avatar — use Next.js Image
  // ★ When unoptimized=true (Cloudinary URLs), we use a plain <img> tag to bypass
  // next/image srcSet generation entirely. This is more reliable on Vercel production
  // where the custom Cloudinary loader + srcSet can cause blank images.
  if (unoptimized) {
    // Use Cloudinary loader to generate optimized URL at a reasonable width
    const displayWidth = fill ? 512 : (width || 80);
    const optimizedSrc = isCloudinaryUrl(src)
      ? src.replace('/image/upload/', `/image/upload/f_auto,q_auto:good,w_${Math.min(displayWidth * 2, 1280)},c_limit/`)
      : src;

    if (fill) {
      return (
        <img
          src={optimizedSrc}
          alt={alt}
          className={cn('absolute inset-0 w-full h-full', objectFitClass, className)}
          style={mergedStyle}
          loading={priority ? 'eager' : loading}
          decoding="async"
        />
      );
    }

    return (
      <img
        src={optimizedSrc}
        alt={alt}
        width={width || 80}
        height={height || 80}
        className={cn(objectFitClass, className)}
        style={mergedStyle}
        loading={priority ? 'eager' : loading}
        decoding="async"
      />
    );
  }

  // Non-Cloudinary images: use next/image with srcSet optimization
  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes || '(max-width: 640px) 100vw, 512px'}
        className={cn('absolute inset-0', objectFitClass, className)}
        style={mergedStyle}
        loading={priority ? 'eager' : loading}
        priority={priority}
        unoptimized={false}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width || 80}
      height={height || 80}
      sizes={sizes}
      className={cn(objectFitClass, className)}
      style={mergedStyle}
      loading={priority ? 'eager' : loading}
      priority={priority}
      unoptimized={false}
    />
  );
}
