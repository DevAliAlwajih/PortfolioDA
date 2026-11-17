import { useEffect, useRef, useState } from 'react';
import { useLang } from '../i18n.jsx';
import { Lightbox } from './Lightbox.jsx';
import { WorkMedia } from './WorkMedia.jsx';

function isExternalUrl(raw = '') {
  return /^https?:\/\//i.test(raw) || /^mailto:/i.test(raw) || /^tel:/i.test(raw);
}

function GalleryScroller({ images, caption, onOpen }) {
  const { lang } = useLang();
  const isRtl = lang === 'ar';
  const scrollerRef = useRef(null);
  const dragMovedRef = useRef(false);
  const dragStartRef = useRef({ x: 0, left: 0 });
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const syncState = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const isOverflow = el.scrollWidth > el.clientWidth + 1;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const left = isRtl ? -el.scrollLeft : el.scrollLeft;
    setCanScrollPrev(isOverflow && (isRtl ? left < -1 : left > 1));
    setCanScrollNext(isOverflow && (isRtl ? left > -maxScroll + 1 : left < maxScroll - 1));
  };

  useEffect(() => {
    syncState();
    const el = scrollerRef.current;
    if (!el) return undefined;
    const onScroll = () => syncState();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', syncState);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', syncState);
    };
  }, [images.length, isRtl]);

  const stepScroll = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(140, el.clientWidth * 0.8);
    const sign = dir * (isRtl ? -1 : 1);
    el.scrollBy({ left: sign * amount, behavior: 'smooth' });
  };

  const onPointerDown = (event) => {
    dragMovedRef.current = false;
    dragStartRef.current = { x: event.clientX, left: scrollerRef.current?.scrollLeft ?? 0 };
  };

  const onPointerMove = (event) => {
    if (!scrollerRef.current) return;
    const delta = Math.abs(event.clientX - dragStartRef.current.x);
    if (delta > 6) dragMovedRef.current = true;
  };

  const onPointerUp = () => {
    requestAnimationFrame(() => {
      dragMovedRef.current = false;
    });
  };

  const handleTileOpen = (index) => {
    if (dragMovedRef.current) return;
    onOpen(index);
  };

  const regionLabel = caption || 'Gallery / المعرض';

  return (
    <div className="section-gallery-shell">
      <div className="section-gallery-actions">
        {images.length > 1 && canScrollPrev && (
          <button type="button" className="section-gallery-arrow section-gallery-arrow-prev" aria-label={isRtl ? 'Next' : 'Previous'} onClick={() => stepScroll(isRtl ? 1 : -1)}>
            {isRtl ? '→' : '←'}
          </button>
        )}
        <div
          ref={scrollerRef}
          className="section-gallery-scroller"
          tabIndex={0}
          role="region"
          aria-label={regionLabel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onKeyDown={(event) => {
            const key = event.key;
            if (key === 'ArrowLeft') {
              event.preventDefault();
              stepScroll(isRtl ? 1 : -1);
            }
            if (key === 'ArrowRight') {
              event.preventDefault();
              stepScroll(isRtl ? -1 : 1);
            }
            if (key === 'Enter' && document.activeElement?.dataset.galleryIndex) {
              event.preventDefault();
              onOpen(Number(document.activeElement.dataset.galleryIndex));
            }
          }}
        >
          {images.map((src, index) => (
            <WorkMedia
              key={`${caption || 'gallery'}-${index}`}
              src={src}
              alt={regionLabel}
              variant="thumb"
              onOpen={() => handleTileOpen(index)}
              className="section-gallery-tile"
            />
          ))}
        </div>
        {images.length > 1 && canScrollNext && (
          <button type="button" className="section-gallery-arrow section-gallery-arrow-next" aria-label={isRtl ? 'Previous' : 'Next'} onClick={() => stepScroll(isRtl ? -1 : 1)}>
            {isRtl ? '←' : '→'}
          </button>
        )}
      </div>
      <div className="section-gallery-meta">
        <span>{images.length} {images.length === 1 ? 'image' : 'images'} / {images.length === 1 ? 'صورة' : 'صور'}</span>
        {caption && <small>{caption}</small>}
      </div>
    </div>
  );
}

