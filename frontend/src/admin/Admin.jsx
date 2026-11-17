import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getToken, setToken } from '../api.js';
import { Brand, LogoPlate } from '../components/Brand.jsx';
import './admin.css';

/* ---------- small building blocks ---------- */

function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}

function ImageInput({ value, onChange, label }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setErr('');
    try { onChange((await api.upload(file)).url); } catch (x) { setErr(x.message); }
    setBusy(false);
    e.target.value = '';
  };
  return (
    <Field label={label}>
      <div className="img-input">
        {value ? <img src={value} alt="" /> : <div className="img-empty">—</div>}
        <div className="img-actions">
          <input type="file" accept="image/*" onChange={pick} disabled={busy} />
          {value && <button type="button" className="btn small" onClick={() => onChange('')}>إزالة</button>}
          {busy && <span className="muted">جارٍ الرفع…</span>}
          {err && <span className="err">{err}</span>}
        </div>
      </div>
    </Field>
  );
}

function Confirm({ onYes, children, className = 'btn small danger' }) {
  const [ask, setAsk] = useState(false);
  if (!ask) return <button type="button" className={className} onClick={() => setAsk(true)}>{children}</button>;
  return (
    <span className="confirm">
      هل أنت متأكد؟
      <button type="button" className="btn small danger" onClick={() => { setAsk(false); onYes(); }}>نعم، احذف</button>
      <button type="button" className="btn small" onClick={() => setAsk(false)}>لا</button>
    </span>
  );
}

function useNotice() {
  const [msg, setMsg] = useState(null);
  useEffect(() => { if (msg) { const id = setTimeout(() => setMsg(null), 4000); return () => clearTimeout(id); } }, [msg]);
  const node = msg ? <p className={msg.err ? 'err' : 'ok'} role="status">{msg.text}</p> : null;
  return [(text, err = false) => setMsg({ text, err }), node];
}

/* ---------- sign in / forgot / reset ---------- */

function Auth({ onDone }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ email: '', password: '', code: '', newPassword: '' });
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const fail = (e) => setMsg({ err: true, text: e.message });

  const login = async (e) => {
    e.preventDefault(); setMsg(null);
    try { const r = await api.post('/auth/login', { email: f.email, password: f.password }); setToken(r.token); onDone(); } catch (x) { fail(x); }
  };
  const forgot = async (e) => {
    e.preventDefault(); setMsg(null);
    try {
      await api.post('/auth/forgot', { email: f.email });
      setMode('reset');
      setMsg({ text: 'إن كان الإيميل مسجلًا فقد أُرسل إليه رمز من 6 أرقام.' });
    } catch (x) { fail(x); }
  };
  const reset = async (e) => {
    e.preventDefault(); setMsg(null);
    try {
      await api.post('/auth/reset', { email: f.email, code: f.code, newPassword: f.newPassword });
      setMode('login'); setF({ ...f, password: '', code: '', newPassword: '' });
      setMsg({ text: 'تم تغيير كلمة السر. سجّل الدخول.' });
    } catch (x) { fail(x); }
  };

  return (
    <div className="auth glass">
      <LogoPlate width={240} />
      <h1>لوحة الإدارة</h1>
      {mode === 'login' && (
        <form onSubmit={login}>
          <Field label="الإيميل"><input type="email" required dir="ltr" autoComplete="username" value={f.email} onChange={set('email')} /></Field>
          <Field label="كلمة السر"><input type="password" required dir="ltr" autoComplete="current-password" value={f.password} onChange={set('password')} /></Field>
          <button className="btn primary">دخول</button>
          <button type="button" className="link" onClick={() => { setMode('forgot'); setMsg(null); }}>نسيت كلمة السر؟</button>
        </form>
      )}
      {mode === 'forgot' && (
        <form onSubmit={forgot}>
          <p className="muted">اكتب إيميلك وسنرسل رمز تحقق من 6 أرقام.</p>
          <Field label="الإيميل"><input type="email" required dir="ltr" value={f.email} onChange={set('email')} /></Field>
          <button className="btn primary">إرسال الرمز</button>
          <button type="button" className="link" onClick={() => setMode('login')}>رجوع</button>
        </form>
      )}
      {mode === 'reset' && (
        <form onSubmit={reset}>
          <Field label="الإيميل"><input type="email" required dir="ltr" value={f.email} onChange={set('email')} /></Field>
          <Field label="رمز التحقق"><input required dir="ltr" inputMode="numeric" maxLength={6} value={f.code} onChange={set('code')} /></Field>
          <Field label="كلمة السر الجديدة (8 أحرف على الأقل)"><input type="password" required minLength={8} dir="ltr" autoComplete="new-password" value={f.newPassword} onChange={set('newPassword')} /></Field>
          <button className="btn primary">تغيير كلمة السر</button>
          <button type="button" className="link" onClick={() => setMode('login')}>رجوع</button>
        </form>
      )}
      {msg && <p className={msg.err ? 'err' : 'ok'} role="status">{msg.text}</p>}
      <Link className="link" to="/">← الصفحة الرئيسية</Link>
    </div>
  );
}

/* ---------- profile, about, vision ---------- */

