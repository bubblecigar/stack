import * as SecureStore from 'expo-secure-store';
import {
  normalizeMathKeyboardKeys,
  serializeMathKeyboardKeys,
} from './mathKeyboardConfig';

const MATH_KEYBOARD_KEY = 'stack.mathKeyboardKeys';

export async function getStoredMathKeyboardKeys() {
  try {
    const value = await SecureStore.getItemAsync(MATH_KEYBOARD_KEY);
    return normalizeMathKeyboardKeys(JSON.parse(value));
  } catch {
    return normalizeMathKeyboardKeys([]);
  }
}

export async function setStoredMathKeyboardKeys(keys) {
  await SecureStore.setItemAsync(
    MATH_KEYBOARD_KEY,
    JSON.stringify(serializeMathKeyboardKeys(keys)),
  );
}

export { normalizeMathKeyboardKeys };
