import {
  Pressable,
  Text,
  View,
} from 'react-native';
import { styles } from '../styles/appStyles';

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
                styles.mathNotationGridEmptyKey,
                key.isReserved && styles.mathNotationGridReservedKey,
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
