import { useState } from 'react';
import { useLang } from '../i18n.jsx';
import { Lightbox } from './Lightbox.jsx';
import { WorkMedia } from './WorkMedia.jsx';

function isExternalUrl(raw = '') {
  return /^https?:\/\//i.test(raw) || /^mailto:/i.test(raw) || /^tel:/i.test(raw);
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
      if (!images.length) return null;
      return (
        <div key={block.id} className="section-gallery">
          {images.map((src, index) => (
            <WorkMedia
              key={`${block.id}-${index}`}
              src={src}
              alt=""
              variant="thumb"
              onOpen={() => setLightbox({ images, index })}
            />
          ))}
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

