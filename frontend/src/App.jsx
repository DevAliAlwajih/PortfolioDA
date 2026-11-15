import { Component, lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from './api.js';
import { useLang } from './i18n.jsx';
import { Brand } from './components/Brand.jsx';
import SiteBackground from './components/SiteBackground.jsx';
import { Blocks } from './components/Blocks.jsx';
import { heroPhrases } from './config/hero.js';
import { tech } from './config/tech.js';
import { Icon, defaultIcon } from './components/Icons.jsx';
import { WorkMedia } from './components/WorkMedia.jsx';
import { RichText } from './components/RichText.jsx';
import WorkPage from './pages/WorkPage.jsx';
import { fxOffLabel, isFxOff } from './config/flags.js';

const Admin = lazy(() => import('./admin/Admin.jsx'));

/* ─── Error Boundary ─── */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', this.props.label || '', error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '20px', color: '#f88', background: 'rgba(255,0,0,.1)', borderRadius: 12, margin: 8 }}>
          <strong>{this.props.label || 'Section'} crashed:</strong>{' '}
          <code style={{ fontSize: 13 }}>{String(this.state.error)}</code>
          <br />
          <button className="btn" style={{ marginTop: 8 }} onClick={() => this.setState({ error: null })}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ─── Icons ─── */
const icon = key => (
  <svg viewBox="0 0 24 24">
    <path
      d={key === 'works'   ? 'M4 7h16v13H4zM8 7V4h8v3'
        : key === 'links'  ? 'M8 16l-2 2a4 4 0 01-6-6l4-4a4 4 0 016 0M16 8l2-2a4 4 0 016 6l-4 4a4 4 0 01-6 0M8 12h8'
        : key === 'contact'? 'M3 5h18v14H3zM3 7l9 6 9-6'
        : key === 'reviews'? 'M12 3l3 6 6 .8-4.3 4.2 1 6-5.7-3-5.7 3 1-6L3 9.8 9 9z'
        : 'M4 20V4h16v16z'}
      fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
    />
  </svg>
);

const path = k =>
  ({ about: '/about', vision: '/vision', works: '/works', links: '/links', contact: '/contact' })[k]
  || (k.startsWith('sec-') ? `/s/${k.slice(4)}` : '/');

/* ─── Drawer ─── */
function Drawer({ open, close, reviews }) {
  const { t } = useLang();
  const ref = useRef();
  useEffect(() => {
    if (!open) return;
    const h = e => e.key === 'Escape' && close();
    addEventListener('keydown', h);
    ref.current?.focus();
    return () => removeEventListener('keydown', h);
  }, [open, close]);
  if (!open) return null;
  return (
    <div className="drawer-backdrop" onMouseDown={close}>
      <aside ref={ref} tabIndex="-1" className="drawer" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}>
        <button className="close" onClick={close}>×</button>
        <h2>{t('reviews')}</h2>
        {reviews.map(r => (
          <article className="review" key={r.id}>
            <b>{r.name}</b> <span>★ {r.rating}/5</span>
            <p>{r.comment}</p>
          </article>
        ))}
        <form className="review-form" onSubmit={async e => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          await api.post('/public/reviews', { name: f.get('name'), email: f.get('email'), comment: f.get('comment'), rating: 5 });
          e.currentTarget.reset();
        }}>
          <h3>{t('addReview')}</h3>
          <input required name="name" placeholder={t('yourName')} />
          <input required name="email" type="email" placeholder={t('yourEmail')} />
          <textarea required name="comment" placeholder={t('yourComment')} />
          <button className="btn primary">{t('send')}</button>
        </form>
      </aside>
    </div>
  );
}

function ImageLightbox({ images, index, close }) {
  const [scale, setScale] = useState(1); const current = images[index] || '';
  useEffect(()=>{const key=e=>{if(e.key==='Escape')close();if(e.key==='+'||e.key==='=')setScale(x=>Math.min(3,x+.25));if(e.key==='-')setScale(x=>Math.max(1,x-.25));};addEventListener('keydown',key);document.body.classList.add('lightbox-open');return()=>{removeEventListener('keydown',key);document.body.classList.remove('lightbox-open')}},[close]);
  return <div className="lightbox" role="dialog" aria-modal="true" onMouseDown={close}><button className="lightbox-close" onClick={close}>×</button><div className="lightbox-tools" onMouseDown={e=>e.stopPropagation()}><button onClick={()=>setScale(x=>Math.max(1,x-.25))}>−</button><span>{Math.round(scale*100)}%</span><button onClick={()=>setScale(x=>Math.min(3,x+.25))}>+</button></div><img src={current} alt="" onMouseDown={e=>e.stopPropagation()} onDoubleClick={()=>setScale(x=>x===1?2:1)} style={{transform:`scale(${scale})`}}/></div>;
}