export function Blocks({ blocks = [] }) {
  const { tr } = useLang();
  const [lightbox, setLightbox] = useState(null);

  const renderBlock = (block) => {
    const d = block?.data || {};

    if (block.type === 'HEADING') {
      const level = d.level === 3 ? 3 : 2;
      const Tag = level === 3 ? 'h3' : 'h2';
      const text = tr(d, 'text');
      if (!text) return null;
      return (
        <Tag key={block.id} id={`section-block-${block.id}`} className="section-block-heading">
          {text}
        </Tag>
      );
    }

    if (block.type === 'TEXT') {
      const text = tr(d, 'text');
      if (!text) return null;
      return (
        <div key={block.id} className="section-copy">
          {text.split(/\n+/).filter(Boolean).map((paragraph, index) => (
            <p key={`${block.id}-${index}`}>{paragraph}</p>
          ))}
        </div>
      );
    }

    if (block.type === 'IMAGE') {
      const src = d.url;
      const caption = tr(d, 'caption');
      if (!src) return null;
      return (
        <figure key={block.id} className="section-figure">
          <WorkMedia
            src={src}
            alt={caption || 'Section image'}
            variant="cover"
            onOpen={() => setLightbox({ images: [src], index: 0 })}
          />
          {caption && <figcaption>{caption}</figcaption>}
        </figure>
      );
    }

    if (block.type === 'GALLERY') {
      const images = (d.images || []).filter(Boolean);
      const caption = tr(d, 'caption') || tr(d, 'title') || 'Gallery';
      if (!images.length) return null;
      if (images.length === 1) {
        return (
          <figure key={block.id} className="section-figure">
            <WorkMedia
              src={images[0]}
              alt={caption}
              variant="cover"
              onOpen={() => setLightbox({ images, index: 0 })}
            />
            {caption && <figcaption>{caption}</figcaption>}
          </figure>
        );
      }
      return (
        <div key={block.id} className="section-gallery-wrap">
          <GalleryScroller images={images} caption={caption} onOpen={(index) => setLightbox({ images, index })} />
        </div>
      );
    }

    if (block.type === 'LINK') {
      const href = d.url;
      const label = tr(d, 'title') || href || 'Open link';
      if (!href) return null;
      return (
        <a key={block.id} className="section-link" href={href} target={isExternalUrl(href) ? '_blank' : undefined} rel={isExternalUrl(href) ? 'noopener noreferrer' : undefined}>
          {label}
          <span aria-hidden="true">↗</span>
        </a>
      );
    }

    if (block.type === 'BUTTON') {
      const href = d.url;
      const label = tr(d, 'label') || 'Open';
      if (!href) return null;
      return (
        <a
          key={block.id}
          className="section-button"
          href={href}
          target={isExternalUrl(href) ? '_blank' : undefined}
          rel={isExternalUrl(href) ? 'noopener noreferrer' : undefined}
          style={{ background: d.color || '#6fd0ff', color: '#07101e' }}
        >
          {label}
        </a>
      );
    }

    if (block.type === 'FILE') {
      const href = d.url;
      const label = tr(d, 'title') || d.name || 'Download file';
      if (!href) return null;
      return (
        <a key={block.id} className="section-file" href={href} download={d.name || undefined} target={isExternalUrl(href) ? '_blank' : undefined} rel={isExternalUrl(href) ? 'noopener noreferrer' : undefined}>
          <span className="section-file-icon" aria-hidden="true">↓</span>
          <span className="section-file-label">{label}</span>
          {d.size > 0 && <small>{d.size >= 1048576 ? `${(d.size / 1048576).toFixed(1)} MB` : `${Math.ceil(d.size / 1024)} KB`}</small>}
        </a>
      );
    }

    return null;
  };

  return (
    <>
      <div className="section-blocks">
        {(blocks || []).map((block) => renderBlock(block))}
      </div>
      {lightbox && (
        <Lightbox
          images={lightbox.images}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}

export default Blocks;

