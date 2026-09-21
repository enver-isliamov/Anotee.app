import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerServiceWorker } from './services/swRegister';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// T-158: офлайн-режим — регистрация SW в точке входа (не зависит от UI-ветки)
registerServiceWorker();

root.render(
<React.StrictMode>
    <App />
</React.StrictMode>
);