function ProfileEditor() {
  const [p, setP] = useState(null);
  const [notify, note] = useNotice();
  useEffect(() => { api.get('/admin/profile').then(setP); }, []);
  if (!p) return <p className="muted">جارٍ التحميل…</p>;
  const set = (k) => (e) => setP({ ...p, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    try { setP(await api.put('/admin/profile', p)); notify('تم الحفظ'); } catch (x) { notify(x.message, true); }
  };
  return (
    <form onSubmit={save} className="form">
      <p className="muted">الاسم والصورة ورقم التواصل تظهر ثابتة في أعلى الصفحة.</p>
      <ImageInput label="الصورة الشخصية" value={p.photoUrl} onChange={(v) => setP({ ...p, photoUrl: v })} />
      <div className="two">
        <Field label="الاسم (عربي)"><input value={p.nameAr} onChange={set('nameAr')} /></Field>
        <Field label="الاسم (English)"><input dir="ltr" value={p.nameEn} onChange={set('nameEn')} /></Field>
      </div>
      <Field label="رقم التواصل"><input dir="ltr" value={p.phone} onChange={set('phone')} /></Field>
      <div className="two">
        <Field label="من نحن (عربي)"><textarea rows={5} value={p.aboutAr} onChange={set('aboutAr')} /></Field>
        <Field label="About (English)"><textarea dir="ltr" rows={5} value={p.aboutEn} onChange={set('aboutEn')} /></Field>
      </div>
      <div className="two">
        <Field label="الرؤية (عربي)"><textarea rows={4} value={p.visionAr} onChange={set('visionAr')} /></Field>
        <Field label="Vision (English)"><textarea dir="ltr" rows={4} value={p.visionEn} onChange={set('visionEn')} /></Field>
      </div>
      <button className="btn primary">حفظ</button>
      {note}
    </form>
  );
}

/* ---------- generic list + form editor ---------- */

function CrudEditor({ resource, fields, blank, titleOf, renderExtra, addLabel }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(null);
  const [notify, note] = useNotice();

  const load = useCallback(async () => {
    const list = await api.get(`/admin/${resource}`);
    setItems(list);
    return list;
  }, [resource]);
  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    try {
      const saved = form.id ? await api.put(`/admin/${resource}/${form.id}`, form) : await api.post(`/admin/${resource}`, form);
      const list = await load();
      setForm(list.find((x) => x.id === saved.id) || saved);
      notify('تم الحفظ');
    } catch (x) { notify(x.message, true); }
  };
  const remove = async (id) => {
    try { await api.del(`/admin/${resource}/${id}`); if (form?.id === id) setForm(null); await load(); } catch (x) { notify(x.message, true); }
  };
  const reload = async () => {
    const list = await load();
    setForm((cur) => (cur?.id ? list.find((x) => x.id === cur.id) || cur : cur));
  };

  return (
    <div className="crud">
      <aside className="crud-list">
        <button className="btn primary" onClick={() => setForm({ ...blank })}>{addLabel || '+ إضافة'}</button>
        <ul>
          {items.map((it) => (
            <li key={it.id} className={form?.id === it.id ? 'on' : ''}>
              <button type="button" className="row-main" onClick={() => setForm({ ...it })}>{titleOf(it) || `#${it.id}`}</button>
              <Confirm onYes={() => remove(it.id)}>حذف</Confirm>
            </li>
          ))}
          {items.length === 0 && <li className="muted">لا توجد عناصر بعد.</li>}
        </ul>
      </aside>
      <div className="crud-form">
        {!form ? <p className="muted">اختر عنصرًا للتعديل أو أضف جديدًا.</p> : (
          <form onSubmit={save} className="form">
            <h3>{form.id ? 'تعديل' : 'عنصر جديد'}</h3>
            {fields.map((fd) => {
              if (fd.type === 'image') return <ImageInput key={fd.key} label={fd.label} value={form[fd.key]} onChange={(v) => setForm({ ...form, [fd.key]: v })} />;
              if (fd.type === 'select') {
                return (
                  <Field key={fd.key} label={fd.label}>
                    <select value={form[fd.key]} onChange={set(fd.key)}>{fd.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  </Field>
                );
              }
              if (fd.type === 'checkbox') return <Field key={fd.key} label={fd.label}><input type="checkbox" checked={!!form[fd.key]} onChange={(e) => setForm({ ...form, [fd.key]: e.target.checked })} /></Field>;
              if (fd.type === 'textarea') return <Field key={fd.key} label={fd.label}><textarea rows={fd.rows || 4} dir={fd.ltr ? 'ltr' : undefined} value={form[fd.key]} onChange={set(fd.key)} /></Field>;
              return <Field key={fd.key} label={fd.label} hint={fd.hint}><input type={fd.type === 'number' ? 'number' : 'text'} dir={fd.ltr ? 'ltr' : undefined} value={form[fd.key]} onChange={set(fd.key)} /></Field>;
            })}
            {renderExtra && renderExtra({ form, setForm, reload, notify })}
            <button className="btn primary">حفظ</button>
            {note}
          </form>
        )}
      </div>
    </div>
  );
}

/* ---------- extra sections: ordered content blocks ---------- */

const BLOCK_DEFAULTS = {
  HEADING: { textAr: '', textEn: '', level: 2 },
  TEXT: { textAr: '', textEn: '' },
  LINK: { titleAr: '', titleEn: '', url: '' },
  BUTTON: { labelAr: '', labelEn: '', url: '', color: '#6fd0ff' },
  IMAGE: { url: '', captionAr: '', captionEn: '' },
  GALLERY: { images: [] },
  FILE: { url: '', titleAr: '', titleEn: '', name: '', size: 0 },
};
const BLOCK_LABELS = { HEADING: 'عنوان', TEXT: 'نص', LINK: 'رابط', BUTTON: 'زر', IMAGE: 'صورة', GALLERY: 'معرض صور', FILE: 'ملف' };

function SectionsEditor() {
  const [sections, setSections] = useState([]);
  const [form, setForm] = useState(null);
  const [dragged, setDragged] = useState(null);
  const [notify, note] = useNotice();
  const load = useCallback(async () => {
    const list = await api.get('/admin/sections');
    setSections(list);
    setForm((current) => current?.id ? list.find((s) => s.id === current.id) || null : current);
    return list;
  }, []);
  useEffect(() => { load().catch((x) => notify(x.message, true)); }, [load]);
  const saveSection = async (e) => {
    e.preventDefault();
    try {
      const saved = form.id ? await api.put(`/admin/sections/${form.id}`, form) : await api.post('/admin/sections', form);
      const list = await load(); setForm(list.find((s) => s.id === saved.id) || saved); notify('تم الحفظ');
    } catch (x) { notify(x.message, true); }
  };
  const removeSection = async (id) => { try { await api.del(`/admin/sections/${id}`); if (form?.id === id) setForm(null); await load(); } catch (x) { notify(x.message, true); } };
  const addBlock = async (type) => {
    try { await api.post(`/admin/sections/${form.id}/blocks`, { type, data: BLOCK_DEFAULTS[type] }); await load(); notify('تمت إضافة البلوك'); }
    catch (x) { notify(x.message, true); }
  };
  const saveBlock = async (block) => { try { await api.put(`/admin/blocks/${block.id}`, { data: block.data }); await load(); notify('تم حفظ البلوك'); } catch (x) { notify(x.message, true); } };
  const removeBlock = async (id) => { try { await api.del(`/admin/blocks/${id}`); await load(); } catch (x) { notify(x.message, true); } };
  const reorder = async (blocks) => {
    const previous = form.blocks;
    setForm({ ...form, blocks });
    try { await api.put(`/admin/sections/${form.id}/blocks/reorder`, { ids: blocks.map((b) => b.id) }); await load(); }
    catch (x) { setForm({ ...form, blocks: previous }); notify(x.message, true); }
  };
  const move = (index, delta) => { const next = [...form.blocks]; const target = index + delta; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; reorder(next); };
  const upload = async (file, block, key = 'url') => {
    if (!file) return;
    try { const uploaded = await api.upload(file); const data = { ...block.data, [key]: uploaded.url }; if (block.type === 'FILE') { data.name = uploaded.name; data.size = uploaded.size; } await api.put(`/admin/blocks/${block.id}`, { data }); await load(); }
    catch (x) { notify(x.message, true); }
  };
  const addGallery = async (files, block) => {
    try { const uploaded = await Promise.all([...files].map((file) => api.upload(file))); await api.put(`/admin/blocks/${block.id}`, { data: { ...block.data, images: [...(block.data.images || []), ...uploaded.map((x) => x.url)] } }); await load(); }
    catch (x) { notify(x.message, true); }
  };
  const updateLocalBlock = (id, data) => setForm({ ...form, blocks: form.blocks.map((b) => b.id === id ? { ...b, data } : b) });
  const blockFields = (block) => {
    const d = block.data || {}; const set = (key, value) => updateLocalBlock(block.id, { ...d, [key]: value });
    const bilingual = (prefix) => <div className="two"><Field label="العربية"><input value={d[`${prefix}Ar`] || ''} onChange={(e) => set(`${prefix}Ar`, e.target.value)} /></Field><Field label="English"><input dir="ltr" value={d[`${prefix}En`] || ''} onChange={(e) => set(`${prefix}En`, e.target.value)} /></Field></div>;
    if (block.type === 'HEADING') return <>{bilingual('text')}<Field label="المستوى"><select value={d.level || 2} onChange={(e) => set('level', Number(e.target.value))}><option value={2}>H2</option><option value={3}>H3</option></select></Field></>;
    if (block.type === 'TEXT') return <div className="two"><Field label="النص العربي"><textarea rows={4} value={d.textAr || ''} onChange={(e) => set('textAr', e.target.value)} /></Field><Field label="English text"><textarea dir="ltr" rows={4} value={d.textEn || ''} onChange={(e) => set('textEn', e.target.value)} /></Field></div>;
    if (block.type === 'LINK') return <>{bilingual('title')}<Field label="URL"><input dir="ltr" value={d.url || ''} onChange={(e) => set('url', e.target.value)} /></Field></>;
    if (block.type === 'BUTTON') return <>{bilingual('label')}<Field label="URL"><input dir="ltr" value={d.url || ''} onChange={(e) => set('url', e.target.value)} /></Field><div className="color-row">{['#6fd0ff','#7b8cff','#4ade80','#f5c26b','#ff8a8a','#e8edf8'].map((c) => <button key={c} type="button" className="color-swatch" style={{ background: c }} onClick={() => set('color', c)} aria-label={c} />)}<input type="color" value={d.color || '#6fd0ff'} onChange={(e) => set('color', e.target.value)} /><a className="btn" style={{ background: d.color || '#6fd0ff', color: '#111' }}>معاينة</a></div></>;
    if (block.type === 'IMAGE') return <>{bilingual('caption')}<Field label="الصورة"><input type="file" accept="image/*" onChange={(e) => upload(e.target.files?.[0], block)} />{d.url && <img className="block-preview" src={d.url} alt="" />}</Field></>;
    if (block.type === 'GALLERY') return <Field label="صور المعرض"><div className="thumbs">{(d.images || []).map((url, i) => <div className="thumb" key={url + i}><img src={url} alt="" /><button type="button" className="btn small danger" onClick={() => set('images', d.images.filter((_, j) => j !== i))}>×</button></div>)}</div><input type="file" accept="image/*" multiple onChange={(e) => addGallery(e.target.files, block)} /></Field>;
    return <>{bilingual('title')}<Field label="الملف"><input type="file" onChange={(e) => upload(e.target.files?.[0], block)} />{d.name && <small className="muted">{d.name} · {Math.round((d.size || 0) / 1024)} KB</small>}</Field></>;
  };
  return <div className="crud"><aside className="crud-list"><button className="btn primary" onClick={() => setForm({ titleAr: '', titleEn: '', order: sections.length, blocks: [] })}>+ إضافة قسم</button><ul>{sections.map((s) => <li key={s.id} className={form?.id === s.id ? 'on' : ''}><button type="button" className="row-main" onClick={() => setForm(s)}>{s.titleAr || s.titleEn || `#${s.id}`}</button><Confirm onYes={() => removeSection(s.id)}>حذف</Confirm></li>)}</ul></aside><div className="crud-form">{!form ? <p className="muted">اختر قسماً أو أضف قسماً جديداً.</p> : <><form className="form" onSubmit={saveSection}><div className="two"><Field label="عنوان القسم (عربي)"><input value={form.titleAr} onChange={(e) => setForm({ ...form, titleAr: e.target.value })} /></Field><Field label="Section title (English)"><input dir="ltr" value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} /></Field></div><Field label="الترتيب"><input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} /></Field><button className="btn primary">حفظ القسم</button></form>{form.id && <><div className="block-add">{Object.keys(BLOCK_DEFAULTS).map((type) => <button key={type} type="button" className="btn small" onClick={() => addBlock(type)}>+ {BLOCK_LABELS[type]}</button>)}</div><div className="section-blocks">{form.blocks.map((block, i) => <article key={block.id} className="section-block" draggable onDragStart={() => setDragged(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragged !== null && dragged !== i) { const next = [...form.blocks]; const [item] = next.splice(dragged, 1); next.splice(i, 0, item); reorder(next); } setDragged(null); }}><div className="block-head"><span className="drag-handle" title="اسحب لإعادة الترتيب">⠿</span><strong className="block-type">{BLOCK_LABELS[block.type]}</strong><span><button type="button" className="btn small" onClick={() => move(i, -1)} disabled={!i}>↑</button><button type="button" className="btn small" onClick={() => move(i, 1)} disabled={i === form.blocks.length - 1}>↓</button><Confirm onYes={() => removeBlock(block.id)}>حذف</Confirm></span></div>{blockFields(block)}<button type="button" className="btn primary small" onClick={() => saveBlock(block)}>حفظ البلوك</button></article>)}</div></>}</>}</div>{note}</div>;
}

