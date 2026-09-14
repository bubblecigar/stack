import {
  Pressable,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CARD_BACKGROUND_OPTIONS } from '../lib/cardBackground';
import { styles } from '../styles/appStyles';

export function MathNotationPalette({
  cameraDisabled = false,
  disabled = false,
  locked = false,
  onBackgroundColorChange,
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
          <Ionicons color="#94A3B8" name="camera-outline" size={22} />
        </Pressable>
        {[
          ...CARD_BACKGROUND_OPTIONS.slice(1),
          CARD_BACKGROUND_OPTIONS[0],
        ].map((option) => (
          <Pressable
            key={option.color}
            accessibilityLabel={`Set card color to ${option.label}`}
            accessibilityRole="button"
            disabled={disabled || locked}
            onPress={() => onBackgroundColorChange?.(option.color)}
            onTouchStart={onTouchStart}
            style={({ pressed }) => [
              styles.leafCardColorButton,
              pressed && styles.mathNotationKeyPressed,
            ]}
          >
            <View
              style={[
                styles.leafCardColorSwatch,
                { backgroundColor: option.color },
              ]}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
