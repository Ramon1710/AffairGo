import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
    Alert,
    ImageBackground,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

const Dashboard = () => {
  const userStatus = 'basic'; // später dynamisch laden
  const navigation = useNavigation();

  const handleNavigation = (target) => {
    const implementedScreens = ['MatchingMap', 'Swipe', 'Chat', 'Event', 'Explore', 'Profil'];
    if (implementedScreens.includes(target)) {
      navigation.navigate(target);
    } else {
      Alert.alert('Hinweis', `Funktion "${target}" ist noch nicht implementiert.`);
    }
  };

  return (
    <ImageBackground source={require('../assets/login-bg.png')} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        
        {/* Obere Ebene */}
        <View style={styles.topRow}>
          <View style={styles.menuBox}>
            <TouchableOpacity style={styles.menuButton} onPress={() => handleNavigation('Explore')}>
              <Ionicons name="airplane" size={20} color="#fff" />
              <Text style={styles.menuText}>Dienstreise</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuButton} onPress={() => handleNavigation('Explore')}>
              <Ionicons name="sunny" size={20} color="#fff" />
              <Text style={styles.menuText}>Urlaub</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuButton} onPress={() => handleNavigation('Event')}>
              <Ionicons name="calendar" size={20} color="#fff" />
              <Text style={styles.menuText}>Veranstaltungen</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.profileButton,
              userStatus === 'basic' && { backgroundColor: 'red' },
              userStatus === 'premium' && { backgroundColor: 'gold' },
              userStatus === 'gold' && { backgroundColor: '#ffd700' }
            ]}
            onPress={() => handleNavigation('Profil')}
          >
            <Ionicons name="person-circle-outline" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Mittlere Ebene */}
        <View style={styles.verticalButtonContainer}>
          <TouchableOpacity style={styles.bigButton} onPress={() => handleNavigation('MatchingMap')}>
            <Ionicons name="map" size={26} color="#fff" />
            <Text style={styles.bigButtonText}>Matching Map</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.bigButton} onPress={() => handleNavigation('Swipe')}>
            <Ionicons name="swap-horizontal" size={26} color="#fff" />
            <Text style={styles.bigButtonText}>Swipen</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.bigButton} onPress={() => handleNavigation('Chat')}>
            <Ionicons name="chatbubbles" size={26} color="#fff" />
            <Text style={styles.bigButtonText}>Chats</Text>
          </TouchableOpacity>
        </View>

        {/* Untere Ebene */}
        <View style={styles.bottomSection}>
          <Text style={styles.sectionTitle}>Veranstaltungen in deiner Nähe</Text>
          <TouchableOpacity style={styles.eventCard} onPress={() => handleNavigation('Event')}>
            <FontAwesome5 name="glass-cheers" size={20} color="#fff" />
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.eventText}>Private Swingerparty</Text>
              <Text style={styles.eventSubtext}>23 km entfernt · 15 Anmeldungen</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    flexGrow: 1,
    minHeight: '100%',
    justifyContent: 'space-between'
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  menuBox: {
    flexDirection: 'column',
    gap: 10
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6
  },
  menuText: {
    color: '#fff',
    marginLeft: 10
  },
  profileButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center'
  },
  verticalButtonContainer: {
    gap: 15,
    marginBottom: 30
  },
  bigButton: {
    backgroundColor: '#c00',
    paddingVertical: 20,
    paddingHorizontal: 15,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center'
  },
  bigButtonText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 15,
    fontWeight: 'bold'
  },
  bottomSection: {
    padding: 15,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#c00',
    padding: 10,
    borderRadius: 10
  },
  eventText: {
    color: '#fff',
    fontWeight: 'bold'
  },
  eventSubtext: {
    color: '#eee',
    fontSize: 12
  }
});

export default Dashboard;
