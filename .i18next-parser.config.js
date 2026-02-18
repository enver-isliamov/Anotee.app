export default {
  contextSeparator: '_',
  createOldCatalogs: false,
  defaultNamespace: 'translation',
  defaultValue: '',
  indentation: 2,
  keepRemoved: true,
  keySeparator: false,
  lexers: {
    ts: ['JavascriptLexer'],
    tsx: ['JavascriptLexer'],
    js: ['JavascriptLexer'],
    jsx: ['JavascriptLexer'],
    default: ['JavascriptLexer']
  },
  lineEnding: 'auto',
  locales: ['en', 'ru', 'es', 'ja', 'ko', 'pt'],
  namespaceSeparator: false,
  output: 'services/locales/$LOCALE.json',
  pluralSeparator: '_',
  input: ['components/**/*.{ts,tsx}', 'services/**/*.{ts,tsx}'],
  sort: true,
  useKeysAsDefaultValue: true,
  verbose: false,
  failOnUpdate: false 
};