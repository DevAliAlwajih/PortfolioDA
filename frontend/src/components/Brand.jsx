import { Link } from 'react-router-dom';
import { useLang } from '../i18n.jsx';

export function Brand() {
  const { t } = useLang();
  return (
    <Link to="/" className="brand" aria-label="Dev.AliAlwajih">
      <img
        src="/logo-mark.png"
        alt=""
        aria-hidden="true"
        className="brand-emblem"
      />
      <div className="brand-text">
        <span className="brand-title" dir="ltr">Dev.AliAlwajih</span>
        <span className="brand-sub">{t('platform')}</span>
      </div>
    </Link>
  );
}

export function LogoPlate({ width }) {
  const widthStyle = width ? (typeof width === 'number' ? `${width}px` : width) : undefined;
  return (
    <div className="logo-plate" style={widthStyle ? { width: widthStyle } : undefined}>
      <img
        src="/logo-full.png"
        alt="Dev.AliAlwajih - منصة التطوير الرقمي"
        className="logo-plate-img"
      />
    </div>
  );
}

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <LogoPlate width={260} />
      <p className="footer-copy muted" dir="ltr">
        © {year} Dev.AliAlwajih
      </p>
    </footer>
  );
}
