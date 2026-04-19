import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import {
    Alert,
    ImageBackground,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { auth } from '../firebase';

const LoginScreen = () => {
  const navigation = useNavigation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Fehler', 'Bitte alle Felder ausfüllen.');
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigation.replace('Dashboard');
    } catch (error) {
      Alert.alert('Login fehlgeschlagen', error.message);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      'Passwort vergessen',
      'Ein neues Passwort wurde an deine E-Mail-Adresse gesendet.'
    );
  };

  return (
    <ImageBackground
      source={require('../assets/login-bg.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <Text style={styles.title}>AffairGo Login</Text>

        <TextInput
          style={styles.input}
          placeholder="E-Mail"
          placeholderTextColor="#ccc"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Passwort"
            placeholderTextColor="#ccc"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? 'eye' : 'eye-off'} size={24} color="#ccc" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={handleForgotPassword}>
          <Text style={styles.forgotText}>Passwort vergessen?</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
          <Text style={styles.loginText}>Login</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={styles.registerText}>Noch kein Account? Jetzt registrieren</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 30
  },
  input: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    color: '#fff'
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    width: '100%'
  },
  passwordInput: {
    flex: 1,
    color: '#fff',
    paddingVertical: 10
  },
  forgotText: {
    color: '#ccc',
    marginBottom: 20
  },
  loginButton: {
    backgroundColor: '#c00',
    padding: 15,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10
  },
  loginText: {
    color: '#fff',
    fontWeight: 'bold'
  },
  registerText: {
    color: '#eee',
    textDecorationLine: 'underline'
  }
});

export default LoginScreen;
