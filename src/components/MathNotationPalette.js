import {
  Pressable,
  ScrollView,
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
  const visibleKeys = [
    ...SYSTEM_MATH_KEYS,
    ...(Array.isArray(keys) ? keys.filter((key) => !key?.isEmpty) : []),
  ];

  if (visibleKeys.length === 0) {
    return null;
  }

  return (
    <View
      onTouchStart={onTouchStart}
      pointerEvents={disabled ? 'none' : 'auto'}
      style={[
        styles.mathNotationPalette,
        disabled && styles.mathNotationPaletteDisabled,
      ]}
    >
      <ScrollView
        horizontal
        keyboardShouldPersistTaps="always"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.mathNotationPaletteScroll}
      >
        <View style={styles.mathNotationGroup}>
          {visibleKeys.map((key, keyIndex) => (
            <Pressable
              accessibilityLabel={key.action === 'delete'
                ? 'Delete previous character'
                : `Insert ${key.label}`}
              accessibilityRole="button"
              disabled={disabled}
              key={`${key.id}-${keyIndex}`}
              onPress={() => {
                if (key.action === 'delete') {
                  onDeleteNotation?.();
                  return;
                }

                onInsertNotation?.(key.insert);
              }}
              style={({ pressed }) => [
                styles.mathNotationKey,
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
      </ScrollView>
    </View>
  );
}