/* ─── Hero ─── */
function Hero({ data, open }) {
  const { tr, lang, t } = useLang();
  const nav = useNavigate();
  const [n, setN] = useState(0);
  const list = (data.works.filter(x => x.featured).length
    ? data.works.filter(x => x.featured)
    : data.works).slice(0, 6);
  const w = list[n];

  useEffect(() => {
    if (isFxOff('reveal')) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const x = setInterval(() => setN(v => list.length ? (v + 1) % list.length : 0), 5000);
    return () => clearInterval(x);
  }, [list.length]);

  return (
    <div className="home-layout">
      <section className="hero-view">
        <div className="portrait-ring">
          <div className="portrait">
            {data.profile.photoUrl
              ? <img src={data.profile.photoUrl} alt={tr(data.profile, 'name')} />
              : tr(data.profile, 'name')[0]}
          </div>
        </div>
        <div>
          <h1>{tr(data.profile, 'name')}</h1>
          <p className="typing">{heroPhrases[lang]?.[n % 3] ?? ''}</p>
          {data.profile.phone && (
            <a className="phone-pill" dir="ltr" href={'tel:' + data.profile.phone}>{data.profile.phone}</a>
          )}
          <p className="hero-actions">
            <button className="btn primary" onClick={() => nav('/works')}>{t('works')}</button>
            <button className="btn" onClick={() => nav('/contact')}>{t('contact')}</button>
          </p>
          <button className="rating-chip" onClick={open}>
            ★ 5.0 ({data.reviews.length}) {t('reviews')}
          </button>
        </div>
      </section>

      {w && (
        <ErrorBoundary label="Showcase">
          <section className="showcase">
            <div className={'device ' + w.type.toLowerCase()}>
              <WorkMedia work={w} variant="showcase" />
            </div>
            <div>
              <span className="pill">{w.type}</span>
              <h2>{tr(w, 'title')}</h2>
              <p>{tr(w, 'summary')}</p>
              <button className="btn primary" onClick={() => onVisitWork(w.id)}>{t('details')}</button>
              {w.link && <a className="btn" href={w.link}>{t('openLink')}</a>}
            </div>
            <div className="progress">
              {list.map((_, i) => (
                <button className={i === n ? 'on' : ''} key={i} onClick={() => setN(i)} />
              ))}
            </div>
          </section>
        </ErrorBoundary>
      )}
    </div>
  );
}

