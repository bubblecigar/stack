import {
  Pressable,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { styles } from '../styles/appStyles';

const SYSTEM_KEY_ICONS = {
  delete: 'backspace-outline',
  newline: 'keyboard-return',
  space: 'keyboard-space',
};

export function MathNotationPalette({
  disabled = false,
  keys = [],
  onTouchStart,
  onDeleteNotation,
  onInsertNotation,
}) {
  const customKeys = Array.isArray(keys) ? keys : [];

  return (
    <View
      onTouchStart={onTouchStart}
      pointerEvents={disabled ? 'none' : 'auto'}
      style={[
        styles.mathNotationPalette,
        disabled && styles.mathNotationPaletteDisabled,
      ]}
    >
      <View style={styles.mathNotationGrid}>
        {customKeys.map((key, keyIndex) => (
          key?.isEmpty ? (
            <View
              key={`math-notation-slot-${key.slotIndex ?? keyIndex}`}
              style={[
                styles.mathNotationGridKey,
                styles.mathNotationGridInvisibleKey,
              ]}
            />
          ) : (
            <Pressable
              accessibilityLabel={`Insert ${key.label}`}
              accessibilityRole="button"
              disabled={disabled}
              key={`math-notation-slot-${key.slotIndex ?? keyIndex}`}
              onPress={() => {
                if (key.action === 'delete') {
                  onDeleteNotation?.();
                  return;
                }

                onInsertNotation?.(key.insert);
              }}
              style={({ pressed }) => [
                styles.mathNotationGridKey,
                key.isSystem && styles.mathNotationGridSystemKey,
                pressed && styles.mathNotationKeyPressed,
              ]}
            >
              {key.isSystem ? (
                <MaterialCommunityIcons
                  color="#64748B"
                  name={SYSTEM_KEY_ICONS[key.systemKeyId]}
                  size={16}
                />
              ) : (
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={styles.mathNotationKeyText}
                >
                  {key.label}
                </Text>
              )}
            </Pressable>
          )
        ))}
      </View>
    </View>
  );
}
