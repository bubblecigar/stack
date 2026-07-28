import {
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { styles } from '../styles/appStyles';

export function MathNotationPalette({
  disabled = false,
  keys = [],
  onTouchStart,
  onInsertNotation,
}) {
  if (!Array.isArray(keys) || keys.length === 0) {
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
          {keys.map((key) => (
            <Pressable
              accessibilityLabel={`Insert ${key.label}`}
              accessibilityRole="button"
              disabled={disabled}
              key={key.id}
              onPress={() => {
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
