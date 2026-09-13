import {
  Pressable,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/appStyles';

export function MathNotationPalette({
  cameraDisabled = false,
  disabled = false,
  locked = false,
  onCameraPress,
  onTouchStart,
}) {
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
        <Pressable
          accessibilityLabel="Take card photo"
          accessibilityRole="button"
          disabled={disabled || locked || cameraDisabled}
          onTouchStart={onTouchStart}
          onPress={onCameraPress}
          style={({ pressed }) => [
            styles.mathNotationGridKey,
            styles.mathNotationGridSystemKey,
            (disabled || cameraDisabled) && !locked && styles.mathNotationTextKeyDisabled,
            pressed && styles.mathNotationKeyPressed,
          ]}
        >
          <Ionicons color="#94A3B8" name="camera-outline" size={16} />
        </Pressable>
      </View>
    </View>
  );
}