function LayoutEditor() {
  const [saved, setSaved] = useState([]);
  const [items, setItems] = useState([]);
  const [dragged, setDragged] = useState(null);
  const [notify, note] = useNotice();
  const load = useCallback(async () => { const data = await api.get('/admin/layout'); setSaved(data); setItems(data); }, []);
  useEffect(() => { load().catch((x) => notify(x.message, true)); }, [load]);
  const changed = JSON.stringify(saved) !== JSON.stringify(items);
  const move = (from, to) => { if (to < 0 || to >= items.length) return; const next = [...items]; const [item] = next.splice(from, 1); next.splice(to, 0, item); setItems(next); };
  const edit = (index, patch) => setItems(items.map((x, i) => i === index ? { ...x, ...patch } : x));
  const save = async () => { try { const result = await api.put('/admin/layout', { items: items.map(({ key, labelAr, labelEn, visible }) => ({ key, labelAr, labelEn, visible })) }); setSaved(result); setItems(result); notify('تم الحفظ'); } catch (x) { notify(x.message, true); } };
  const reset = () => { const builtins = ['about', 'vision', 'works', 'links', 'contact', 'reviews']; setItems([...items.filter((x) => builtins.includes(x.key)).sort((a, b) => builtins.indexOf(a.key) - builtins.indexOf(b.key)).map((x) => ({ ...x, labelAr: '', labelEn: '', visible: true })), ...items.filter((x) => !builtins.includes(x.key)).map((x) => ({ ...x, visible: true }))]); };
  const placeholders = { about: 'من نحن', vision: 'الرؤية', works: 'الأعمال', links: 'الروابط', contact: 'التواصل', reviews: 'التقييمات' };
  return <div className="form"><p className="muted">اسحب العناصر أو استخدم الأسهم، ثم احفظ التغييرات.</p><div className="layout-list">{items.map((item, index) => <article key={item.key} className={`layout-card ${dragged === index ? 'dragging' : ''}`} draggable onDragStart={() => setDragged(index)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragged !== null) move(dragged, index); setDragged(null); }}><div className="layout-head"><span className="drag-handle">⠿</span><strong className="block-type">{item.kind === 'section' ? 'قسم إضافي' : 'أساسي'}</strong><span><button type="button" className="btn small" aria-label="للأعلى" disabled={!index} onClick={() => move(index, index - 1)}>↑</button><button type="button" className="btn small" aria-label="للأسفل" disabled={index === items.length - 1} onClick={() => move(index, index + 1)}>↓</button></span><label className="visibility">ظاهر <input type="checkbox" checked={item.visible} onChange={(e) => edit(index, { visible: e.target.checked })} /></label></div><div className="two"><Field label="العنوان (عربي)"><input value={item.labelAr} placeholder={item.kind === 'builtin' ? placeholders[item.key] : ''} onChange={(e) => edit(index, { labelAr: e.target.value })} /></Field><Field label="Title (English)"><input dir="ltr" value={item.labelEn} placeholder={item.kind === 'builtin' ? item.key : ''} onChange={(e) => edit(index, { labelEn: e.target.value })} /></Field></div></article>)}</div><p className="muted">عنوان القسم الإضافي هو نفسه الموجود في تبويب أقسام إضافية.</p>{changed && <p className="warn">تعديلات غير محفوظة</p>}<div className="row-actions"><button type="button" className="btn primary" onClick={save}>حفظ الترتيب والعناوين</button><Confirm className="btn" onYes={reset}>إعادة الترتيب الافتراضي</Confirm></div>{note}</div>;
}

