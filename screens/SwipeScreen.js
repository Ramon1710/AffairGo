import { StyleSheet, Text, View } from 'react-native';

const SwipeScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Swipen kommt bald...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 18, color: '#555' }
});

export default SwipeScreen;
