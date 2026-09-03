import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';

const browserGlobals = {
  window: 'readonly', document: 'readonly', localStorage: 'readonly', sessionStorage: 'readonly',
  navigator: 'readonly', console: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
  setInterval: 'readonly', clearInterval: 'readonly', URLSearchParams: 'readonly', crypto: 'readonly',
  fetch: 'readonly', SharedArrayBuffer: 'readonly', location: 'readonly', history: 'readonly',
  FormData: 'readonly', Worker: 'readonly', requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly', ResizeObserver: 'readonly', IntersectionObserver: 'readonly',
  alert: 'readonly', confirm: 'readonly', HTMLElement: 'readonly', HTMLVideoElement: 'readonly',
  HTMLIFrameElement: 'readonly', HTMLInputElement: 'readonly', HTMLTextAreaElement: 'readonly',
  VisualViewport: 'readonly', Audio: 'readonly', URL: 'readonly', Blob: 'readonly',
  FileReader: 'readonly', CustomEvent: 'readonly', Event: 'readonly', KeyboardEvent: 'readonly',
  PointerEvent: 'readonly', OfflineAudioContext: 'readonly', webkitAudioContext: 'readonly',
  webkitSpeechRecognition: 'readonly', SpeechRecognition: 'readonly', MediaRecorder: 'readonly',
  getComputedStyle: 'readonly', DOMParser: 'readonly', TextDecoder: 'readonly', TextEncoder: 'readonly',
  btoa: 'readonly', atob: 'readonly', Option: 'readonly', devicePixelRatio: 'readonly',
  DragEvent: 'readonly', MouseEvent: 'readonly', Node: 'readonly', NodeJS: 'readonly',
  CSSStyleDeclaration: 'readonly', MediaQueryList: 'readonly', ArrayBuffer: 'readonly',
  Uint8Array: 'readonly', Uint16Array: 'readonly', Uint32Array: 'readonly', Int16Array: 'readonly',
  Float32Array: 'readonly', DataView: 'readonly', Promise: 'readonly', Error: 'readonly',
  EventSource: 'readonly', XMLHttpRequest: 'readonly', WebSocket: 'readonly',
  CSS: 'readonly', performance: 'readonly', queueMicrotask: 'readonly', structuredClone: 'readonly',
};

const nodeGlobals = {
  console: 'readonly', process: 'readonly', Buffer: 'readonly', fetch: 'readonly',
  URL: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
};

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tsParser,
      globals: browserGlobals,
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      // T-29/T-30: гарантия отсутствия React #321 (invalid hook call)
      'react-hooks/rules-of-hooks': 'error',
      // no-undef отключён для TS: undefined-имена проверяет tsc (рекомендация ESLint+TS)
      'no-undef': 'off',
      // no-empty/no-case-declarations/no-unused-vars: легаси-стиль, не связано с хуками
      'no-empty': 'off',
      'no-case-declarations': 'off',
      'no-unused-vars': 'off',
    },
  },
  {
    files: ['**/*.mjs', '**/*.cjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: nodeGlobals,
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': 'off',
    },
  },
  {
    ignores: ['node_modules/**', 'dist/**', 'api/**', 'tests/**', '**/*.d.ts'],
  },
];