/* ---------- works: usage steps, screenshots, downloadable files ---------- */

function WorkExtras({ form, setForm, reload, notify }) {
  const steps = Array.isArray(form.steps) ? form.steps : [];
  const gallery = Array.isArray(form.gallery) ? form.gallery : [];
  const [busy, setBusy] = useState(false);

  const setStep = (i, patch) => setForm({ ...form, steps: steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const move = (i, d) => {
    const a = [...steps]; const j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    setForm({ ...form, steps: a });
  };

  const addGallery = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    setBusy(true);
    try {
      const urls = [];
      for (const f of files) urls.push((await api.upload(f)).url);
      setForm({ ...form, gallery: [...gallery, ...urls] });
    } catch (x) { notify(x.message, true); }
    setBusy(false);
  };

  const addFile = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    setBusy(true);
    try {
      for (const f of files) {
        const up = await api.upload(f);
        await api.post(`/admin/works/${form.id}/files`, up);
      }
      await reload();
      notify('تم رفع الملفات');
    } catch (x) { notify(x.message, true); }
    setBusy(false);
  };
  const delFile = async (id) => { try { await api.del(`/admin/files/${id}`); await reload(); } catch (x) { notify(x.message, true); } };

  return (
    <>
      <fieldset>
        <legend>كيفية استخدام النظام (نص وصورة لكل خطوة)</legend>
        {steps.map((s, i) => (
          <div key={i} className="step-edit">
            <div className="step-head">
              <strong>خطوة {i + 1}</strong>
              <span>
                <button type="button" className="btn small" onClick={() => move(i, -1)} aria-label="للأعلى">↑</button>
                <button type="button" className="btn small" onClick={() => move(i, 1)} aria-label="للأسفل">↓</button>
                <button type="button" className="btn small danger" onClick={() => setForm({ ...form, steps: steps.filter((_, j) => j !== i) })}>حذف</button>
              </span>
            </div>
            <div className="two">
              <Field label="النص (عربي)"><textarea rows={3} value={s.textAr || ''} onChange={(e) => setStep(i, { textAr: e.target.value })} /></Field>
              <Field label="Text (English)"><textarea dir="ltr" rows={3} value={s.textEn || ''} onChange={(e) => setStep(i, { textEn: e.target.value })} /></Field>
            </div>
            <ImageInput label="صورة الخطوة" value={s.imageUrl || ''} onChange={(v) => setStep(i, { imageUrl: v })} />
          </div>
        ))}
        <button type="button" className="btn" onClick={() => setForm({ ...form, steps: [...steps, { textAr: '', textEn: '', imageUrl: '' }] })}>+ إضافة خطوة</button>
      </fieldset>

      <fieldset>
        <legend>صور توضيحية</legend>
        <div className="thumbs">
          {gallery.map((g, i) => (
            <div key={g + i} className="thumb">
              <img src={g} alt="" />
              <button type="button" className="btn small danger" onClick={() => setForm({ ...form, gallery: gallery.filter((_, j) => j !== i) })}>×</button>
            </div>
          ))}
        </div>
        <input type="file" accept="image/*" multiple onChange={addGallery} disabled={busy} />
      </fieldset>

      <fieldset>
        <legend>ملفات للتنزيل</legend>
        {!form.id ? <p className="muted">احفظ العمل أولًا ثم أضف الملفات.</p> : (
          <>
            <ul className="files-admin">
              {(form.files || []).map((f) => (
                <li key={f.id}>
                  <a href={f.url} download={f.name}>{f.name}</a>
                  <Confirm onYes={() => delFile(f.id)}>حذف</Confirm>
                </li>
              ))}
            </ul>
            <input type="file" multiple onChange={addFile} disabled={busy} />
            {busy && <span className="muted"> جارٍ الرفع…</span>}
          </>
        )}
      </fieldset>
    </>
  );
}

