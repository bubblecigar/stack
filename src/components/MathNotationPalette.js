import {
  Pressable,
  Text,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { styles } from '../styles/appStyles';

const SYSTEM_KEY_ICONS = {
  delete: {
    Icon: MaterialCommunityIcons,
    name: 'backspace-outline',
  },
  keyboard: {
    Icon: Ionicons,
    name: 'keypad-outline',
  },
  newline: {
    Icon: MaterialCommunityIcons,
    name: 'keyboard-return',
  },
  space: {
    Icon: MaterialCommunityIcons,
    name: 'keyboard-space',
  },
};

export function MathNotationPalette({
  disabled = false,
  keys = [],
  onTouchStart,
  onDeleteNotation,
  onInsertNotation,
  onOpenSystemKeyboard,
}) {
  const customKeys = Array.isArray(keys) ? keys : [];

  return (
    <View
      pointerEvents={disabled ? 'none' : 'box-none'}
      style={[
        styles.mathNotationPalette,
        disabled && styles.mathNotationPaletteDisabled,
      ]}
    >
      <View
        pointerEvents="box-none"
        style={styles.mathNotationGrid}
      >
        {customKeys.map((key, keyIndex) => (
          key?.isEmpty ? (
            <View
              key={`math-notation-slot-${key.slotIndex ?? keyIndex}`}
              pointerEvents="none"
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
              onTouchStart={onTouchStart}
              onPress={() => {
                if (key.action === 'delete') {
                  onDeleteNotation?.();
                  return;
                }

                if (key.action === 'openKeyboard') {
                  onOpenSystemKeyboard?.();
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
              {key.isSystem ? (() => {
                const SystemIcon = SYSTEM_KEY_ICONS[key.systemKeyId]?.Icon
                  ?? MaterialCommunityIcons;
                const systemIconName = SYSTEM_KEY_ICONS[key.systemKeyId]?.name;

                return (
                  <SystemIcon
                    color="#94A3B8"
                    name={systemIconName}
                    size={16}
                  />
                );
              })() : (
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
