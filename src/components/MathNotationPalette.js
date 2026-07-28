import {
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { styles } from '../styles/appStyles';

const MATH_NOTATION_GROUPS = [
  ['≡', '≢', '≅', '≇', '≈', '≠', '≤', '≥'],
  ['mod', 'gcd', 'lcm', '∈', '∉', '⊂', '⊆', '∅'],
  ['α', 'β', 'γ', 'θ', 'λ', 'π', '∞', '∑', '∏', '∫', '√'],
  ['^', '_', '()', '[]', '{}', '$$', '→', '↔'],
];

function getNotationInsert(notation) {
  if (notation === 'mod') {
    return ' (mod n)';
  }

  if (notation === 'gcd' || notation === 'lcm') {
    return `${notation}(a, b)`;
  }

  if (notation === '()') {
    return '()';
  }

  if (notation === '[]') {
    return '[]';
  }

  if (notation === '{}') {
    return '{}';
  }

  if (notation === '$$') {
    return '$$';
  }

  return notation;
}

export function MathNotationPalette({
  disabled = false,
  onTouchStart,
  onInsertNotation,
}) {
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
        {MATH_NOTATION_GROUPS.map((group, groupIndex) => (
          <View
            key={`math-notation-group-${groupIndex}`}
            style={styles.mathNotationGroup}
          >
            {group.map((notation) => (
              <Pressable
                accessibilityLabel={`Insert ${notation}`}
                accessibilityRole="button"
                disabled={disabled}
                key={notation}
                onPress={() => {
                  onInsertNotation?.(getNotationInsert(notation));
                }}
                style={({ pressed }) => [
                  styles.mathNotationKey,
                  pressed && styles.mathNotationKeyPressed,
                ]}
              >
                <Text style={styles.mathNotationKeyText}>{notation}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
