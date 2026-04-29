const MAP_PROVIDER_NAME = process.env.EXPO_PUBLIC_MAP_PROVIDER || 'geoapify';
const MAP_STYLE = process.env.EXPO_PUBLIC_MAP_STYLE || 'osm-carto';
const MAP_API_KEY = (process.env.EXPO_PUBLIC_MAP_API_KEY || '').trim();

const looksLikePlaceholder = (value) => !value || /your_|paste_|placeholder/i.test(value);

export const hasConfiguredMapApiKey = () => !looksLikePlaceholder(MAP_API_KEY);

export const getMapProviderLabel = () => {
  if (MAP_PROVIDER_NAME === 'geoapify') {
    return 'Geoapify';
  }

  return MAP_PROVIDER_NAME;
};

export const getMapSetupInstructions = () => {
  return 'Lege eine .env im Projekt an und setze EXPO_PUBLIC_MAP_API_KEY mit deinem Kartenanbieter-Key.';
};

export const buildStaticMapUrl = ({ latitude, longitude, zoom, width = 1000, height = 520 }) => {
  if (!hasConfiguredMapApiKey()) {
    return '';
  }

  if (MAP_PROVIDER_NAME === 'geoapify') {
    const params = new URLSearchParams({
      style: MAP_STYLE,
      width: String(width),
      height: String(height),
      center: `lonlat:${longitude},${latitude}`,
      zoom: String(zoom),
      apiKey: MAP_API_KEY,
    });

    return `https://maps.geoapify.com/v1/staticmap?${params.toString()}`;
  }

  return '';
};
