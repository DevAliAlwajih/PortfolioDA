import React from 'react'; import { createRoot } from 'react-dom/client'; import { BrowserRouter } from 'react-router-dom'; import { LangProvider } from './i18n.jsx'; import App from './App.jsx'; import './styles.css';
createRoot(document.getElementById('root')).render(<React.StrictMode><LangProvider><BrowserRouter><App /></BrowserRouter></LangProvider></React.StrictMode>);
