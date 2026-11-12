import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useLang } from '../i18n.jsx';
import { Brand, Footer } from '../components/Brand.jsx';

function Stars({ value, onChange, label }) {
  return (
    <div className="stars" role={onChange ? 'radiogroup' : 'img'} aria-label={`${value} ${label}`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= value;
        return onChange ? (
          <button key={n} type="button" className={on ? 'on' : ''} onClick={() => onChange(n)} aria-label={`${n}`}>★</button>
        ) : (
          <span key={n} className={on ? 'on' : ''}>★</span>
        );
      })}
    </div>
  );
}

function ReviewForm() {
  const { t } = useLang();
  const [form, setForm] = useState({ name: '', email: '', rating: 5, comment: '' });
  const [state, setState] = useState('idle');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setState('sending');
    try {
      await api.post('/public/reviews', form);
      setForm({ name: '', email: '', rating: 5, comment: '' });
      setState('done');
    } catch {
      setState('error');
    }
  };

  return (
    <form className="review-form" onSubmit={submit}>
      <h4>{t('addReview')}</h4>
      <Stars value={form.rating} onChange={(n) => setForm({ ...form, rating: n })} label={t('stars')} />
      <input required maxLength={80} placeholder={t('yourName')} value={form.name} onChange={set('name')} />
      <input required type="email" placeholder={t('yourEmail')} value={form.email} onChange={set('email')} dir="ltr" />
      <textarea required maxLength={1000} rows={3} placeholder={t('yourComment')} value={form.comment} onChange={set('comment')} />
      <button className="btn primary" disabled={state === 'sending'}>{t('send')}</button>
      {state === 'done' && <p className="ok" role="status">{t('thanks')}</p>}
      {state === 'error' && <p className="err" role="alert">{t('failed')}</p>}
    </form>
  );
}

function RatingBadge({ reviews, onClick }) {
  const { t } = useLang();
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const rounded = Math.round(avg);

  return (
    <button
      type="button"
      className="rating-badge glass"
      onClick={onClick}
      aria-label={`${t('reviews')}: ${avg.toFixed(1)} ${t('stars')} (${reviews.length})`}
    >
      <div className="rating-badge-top">
        <span className="rating-score">{reviews.length ? avg.toFixed(1) : '—'}</span>
        <div className="rating-stars-row">
          {[1,2,3,4,5].map((n) => (
            <span key={n} className={n <= rounded ? 'rb-star on' : 'rb-star'}>
              ★
            </span>
          ))}
        </div>
      </div>
      <div className="rating-badge-bottom">
        <span className="rating-label">{t('reviews')}</span>
        <span className="rating-count">{reviews.length} {t('reviewers') || '💬'}</span>
      </div>
      <span className="rating-arrow">↗</span>
    </button>
  );
}

function ReviewsSection({ reviews, sectionRef }) {
  const { t, lang } = useLang();
  return (
    <section id="rating" ref={sectionRef} className="centered">
      <h2>{t('reviews')}</h2>
      <div className="reviews-list">
        {reviews.length === 0 && <p className="muted">{t('noReviews')}</p>}
        {reviews.map((r) => (
          <article key={r.id} className="review glass">
            <div className="review-top">
              <strong>{r.name}</strong>
              <Stars value={r.rating} label={t('stars')} />
            </div>
            <p>{r.comment}</p>
            <time className="muted" dateTime={r.createdAt}>
              {new Date(r.createdAt).toLocaleDateString(lang === 'ar' ? 'ar' : 'en')}
            </time>
          </article>
        ))}
      </div>
      <ReviewForm />
    </section>
  );
}

function WorkCard({ w }) {
  const { t, tr } = useLang();
  return (
    <article className="glass work">
      {w.imageUrl ? <img src={w.imageUrl} alt="" loading="lazy" /> : <div className="work-ph" aria-hidden="true">{w.type}</div>}
      <div className="work-body">
        <div className="work-meta">
          <span className="pill">{t(w.type.toLowerCase())}</span>
          {w.version && <span className="pill dim">{t('version')} {w.version}</span>}
        </div>
        <h3>{tr(w, 'title')}</h3>
        <p className="muted">{tr(w, 'summary')}</p>
        <div className="work-actions">
          <Link className="btn primary" to={`/works/${w.id}`}>{t('details')}</Link>
          {w.link && <a className="btn" href={w.link} target="_blank" rel="noopener noreferrer">{t('openLink')}</a>}
        </div>
      </div>
    </article>
  );
}

function contrastColor(hex) {
  const value = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex.slice(1) : '6fd0ff';
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  return (r * 0.299 + g * 0.587 + b * 0.114) > 160 ? '#111827' : '#ffffff';
}

function BlockView({ block }) {
  const { tr } = useLang();
  const d = block.data || {};
  if (block.type === 'HEADING') {
    const Tag = d.level === 3 ? 'h3' : 'h2';
    return <Tag className="content-heading">{tr(d, 'text')}</Tag>;
  }
  if (block.type === 'TEXT') return <p className="block-text">{tr(d, 'text')}</p>;
  if (block.type === 'LINK') return <a className="content-link" href={d.url} target="_blank" rel="noopener noreferrer">{tr(d, 'title') || d.url}<span aria-hidden="true">↗</span></a>;
  if (block.type === 'BUTTON') return <a className="content-button" href={d.url} target="_blank" rel="noopener noreferrer" style={{ backgroundColor: d.color || '#6fd0ff', color: contrastColor(d.color) }}>{tr(d, 'label') || d.url}</a>;
  if (block.type === 'IMAGE') return <figure className="content-image"><img src={d.url} alt={tr(d, 'caption')} loading="lazy" />{(d.captionAr || d.captionEn) && <figcaption>{tr(d, 'caption')}</figcaption>}</figure>;
  if (block.type === 'GALLERY') return <div className="content-gallery">{(d.images || []).map((url, i) => <a key={url + i} href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt="" loading="lazy" /></a>)}</div>;
  if (block.type === 'FILE') return <a className="file-block glass" href={d.url} download={d.name || undefined}><span className="file-icon" aria-hidden="true">▣</span><span>{tr(d, 'title') || d.name || 'Download file'}</span>{d.size > 0 && <small>{d.size >= 1048576 ? `${(d.size / 1048576).toFixed(1)} MB` : `${Math.ceil(d.size / 1024)} KB`}</small>}<span className="download-icon" aria-hidden="true">↓</span></a>;
  return null;
}

