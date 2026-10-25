import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useLang } from '../i18n.jsx';
import { Brand, Footer } from '../components/Brand.jsx';

const fmtSize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function WorkPage() {
  const { id } = useParams();
  const { t, tr, lang, setLang } = useLang();
  const [w, setW] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setW(null);
    api.get(`/public/works/${id}`).then(setW).catch(() => setError(true));
  }, [id]);

  if (error) return <p className="center-note">{t('notFound')} <Link to="/">{t('back')}</Link></p>;
  if (!w) return <p className="center-note">{t('loading')}</p>;

  const steps = Array.isArray(w.steps) ? w.steps : [];
  const gallery = Array.isArray(w.gallery) ? w.gallery : [];

  return (
    <div className="wrap narrow">
      <div className="brandbar">
        <Brand />
        <div className="brandbar-actions">
          <Link className="btn" to="/">← {t('back')}</Link>
          <button className="lang" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{t('lang')}</button>
        </div>
      </div>

      <header className="work-head">
        {w.imageUrl && <img className="work-cover glass" src={w.imageUrl} alt="" />}
        <div className="work-meta">
          <span className="pill">{t(w.type.toLowerCase())}</span>
          {w.version && <span className="pill dim">{t('version')} {w.version}</span>}
        </div>
        <h1>{tr(w, 'title')}</h1>
        <p className="muted">{tr(w, 'summary')}</p>
        {w.link && <a className="btn primary" href={w.link} target="_blank" rel="noopener noreferrer">{t('openLink')}</a>}
      </header>

      {tr(w, 'intro') && (
        <section className="doc glass">
          <h2>{t('intro')}</h2>
          <p className="prose pre">{tr(w, 'intro')}</p>
        </section>
      )}

      {tr(w, 'policy') && (
        <section className="doc glass">
          <h2>{t('policy')}</h2>
          <p className="prose pre">{tr(w, 'policy')}</p>
        </section>
      )}

      {steps.length > 0 && (
        <section className="doc glass">
          <h2>{t('howto')}</h2>
          <ol className="steps">
            {steps.map((s, i) => (
              <li key={i}>
                {tr(s, 'text') && <p className="prose pre">{tr(s, 'text')}</p>}
                {s.imageUrl && <img src={s.imageUrl} alt="" loading="lazy" />}
              </li>
            ))}
          </ol>
        </section>
      )}

      {gallery.length > 0 && (
        <section className="doc glass">
          <h2>{t('gallery')}</h2>
          <div className="gallery">{gallery.map((g, i) => <img key={i} src={g} alt="" loading="lazy" />)}</div>
        </section>
      )}

      {w.files.length > 0 && (
        <section className="doc glass">
          <h2>{t('files')}</h2>
          <ul className="files">
            {w.files.map((f) => (
              <li key={f.id}>
                <a href={f.url} download={f.name}>{f.name}</a>
                <span className="muted">{fmtSize(f.size)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Footer />
    </div>
  );
}
