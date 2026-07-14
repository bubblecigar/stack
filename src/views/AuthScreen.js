import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  login,
  register,
  requestPasswordReset,
  resetPassword,
} from '../lib/apiClient';
import { styles } from '../styles/appStyles';

export function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isSignup = mode === 'signup';
  const isForgotPassword = mode === 'forgot';
  const isResetPassword = mode === 'reset';
  const title = isSignup
    ? 'Sign up'
    : isForgotPassword
      ? 'Reset password'
      : isResetPassword
        ? 'New password'
        : 'Login';

  async function handleSubmit() {
    setIsSubmitting(true);
    setErrorMessage('');
    setStatusMessage('');

    try {
      if (isForgotPassword) {
        const result = await requestPasswordReset(email);
        setStatusMessage(result.message || 'If an account exists, a reset code has been sent.');
        setMode('reset');
        return;
      }

      if (isResetPassword) {
        await resetPassword(resetCode, password);
        setStatusMessage('Password updated. Login with your new password.');
        setMode('login');
        setPassword('');
        setResetCode('');
        return;
      }

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
    setStatusMessage('');
  }

  function showForgotPassword() {
    setMode('forgot');
    setErrorMessage('');
    setStatusMessage('');
  }

  function showResetPassword() {
    setMode('reset');
    setErrorMessage('');
    setStatusMessage('');
  }

  function showLogin() {
    setMode('login');
    setErrorMessage('');
  }

  return (
    <View style={styles.authContainer}>
      <View style={styles.authPanel}>
        <Text style={styles.authTitle}>{title}</Text>
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
        {isResetPassword ? (
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setResetCode}
            placeholder="Reset code"
            placeholderTextColor="#94A3B8"
            returnKeyType="next"
            style={styles.authInput}
            value={resetCode}
          />
        ) : null}
        {!isForgotPassword ? (
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setPassword}
            onSubmitEditing={handleSubmit}
            placeholder={isResetPassword ? 'New password' : 'Password'}
            placeholderTextColor="#94A3B8"
            returnKeyType="done"
            secureTextEntry
            style={styles.authInput}
            value={password}
          />
        ) : null}
        {statusMessage ? (
          <Text style={styles.authStatus}>{statusMessage}</Text>
        ) : null}
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
              {isSignup
                ? 'Create account'
                : isForgotPassword
                  ? 'Send reset code'
                  : isResetPassword
                    ? 'Update password'
                    : 'Login'}
            </Text>
          )}
        </Pressable>
        {mode === 'login' ? (
          <>
            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={showForgotPassword}
              style={styles.authSecondaryButton}
            >
              <Text style={styles.authSecondaryButtonText}>Forgot password?</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={toggleMode}
              style={styles.authSecondaryButton}
            >
              <Text style={styles.authSecondaryButtonText}>Create new account</Text>
            </Pressable>
          </>
        ) : (
          <>
            {isForgotPassword ? (
              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                onPress={showResetPassword}
                style={styles.authSecondaryButton}
              >
                <Text style={styles.authSecondaryButtonText}>I have a reset code</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={showLogin}
              style={styles.authSecondaryButton}
            >
              <Text style={styles.authSecondaryButtonText}>Back to login</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}