const WORK_FIELDS = [
  { key: 'type', label: 'النوع', type: 'select', options: [['WEB', 'ويب'], ['MOBILE', 'جوال'], ['DESKTOP', 'سطح مكتب'], ['OTHER', 'أخرى']] },
  { key: 'titleAr', label: 'العنوان (عربي)' },
  { key: 'titleEn', label: 'Title (English)', ltr: true },
  { key: 'imageUrl', label: 'الصورة', type: 'image' },
  { key: 'version', label: 'الإصدار', ltr: true },
  { key: 'summaryAr', label: 'شرح مختصر (عربي)', type: 'textarea', rows: 3 },
  { key: 'featured', label: 'عمل مميز (يظهر في عارض الرئيسية)', type: 'checkbox' },
  { key: 'summaryEn', label: 'Short description (English)', type: 'textarea', rows: 3, ltr: true },
  { key: 'link', label: 'الرابط (يظهر زر "فتح الرابط")', ltr: true, hint: 'يجب أن يبدأ بـ https://' },
  { key: 'introAr', label: 'تعريف بالنظام (عربي)', type: 'textarea', rows: 5 },
  { key: 'introEn', label: 'About the system (English)', type: 'textarea', rows: 5, ltr: true },
  { key: 'policyAr', label: 'سياسة استخدام النظام (عربي)', type: 'textarea', rows: 5 },
  { key: 'policyEn', label: 'Usage policy (English)', type: 'textarea', rows: 5, ltr: true },
  { key: 'order', label: 'الترتيب (الأصغر أولًا)', type: 'number' },
];

/* ---------- reviews ---------- */

function ReviewsAdmin({ onPendingChange }) {
  const [items, setItems] = useState([]);
  const [loadErr, setLoadErr] = useState(null);
  const [email, setEmail] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [search, setSearch] = useState('');
  const [notify, note] = useNotice();

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      const list = await api.get('/admin/reviews');
      setItems(list);
      if (onPendingChange) {
        onPendingChange(list.filter(r => !r.approved).length);
      }
    } catch (x) {
      setLoadErr(x.message || 'فشل تحميل التقييمات');
    }
  }, [onPendingChange]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (r) => {
    try { await api.put(`/admin/reviews/${r.id}`, { approved: !r.approved }); await load(); }
    catch (x) { notify(x.message, true); }
  };
  const del = async (r) => {
    try { await api.del(`/admin/reviews/${r.id}`); await load(); }
    catch (x) { notify(x.message, true); }
  };
  const delByEmail = async (e) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value) { notify('اكتب إيميلًا أولًا.', true); return; }
    if (!confirm) { notify('يجب تأكيد الحذف.', true); return; }
    try {
      const result = await api.del(`/admin/reviews/email/${encodeURIComponent(value)}`, { confirm: true });
      notify(`تم حذف ${result.deleted ?? 0} تقييم(ات).`);
      setEmail(''); setConfirm(false); load();
    } catch (x) { notify(x.message, true); }
  };

  const pending = items.filter(r => !r.approved);
  const filtered = search
    ? items.filter(r => r.email?.toLowerCase().includes(search.toLowerCase()) || r.name?.toLowerCase().includes(search.toLowerCase()))
    : items;
  // Show pending first
  const sorted = [...filtered.filter(r => !r.approved), ...filtered.filter(r => r.approved)];

  if (loadErr) {
    return (
      <div className="form">
        <p className="err" role="alert">خطأ في تحميل التقييمات: {loadErr}</p>
        <button className="btn" onClick={load}>إعادة المحاولة / Retry</button>
      </div>
    );
  }

  return (
    <div className="form">
      <p className="muted">
        التقييم الجديد لا يظهر للزوار حتى توافق عليه. الإيميل يظهر لك أنت فقط.
        {pending.length > 0 && <strong style={{ color: 'var(--warn, #f5c26b)', marginRight: 8 }}> ({pending.length} بانتظار الموافقة)</strong>}
      </p>

      {/* Search */}
      <Field label="بحث حسب الاسم أو الإيميل">
        <input dir="ltr" value={search} onChange={e => setSearch(e.target.value)} placeholder="name or email…" />
      </Field>

      {/* Delete by email tool */}
      <details style={{ marginBottom: '1rem' }}>
        <summary style={{ cursor: 'pointer', marginBottom: 8 }}>🗑 حذف جميع تقييمات إيميل معين</summary>
        <form onSubmit={delByEmail} className="row-actions" style={{ flexWrap: 'wrap' }}>
          <Field label="الإيميل"><input dir="ltr" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" /></Field>
          <label className="field" style={{ minWidth: 200 }}>
            <span>تأكيد الحذف</span>
            <input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} />
          </label>
          <button className="btn danger" type="submit">حذف جميع تقييمات هذا الإيميل</button>
        </form>
      </details>

      {note}

      {sorted.length === 0 && <p className="muted">لا توجد تقييمات.</p>}
      {sorted.map((r) => (
        <article key={r.id} className="glass review-admin">
          <div className="review-top">
            <strong>{r.name}</strong>
            <span dir="ltr" className="muted">{r.email}</span>
            <span className="pill">{'★'.repeat(r.rating)}</span>
            <span className={`pill ${r.approved ? '' : 'warn'}`}>{r.approved ? 'معتمد / Approved' : 'بانتظار الموافقة / Pending'}</span>
          </div>
          <p>{r.comment}</p>
          <div className="muted" style={{ fontSize: '0.8em', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span>تاريخ الإرسال: {new Date(r.createdAt).toLocaleString('en-GB')}</span>
            {r.consentAt && <span>قبول السياسة: {new Date(r.consentAt).toLocaleString('en-GB')}</span>}
          </div>
          <div className="row-actions">
            <button className="btn small primary" onClick={() => toggle(r)}>{r.approved ? 'إخفاء / Hide' : 'موافقة وإظهار / Approve'}</button>
            <Confirm onYes={() => del(r)}>حذف</Confirm>
          </div>
        </article>
      ))}
    </div>
  );
}

