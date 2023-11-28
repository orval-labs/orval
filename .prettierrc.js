const os = require('node:os');

module.exports = {
  arrowParens: 'always',
  bracketSpacing: true,
  printWidth: 80,
  tabWidth: 2,
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  endOfLine: os.EOL === '\r\n' ? 'crlf' : 'lf',
};
