import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMemo } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { Image, Text, View } from 'react-native';
import { affairGoTheme } from '../constants/affairGoTheme';
import { getMapTileAttribution, getStadiaTileUrl, hasConfiguredMapApiKey } from '../constants/mapProvider';

const STATUS_CONFIG = {
  active: { label: 'Aktiv', color: '#e86d5c', glyph: 'A' },
  vacation: { label: 'Urlaub', color: '#2aa6a4', glyph: 'U' },
  business: { label: 'Dienstreise', color: '#3a6ee8', glyph: 'D' },
  event: { label: 'Event', color: '#d4a019', glyph: 'E' },
};

const getMapZoom = (radiusKm) => {
  if (radiusKm <= 5) {
    return 13;
  }
  if (radiusKm <= 10) {
    return 12;
  }
  if (radiusKm <= 20) {
    return 11;
  }
  if (radiusKm <= 50) {
    return 10;
  }
  if (radiusKm <= 100) {
    return 9;
  }
  return 8;
};

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const createProfileMarkerIcon = (item) => {
  const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.active;
  const imageMarkup = item.profileImageUri
    ? `<img src="${escapeHtml(item.profileImageUri)}" alt="${escapeHtml(item.nickname || 'Profil')}" style="width:100%;height:100%;object-fit:cover;border-radius:999px;" />`
    : `<span style="font-size:14px;font-weight:800;color:#fff;">${escapeHtml(item.age ? String(item.age) : status.glyph)}</span>`;

  return L.divIcon({
    className: 'affairgo-map-marker',
    html: `
      <div style="display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:999px;background:#1c1313;border:3px solid ${status.color};box-shadow:0 10px 24px rgba(0,0,0,0.28);overflow:hidden;">
        ${imageMarkup}
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -20],
  });
};

const createEventMarkerIcon = (item) => {
  const status = STATUS_CONFIG.event;

  return L.divIcon({
    className: 'affairgo-map-event-marker',
    html: `
      <div style="display:flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:14px;background:${status.color};border:2px solid #fff;box-shadow:0 10px 24px rgba(0,0,0,0.22);color:#fff;font-weight:800;font-size:18px;">
        *
      </div>
    `,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -18],
  });
};

const MapViewportController = ({ center, zoom }) => {
  const map = useMap();
  map.setView([center.latitude, center.longitude], zoom, { animate: true });
  return null;
};

const PopupProfileImage = ({ uri, label }) => {
  if (!uri) {
    return null;
  }

  return (
    <Image
      source={{ uri }}
      accessibilityLabel={label}
      style={{ width: '100%', height: 128, borderRadius: 12, marginBottom: 10 }}
      resizeMode="cover"
    />
  );
};

const PopupText = ({ children, strong = false }) => (
  <Text style={{ color: '#2e2121', fontSize: strong ? 16 : 13, fontWeight: strong ? '700' : '500', marginBottom: 4 }}>
    {children}
  </Text>
);

const MatchingMapLeaflet = ({ center, radiusKm, profiles, events, onProfilePress }) => {
  const hasApiKey = hasConfiguredMapApiKey();
  const tileUrl = getStadiaTileUrl();
  const zoom = getMapZoom(radiusKm);
  const profileMarkers = useMemo(() => (profiles || []).filter((item) => Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude))), [profiles]);
  const eventMarkers = useMemo(() => (events || []).filter((item) => Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude))), [events]);

  if (!hasApiKey) {
    return (
      <View style={{ minHeight: 440, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: affairGoTheme.colors.text, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Karte derzeit nicht verfügbar</Text>
        <Text style={{ color: affairGoTheme.colors.textMuted, textAlign: 'center', lineHeight: 22 }}>
          Die Kartenansicht kann im Moment nicht geladen werden. Bitte versuche es in Kürze erneut.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ height: 520, borderRadius: 22, overflow: 'hidden' }}>
      <MapContainer center={[center.latitude, center.longitude]} zoom={zoom} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <MapViewportController center={center} zoom={zoom} />
        <TileLayer attribution={getMapTileAttribution()} url={tileUrl} />
        <Circle
          center={[center.latitude, center.longitude]}
          radius={radiusKm * 1000}
          pathOptions={{ color: '#e86d5c', fillColor: '#e86d5c', fillOpacity: 0.08 }}
        />
        <Marker position={[center.latitude, center.longitude]} icon={L.divIcon({
          className: 'affairgo-self-marker',
          html: '<div style="display:flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:999px;background:#e86d5c;border:3px solid #fff;box-shadow:0 6px 18px rgba(0,0,0,0.18);"></div>',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        })}>
          <Popup>
            <PopupText strong>Dein Standort</PopupText>
            <PopupText>Nur lokal exakt sichtbar.</PopupText>
          </Popup>
        </Marker>
        {profileMarkers.map((profile) => (
          <Marker
            key={profile.id}
            position={[profile.latitude, profile.longitude]}
            icon={createProfileMarkerIcon(profile)}
            eventHandlers={onProfilePress ? { click: () => onProfilePress(profile) } : undefined}
          >
            <Popup minWidth={220}>
              <View style={{ minWidth: 220 }}>
                <PopupProfileImage uri={profile.profileImageUri} label={profile.nickname || 'Profilbild'} />
                <PopupText strong>{profile.nickname || 'Unbekannt'}</PopupText>
                <PopupText>{profile.age ? `${profile.age} Jahre` : 'Alter unbekannt'}</PopupText>
                <PopupText>Matching: {profile.compatibility ?? 0}%</PopupText>
                <PopupText>Entfernung: {profile.distanceKm ?? '-'} km</PopupText>
                <PopupText>Status: {(STATUS_CONFIG[profile.status] || STATUS_CONFIG.active).label}</PopupText>
              </View>
            </Popup>
          </Marker>
        ))}
        {eventMarkers.map((event) => (
          <Marker key={event.id} position={[event.latitude, event.longitude]} icon={createEventMarkerIcon(event)}>
            <Popup minWidth={220}>
              <View style={{ minWidth: 220 }}>
                <PopupProfileImage uri={event.imageUri} label={event.title || 'Eventbild'} />
                <PopupText strong>{event.title || 'Event'}</PopupText>
                <PopupText>{event.category || 'Event'}</PopupText>
                <PopupText>Entfernung: {event.distanceKm ?? '-'} km</PopupText>
                <PopupText>Status: Event</PopupText>
              </View>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </View>
  );
};

export default MatchingMapLeaflet;
