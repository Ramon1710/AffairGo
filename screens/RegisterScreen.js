import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    Alert, Image, ImageBackground, ScrollView, StyleSheet,
    Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { auth, db } from '../firebase';

const RegisterScreen = () => {
  const navigation = useNavigation();

  const [profileImage, setProfileImage] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [gender, setGender] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nickname, setNickname] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [figure, setFigure] = useState('');
  const [penisSize, setPenisSize] = useState('');
  const [braSize, setBraSize] = useState('');
  const [hairColor, setHairColor] = useState('');
  const [eyeColor, setEyeColor] = useState('');
  const [skinType, setSkinType] = useState('');

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - 18 - i);
  const months = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];

  useEffect(() => {
    if (birthDay && birthMonth !== '' && birthYear) {
      const birthDate = new Date(`${birthYear}-${Number(birthMonth) + 1}-${birthDay}`);
      const today = new Date();
      let calculatedAge = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        calculatedAge--;
      }
      setAge(calculatedAge);
    }
  }, [birthDay, birthMonth, birthYear]);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 1 });
    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
      Alert.alert('Hinweis', 'Selfie + KI-Abgleich wurde durchgeführt. Bild wird danach gelöscht.');
    }
  };

  const handleRegister = async () => {
    if (!email || !password || !repeatPassword || !nickname) {
      Alert.alert('Fehler', 'Bitte fülle alle Pflichtfelder aus.');
      return;
    }

    if (password !== repeatPassword) {
      Alert.alert('Fehler', 'Passwörter stimmen nicht überein.');
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email,
        gender,
        firstName,
        lastName,
        nickname,
        birthDay,
        birthMonth,
        birthYear,
        age,
        height,
        figure,
        penisSize,
        braSize,
        hairColor,
        eyeColor,
        skinType,
        profileImage
      });

      Alert.alert('Erfolg', 'Registrierung abgeschlossen!');
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (error) {
      Alert.alert('Fehler', error.message);
    }
  };

  return (
    <ImageBackground source={require('../assets/login-bg.png')} style={styles.background}>
      <ScrollView contentContainerStyle={styles.overlay}>
        <Text style={styles.title}>Registrierung</Text>

        <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.profileImage} />
          ) : (
            <Text style={styles.imageText}>Profilbild hochladen</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.infoText}>
          Beim Hochladen erfolgt ein Fake-Check per Selfie + KI. Selfie wird danach gelöscht.
        </Text>

        <Text style={styles.label}>E-Mail</Text>
        <TextInput
          style={styles.input}
          placeholder="z. B. max@mail.de"
          placeholderTextColor="#ccc"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />

        <Text style={styles.label}>Passwort</Text>
        <TextInput
          style={styles.input}
          placeholder="Passwort"
          placeholderTextColor="#ccc"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Text style={styles.label}>Passwort wiederholen</Text>
        <TextInput
          style={styles.input}
          placeholder="Passwort bestätigen"
          placeholderTextColor="#ccc"
          secureTextEntry
          value={repeatPassword}
          onChangeText={setRepeatPassword}
        />

        <Text style={styles.label}>Geschlecht</Text>
        <View style={styles.genderRow}>
          {['männlich', 'weiblich', 'divers'].map((option) => (
            <TouchableOpacity
              key={option}
              style={[styles.genderButton, gender === option && styles.genderSelected]}
              onPress={() => setGender(option)}
            >
              <Text style={[styles.genderText, gender === option && styles.genderTextSelected]}>
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Vorname</Text>
        <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="z. B. Max" placeholderTextColor="#ccc" />

        <Text style={styles.label}>Nachname</Text>
        <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder="z. B. Mustermann" placeholderTextColor="#ccc" />

        <Text style={styles.label}>Spitzname</Text>
        <TextInput style={styles.input} value={nickname} onChangeText={setNickname} placeholder="z. B. Max1990" placeholderTextColor="#ccc" />
        <Text style={styles.infoText}>Spitzname muss eindeutig sein und wird öffentlich angezeigt.</Text>

        <Text style={styles.label}>Geburtsdatum</Text>

        <Text style={styles.subLabel}>Tag</Text>
        <TextInput
          style={styles.input}
          placeholder="z. B. 17"
          placeholderTextColor="#ccc"
          value={birthDay}
          onChangeText={setBirthDay}
          keyboardType="numeric"
        />

        <Text style={styles.subLabel}>Monat</Text>
        <View style={styles.picker}>
          <Picker selectedValue={birthMonth} onValueChange={setBirthMonth} style={{ color: '#fff' }}>
            <Picker.Item label="Monat auswählen" value="" />
            {months.map((m, i) => <Picker.Item key={i} label={m} value={i} />)}
          </Picker>
        </View>

        <Text style={styles.subLabel}>Jahr</Text>
        <View style={styles.picker}>
          <Picker selectedValue={birthYear} onValueChange={setBirthYear} style={{ color: '#fff' }}>
            <Picker.Item label="Jahr auswählen" value="" />
            {years.map((y, i) => <Picker.Item key={i} label={String(y)} value={y} />)}
          </Picker>
        </View>

        {age !== '' && <Text style={styles.infoText}>Alter: {age} Jahre</Text>}

        <Text style={styles.label}>Größe</Text>
        <TextInput style={styles.input} placeholder="z. B. 1,75 m" placeholderTextColor="#ccc" value={height} onChangeText={setHeight} />

        <Text style={styles.label}>Figur</Text>
        <View style={styles.picker}>
          <Picker selectedValue={figure} onValueChange={setFigure} style={{ color: '#fff' }}>
            <Picker.Item label="Figur auswählen" value="" />
            {['Mager', 'Schlank', 'Sportlich', 'Normal', 'Pummelig', 'Dick'].map((f, i) => (
              <Picker.Item key={i} label={f} value={f} />
            ))}
          </Picker>
        </View>

        {gender === 'männlich' || gender === 'divers' ? (
          <>
            <Text style={styles.label}>Penisgröße</Text>
            <TextInput style={styles.input} placeholder="z. B. 16 cm" placeholderTextColor="#ccc" value={penisSize} onChangeText={setPenisSize} keyboardType="numeric" />
          </>
        ) : null}

        {gender === 'weiblich' || gender === 'divers' ? (
          <>
            <Text style={styles.label}>BH-Größe</Text>
            <TextInput style={styles.input} placeholder="z. B. 75B" placeholderTextColor="#ccc" value={braSize} onChangeText={setBraSize} />
          </>
        ) : null}

        <Text style={styles.label}>Haarfarbe</Text>
        <View style={styles.picker}>
          <Picker selectedValue={hairColor} onValueChange={setHairColor} style={{ color: '#fff' }}>
            <Picker.Item label="Haarfarbe auswählen" value="" />
            {['Blond', 'Braun', 'Schwarz', 'Rot', 'Grau', 'Glatze', 'Gefärbt'].map((c, i) => (
              <Picker.Item key={i} label={c} value={c} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Augenfarbe</Text>
        <View style={styles.picker}>
          <Picker selectedValue={eyeColor} onValueChange={setEyeColor} style={{ color: '#fff' }}>
            <Picker.Item label="Augenfarbe auswählen" value="" />
            {['Blau', 'Braun', 'Grün', 'Grau', 'Schwarz', 'Gemischt'].map((e, i) => (
              <Picker.Item key={i} label={e} value={e} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Hauttyp</Text>
        <View style={styles.picker}>
          <Picker selectedValue={skinType} onValueChange={setSkinType} style={{ color: '#fff' }}>
            <Picker.Item label="Hauttyp auswählen" value="" />
            {['Sehr hell', 'Hell', 'Mittel', 'Oliv', 'Dunkel', 'Sehr dunkel'].map((s, i) => (
              <Picker.Item key={i} label={s} value={s} />
            ))}
          </Picker>
        </View>

        <TouchableOpacity style={styles.loginButton} onPress={handleRegister}>
          <Text style={styles.loginText}>Jetzt registrieren</Text>
        </TouchableOpacity>
      </ScrollView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#fff', marginBottom: 20, textAlign: 'center' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    color: '#fff'
  },
  label: { color: '#fff', fontSize: 14, marginBottom: 6, marginTop: 12 },
  subLabel: { color: '#fff', fontSize: 12, marginBottom: 4, marginTop: 10 },
  infoText: { color: '#ccc', fontSize: 12, marginBottom: 15 },
  genderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  genderButton: {
    flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    padding: 10, marginHorizontal: 4, alignItems: 'center'
  },
  genderSelected: { backgroundColor: '#c00', borderColor: '#c00' },
  genderText: { color: '#ccc' },
  genderTextSelected: { color: '#fff', fontWeight: 'bold' },
  imagePicker: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    marginBottom: 12
  },
  imageText: { color: '#ccc' },
  profileImage: { width: 100, height: 100, borderRadius: 50 },
  picker: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.1)'
  },
  loginButton: {
    backgroundColor: '#c00',
    padding: 15,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginBottom: 30
  },
  loginText: {
    color: '#fff',
    fontWeight: 'bold'
  }
});

export default RegisterScreen;
