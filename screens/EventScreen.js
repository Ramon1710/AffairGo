import { StyleSheet, Text, View } from 'react-native';

const EventScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Veranstaltungen & Partys</Text>
      <Text style={styles.sub}>Hier erscheinen Events in deiner Nähe</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  text: { fontSize: 20, fontWeight: 'bold', color: '#c00', marginBottom: 10 },
  sub: { fontSize: 14, color: '#555', textAlign: 'center' }
});

export default EventScreen;
