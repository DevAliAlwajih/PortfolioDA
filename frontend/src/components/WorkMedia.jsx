import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icons.jsx';

/**
 * WorkMedia component
 * Props:
 * - src: image URL string
 * - alt: image alt text (attribute only)
 * - variant: "cover" | "step" | "thumb" (also supports legacy "card" / "showcase")
 * - onOpen: callback function when clicked / Enter / Space pressed
 * - caption: optional caption string (real admin-written only)
 * - work: optional work object (for placeholder icon/type fallback)
 * - className: optional CSS class
 */
export function WorkMedia({
  src,
  alt = '',
  variant = 'card',
  onOpen,
  caption,
  work,
  className = '',
  onClick
}) {
  const [shape, setShape] = useState(null); // 'portrait' | 'landscape'
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Support both src prop directly or work.imageUrl
  const imageSrc = src !== undefined ? src : (work?.imageUrl || '');
  const handleOpen = onOpen || onClick;

  const onLoad = (e) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setShape(img.naturalHeight > img.naturalWidth ? 'portrait' : 'landscape');
      setLoaded(true);
    }
  };

  const onError = () => {
    setFailed(true);
    setLoaded(true);
  };

  const placeholder = !imageSrc || failed;
  const portrait = shape === 'portrait';
  const workType = work?.type || 'WEB';

  const onKeyDown = (e) => {
    if (handleOpen && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      handleOpen(e);
    }
  };

  return (
    <div
      className={`work-media work-media-${variant} ${portrait ? 'is-portrait' : 'is-landscape'} ${placeholder ? 'is-placeholder' : ''} ${handleOpen ? 'is-zoomable' : ''} ${!loaded && !placeholder ? 'is-loading' : ''} ${className}`}
      style={imageSrc && !failed ? { '--work-image': `url("${imageSrc}")` } : undefined}
      onClick={handleOpen}
      role={handleOpen ? 'button' : undefined}
      tabIndex={handleOpen ? 0 : undefined}
      onKeyDown={onKeyDown}
      aria-label={handleOpen ? (alt ? `Zoom ${alt}` : 'Zoom image') : undefined}
    >
      {/* Blurred background copy for contain frame */}
      {imageSrc && !failed && <div className="work-media-backdrop" aria-hidden="true" />}

      {/* Shimmer skeleton while loading */}
      {!loaded && !placeholder && <div className="work-media-skeleton" aria-hidden="true" />}

      {placeholder ? (
        <div className="work-media-placeholder">
          <Icon name={workType === 'MOBILE' ? 'phone' : 'briefcase'} size={34} />
          <b>{(work?.titleAr || work?.titleEn || workType || 'Work').slice(0, 2)}</b>
        </div>
      ) : (
        <>
          {portrait ? (
            <div className="work-phone">
              <i className="phone-notch" aria-hidden="true" />
              <img
                src={imageSrc}
                alt={alt}
                loading="lazy"
                decoding="async"
                onLoad={onLoad}
                onError={onError}
              />
            </div>
          ) : (
            <div className="work-browser">
              <i className="browser-dots" aria-hidden="true" />
              <img
                src={imageSrc}
                alt={alt}
                loading="lazy"
                decoding="async"
                onLoad={onLoad}
                onError={onError}
              />
            </div>
          )}

          {/* Hidden probe to determine natural dimensions if not yet known */}
          {!shape && (
            <img
              className="work-media-probe"
              src={imageSrc}
              alt=""
              aria-hidden="true"
              onLoad={onLoad}
              onError={onError}
            />
          )}
        </>
      )}

      {caption && <div className="work-media-caption">{caption}</div>}
    </div>
  );
}

export default WorkMedia;
