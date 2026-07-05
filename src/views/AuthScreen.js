import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { login, register } from '../lib/apiClient';
import { styles } from '../styles/appStyles';

export function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isSignup = mode === 'signup';

  async function handleSubmit() {
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const result = isSignup
        ? await register(email, password)
        : await login(email, password);

      onAuthenticated(result);
    } catch (error) {
      setErrorMessage(error.message || 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleMode() {
    setMode((currentMode) => (currentMode === 'login' ? 'signup' : 'login'));
    setErrorMessage('');
  }

  return (
    <View style={styles.authContainer}>
      <View style={styles.authPanel}>
        <Text style={styles.authTitle}>{isSignup ? 'Sign up' : 'Login'}</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor="#94A3B8"
          returnKeyType="next"
          style={styles.authInput}
          value={email}
        />
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setPassword}
          onSubmitEditing={handleSubmit}
          placeholder="Password"
          placeholderTextColor="#94A3B8"
          returnKeyType="done"
          secureTextEntry
          style={styles.authInput}
          value={password}
        />
        {errorMessage ? (
          <Text style={styles.authError}>{errorMessage}</Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.authPrimaryButton,
            pressed && styles.authPrimaryButtonPressed,
            isSubmitting && styles.authButtonDisabled,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.authPrimaryButtonText}>
              {isSignup ? 'Create account' : 'Login'}
            </Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={toggleMode}
          style={styles.authSecondaryButton}
        >
          <Text style={styles.authSecondaryButtonText}>
            {isSignup ? 'Use existing account' : 'Create new account'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
