import {
  Pressable,
  Text,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { styles } from '../styles/appStyles';

const SYSTEM_KEY_ICONS = {
  camera: {
    Icon: Ionicons,
    name: 'camera-outline',
  },
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
  cameraDisabled = false,
  disabled = false,
  hasImage = false,
  keys = [],
  locked = false,
  onCameraPress,
  onDeleteImage,
  onTouchStart,
  onDeleteNotation,
  onInsertNotation,
  onOpenSystemKeyboard,
  textEntryDisabled = false,
}) {
  const customKeys = Array.isArray(keys) ? keys : [];

  return (
    <View
      pointerEvents={disabled || locked ? 'none' : 'box-none'}
      style={[
        styles.mathNotationPalette,
        disabled && styles.mathNotationPaletteDisabled,
        locked && styles.mathNotationPaletteLocked,
      ]}
    >
      <View
        pointerEvents="box-none"
        style={styles.mathNotationGrid}
      >
        {customKeys.map((key, keyIndex) => {
          if (key?.isEmpty) {
            return (
              <View
                key={`math-notation-slot-${key.slotIndex ?? keyIndex}`}
                pointerEvents="none"
                style={[
                  styles.mathNotationGridKey,
                  styles.mathNotationGridInvisibleKey,
                ]}
              />
            );
          }

          const isCameraKey = key.isSystem && key.systemKeyId === 'camera';
          const isImageDeleteKey = hasImage && key.action === 'delete';
          const isKeyDisabled = disabled || locked || (isCameraKey
            ? cameraDisabled
            : (isImageDeleteKey ? cameraDisabled : textEntryDisabled));

          return (
            <Pressable
              accessibilityLabel={isCameraKey ? 'Take card photo' : (
                isImageDeleteKey ? 'Remove card image' : `Insert ${key.label}`
              )}
              accessibilityRole="button"
              disabled={isKeyDisabled}
              key={`math-notation-slot-${key.slotIndex ?? keyIndex}`}
              onTouchStart={onTouchStart}
              onPress={() => {
                if (key.action === 'camera') {
                  onCameraPress?.();
                  return;
                }

                if (key.action === 'delete') {
                  if (hasImage) {
                    onDeleteImage?.();
                    return;
                  }

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
                isKeyDisabled && !locked && styles.mathNotationTextKeyDisabled,
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
          );
        })}
      </View>
    </View>
  );
}
