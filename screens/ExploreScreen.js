import { StyleSheet, Text, View } from 'react-native';

const ExploreScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Explore-Modus (Gold Only)</Text>
      <Text style={styles.sub}>Fiktive Städte & neue Kontakte entdecken</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  text: { fontSize: 20, fontWeight: 'bold', color: '#c00', marginBottom: 10 },
  sub: { fontSize: 14, color: '#555', textAlign: 'center' }
});

export default ExploreScreen;
