import { StyleSheet, Text, View } from 'react-native';

const ChatScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Chats & Matches</Text>
      <Text style={styles.sub}>Hier kannst du mit deinen Matches schreiben</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  text: { fontSize: 20, fontWeight: 'bold', color: '#c00', marginBottom: 10 },
  sub: { fontSize: 14, color: '#555', textAlign: 'center' }
});

export default ChatScreen;
