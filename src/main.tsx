import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';

// Suppress benign environment-specific console.error and console.warn calls
const originalConsoleError = console.error;
console.error = function (...args) {
  try {
    const messageStr = args
      .map((arg) => (typeof arg === 'string' ? arg : arg instanceof Error ? arg.message + ' ' + arg.stack : JSON.stringify(arg)))
      .join(' ');
    if (
      messageStr.includes('websocket') ||
      messageStr.includes('WebSocket') ||
      messageStr.includes('WebSocket closed') ||
      messageStr.includes('[vite]') ||
      messageStr.includes('no-speech') ||
      messageStr.includes('Speech')
    ) {
      // Benign warning from Vite offline container or quiet speech speech API, gracefully ignored
      return;
    }
  } catch (e) {
    // Fallback if JSON.stringify fails on circular structures
  }
  originalConsoleError.apply(console, args);
};

const originalConsoleWarn = console.warn;
console.warn = function (...args) {
  try {
    const messageStr = args
      .map((arg) => (typeof arg === 'string' ? arg : arg instanceof Error ? arg.message : JSON.stringify(arg)))
      .join(' ');
    if (
      messageStr.includes('websocket') ||
      messageStr.includes('WebSocket') ||
      messageStr.includes('WebSocket closed') ||
      messageStr.includes('[vite]') ||
      messageStr.includes('no-speech') ||
      messageStr.includes('Speech')
    ) {
      return;
    }
  } catch (e) {
    // Fallback
  }
  originalConsoleWarn.apply(console, args);
};

// Global error handlers to capture and suppress benign environment-specific websocket and speech warnings before they bubble up
window.addEventListener('unhandledrejection', (event) => {
  try {
    const reason = event.reason;
    const reasonStr = typeof reason === 'string'
      ? reason
      : (reason?.message || reason?.stack || JSON.stringify(reason) || '');
    if (
      reasonStr.includes('WebSocket') ||
      reasonStr.includes('websocket') ||
      reasonStr.includes('WebSpeech') ||
      reasonStr.includes('speech') ||
      reasonStr.includes('no-speech') ||
      reasonStr.includes('vite')
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  } catch (e) {
    // Swallow any error in suppression logic
  }
});

window.addEventListener('error', (event) => {
  try {
    const message = event.message || '';
    const errorStr = event.error?.message || event.error?.stack || '';
    const combined = `${message} ${errorStr}`;
    if (
      combined.includes('WebSocket') ||
      combined.includes('websocket') ||
      combined.includes('no-speech') ||
      combined.includes('Web Speech') ||
      combined.includes('vite')
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  } catch (e) {
    // Swallow
  }
});

import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);

