import {
  Pressable,
  Text,
  View,
} from 'react-native';
import { styles } from '../styles/appStyles';

const SYSTEM_MATH_KEYS = [
  {
    action: 'insert',
    id: 'system-math-key-space',
    insert: ' ',
    label: 'space',
  },
  {
    action: 'insert',
    id: 'system-math-key-newline',
    insert: '\n',
    label: 'enter',
  },
  {
    action: 'delete',
    id: 'system-math-key-delete',
    label: 'delete',
  },
];

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
      <View style={styles.mathNotationSystemRow}>
        {SYSTEM_MATH_KEYS.map((key) => (
          <Pressable
            accessibilityLabel={key.action === 'delete'
              ? 'Delete previous character'
              : `Insert ${key.label}`}
            accessibilityRole="button"
            disabled={disabled}
            key={key.id}
            onPress={() => {
              if (key.action === 'delete') {
                onDeleteNotation?.();
                return;
              }

              onInsertNotation?.(key.insert);
            }}
            style={({ pressed }) => [
              styles.mathNotationSystemKey,
              pressed && styles.mathNotationKeyPressed,
            ]}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={styles.mathNotationKeyText}
            >
              {key.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.mathNotationGrid}>
        {customKeys.map((key, keyIndex) => (
          key?.isEmpty ? (
            <View
              key={`math-notation-slot-${key.slotIndex ?? keyIndex}`}
              style={[
                styles.mathNotationGridKey,
                styles.mathNotationGridEmptyKey,
              ]}
            />
          ) : (
            <Pressable
              accessibilityLabel={`Insert ${key.label}`}
              accessibilityRole="button"
              disabled={disabled}
              key={`math-notation-slot-${key.slotIndex ?? keyIndex}`}
              onPress={() => {
                onInsertNotation?.(key.insert);
              }}
              style={({ pressed }) => [
                styles.mathNotationGridKey,
                pressed && styles.mathNotationKeyPressed,
              ]}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={styles.mathNotationKeyText}
              >
                {key.label}
              </Text>
            </Pressable>
          )
        ))}
      </View>
    </View>
  );
}
