import Constants from 'expo-constants';

const MAP_PROVIDER_NAME = 'Stadia Maps';
const MAP_API_KEY = (
  Constants.expoConfig?.extra?.stadiaApiKey
  || process.env.EXPO_PUBLIC_STADIA_API_KEY
  || ''
).trim();
const TILE_STYLE = 'alidade_smooth';
const TILE_ATTRIBUTION = '&copy; Stadia Maps &copy; OpenMapTiles &copy; OpenStreetMap contributors';

const looksLikePlaceholder = (value) => !value || /your_|paste_|placeholder/i.test(value);

export const hasConfiguredMapApiKey = () => !looksLikePlaceholder(MAP_API_KEY);

export const getMapProviderLabel = () => MAP_PROVIDER_NAME;

export const getMapSetupInstructions = () => {
  return 'Setze EXPO_PUBLIC_STADIA_API_KEY in .env oder .env.local und starte Expo danach neu, damit der Client den Stadia-Maps-Key neu einliest.';
};

export const getMapTileAttribution = () => TILE_ATTRIBUTION;

export const getStadiaTileUrl = () => {
  if (!hasConfiguredMapApiKey()) {
    return '';
  }

  return `https://tiles.stadiamaps.com/tiles/${TILE_STYLE}/{z}/{x}/{y}{r}.png?api_key=${MAP_API_KEY}`;
};

export const buildExternalMapUrl = ({ latitude, longitude, zoom = 12 }) => {
  return `https://www.openstreetmap.org/#map=${zoom}/${latitude}/${longitude}`;
};
