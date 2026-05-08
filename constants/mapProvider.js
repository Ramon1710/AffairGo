const MAP_PROVIDER_NAME = 'Stadia Maps';
const MAP_API_KEY = (process.env.EXPO_PUBLIC_STADIA_API_KEY || '').trim();
const TILE_STYLE = 'alidade_smooth';
const TILE_ATTRIBUTION = '&copy; Stadia Maps &copy; OpenMapTiles &copy; OpenStreetMap contributors';

const looksLikePlaceholder = (value) => !value || /your_|paste_|placeholder/i.test(value);

export const hasConfiguredMapApiKey = () => !looksLikePlaceholder(MAP_API_KEY);

export const getMapProviderLabel = () => MAP_PROVIDER_NAME;

export const getMapSetupInstructions = () => {
  return 'Lege eine .env im Projekt an und setze EXPO_PUBLIC_STADIA_API_KEY mit deinem öffentlichen Stadia-Maps-Key.';
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
