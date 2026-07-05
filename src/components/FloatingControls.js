import { Pressable, Text, View } from 'react-native';
import { styles } from '../styles/appStyles';

export function FloatingControls({
  layoutMode,
  onToggleMode,
  onCreateCard,
}) {
  return (
    <View style={styles.floatingControls}>
      <Pressable
        accessibilityLabel="Toggle stack layout"
        accessibilityRole="button"
        onPress={onToggleMode}
        style={({ pressed }) => [
          styles.fab,
          styles.modeFab,
          pressed && styles.modeFabPressed,
        ]}
      >
        <Text style={styles.modeFabText}>
          {layoutMode === 'leaf' ? 'L' : 'T'}
        </Text>
      </Pressable>

      <Pressable
        accessibilityLabel="Add card"
        accessibilityRole="button"
        onPress={onCreateCard}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </View>
  );
}

