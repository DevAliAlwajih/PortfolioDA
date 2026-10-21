import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getToken, setToken } from '../api.js';

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
  { key: 'summaryEn', label: 'Short description (English)', type: 'textarea', rows: 3, ltr: true },
  { key: 'link', label: 'الرابط (يظهر زر "فتح الرابط")', ltr: true, hint: 'يجب أن يبدأ بـ https://' },
  { key: 'introAr', label: 'تعريف بالنظام (عربي)', type: 'textarea', rows: 5 },
  { key: 'introEn', label: 'About the system (English)', type: 'textarea', rows: 5, ltr: true },
  { key: 'policyAr', label: 'سياسة استخدام النظام (عربي)', type: 'textarea', rows: 5 },
  { key: 'policyEn', label: 'Usage policy (English)', type: 'textarea', rows: 5, ltr: true },
  { key: 'order', label: 'الترتيب (الأصغر أولًا)', type: 'number' },
];

/* ---------- reviews ---------- */

function ReviewsAdmin() {
  const [items, setItems] = useState([]);
  const load = useCallback(() => api.get('/admin/reviews').then(setItems), []);
  useEffect(() => { load(); }, [load]);
  const toggle = async (r) => { await api.put(`/admin/reviews/${r.id}`, { approved: !r.approved }); load(); };
  const del = async (r) => { await api.del(`/admin/reviews/${r.id}`); load(); };
  return (
    <div className="form">
      <p className="muted">التقييم الجديد لا يظهر للزوار حتى توافق عليه. الإيميل يظهر لك أنت فقط.</p>
      {items.length === 0 && <p className="muted">لا توجد تقييمات.</p>}
      {items.map((r) => (
        <article key={r.id} className="glass review-admin">
          <div className="review-top">
            <strong>{r.name}</strong>
            <span dir="ltr" className="muted">{r.email}</span>
            <span className="pill">{'★'.repeat(r.rating)}</span>
            <span className={`pill ${r.approved ? '' : 'warn'}`}>{r.approved ? 'ظاهر' : 'بانتظار الموافقة'}</span>
          </div>
          <p>{r.comment}</p>
          <div className="row-actions">
            <button className="btn small primary" onClick={() => toggle(r)}>{r.approved ? 'إخفاء' : 'موافقة وإظهار'}</button>
            <Confirm onYes={() => del(r)}>حذف</Confirm>
          </div>
        </article>
      ))}
    </div>
  );
}

/* ---------- account ---------- */

function Account({ email }) {
  const [f, setF] = useState({ current: '', next: '' });
  const [notify, note] = useNotice();
  const save = async (e) => {
    e.preventDefault();
    try { await api.post('/auth/change-password', f); setF({ current: '', next: '' }); notify('تم تغيير كلمة السر'); } catch (x) { notify(x.message, true); }
  };
  return (
    <form onSubmit={save} className="form narrow-form">
      <p>الحساب: <strong dir="ltr">{email}</strong></p>
      <Field label="كلمة السر الحالية"><input type="password" required dir="ltr" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></Field>
      <Field label="كلمة السر الجديدة (8 أحرف على الأقل)"><input type="password" required minLength={8} dir="ltr" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></Field>
      <button className="btn primary">تغيير كلمة السر</button>
      {note}
    </form>
  );
}

/* ---------- shell ---------- */

const TABS = [
  ['profile', 'الملف و من نحن والرؤية'],
  ['works', 'إدارة الأعمال'],
  ['links', 'إدارة الروابط'],
  ['contacts', 'إدارة التواصل'],
  ['sections', 'أقسام إضافية'],
  ['reviews', 'التقييمات'],
  ['account', 'الحساب'],
];

export default function Admin() {
  const [me, setMe] = useState(null);
  const [checking, setChecking] = useState(!!getToken());
  const [tab, setTab] = useState('profile');

  const check = useCallback(() => {
    if (!getToken()) { setMe(null); setChecking(false); return; }
    api.get('/auth/me').then((r) => setMe(r.email)).catch(() => { setToken(''); setMe(null); }).finally(() => setChecking(false));
  }, []);
  useEffect(() => { check(); }, [check]);

  if (checking) return <p className="center-note">…</p>;
  if (!me) return <div className="wrap admin" dir="rtl"><Auth onDone={check} /></div>;

  return (
    <div className="wrap admin" dir="rtl">
      <div className="topbar">
        <Link className="btn" to="/">← الصفحة الرئيسية</Link>
        <button className="btn" onClick={() => { setToken(''); setMe(null); }}>تسجيل الخروج</button>
      </div>
      <h1>لوحة الإدارة</h1>
      <div className="tabs" role="tablist">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      <div className="panel glass">
        {tab === 'profile' && <ProfileEditor />}
        {tab === 'works' && (
          <CrudEditor
            resource="works"
            addLabel="+ إضافة عمل أو تطبيق"
            titleOf={(w) => w.titleAr || w.titleEn}
            blank={{ type: 'WEB', titleAr: '', titleEn: '', imageUrl: '', version: '', summaryAr: '', summaryEn: '', link: '', introAr: '', introEn: '', policyAr: '', policyEn: '', steps: [], gallery: [], order: 0, files: [] }}
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
        {tab === 'sections' && (
          <CrudEditor resource="sections" addLabel="+ إضافة قسم" titleOf={(s) => s.titleAr || s.titleEn} blank={{ titleAr: '', titleEn: '', bodyAr: '', bodyEn: '', order: 0 }}
            fields={[
              { key: 'titleAr', label: 'عنوان القسم (عربي)' }, { key: 'titleEn', label: 'Section title (English)', ltr: true },
              { key: 'bodyAr', label: 'المحتوى (عربي)', type: 'textarea', rows: 6 }, { key: 'bodyEn', label: 'Content (English)', type: 'textarea', rows: 6, ltr: true },
              { key: 'order', label: 'الترتيب', type: 'number' },
            ]} />
        )}
        {tab === 'reviews' && <ReviewsAdmin />}
        {tab === 'account' && <Account email={me} />}
      </div>
    </div>
  );
}
