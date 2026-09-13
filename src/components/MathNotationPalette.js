import {
  Pressable,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/appStyles';

export function MathNotationPalette({
  cameraDisabled = false,
  disabled = false,
  keys = [],
  locked = false,
  onCameraPress,
  onTouchStart,
}) {
  const paletteKeys = Array.isArray(keys) ? keys : [];

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
        {paletteKeys.map((key, keyIndex) => {
          if (!key?.isSystem) {
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

          const isKeyDisabled = disabled || locked || cameraDisabled;

          return (
            <Pressable
              accessibilityLabel="Take card photo"
              accessibilityRole="button"
              disabled={isKeyDisabled}
              key={`math-notation-slot-${key.slotIndex ?? keyIndex}`}
              onTouchStart={onTouchStart}
              onPress={onCameraPress}
              style={({ pressed }) => [
                styles.mathNotationGridKey,
                styles.mathNotationGridSystemKey,
                isKeyDisabled && !locked && styles.mathNotationTextKeyDisabled,
                pressed && styles.mathNotationKeyPressed,
              ]}
            >
              <Ionicons color="#94A3B8" name="camera-outline" size={16} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