/* ---------- privacy policy editor ---------- */

const DEFAULT_PRIVACY = {
  titleAr: 'سياسة الخصوصية',
  titleEn: 'Privacy Policy',
  bodyAr: 'نحن نلتزم بحماية بيانات زوارنا. لا نبيع البيانات ولا نشاركها مع أطراف ثالثة لأغراض التسويق.\n\n## ما نجمعه\n\n- يتم جمع الاسم والبريد الإلكتروني والتقييم والتعليق فقط عند إرسال مراجعة.\n- يُحفظ البريد الإلكتروني لأغراض الإشراف الإداري؛ ولا يتم إظهاره في الصفحات العامة.\n- لا توجد ملفات تعريف ارتباط أو تحليلات أو تعقب.\n\n**بإرسال تقييم، فأنت توافق على تخزين الاسم والبريد الإلكتروني والتعليق وفقًا لهذه السياسة.**',
  bodyEn: 'We protect visitor data and do not sell or share it with third parties for marketing.\n\n## What We Collect\n\n- Name, email, rating, and comment are collected only when a visitor submits a review.\n- The email is stored for admin moderation and is never shown on public pages.\n- This site does not use analytics, cookies, or tracker scripts.\n\n**By submitting a review, you agree that your name, email, and comment may be stored per this policy.**',
};

