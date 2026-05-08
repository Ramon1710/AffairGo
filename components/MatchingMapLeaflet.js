import { Text, View } from 'react-native';
import { affairGoTheme } from '../constants/affairGoTheme';

const MatchingMapLeaflet = () => {
  return (
    <View style={{ minHeight: 320, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ color: affairGoTheme.colors.text, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Leaflet ist hier nur im Web aktiv</Text>
      <Text style={{ color: affairGoTheme.colors.textMuted, textAlign: 'center', lineHeight: 22 }}>
        Oeffne die Expo-Webansicht, um die echte OpenStreetMap-Karte mit Stadia Maps Tiles zu sehen.
      </Text>
    </View>
  );
};

export default MatchingMapLeaflet;
