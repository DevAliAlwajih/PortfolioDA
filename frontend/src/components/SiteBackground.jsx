import { useLocation } from 'react-router-dom';

export function SiteBackground() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/admin')) {
    return null;
  }
  return <div className="site-bg" aria-hidden="true" />;
}

export default SiteBackground;