export default function Home() {
  const { t, tr, lang, setLang } = useLang();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const reviewsSectionRef = useRef(null);

  useEffect(() => {
    api.get('/public').then(setData).catch(() => setError(true));
  }, []);

  const types = useMemo(() => (data ? [...new Set(data.works.map((w) => w.type))] : []), [data]);

  if (error) return <p className="center-note">{t('failed')}</p>;
  if (!data) return <p className="center-note">{t('loading')}</p>;

  const { profile, sections, works, links, contacts, reviews, layout = [] } = data;
  const shown = filter === 'ALL' ? works : works.filter((w) => w.type === filter);
  const name = tr(profile, 'name');

  const openReviews = () => {
    if (reviewsSectionRef.current) {
      reviewsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const defaults = { about: t('about'), vision: t('vision'), works: t('works'), links: t('links'), contact: t('contact'), reviews: t('rating') };
  const sectionByKey = new Map(sections.map((s) => [`sec-${s.id}`, s]));
  const shownLayout = layout.filter((item) => item.visible && (item.key === 'reviews' || item.key === 'about' || item.key === 'vision' || item.key === 'works' || (item.key === 'links' && links.length) || (item.key === 'contact' && contacts.length) || sectionByKey.has(item.key)));
  const layoutLabel = (item) => tr(item, 'label') || defaults[item.key] || tr(sectionByKey.get(item.key), 'title');

  const renderItem = (item) => {
    const label = layoutLabel(item);
    if (item.key === 'about') return <section key={item.key} id="about" className="centered"><h2>{label}</h2><p className="prose">{tr(profile, 'about')}</p></section>;
    if (item.key === 'vision') return <section key={item.key} id="vision" className="centered"><h2>{label}</h2><p className="prose">{tr(profile, 'vision')}</p></section>;
    if (item.key === 'works') return <section key={item.key} id="works"><h2>{label}</h2>{types.length > 1 && <div className="filters" role="tablist">{['ALL', ...types].map((ty) => <button key={ty} role="tab" aria-selected={filter === ty} className={filter === ty ? 'on' : ''} onClick={() => setFilter(ty)}>{ty === 'ALL' ? t('all') : t(ty.toLowerCase())}</button>)}</div>}{shown.length === 0 ? <p className="muted">{t('noWorks')}</p> : <div className="works-grid">{shown.map((w) => <WorkCard key={w.id} w={w} />)}</div>}</section>;
    if (item.key === 'links') return <section key={item.key} id="links"><h2>{label}</h2><div className="chips">{links.map((l) => <a key={l.id} className="chip-link glass" href={l.url} target="_blank" rel="noopener noreferrer">{l.title}</a>)}</div></section>;
    if (item.key === 'contact') return <section key={item.key} id="contact"><h2>{label}</h2><div className="contacts">{contacts.map((c) => <div key={c.id} className="glass contact-item"><span className="muted">{c.title}</span><strong dir="ltr">{c.value}</strong></div>)}</div></section>;
    const section = sectionByKey.get(item.key);
    return section ? <section key={item.key} id={item.key} className="centered"><h2>{label}</h2><div className="blocks">{section.blocks.map((block) => <BlockView key={block.id} block={block} />)}</div></section> : null;
  };

  return (
    <div className="wrap">
      {/* Top brand bar */}
      <div className="brandbar">
        <Brand />
        <div className="brandbar-actions">
          <button className="lang" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{t('lang')}</button>
          <Link className="lang" to="/admin">{t('admin')}</Link>
        </div>
      </div>

      {/* Centered hero header */}
      <header className="hero">
        <div className="photo-wrap">
          {profile?.photoUrl
            ? <img className="photo" src={profile.photoUrl} alt={name} />
            : <div className="photo ph" aria-hidden="true">{name.slice(0, 1)}</div>}
        </div>
        <h1 className="hero-name">{name}</h1>
        {profile?.phone && (
          <a className="phone" dir="ltr" href={`tel:${profile.phone.replace(/\s/g, '')}`}>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.6a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 3h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.59a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 17z"/>
            </svg>
            {profile.phone}
          </a>
        )}
        <RatingBadge reviews={reviews} onClick={openReviews} />
      </header>

      <nav className="nav glass" aria-label="Sections">
        {shownLayout.map((item) => item.key === 'reviews'
          ? <button key={item.key} type="button" onClick={openReviews}>{layoutLabel(item)}</button>
          : <a key={item.key} href={`#${item.key}`}>{layoutLabel(item)}</a>)}
      </nav>

      <main>
        {shownLayout.filter((item) => item.key !== 'reviews').map(renderItem)}

        <ReviewsSection reviews={reviews} sectionRef={reviewsSectionRef} />
      </main>
      <Footer />
    </div>
  );
}
