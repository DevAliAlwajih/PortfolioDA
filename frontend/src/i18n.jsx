import { createContext, useContext, useEffect, useState } from 'react';

const UI = {
  ar: {
    about: 'من نحن', vision: 'الرؤية', works: 'الأعمال', links: 'الروابط', contact: 'التواصل', rating: 'التقييم',
    all: 'الكل', web: 'ويب', mobile: 'جوال', desktop: 'سطح مكتب', other: 'أخرى',
    details: 'زيارة', openLink: 'فتح الرابط', version: 'الإصدار',
    noWorks: 'لا توجد أعمال بعد.', back: 'العودة للرئيسية',
    intro: 'تعريف بالنظام', policy: 'سياسة استخدام النظام', howto: 'كيفية استخدام النظام', gallery: 'صور توضيحية', files: 'ملفات للتنزيل',
    reviews: 'تقييمات العملاء', noReviews: 'لا توجد تقييمات بعد.', addReview: 'أضف تقييمك',
    yourName: 'الاسم', yourEmail: 'الإيميل (لا يظهر للزوار)', yourComment: 'تعليقك', send: 'إرسال',
    thanks: 'شكرًا لك. سيظهر تقييمك بعد مراجعته.', failed: 'تعذر الإرسال. حاول لاحقًا.',
    admin: 'الإدارة', lang: 'English', loading: 'جارٍ التحميل…', notFound: 'الصفحة غير موجودة.',
    stars: 'نجوم',
  },
  en: {
    about: 'About', vision: 'Vision', works: 'Works', links: 'Links', contact: 'Contact', rating: 'Reviews',
    all: 'All', web: 'Web', mobile: 'Mobile', desktop: 'Desktop', other: 'Other',
    details: 'Visit', openLink: 'Open link', version: 'Version',
    noWorks: 'No works yet.', back: 'Back to home',
    intro: 'About the system', policy: 'Usage policy', howto: 'How to use', gallery: 'Screenshots', files: 'Downloads',
    reviews: 'Customer reviews', noReviews: 'No reviews yet.', addReview: 'Leave a review',
    yourName: 'Name', yourEmail: 'Email (not shown to visitors)', yourComment: 'Your comment', send: 'Send',
    thanks: 'Thank you. Your review will appear once it is approved.', failed: 'Could not send. Try again later.',
    admin: 'Admin', lang: 'العربية', loading: 'Loading…', notFound: 'Page not found.',
    stars: 'stars',
  },
};

const Ctx = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try { const s = localStorage.getItem('portfolio-lang'); if (s === 'ar' || s === 'en') return s; } catch { /* ignore */ }
    return 'ar';
  });
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    try { localStorage.setItem('portfolio-lang', lang); } catch { /* ignore */ }
  }, [lang]);
  const t = (k) => UI[lang][k] ?? k;
  // Pick the Arabic or English version of a content field, falling back to the other one.
  const tr = (obj, base) => {
    if (!obj) return '';
    const a = obj[`${base}Ar`] || '';
    const e = obj[`${base}En`] || '';
    return lang === 'ar' ? a || e : e || a;
  };
  return <Ctx.Provider value={{ lang, setLang, t, tr }}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);