function PrivacyEditor() {
  const [doc, setDoc] = useState(null);
  const [subTab, setSubTab] = useState('ar');
  const [notify, note] = useNotice();
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    try { setDoc(await api.get('/admin/privacy')); }
    catch (x) { notify(x.message, true); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (e) => {
    e.preventDefault();
    try { setDoc(await api.put('/admin/privacy', doc)); notify('تم الحفظ'); }
    catch (x) { notify(x.message, true); }
  };

  const reset = async () => {
    setResetting(false);
    const val = { ...DEFAULT_PRIVACY, updatedAt: new Date().toISOString() };
    try { setDoc(await api.put('/admin/privacy', val)); notify('تمت إعادة الضبط إلى النص الافتراضي'); }
    catch (x) { notify(x.message, true); }
  };

  if (!doc) return <p className="muted">جارٍ التحميل…</p>;

  return (
    <form onSubmit={save} className="form">
      <p className="muted">
        حرر نص سياسة الخصوصية بالعربية والإنجليزية. يدعم الصياغة بـ Markdown (## عنوان، - قائمة، **굵게**).
      </p>

      <div className="tabs" role="tablist" style={{ marginBottom: '1rem' }}>
        <button type="button" role="tab" aria-selected={subTab === 'ar'} className={subTab === 'ar' ? 'on' : ''} onClick={() => setSubTab('ar')}>العربية</button>
        <button type="button" role="tab" aria-selected={subTab === 'en'} className={subTab === 'en' ? 'on' : ''} onClick={() => setSubTab('en')}>English</button>
      </div>

      {subTab === 'ar' && (
        <>
          <Field label="عنوان الصفحة (عربي)">
            <input value={doc.titleAr || ''} onChange={e => setDoc({ ...doc, titleAr: e.target.value })} />
          </Field>
          <Field label="نص السياسة (عربي)">
            <textarea rows={16} value={doc.bodyAr || ''} onChange={e => setDoc({ ...doc, bodyAr: e.target.value })} style={{ fontFamily: 'monospace', fontSize: '0.9em' }} />
          </Field>
        </>
      )}
      {subTab === 'en' && (
        <>
          <Field label="Page title (English)">
            <input dir="ltr" value={doc.titleEn || ''} onChange={e => setDoc({ ...doc, titleEn: e.target.value })} />
          </Field>
          <Field label="Policy text (English)">
            <textarea dir="ltr" rows={16} value={doc.bodyEn || ''} onChange={e => setDoc({ ...doc, bodyEn: e.target.value })} style={{ fontFamily: 'monospace', fontSize: '0.9em' }} />
          </Field>
        </>
      )}

      {doc.updatedAt && (
        <p className="muted" style={{ fontSize: '0.85em' }}>
          آخر تحديث / Last updated: {new Date(doc.updatedAt).toLocaleString('en-GB')}
        </p>
      )}

      <div className="row-actions" style={{ marginTop: '1rem' }}>
        <button className="btn primary" type="submit">حفظ / Save</button>
        {resetting
          ? (
            <span className="confirm">
              هل أنت متأكد من إعادة الضبط؟
              <button type="button" className="btn small danger" onClick={reset}>نعم، إعادة الضبط</button>
              <button type="button" className="btn small" onClick={() => setResetting(false)}>إلغاء</button>
            </span>
          )
          : (
            <button type="button" className="btn" onClick={() => setResetting(true)}>
              إعادة الضبط إلى الافتراضي / Reset to default
            </button>
          )
        }
        <a className="btn" href="/policy" target="_blank" rel="noopener noreferrer">
          معاينة / Preview ↗
        </a>
      </div>
      {note}
    </form>
  );
}

/* ---------- account ---------- */

function useResend(onResend) {
  const [secs, setSecs] = useState(0);
  const start = () => {
    setSecs(60);
    onResend();
  };
  useEffect(() => {
    if (secs <= 0) return;
    const id = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secs]);
  return [secs, start];
}

function Account({ email, onEmailChange }) {
  // ── Email change state ──────────────────────────────────────────────────
  const [emailStep, setEmailStep] = useState(1);
  const [newEmail, setNewEmail] = useState('');
  const [emailPwd, setEmailPwd] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailMsg, setEmailMsg] = useState(null);
  const [emailBusy, setEmailBusy] = useState(false);

  // ── Password change state ───────────────────────────────────────────────
  const [pwdStep, setPwdStep] = useState(1);
  const [curPwd, setCurPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdCode, setPwdCode] = useState('');
  const [pwdMsg, setPwdMsg] = useState(null);
  const [pwdBusy, setPwdBusy] = useState(false);

  const handle401 = (err) => {
    if (err.status === 401) { setToken(''); window.location.reload(); }
  };

  // ── Email change handlers ───────────────────────────────────────────────
  const sendEmailCode = async (e) => {
    if (e) e.preventDefault();
    setEmailMsg(null); setEmailBusy(true);
    try {
      await api.post('/auth/change-email/request', { newEmail, password: emailPwd });
      setEmailStep(2);
      setEmailMsg({ text: null });
    } catch (x) { handle401(x); setEmailMsg({ err: true, text: x.message }); }
    setEmailBusy(false);
  };
  const [emailSecs, startEmailResend] = useResend(sendEmailCode);

  const confirmEmail = async (e) => {
    e.preventDefault(); setEmailMsg(null); setEmailBusy(true);
    try {
      const r = await api.post('/auth/change-email/confirm', { code: emailCode });
      setToken(r.token);
      if (onEmailChange) onEmailChange(r.email);
      setEmailStep(1); setNewEmail(''); setEmailPwd(''); setEmailCode('');
      setEmailMsg({ text: 'تم تغيير الإيميل بنجاح' });
    } catch (x) { handle401(x); setEmailMsg({ err: true, text: x.message }); }
    setEmailBusy(false);
  };

  // ── Password change handlers ────────────────────────────────────────────
  const sendPwdCode = async (e) => {
    if (e) e.preventDefault();
    if (newPwd !== confirmPwd) { setPwdMsg({ err: true, text: 'كلمة السر الجديدة وتأكيدها غير متطابقين' }); return; }
    setPwdMsg(null); setPwdBusy(true);
    try {
      await api.post('/auth/change-password/request', { currentPassword: curPwd, newPassword: newPwd });
      setPwdStep(2);
      setPwdMsg({ text: null });
    } catch (x) { handle401(x); setPwdMsg({ err: true, text: x.message }); }
    setPwdBusy(false);
  };
  const [pwdSecs, startPwdResend] = useResend(sendPwdCode);

  const confirmPwdChange = async (e) => {
    e.preventDefault(); setPwdMsg(null); setPwdBusy(true);
    try {
      const r = await api.post('/auth/change-password/confirm', { code: pwdCode });
      setToken(r.token);
      setPwdStep(1); setCurPwd(''); setNewPwd(''); setConfirmPwd(''); setPwdCode('');
      setPwdMsg({ text: 'تم تغيير كلمة السر بنجاح' });
    } catch (x) { handle401(x); setPwdMsg({ err: true, text: x.message }); }
    setPwdBusy(false);
  };

  return (
    <div className="form narrow-form">
      <p>الحساب: <strong dir="ltr">{email}</strong></p>

      {/* ── Email change section ──────────────────────────────────────── */}
      <fieldset>
        <legend>تغيير الإيميل</legend>
        {emailStep === 1 && (
          <form onSubmit={sendEmailCode}>
            <Field label="الإيميل الجديد">
              <input id="new-email" type="email" required dir="ltr" value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)} />
            </Field>
            <Field label="كلمة السر الحالية">
              <input id="email-change-pwd" type="password" required dir="ltr" value={emailPwd}
                onChange={(e) => setEmailPwd(e.target.value)} />
            </Field>
            <button id="send-email-code-btn" className="btn primary" disabled={emailBusy}>إرسال رمز التحقق</button>
            {emailMsg?.text && <p className={emailMsg.err ? 'err' : 'ok'} role="status">{emailMsg.text}</p>}
          </form>
        )}
        {emailStep === 2 && (
          <form onSubmit={confirmEmail}>
            <p className="muted">أرسلنا رمزًا من 6 أرقام إلى <strong dir="ltr">{newEmail}</strong></p>
            <Field label="رمز التحقق">
              <input id="email-otp" dir="ltr" inputMode="numeric" maxLength={6} required value={emailCode}
                onChange={(e) => setEmailCode(e.target.value)} />
            </Field>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button id="confirm-email-btn" className="btn primary" disabled={emailBusy}>تأكيد تغيير الإيميل</button>
              <button type="button" className="btn"
                onClick={() => { setEmailStep(1); setEmailCode(''); setEmailMsg(null); }}>
                إلغاء / تعديل الإيميل
              </button>
              <button type="button" className="btn" id="resend-email-btn"
                disabled={emailSecs > 0 || emailBusy}
                onClick={startEmailResend}>
                إعادة إرسال الرمز{emailSecs > 0 ? ` (${emailSecs}s)` : ''}
              </button>
            </div>
            {emailMsg?.text && <p className={emailMsg.err ? 'err' : 'ok'} role="status">{emailMsg.text}</p>}
          </form>
        )}
      </fieldset>

      {/* ── Password change section ───────────────────────────────────── */}
      <fieldset style={{ marginTop: '1.5rem' }}>
        <legend>تغيير كلمة السر</legend>
        {pwdStep === 1 && (
          <form onSubmit={sendPwdCode}>
            <Field label="كلمة السر الحالية">
              <input id="cur-pwd" type="password" required dir="ltr" value={curPwd}
                onChange={(e) => setCurPwd(e.target.value)} />
            </Field>
            <Field label="كلمة السر الجديدة (8 أحرف على الأقل)">
              <input id="new-pwd" type="password" required minLength={8} dir="ltr" value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)} />
            </Field>
            <Field label="تأكيد كلمة السر الجديدة">
              <input id="confirm-pwd" type="password" required minLength={8} dir="ltr" value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)} />
            </Field>
            <button id="send-pwd-code-btn" className="btn primary" disabled={pwdBusy}>إرسال رمز التحقق إلى إيميلي</button>
            {pwdMsg?.text && <p className={pwdMsg.err ? 'err' : 'ok'} role="status">{pwdMsg.text}</p>}
          </form>
        )}
        {pwdStep === 2 && (
          <form onSubmit={confirmPwdChange}>
            <p className="muted">أرسلنا رمزًا من 6 أرقام إلى <strong dir="ltr">{email}</strong></p>
            <Field label="رمز التحقق">
              <input id="pwd-otp" dir="ltr" inputMode="numeric" maxLength={6} required value={pwdCode}
                onChange={(e) => setPwdCode(e.target.value)} />
            </Field>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button id="confirm-pwd-btn" className="btn primary" disabled={pwdBusy}>تأكيد تغيير كلمة السر</button>
              <button type="button" className="btn"
                onClick={() => { setPwdStep(1); setPwdCode(''); setPwdMsg(null); }}>
                إلغاء / تعديل
              </button>
              <button type="button" className="btn" id="resend-pwd-btn"
                disabled={pwdSecs > 0 || pwdBusy}
                onClick={startPwdResend}>
                إعادة إرسال الرمز{pwdSecs > 0 ? ` (${pwdSecs}s)` : ''}
              </button>
            </div>
            {pwdMsg?.text && <p className={pwdMsg.err ? 'err' : 'ok'} role="status">{pwdMsg.text}</p>}
          </form>
        )}
      </fieldset>
    </div>
  );
}

