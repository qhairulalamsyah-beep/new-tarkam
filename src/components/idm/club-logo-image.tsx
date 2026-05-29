'use client';

import Image from 'next/image';
import { getClubLogoUrl, isClubLogoPlaceholder, isCloudinaryUrl, CLUB_LOGO_PLACEHOLDER } from '@/lib/utils';
import { useState, useMemo } from 'react';
import type { CSSProperties } from 'react';

interface ClubLogoImageProps {
  clubName: string;
  dbLogo?: string | null;
  alt?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  sizes?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Club logo image component with graceful fallback handling.
 *
 * Priority:
 * 1. If dbLogo exists → render as optimized Image (Cloudinary or any URL)
 * 2. If no dbLogo → show letter-based fallback div immediately (no HTTP 404s)
 * 3. If Image fails to load (broken URL) → fall back to letter div
 *
 * This ensures we NEVER make HTTP requests for non-existent Cloudinary fallback images.
 */
export function ClubLogoImage({
  clubName,
  dbLogo,
  alt,
  width,
  height,
  fill,
  sizes,
  className,
  style,
}: ClubLogoImageProps) {
  const rawSrc = getClubLogoUrl(clubName, dbLogo);
  const isPlaceholder = isClubLogoPlaceholder(rawSrc);

  // Hooks must be called unconditionally (React rules of hooks)
  // Use rawSrc as key to reset errorStage when logo changes
  const [errorKey, setErrorKey] = useState(rawSrc);
  const [errorStage, setErrorStage] = useState(0);

  // Detect src change and reset error state (without useEffect to avoid lint warning)
  if (rawSrc !== errorKey) {
    setErrorKey(rawSrc);
    setErrorStage(0);
  }

  const handleError = () => {
    setErrorStage((prev) => Math.min(prev + 1, 2));
  };

  // If no logo available (placeholder marker) or error exhausted, show letter fallback
  // This prevents 404 HTTP requests for non-existent Cloudinary fallback images
  if (rawSrc === CLUB_LOGO_PLACEHOLDER || errorStage === 2) {
    return renderLetterFallback(clubName, alt, width, height, fill, className, style);
  }

  // On error stage 1, retry with the raw (non-optimized) URL in case
  // the Cloudinary transformation URL is broken but the original works
  const imgSrc = errorStage >= 1 && isCloudinaryUrl(rawSrc) ? rawSrc : rawSrc;

  // Only use unoptimized for data URI placeholders and error retry —
  // Cloudinary URLs go through the custom cloudinary-loader which handles optimization.
  const shouldUnoptimize = isPlaceholder || errorStage >= 1;

  if (fill) {
    return (
      <Image
        src={imgSrc}
        alt={alt || clubName}
        fill
        sizes={sizes}
        className={className}
        style={style}
        unoptimized={shouldUnoptimize}
        onError={handleError}
      />
    );
  }

  return (
    <Image
      src={imgSrc}
      alt={alt || clubName}
      width={width || 32}
      height={height || 32}
      className={className}
      style={style}
      unoptimized={shouldUnoptimize}
      onError={handleError}
    />
  );
}

/** Render a styled letter fallback div for clubs without logos */
function renderLetterFallback(
  clubName: string,
  alt?: string,
  width?: number,
  height?: number,
  fill?: boolean,
  className?: string,
  style?: CSSProperties,
) {
  const letter = clubName.charAt(0).toUpperCase();
  const size = fill ? undefined : (width || 32);
  const containerStyle: CSSProperties = fill
    ? { ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }
    : { ...style, width: size, height: size || width || 32, display: 'flex', alignItems: 'center', justifyContent: 'center' };

  return (
    <div
      className={className}
      style={containerStyle}
      role="img"
      aria-label={alt || clubName}
    >
      <span className="text-idm-gold-warm font-bold select-none" style={{ fontSize: fill ? '1.25rem' : `${(size || 32) * 0.5}px` }}>
        {letter}
      </span>
    </div>
  );
}
