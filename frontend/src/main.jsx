import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { LangProvider } from './i18n.jsx';
import Home from './pages/Home.jsx';
import WorkPage from './pages/WorkPage.jsx';
import Admin from './admin/Admin.jsx';
import SiteBackground from './components/SiteBackground.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LangProvider>
      <BrowserRouter>
        <SiteBackground />
        <div className="glow" aria-hidden="true" />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/works/:id" element={<WorkPage />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </LangProvider>
  </React.StrictMode>,
);