/* ─── View router ─── */
function View({ data, open }) {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const detailId = pathname.match(/^\/works\/(\d+)$/)?.[1];
  const sectionId = pathname.match(/^\/s\/(\d+)$/)?.[1];
  const { t, tr } = useLang();
  const [filter, setFilter] = useState('ALL');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [workMode, setWorkMode] = useState(() => { try { return localStorage.getItem('works-mode') || 'grid'; } catch { return 'grid'; } });
  const [detail, setDetail] = useState();
  const [lightbox, setLightbox] = useState(null);

  // Scroll position management:
  // - Opening /works/:id must start at scrollTop 0 for every scrollable ancestor
  // - Opening /works restores its previous scroll position saved when leaving to detail
  useLayoutEffect(() => {
    const stage = document.querySelector('.stage');
    if (pathname.startsWith('/works/')) {
      stage?.scrollTo({ top: 0, behavior: 'instant' });
    } else if (pathname === '/works') {
      const savedKey = `scroll_${pathname}${window.location.search}`;
      const savedTop = sessionStorage.getItem(savedKey);
      if (savedTop !== null && stage) {
        stage.scrollTo({ top: Number(savedTop) || 0, behavior: 'instant' });
      }
    }
  }, [pathname]);

  const onVisitWork = (workId) => {
    const stage = document.querySelector('.stage');
    if (stage) {
      const currentKey = `scroll_${pathname}${window.location.search}`;
      sessionStorage.setItem(currentKey, String(stage.scrollTop));
    }
    nav('/works/' + workId);
  };

  let page = pathname.startsWith('/works/') ? 'detail'
    : pathname === '/works' ? 'works'
    : pathname.slice(1) || 'home';

  useEffect(() => {
    document.title = `${page === 'home' ? 'Dev.AliAlwajih' : t(page)} | Dev.AliAlwajih`;
  }, [page, t]);

  useEffect(() => {
    if (page === 'detail' && detailId) api.get('/public/works/' + detailId).then(setDetail).catch(() => setDetail(false));
  }, [page, detailId]);

  useEffect(() => {
    if (page === 'detail' && detail) document.title = `${tr(detail, 'title')} | Dev.AliAlwajih`;
  }, [page, detail, tr]);
  useEffect(() => { const timer = setTimeout(() => setSearch(query), 180); return () => clearTimeout(timer); }, [query]);
  useEffect(() => { try { localStorage.setItem('works-mode', workMode); } catch {} }, [workMode]);

  if (page === 'home') return <Hero data={data} open={open} />;

  if (page === 'about') return (
    <section className="center-view">
      <h1>{t('about')}</h1>
      <p>{tr(data.profile, 'about')}</p>
      <div className="counters">
        <b>{data.works.length}<small>{t('works')}</small></b>
        <b>{data.reviews.length}<small>{t('reviews')}</small></b>
      </div>
      <div className="tech">{tech.map(x => <span key={x}>{x}</span>)}</div>
    </section>
  );

  if (page === 'vision') return (
    <section className="center-view">
      <h1>{t('vision')}</h1>
      <p>{tr(data.profile, 'vision')}</p>
    </section>
  );

  if (page === 'works') {
    const types = ['ALL', ...new Set(data.works.map(x => x.type))];
    const byType = filter === 'ALL' ? data.works : data.works.filter(x => x.type === filter);
    const list = byType.filter(x => `${tr(x,'title')} ${tr(x,'summary')}`.toLowerCase().includes(search.toLowerCase()));
    return (
      <section>
        <h1>{t('works')}</h1>
        <div className="works-toolbar">
          <div className="filters">{types.map(x => <button className={filter === x ? 'on' : ''} onClick={() => setFilter(x)} key={x}>{x === 'ALL' ? t('all') : t(x.toLowerCase())} {data.works.filter(w => x === 'ALL' || w.type === x).length}</button>)}</div>
          <label className="works-search"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search works" />{query && <button type="button" onClick={()=>setQuery('')}>×</button>}</label>
          <div className="works-mode"><button className={workMode==='grid'?'on':''} onClick={()=>setWorkMode('grid')}>Grid</button><button className={workMode==='carousel'?'on':''} onClick={()=>setWorkMode('carousel')}>Carousel</button></div>
        </div>
        {list.length === 0 ? <div className="works-empty"><p>{t('noWorks')}</p><button className="btn" onClick={()=>{setFilter('ALL');setQuery('')}}>Clear filters</button></div> : <div className={workMode === 'carousel' ? 'works-carousel' : 'works-grid'}>
          {list.map((w, i) => (
            <article
              className="work-card"
              key={w.id}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <WorkMedia work={w} />
              <h2>{tr(w, 'title')}</h2>
              <p>{tr(w, 'summary')}</p>
              <button className="btn primary" onClick={() => onVisitWork(w.id)}>{t('details')}</button>
            </article>
          ))}
        </div>}
      </section>
    );
  }

  if (page === 'links') return (
    <section>
      <h1>{t('links')}</h1>
      <div className="chips">{data.links.map(x => <a className="btn" href={x.url} key={x.id}>{x.title}</a>)}</div>
    </section>
  );

  if (page === 'contact') return (
    <section>
      <h1>{t('contact')}</h1>
      <div className="contacts">
        {data.contacts.map(x => (
          <article className="glass" key={x.id}><small>{x.title}</small><strong dir="ltr">{x.value}</strong></article>
        ))}
      </div>
    </section>
  );

  if (pathname.startsWith('/s/')) {
    const s = data.sections.find(x => String(x.id) === sectionId);
    return s ? (
      <section>
        <h1>{tr(s, 'title')}</h1>
        <Blocks blocks={s.blocks} />
      </section>
    ) : <section className="center-view"><h1>{t('notFound')}</h1><Link className="btn" to="/">{t('back')}</Link></section>;
  }

  if (page === 'detail') {
    return <WorkPage work={detail} onBack={() => nav('/works')} />;
  }

  return <Hero data={data} open={open} />;
}

