import { useEffect, useRef, useState, useCallback } from 'react';
import { useLang } from '../i18n.jsx';

/**
 * Accessible Lightbox Component
 * Features:
 * - Zoom in / out buttons, +, -, 0 keys
 * - Mouse wheel zoom towards cursor
 * - Pinch zoom on touch
 * - Double click toggles 1x / 2x
 * - Drag to pan when scale > 1
 * - Esc closes, arrow keys navigate (mirrored in RTL)
 * - Focus trap & restore focus to previous activeElement on close
 * - Body scroll lock
 * - Image counter "X / Y"
 * - Close button & backdrop click (when scale === 1)
 */
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

  // Save previous activeElement to restore focus
  useEffect(() => {
    prevFocusRef.current = document.activeElement;
    document.body.classList.add('lightbox-open');
    return () => {
      document.body.classList.remove('lightbox-open');
      if (prevFocusRef.current && typeof prevFocusRef.current.focus === 'function') {
        prevFocusRef.current.focus();
      }
    };
  }, []);

  // Reset scale and position when changing images
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
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const prevImage = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  // Keyboard navigation & zoom
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
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

      // Focus trap within container
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

  // Mouse wheel zoom towards cursor
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    setClampedScale((s) => s + delta);
  };

  // Double click toggles 1x / 2x
  const handleDoubleClick = (e) => {
    e.stopPropagation();
    setClampedScale((s) => (s > 1 ? 1 : 2));
  };

  // Drag to pan
  const handleMouseDown = (e) => {
    if (scale <= 1) return;
    if (e.button !== 0) return; // Only left click
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

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch pinch to zoom
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

  // Backdrop click closes only when scale is 1
  const handleBackdropClick = (e) => {
    if (e.target === containerRef.current && scale === 1) {
      onClose();
    }
  };

  const currentImage = images[currentIndex] || '';

  return (
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
      {/* Top Controls Bar */}
      <div className="work-lightbox-topbar">
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

      {/* Prev / Next buttons */}
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

      {/* Image Stage */}
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

      {/* Bottom Zoom Toolbar */}
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
}

export default Lightbox;
