import { useEffect, useLayoutEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useLang } from '../i18n.jsx';
import { WorkMedia } from '../components/WorkMedia.jsx';
import { RichText } from '../components/RichText.jsx';
import { Lightbox } from '../components/Lightbox.jsx';

const fmtSize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function WorkPage({ work: propWork, onBack }) {
  const params = useParams();
  const id = propWork?.id || params.id;
  const { t, tr, lang } = useLang();
  const nav = useNavigate();
  const [w, setW] = useState(propWork || null);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState('steps'); // 'steps' | 'policy' | 'gallery' | 'files' | 'intro'
  const [lightbox, setLightbox] = useState(null); // { index: number }

  // Ensure scrollTop is 0 for every scrollable ancestor on page enter
  useLayoutEffect(() => {
    const ancestors = [
      document.querySelector('.stage'),
      document.documentElement,
      document.body,
      document.querySelector('#root'),
      document.querySelector('.public')
    ];
    ancestors.forEach((el) => {
      if (el && typeof el.scrollTo === 'function') {
        el.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }
    });
  }, [id]);

  useEffect(() => {
    if (propWork) {
      setW(propWork);
      return;
    }
    setW(null);
    setError(false);
    api.get(`/public/works/${id}`)
      .then(setW)
      .catch(() => setError(true));
  }, [id, propWork]);

  useEffect(() => {
    if (w) {
      document.title = `${tr(w, 'title')} | Dev.AliAlwajih`;
    }
  }, [w, tr]);

  if (error) {
    return (
      <section className="center-view">
        <h1>{t('notFound')}</h1>
        <Link className="btn" to="/works">← {t('back')}</Link>
      </section>
    );
  }

  if (!w) {
    return <div className="skeleton" aria-label={t('loading')} />;
  }

  // Cover image: ALWAYS the work's main imageUrl, or first gallery image if empty.
  const coverSrc = w.imageUrl || (Array.isArray(w.gallery) && w.gallery[0]) || '';
  const steps = Array.isArray(w.steps) ? w.steps : [];
  const gallery = Array.isArray(w.gallery) ? w.gallery : [];
  const files = Array.isArray(w.files) ? w.files : [];

  // Aggregate all unique images in order for the Lightbox: cover first, then gallery, then steps
  const allImages = [];
  if (coverSrc) allImages.push(coverSrc);
  gallery.forEach((img) => {
    if (img && !allImages.includes(img)) allImages.push(img);
  });
  steps.forEach((s) => {
    if (s.imageUrl && !allImages.includes(s.imageUrl)) allImages.push(s.imageUrl);
    if (Array.isArray(s.images)) {
      s.images.forEach((img) => {
        if (img && !allImages.includes(img)) allImages.push(img);
      });
    }
  });

  const openLightboxWith = (imgSrc) => {
    const idx = allImages.indexOf(imgSrc);
    setLightbox({ index: idx >= 0 ? idx : 0 });
  };

  const handleBack = () => {
    if (onBack) onBack();
    else nav('/works');
  };

  // Determine available tabs
  const hasSteps = steps.length > 0;
  const hasPolicy = Boolean(tr(w, 'policy'));
  const hasGallery = gallery.length > 0;
  const hasFiles = files.length > 0;
  const hasIntro = Boolean(tr(w, 'intro'));

  const availableTabs = [
    hasSteps && { id: 'steps', label: t('howto') || 'Usage steps' },
    hasPolicy && { id: 'policy', label: t('policy') || 'Usage policy' },
    hasGallery && { id: 'gallery', label: t('gallery') || 'Gallery' },
    hasFiles && { id: 'files', label: t('files') || 'Files' },
    hasIntro && { id: 'intro', label: t('intro') || 'Intro' },
  ].filter(Boolean);

  const currentTab = availableTabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : (availableTabs[0]?.id || 'steps');

  return (
    <article className="work-detail-page">
      {/* Back button */}
      <div className="work-detail-nav">
        <button type="button" className="btn work-back-btn" onClick={handleBack}>
          ← {t('back')}
        </button>
      </div>

      {/* Hero section: Cover & Title block */}
      <header className="work-detail-hero">
        <div className="work-detail-cover-col">
          <WorkMedia
            src={coverSrc}
            alt={tr(w, 'title')}
            variant="cover"
            work={w}
            onOpen={() => openLightboxWith(coverSrc)}
          />
        </div>

        <div className="work-detail-title-col">
          <h1 className="work-detail-title">{tr(w, 'title')}</h1>

          <div className="work-detail-pills">
            <span className="pill">{w.type}</span>
            {w.version && <span className="pill dim">{w.version}</span>}
          </div>

          {tr(w, 'summary') && (
            <div className="work-detail-summary">
              <RichText text={tr(w, 'summary')} />
            </div>
          )}

          <div className="work-detail-actions">
            {w.link && (
              <a
                className="btn primary"
                href={w.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('openLink')}
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Below the hero: Tabs navigation */}
      {availableTabs.length > 0 && (
        <nav className="work-detail-tabs" role="tablist" aria-label="Work sections">
          {availableTabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              type="button"
              id={`tab-${tab.id}`}
              aria-selected={currentTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              className={`work-tab-btn ${currentTab === tab.id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      )}

      {/* Tab Panels */}
      <div className="work-detail-tab-content">
        {/* Steps Tab */}
        {currentTab === 'steps' && hasSteps && (
          <section
            id="panel-steps"
            role="tabpanel"
            aria-labelledby="tab-steps"
            className="work-panel work-panel-steps"
          >
            <h2 className="work-panel-heading">{t('howto') || 'Usage steps'}</h2>
            <div className="work-steps-list">
              {steps.map((step, i) => {
                const stepText = tr(step, 'text');
                const cleanText = stepText?.trim()?.toLowerCase() === 'app' ? '' : stepText;
                const stepImages = Array.isArray(step.images) && step.images.length > 0
                  ? step.images
                  : (step.imageUrl ? [step.imageUrl] : []);
                const hasStepImg = stepImages.length > 0;
                const isMulti = stepImages.length > 1;

                return (
                  <div key={i} className={`work-step-card glass ${hasStepImg ? 'has-media' : 'no-media'}`}>
                    <span className="work-step-badge" aria-hidden="true">{i + 1}</span>

                    <div className="work-step-body">
                      {cleanText && (
                        <div className="work-step-text">
                          <RichText text={cleanText} />
                        </div>
                      )}

                      {hasStepImg && (
                        <div className="work-step-media-col">
                          {isMulti ? (
                            <div className="work-step-thumbs-row">
                              {stepImages.map((imgUrl, imgIdx) => (
                                <WorkMedia
                                  key={imgIdx}
                                  src={imgUrl}
                                  variant="thumb"
                                  work={w}
                                  onOpen={() => openLightboxWith(imgUrl)}
                                />
                              ))}
                            </div>
                          ) : (
                            <WorkMedia
                              src={stepImages[0]}
                              variant="step"
                              work={w}
                              onOpen={() => openLightboxWith(stepImages[0])}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Policy Tab */}
        {currentTab === 'policy' && hasPolicy && (
          <section
            id="panel-policy"
            role="tabpanel"
            aria-labelledby="tab-policy"
            className="work-panel glass"
          >
            <h2 className="work-panel-heading">{t('policy') || 'Usage policy'}</h2>
            <div className="work-panel-prose">
              <RichText text={tr(w, 'policy')} />
            </div>
          </section>
        )}

        {/* Gallery Tab */}
        {currentTab === 'gallery' && hasGallery && (
          <section
            id="panel-gallery"
            role="tabpanel"
            aria-labelledby="tab-gallery"
            className="work-panel"
          >
            <h2 className="work-panel-heading">{t('gallery') || 'Gallery'}</h2>
            <div className="work-gallery-grid">
              {gallery.map((imgSrc, i) => (
                <WorkMedia
                  key={i}
                  src={imgSrc}
                  variant="thumb"
                  work={w}
                  onOpen={() => openLightboxWith(imgSrc)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Files Tab */}
        {currentTab === 'files' && hasFiles && (
          <section
            id="panel-files"
            role="tabpanel"
            aria-labelledby="tab-files"
            className="work-panel glass"
          >
            <h2 className="work-panel-heading">{t('files') || 'Files'}</h2>
            <ul className="work-files-list">
              {files.map((file) => (
                <li key={file.id} className="work-file-item">
                  <a className="btn" href={file.url} download={file.name}>
                    ↓ {file.name}
                  </a>
                  {file.size > 0 && <span className="muted">{fmtSize(file.size)}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Intro Tab */}
        {currentTab === 'intro' && hasIntro && (
          <section
            id="panel-intro"
            role="tabpanel"
            aria-labelledby="tab-intro"
            className="work-panel glass"
          >
            <h2 className="work-panel-heading">{t('intro') || 'Intro'}</h2>
            <div className="work-panel-prose">
              <RichText text={tr(w, 'intro')} />
            </div>
          </section>
        )}
      </div>

      {/* Lightbox */}
      {lightbox !== null && allImages.length > 0 && (
        <Lightbox
          images={allImages}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </article>
  );
}
