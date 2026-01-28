import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ClerkProvider } from '@clerk/clerk-react';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Get the key from environment variables (Vite specific)
// We add a fallback to allow the app to start in "Guest Mode" even if keys are missing.
const env = (import.meta as any).env || {};
const PUBLISHABLE_KEY = env.VITE_CLERK_PUBLISHABLE_KEY || "pk_test_placeholder_key";

const root = ReactDOM.createRoot(rootElement);

// We render the app regardless. If key is invalid, Clerk components will fail gracefully 
// but Guest Login (custom implementation) will still work.
root.render(
<React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
    <App />
    </ClerkProvider>
</React.StrictMode>
);
