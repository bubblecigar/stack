import { Pressable, Text, View } from 'react-native';
import { styles } from '../styles/appStyles';

const DELETE_HOLD_MS = 1000;

function TrashCanIcon() {
  return (
    <View style={styles.trashIcon}>
      <View style={styles.trashIconLid} />
      <View style={styles.trashIconHandle} />
      <View style={styles.trashIconBody}>
        <View style={styles.trashIconLine} />
        <View style={styles.trashIconLine} />
      </View>
    </View>
  );
}

export function FloatingControls({
  layoutMode,
  onToggleMode,
  onCreateCard,
  onDeleteHoldChange,
  canDeleteCurrentCard = false,
}) {
  const shouldShowDelete = layoutMode === 'leaf' && canDeleteCurrentCard;

  function handleDeletePressIn() {
    onDeleteHoldChange?.(true);
  }

  function handleDeletePressOut() {
    onDeleteHoldChange?.(false);
  }

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

      {shouldShowDelete ? (
        <Pressable
          accessibilityHint="Hold until the circle completes to delete the current card"
          accessibilityLabel="Delete current card"
          accessibilityRole="button"
          delayLongPress={DELETE_HOLD_MS}
          onPressIn={handleDeletePressIn}
          onPressOut={handleDeletePressOut}
          style={({ pressed }) => [
            styles.fab,
            styles.deleteFab,
            pressed && styles.deleteFabPressed,
          ]}
        >
          <TrashCanIcon />
        </Pressable>
      ) : null}

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