/* ---------- shell ---------- */

const TABS = [
  ['profile', 'الملف و من نحن والرؤية'],
  ['works', 'إدارة الأعمال'],
  ['links', 'إدارة الروابط'],
  ['contacts', 'إدارة التواصل'],
  ['sections', 'أقسام إضافية'],
  ['layout', 'القائمة والترتيب'],
  ['reviews', 'التقييمات'],
  ['privacy', 'الخصوصية'],
  ['account', 'الحساب'],
];

export default function Admin() {
  const [me, setMe] = useState(null);
  const [checking, setChecking] = useState(!!getToken());
  const [tab, setTab] = useState('profile');
  const [pendingCount, setPendingCount] = useState(0);

  const check = useCallback(() => {
    if (!getToken()) { setMe(null); setChecking(false); return; }
    api.get('/auth/me').then((r) => setMe(r.email)).catch(() => { setToken(''); setMe(null); }).finally(() => setChecking(false));
  }, []);
  useEffect(() => { check(); }, [check]);

  useEffect(() => {
    if (me) {
      api.get('/admin/reviews')
        .then(list => setPendingCount(list.filter(r => !r.approved).length))
        .catch(() => {});
    }
  }, [me]);

  if (checking) return <p className="center-note">…</p>;
  if (!me) return <div className="wrap admin" dir="rtl"><Auth onDone={check} /></div>;

  return (
    <div className="wrap admin" dir="rtl">
      <div className="brandbar">
        <Brand />
        <div className="brandbar-actions">
          <Link className="btn" to="/">← الصفحة الرئيسية</Link>
          <button className="btn" onClick={() => { setToken(''); setMe(null); }}>تسجيل الخروج</button>
        </div>
      </div>
      <h1>لوحة الإدارة</h1>
      <div className="tabs" role="tablist">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {l}
            {k === 'reviews' && pendingCount > 0 && (
              <span
                className="badge pending-badge"
                style={{
                  marginInlineStart: 6,
                  background: '#f5c26b',
                  color: '#111',
                  padding: '2px 7px',
                  borderRadius: 10,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  display: 'inline-block',
                  lineHeight: 1.2,
                }}
              >
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="panel glass">
        {tab === 'profile' && <ProfileEditor />}
        {tab === 'works' && (
          <CrudEditor
            resource="works"
            addLabel="+ إضافة عمل أو تطبيق"
            titleOf={(w) => w.titleAr || w.titleEn}
            blank={{ type: 'WEB', titleAr: '', titleEn: '', imageUrl: '', version: '', summaryAr: '', summaryEn: '', link: '', introAr: '', introEn: '', policyAr: '', policyEn: '', steps: [], gallery: [], order: 0, featured: false, files: [] }}
            fields={WORK_FIELDS}
            renderExtra={(p) => <WorkExtras {...p} />}
          />
        )}
        {tab === 'links' && (
          <CrudEditor resource="links" titleOf={(l) => l.title} blank={{ title: '', url: '', order: 0 }}
            fields={[{ key: 'title', label: 'العنوان' }, { key: 'url', label: 'الرابط', ltr: true, hint: 'يجب أن يبدأ بـ https://' }, { key: 'order', label: 'الترتيب', type: 'number' }]} />
        )}
        {tab === 'contacts' && (
          <CrudEditor resource="contacts" titleOf={(c) => `${c.title}: ${c.value}`} blank={{ title: '', value: '', order: 0 }}
            fields={[{ key: 'title', label: 'العنوان (مثل: واتساب)' }, { key: 'value', label: 'الرقم أو القيمة', ltr: true }, { key: 'order', label: 'الترتيب', type: 'number' }]} />
        )}
        {tab === 'sections' && <SectionsEditor />}
        {tab === 'layout' && <LayoutEditor />}
        {tab === 'reviews' && <ReviewsAdmin onPendingChange={setPendingCount} />}
        {tab === 'privacy' && <PrivacyEditor />}
        {tab === 'account' && <Account email={me} onEmailChange={setMe} />}
      </div>
    </div>
  );
}
