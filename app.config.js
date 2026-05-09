const { expo } = require('./app.json');

module.exports = () => ({
  ...expo,
  extra: {
    ...expo.extra,
    stadiaApiKey: process.env.EXPO_PUBLIC_STADIA_API_KEY || '',
  },
});