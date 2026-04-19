import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    Alert, ImageBackground, ScrollView, StyleSheet,
    Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { db } from '../firebase';

const ProfilScreen = () => {
  const navigation = useNavigation();
  const auth = getAuth();
  const userId = auth.currentUser?.uid;

  const [email, setEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [height, setHeight] = useState('');
  const [figure, setFigure] = useState('');
  const [penisSize, setPenisSize] = useState('');
  const [braSize, setBraSize] = useState('');
  const [hairColor, setHairColor] = useState('');
  const [eyeColor, setEyeColor] = useState('');
  const [skinType, setSkinType] = useState('');
  const [gender, setGender] = useState('männlich');

  const [preferences, setPreferences] = useState([]);
  const [taboos, setTaboos] = useState([]);
  const [editMode, setEditMode] = useState(true);

  const preferenceList = [
    'Oralsex geben', 'Oralsex empfangen', '69-Stellung', 'Zungenküsse',
    'Vorspiel genießen', 'Langes Liebesspiel', 'Spontaner Sex', 'Dominant sein',
    'Devot sein', 'Leichte Fesselspiele (Bondage)', 'Dirty Talk', 'Rollenspiele',
    'Anal (aktiv)', 'Anal (passiv)', 'Toys benutzen', 'Zärtlich & romantisch',
    'Schnell & hart', 'Erotik mit Augenbinde', 'Sex mit Musik', 'Fesselspiele',
    'BDSM (soft)', 'BDSM (hart)', 'Gruppensex / Dreier', 'Wechselnde Stellungen',
    'Langsamer, sinnlicher Sex'
  ];

  const tabooList = [
    'Analverkehr', 'Oralsex geben', 'Oralsex empfangen', 'ungeschützter Sex',
    'Sex ohne Emotion', 'BDSM', 'Gewaltspiele', 'Rollenspiel', 'Fesselspiele',
    'Gruppensex', 'Dreier (egal welches Geschlecht)', 'Öffentlichkeit / Outdoor-Sex',
    'Dominanz/Devotion-Spiel', 'Dirty Talk', 'Toys', 'Fußfetisch',
    'erniedrigende Praktiken', 'harte Praktiken', 'Tausch von intimen Bildern',
    'Küssen', 'Küssen auf den Mund', 'Kuscheln danach', 'emotionaler Kontakt',
    'Übernachtungen', 'Kontakt außerhalb der Treffen', 'Sex beim ersten Treffen'
  ];

  const toggleItem = (item, list, setList) => {
    setList(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  };

  const loadUserData = async () => {
    if (!userId) return;
    try {
      const docRef = doc(db, 'users', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const d = docSnap.data();
        setEmail(d.email || '');
        setNickname(d.nickname || '');
        setHeight(d.height || '');
        setFigure(d.figure || '');
        setPenisSize(d.penisSize || '');
        setBraSize(d.braSize || '');
        setHairColor(d.hairColor || '');
        setEyeColor(d.eyeColor || '');
        setSkinType(d.skinType || '');
        setGender(d.gender || 'männlich');
        setPreferences(d.preferences || []);
        setTaboos(d.taboos || []);
      }
    } catch (err) {
      console.error('Fehler beim Laden:', err);
    }
  };

  const saveUserData = async () => {
    if (!userId) return;
    try {
      const docRef = doc(db, 'users', userId);
      await setDoc(docRef, {
        email: newEmail || email,
        nickname: newNickname || nickname,
        height,
        figure,
        penisSize,
        braSize,
        hairColor,
        eyeColor,
        skinType,
        gender,
        preferences,
        taboos
      });
      if (newEmail) setEmail(newEmail);
      if (newNickname) setNickname(newNickname);
      Alert.alert('Gespeichert', 'Dein Profil wurde gespeichert.');
      setEditMode(false);
    } catch (err) {
      Alert.alert('Fehler', 'Daten konnten nicht gespeichert werden.');
      console.error(err);
    }
  };

  const handleLogout = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  useEffect(() => {
    loadUserData();
  }, []);

  return (
    <ImageBackground source={require('../assets/login-bg.png')} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.navigate('Dashboard')}>
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Dein Profil</Text>

        <Text style={styles.label}>E-Mail:</Text>
        <TextInput style={styles.input} placeholder="Neue E-Mail" value={newEmail} onChangeText={setNewEmail} placeholderTextColor="#ccc" />

        <Text style={styles.label}>Spitzname:</Text>
        <TextInput style={styles.input} placeholder="Neuer Spitzname" value={newNickname} onChangeText={setNewNickname} placeholderTextColor="#ccc" />

        <Text style={styles.label}>Körpergröße:</Text>
        <TextInput style={styles.input} placeholder="z. B. 1,80" value={height} onChangeText={setHeight} placeholderTextColor="#ccc" />

        <Text style={styles.label}>Figur:</Text>
        <Picker selectedValue={figure} onValueChange={setFigure} style={styles.picker}>
          {['Mager', 'Schlank', 'Sportlich', 'Normal', 'Pummelig', 'Dick'].map(f => (
            <Picker.Item key={f} label={f} value={f} />
          ))}
        </Picker>

        {gender === 'männlich' || gender === 'divers' ? (
          <>
            <Text style={styles.label}>Penisgröße:</Text>
            <TextInput style={styles.input} value={penisSize} onChangeText={setPenisSize} placeholder="z. B. 16" placeholderTextColor="#ccc" />
          </>
        ) : null}

        {gender === 'weiblich' || gender === 'divers' ? (
          <>
            <Text style={styles.label}>BH-Größe:</Text>
            <TextInput style={styles.input} value={braSize} onChangeText={setBraSize} placeholder="z. B. 75B" placeholderTextColor="#ccc" />
          </>
        ) : null}

        <Text style={styles.label}>Haarfarbe:</Text>
        <Picker selectedValue={hairColor} onValueChange={setHairColor} style={styles.picker}>
          {['Blond', 'Braun', 'Schwarz', 'Rot', 'Grau', 'Glatze', 'Gefärbt'].map(h => (
            <Picker.Item key={h} label={h} value={h} />
          ))}
        </Picker>

        <Text style={styles.label}>Augenfarbe:</Text>
        <Picker selectedValue={eyeColor} onValueChange={setEyeColor} style={styles.picker}>
          {['Blau', 'Braun', 'Grün', 'Grau', 'Schwarz', 'Gemischt'].map(e => (
            <Picker.Item key={e} label={e} value={e} />
          ))}
        </Picker>

        <Text style={styles.label}>Hauttyp:</Text>
        <Picker selectedValue={skinType} onValueChange={setSkinType} style={styles.picker}>
          {['Sehr hell', 'Hell', 'Mittel', 'Oliv', 'Dunkel', 'Sehr dunkel'].map(s => (
            <Picker.Item key={s} label={s} value={s} />
          ))}
        </Picker>

        <Text style={styles.sectionTitle}>Vorlieben (markiere was du magst):</Text>
        {editMode ? preferenceList.map((pref, i) => (
          <TouchableOpacity key={i} onPress={() => toggleItem(pref, preferences, setPreferences)}>
            <Text style={preferences.includes(pref) ? styles.selectedItem : styles.unselectedItem}>{pref}</Text>
          </TouchableOpacity>
        )) : preferences.map((item, i) => (
          <Text key={i} style={styles.selectedItem}>{item}</Text>
        ))}

        <Text style={styles.sectionTitle}>Tabus (markiere was du nicht magst):</Text>
        {editMode ? tabooList.map((tab, i) => (
          <TouchableOpacity key={i} onPress={() => toggleItem(tab, taboos, setTaboos)}>
            <Text style={taboos.includes(tab) ? styles.selectedItem : styles.unselectedItem}>{tab}</Text>
          </TouchableOpacity>
        )) : taboos.map((item, i) => (
          <Text key={i} style={styles.selectedItem}>{item}</Text>
        ))}

        <TouchableOpacity style={styles.button} onPress={editMode ? saveUserData : () => setEditMode(true)}>
          <Text style={styles.buttonText}>{editMode ? 'Speichern' : 'Ändern?'}</Text>
        </TouchableOpacity>

        <View style={{ height: 80 }} />
      </ScrollView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 20 },
  label: { fontWeight: 'bold', color: '#fff', marginTop: 20 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 8,
    marginTop: 8, color: '#fff', borderWidth: 1, borderColor: '#ccc'
  },
  picker: {
    backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff',
    borderRadius: 8, marginTop: 8
  },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff', marginTop: 30, marginBottom: 10 },
  selectedItem: { color: '#c00', fontWeight: 'bold', marginVertical: 4 },
  unselectedItem: { color: '#ccc', marginVertical: 4 },
  button: { backgroundColor: '#c00', padding: 12, borderRadius: 10, marginTop: 20 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: 'bold' }
});

export default ProfilScreen;
