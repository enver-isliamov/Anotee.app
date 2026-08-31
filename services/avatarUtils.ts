import { stringToColor } from './utils';

/**
 * Генерирует локальный SVG-аватар с инициалами (data-URI) — детерминированный по seed.
 * Замена внешнего сервиса генерации аватаров (недоступен/нестабилен из РФ),
 * см. docs/RF-RESILIENCE.md (T-17).
 * Цвет фона — тот же stringToColor, что используется для маркеров комментариев,
 * поэтому аватары визуально согласованы с остальным UI.
 *
 * @param seed Имя пользователя или email — источник инициалов и цвета.
 * @returns data-URI SVG для использования в <img src>.
 */
export const generateInitialsAvatar = (seed: string): string => {
  const backgroundColor = stringToColor(seed);
  // Unicode-буквы (\p{L}) — чтобы «(Director)» давала «D», а не скобку.
  const firstLetter = (s: string): string => s.match(/\p{L}/u)?.[0] || '';
  const words = seed.trim().split(/\s+/).filter(Boolean);
  // 1-2 первые буквы: по букве из первых двух слов («Режиссер (Director)» → «РД»),
  // иначе первые буквы одного слова/email («Colorist» → «CO», «anna@x.io» → «AN»).
  const initials =
    words.length >= 2
      ? (firstLetter(words[0]) + firstLetter(words[1])).toUpperCase()
      : (seed.match(/\p{L}/gu) || []).slice(0, 2).join('').toUpperCase() || '?';

  // dy="0.35em" вместо dominant-baseline="central" — стабильное центрирование в Safari/Firefox.
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">` +
    `<circle cx="50" cy="50" r="50" fill="${backgroundColor}"/>` +
    `<text x="50" y="50" dy="0.35em" text-anchor="middle" fill="#ffffff" ` +
    `font-family="system-ui, -apple-system, sans-serif" font-size="40" font-weight="600">${initials}</text>` +
    `</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};
