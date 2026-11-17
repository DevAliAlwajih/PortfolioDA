import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '../i18n.jsx';

export function Lightbox({ images = [], initialIndex = 0, onClose }) {
  const { lang } = useLang();
  const isRtl = lang === 'ar' || document.documentElement.dir === 'rtl';

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  const containerRef = useRef(null);
  const prevFocusRef = useRef(null);
  const touchStartRef = useRef({ dist: 0, scale: 1 });
  const portalRootRef = useRef(null);

  useEffect(() => {
    prevFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const previousPosition = document.body.style.position;
    const previousTop = document.body.style.top;
    const scrollY = window.scrollY;

    document.body.classList.add('lightbox-open');
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    const root = document.createElement('div');
    root.setAttribute('data-lightbox-root', 'true');
    document.body.appendChild(root);
    portalRootRef.current = root;

    const markerUrl = new URL(window.location.href);
    markerUrl.hash = 'lightbox-open';
    window.history.pushState({ lightboxOpen: true }, '', markerUrl);

    const handlePopState = () => {
      if (window.location.hash !== '#lightbox-open') {
        onClose?.();
      }
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      document.body.classList.remove('lightbox-open');
      document.body.style.overflow = previousOverflow;
      document.body.style.position = previousPosition;
      document.body.style.top = previousTop;
      document.body.style.width = '';
      if (portalRootRef.current) {
        portalRootRef.current.remove();
      }
      if (prevFocusRef.current && typeof prevFocusRef.current.focus === 'function') {
        prevFocusRef.current.focus();
      }
      window.scrollTo({ top: scrollY, behavior: 'auto' });
    };
  }, [onClose]);

  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  const setClampedScale = useCallback((updater) => {
    setScale((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const clamped = Math.max(1, Math.min(5, Number(next.toFixed(2))));
      if (clamped === 1) {
        setPosition({ x: 0, y: 0 });
      }
      return clamped;
    });
  }, []);

  const nextImage = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % Math.max(images.length, 1));
  }, [images.length]);

  const prevImage = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + Math.max(images.length, 1)) % Math.max(images.length, 1));
  }, [images.length]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
        return;
      }
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setClampedScale((s) => s + 0.3);
        return;
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setClampedScale((s) => s - 0.3);
        return;
      }
      if (e.key === '0') {
        e.preventDefault();
        setClampedScale(1);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (isRtl) prevImage();
        else nextImage();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (isRtl) nextImage();
        else prevImage();
        return;
      }

      if (e.key === 'Tab' && containerRef.current) {
        const focusable = containerRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length > 0) {
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, setClampedScale, isRtl, nextImage, prevImage]);

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    setClampedScale((s) => s + delta);
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    setClampedScale((s) => (s > 1 ? 1 : 2));
  };

  const handleMouseDown = (e) => {
    if (scale <= 1 || e.button !== 0) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging || scale <= 1) return;
    e.preventDefault();
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPosition({
      x: dragStartRef.current.posX + dx,
      y: dragStartRef.current.posY + dy
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartRef.current = { dist, scale };
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && touchStartRef.current.dist > 0) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchStartRef.current.dist;
      setClampedScale(touchStartRef.current.scale * factor);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === containerRef.current && scale === 1) {
      onClose?.();
    }
  };

  if (!images.length) return null;

  const currentImage = images[currentIndex] || images[0];
  const ui = (
    <div
      ref={containerRef}
      className="work-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Image gallery zoom"
      onClick={handleBackdropClick}
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      <div className="work-lightbox-topbar">
        <button
          type="button"
          className="work-lightbox-btn work-lightbox-back"
          onClick={onClose}
          aria-label="Back to gallery"
          title="Back"
        >
          <span aria-hidden="true">←</span>
          <span>{isRtl ? 'الخلف' : 'Back'}</span>
        </button>

        <span className="work-lightbox-counter" aria-live="polite">
          {currentIndex + 1} / {images.length}
        </span>

        <button
          type="button"
          className="work-lightbox-btn work-lightbox-close"
          onClick={onClose}
          aria-label="Close zoom"
          title="Close (Esc)"
        >
          ✕
        </button>
      </div>

      {images.length > 1 && (
        <>
          <button
            type="button"
            className="work-lightbox-nav-btn work-lightbox-prev"
            onClick={isRtl ? nextImage : prevImage}
            aria-label={isRtl ? 'Next image' : 'Previous image'}
          >
            {isRtl ? '❯' : '❮'}
          </button>

          <button
            type="button"
            className="work-lightbox-nav-btn work-lightbox-next"
            onClick={isRtl ? prevImage : nextImage}
            aria-label={isRtl ? 'Previous image' : 'Next image'}
          >
            {isRtl ? '❮' : '❯'}
          </button>
        </>
      )}

      <div className="work-lightbox-stage">
        <img
          src={currentImage}
          alt=""
          className={`work-lightbox-img ${isDragging ? 'is-dragging' : ''}`}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in'
          }}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          draggable={false}
        />
      </div>

      <div className="work-lightbox-toolbar" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="work-lightbox-btn"
          onClick={() => setClampedScale((s) => s - 0.3)}
          aria-label="Zoom out"
          title="Zoom out (-)"
        >
          −
        </button>

        <span className="work-lightbox-scale">{Math.round(scale * 100)}%</span>

        <button
          type="button"
          className="work-lightbox-btn"
          onClick={() => setClampedScale((s) => s + 0.3)}
          aria-label="Zoom in"
          title="Zoom in (+)"
        >
          +
        </button>

        {scale !== 1 && (
          <button
            type="button"
            className="work-lightbox-btn work-lightbox-reset"
            onClick={() => setClampedScale(1)}
            aria-label="Reset zoom"
            title="Reset (0)"
          >
            100%
          </button>
        )}
      </div>
    </div>
  );

  return createPortal(ui, document.body);
}

export default Lightbox;
