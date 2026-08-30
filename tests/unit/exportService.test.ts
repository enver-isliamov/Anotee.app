import { describe, it, expect } from 'vitest';
import { generateResolveXML, generateCSV, generateEDL } from '../../services/exportService';
import { Comment, CommentStatus } from '../../types';

const makeComment = (overrides: Partial<Comment> = {}): Comment => ({
  id: 'c1',
  userId: 'u1',
  authorName: 'Andrey',
  timestamp: 10.0,
  text: 'Make this transition faster',
  status: CommentStatus.OPEN,
  createdAt: 'now',
  ...overrides,
});

/** Минимальная проверка well-formed XML: баланс открывающих/закрывающих тегов. */
const assertWellFormedXml = (xml: string) => {
  const withoutDecl = xml
    .replace(/<\?[\s\S]*?\?>/g, '') // XML declaration
    .replace(/<!DOCTYPE[^>]*>/g, ''); // DOCTYPE
  const tagRe = /<\/?([\w.-]+)(?:\s[^>]*)?>/g;
  const stack: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(withoutDecl)) !== null) {
    const full = m[0];
    const name = m[1];
    if (full.startsWith('</')) {
      const top = stack.pop();
      if (top !== name) throw new Error(`Mismatched tag: expected </${top}>, got </${name}>`);
    } else if (!full.endsWith('/>')) {
      stack.push(name);
    }
  }
  expect(stack).toEqual([]);
};

describe('generateResolveXML', () => {
  it('генерирует валидный xmeml с таймкодом маркеров в кадрах', () => {
    const xml = generateResolveXML('Test', 2, [makeComment({ timestamp: 10.0 })], 24);
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<xmeml version="5">');
    expect(xml).toContain('<timebase>24</timebase>');
    expect(xml).toContain('<marker>');
    // frames = floor(10.0 * 24) = 240
    expect(xml).toContain('<in>240</in>');
    expect(xml).toContain('<out>240</out>');
    expect(xml).toContain('<name>u1</name>');
    assertWellFormedXml(xml);
  });

  it('дробный таймкод округляется вниз до кадра', () => {
    const xml = generateResolveXML('Test', 1, [makeComment({ timestamp: 10.04 })], 24);
    expect(xml).toContain('<in>240</in>'); // floor(10.04*24) = floor(240.96) = 240
  });

  it('разрешенный комментарий → зелёный цвет, открытый → красный', () => {
    const resolved = generateResolveXML('T', 1, [makeComment({ status: CommentStatus.RESOLVED })], 24);
    expect(resolved).toContain('<name>Green</name>');
    const open = generateResolveXML('T', 1, [makeComment({ status: CommentStatus.OPEN })], 24);
    expect(open).toContain('<name>Red</name>');
  });

  it('спецсимволы текста экранируются (& < >)', () => {
    const xml = generateResolveXML('T', 1, [makeComment({ text: 'A & B < C > D' })], 24);
    expect(xml).toContain('A &amp; B &lt; C &gt; D');
    expect(xml).not.toContain('<comment>A & B < C');
    assertWellFormedXml(xml);
  });

  it('пустой список комментариев не роняет генератор', () => {
    const xml = generateResolveXML('T', 1, [], 24);
    expect(xml).toContain('<xmeml');
    expect(xml).not.toContain('<marker>');
    assertWellFormedXml(xml);
  });
});

describe('generateCSV', () => {
  it('содержит заголовок с нужными колонками', () => {
    const csv = generateCSV([makeComment()]);
    const [header] = csv.trim().split('\n');
    expect(header).toBe('Timecode, Name, Description, Color');
  });

  it('каждый маркер — строка с таймкодом HH:MM:SS и текстом в кавычках', () => {
    const csv = generateCSV([makeComment({ timestamp: 75, text: 'Hello' })]);
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('00:01:15');
    expect(lines[1]).toContain('"Hello"');
  });

  it('кавычки в тексте удваиваются', () => {
    const csv = generateCSV([makeComment({ text: 'Say "hi"' })]);
    expect(csv).toContain('"Say ""hi"""');
  });

  it('статус определяет цвет: resolved → Green, open → Red', () => {
    const resolved = generateCSV([makeComment({ status: CommentStatus.RESOLVED })]);
    expect(resolved).toContain('"Green"');
    const open = generateCSV([makeComment({ status: CommentStatus.OPEN })]);
    expect(open).toContain('"Red"');
  });

  it('пустой список → только заголовок, без ошибок', () => {
    const csv = generateCSV([]);
    expect(csv.trim()).toBe('Timecode, Name, Description, Color');
  });
});

describe('generateEDL', () => {
  it('содержит TITLE и FCM: NON-DROP FRAME', () => {
    const edl = generateEDL('Test', 1, [makeComment()], 24);
    expect(edl).toContain('TITLE: Test_v1 Markers');
    expect(edl).toContain('FCM: NON-DROP FRAME');
  });

  it('IN/OUT точки — таймкоды в кадрах, по умолчанию длительность 1 кадр', () => {
    const edl = generateEDL('Test', 1, [makeComment({ timestamp: 10.0 })], 24);
    // 240 кадров → 00:00:10:00; OUT = IN + 1 кадр
    expect(edl).toContain('00:00:10:00 00:00:10:01 00:00:10:00 00:00:10:01');
    expect(edl).toContain('|D:1');
  });

  it('range-комментарий (duration) расширяет OUT', () => {
    const edl = generateEDL('Test', 1, [makeComment({ timestamp: 10.0, duration: 2.0 })], 24);
    // OUT = 240 + floor(2*24)=48 → 288 кадров → 00:00:12:00
    expect(edl).toContain('00:00:10:00 00:00:12:00');
    expect(edl).toContain('|D:48');
  });

  it('resolved → ResolveColorBlue, open → ResolveColorRed', () => {
    const resolved = generateEDL('T', 1, [makeComment({ status: CommentStatus.RESOLVED })], 24);
    expect(resolved).toContain('ResolveColorBlue');
    const open = generateEDL('T', 1, [makeComment({ status: CommentStatus.OPEN })], 24);
    expect(open).toContain('ResolveColorRed');
  });

  it('пустой список → заголовок без записей, не падает', () => {
    const edl = generateEDL('Test', 1, [], 24);
    expect(edl).toContain('TITLE:');
    expect(edl).toContain('FCM: NON-DROP FRAME');
    expect(edl).not.toMatch(/^\d{3}\s+001/m); // нет записей маркеров
  });
});
