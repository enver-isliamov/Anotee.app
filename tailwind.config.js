// Локальная конфигурация Tailwind (замена cdn.tailwindcss.com, см. docs/RF-RESILIENCE.md).
// theme.extend перенесён 1:1 из inline-конфига index.html (строки 72-101).
/** @type {import('tailwindcss').Config} */
import tailwindcssAnimate from 'tailwindcss-animate';

export default {
  darkMode: 'class',
  content: [
    './index.html',
    './*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        zinc: {
          950: '#09090b',
        }
      },
      animation: {
        'gradient-x': 'gradient-x 15s ease infinite',
      },
      keyframes: {
        'gradient-x': {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center'
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center'
          },
        },
      }
    }
  },
  // Плагин обязателен: в компонентах используются animate-in/fade-in/zoom-in/slide-in-from-*
  plugins: [
    tailwindcssAnimate,
  ],
};