/* ─── App root ─── */
export default function App() {
  const { lang, setLang, t, tr } = useLang();
  const loc = useLocation();
  const [data, setData] = useState();
  const [failed, setFailed] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    const admin = loc.pathname.startsWith('/admin');
    document.body.classList.toggle('admin-page', admin);
    return () => document.body.classList.remove('admin-page');
  }, [loc.pathname]);

  /* ?debug=1 → outline every element in the shell */
  const debug = new URLSearchParams(loc.search).get('debug') === '1';

  useEffect(() => {
    if (!loc.pathname.startsWith('/admin'))
      api.get('/public').then(setData).catch(() => setFailed(true));
  }, [loc.pathname]);

  useEffect(() => {
    if (!debug || !data) return undefined;
    const selectors = ['.topbar', '.dock', '.stage', '.view', '.hero-view h1', '.phone-pill', '.showcase', '.site-bg', 'canvas'];
    const snapshot = (ms) => {
      const point = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      const rows = selectors.flatMap(selector => [...document.querySelectorAll(selector)].map(el => {
        const r = el.getBoundingClientRect(), s = getComputedStyle(el);
        return { ms, selector, tag: el.tagName, class: el.className, x: r.x, y: r.y, width: r.width, height: r.height, opacity: s.opacity, visibility: s.visibility, display: s.display, zIndex: s.zIndex, transform: s.transform, atCenter: point ? `${point.tagName}.${point.className}` : '' };
      }));
      console.table(rows);
    };
    const times = [0, 300, 800, 1500, 3000, 6000];
    const ids = times.map(ms => setTimeout(() => snapshot(ms), ms));
    const error = event => console.error('[debug window error]', event.error || event.message);
    const rejection = event => console.error('[debug unhandled rejection]', event.reason);
    const observer = new MutationObserver(records => console.log('[debug shell mutation]', records.map(r => ({ target: r.target.className, attribute: r.attributeName, value: r.target.getAttribute(r.attributeName) }))));
    addEventListener('error', error); addEventListener('unhandledrejection', rejection);
    const shell = document.querySelector('.public');
    if (shell) observer.observe(shell, { attributes: true, subtree: false });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => { ids.forEach(clearTimeout); removeEventListener('error', error); removeEventListener('unhandledrejection', rejection); observer.disconnect(); };
  }, [debug, data]);

  useEffect(() => {
    document.title = loc.pathname.startsWith('/admin') ? 'الإدارة | Dev.AliAlwajih' : 'Dev.AliAlwajih';
  }, [loc.pathname]);

  if (loc.pathname.startsWith('/admin'))
    return (
      <Suspense fallback={<main className="loading"><div className="skeleton" /></main>}>
        <Admin />
      </Suspense>
    );
  if (failed)
    return (
      <main className="error">
        <p>{t('failed')}</p>
        <button className="btn" onClick={() => location.reload()}>Retry</button>
      </main>
    );
  if (!data)
    return <main className="loading"><div className="skeleton" /></main>;

  const sec = new Map(data.sections.map(x => ['sec-' + x.id, x]));
  const fallback = { about: t('about'), vision: t('vision'), works: t('works'), links: t('links'), contact: t('contact'), reviews: t('reviews') };
  const items = data.layout.filter(x =>
    x.visible
    && (x.key !== 'links' || data.links.length)
    && (x.key !== 'contact' || data.contacts.length)
    && (!x.key.startsWith('sec-') || sec.has(x.key))
  );
  const label = x => tr(x, 'label') || fallback[x.key] || tr(sec.get(x.key), 'title');

  return (
    <div className="public" data-fx-off={fxOffLabel || undefined} {...(debug ? { 'data-debug': '' } : {})}>
      <SiteBackground />
      {fxOffLabel && <output className="fx-off" aria-live="polite">FX off: {fxOffLabel}</output>}
      <a className="skip" href="#stage">Skip to content</a>

      <header className="topbar">
        <Brand />
        <div>
          <button className="lang" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{t('lang')}</button>
          <Link className="lang" to="/admin">{t('admin')}</Link>
        </div>
      </header>

      <ErrorBoundary label="Dock">
        <nav className="dock">
          {items.map(x => x.key === 'reviews'
            ? <button onClick={() => setDrawer(true)} key={x.key}><Icon name={x.icon || defaultIcon(x.key)} /><span>{label(x)}</span></button>
            : <Link to={path(x.key)} key={x.key} aria-current={loc.pathname === path(x.key) ? 'page' : undefined}>
                <Icon name={x.icon || defaultIcon(x.key)} /><span>{label(x)}</span>
              </Link>
          )}
        </nav>
      </ErrorBoundary>

      <main className="stage" id="stage" tabIndex="-1">
        <div className="view">
          <ErrorBoundary label="Stage">
            <View data={data} open={() => setDrawer(true)} />
          </ErrorBoundary>
        </div>
      </main>

      <Drawer open={drawer} close={() => setDrawer(false)} reviews={data.reviews} />
    </div>
  );
}
