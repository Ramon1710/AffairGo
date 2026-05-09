const fs = require('fs');
const path = require('path');
const { expo } = require('./app.json');

const readEnvFileValue = (key, fileName) => {
  const filePath = path.join(__dirname, fileName);

  if (!fs.existsSync(filePath)) {
    return '';
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)\\s*$`));

    if (!match) {
      continue;
    }

    return match[1].trim().replace(/^['\"]|['\"]$/g, '');
  }

  return '';
};

const resolveEnvValue = (key) => (
  process.env[key]
  || readEnvFileValue(key, '.env.local')
  || readEnvFileValue(key, '.env')
  || ''
);

const stadiaApiKey = resolveEnvValue('EXPO_PUBLIC_STADIA_API_KEY');

module.exports = () => ({
  ...expo,
  extra: {
    ...expo.extra,
    stadiaApiKey,
  },
});