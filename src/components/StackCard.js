import { Pressable, Text, TextInput, View } from 'react-native';
import { styles } from '../styles/appStyles';

export function StackCard({
  card,
  visibleIndex,
  layout,
  editingIndex,
  editingValue,
  focusedCardIndex,
  collapsedNodeIds,
  treePosition,
  isCollapsedStacked = false,
  onPress,
  onPressIn,
  onCreateEdit,
  onToggleCollapse,
  onDeleteCard,
  onEditingValueChange,
}) {
  const {
    id,
    index,
    childIds,
    text,
  } = card;

  const isLeafCard = layout === 'leaf';
  const isTreeCard = layout === 'tree';
  const isEditing = editingIndex === index;
  const isFocusedCard = focusedCardIndex === index;
  const hasChildren = Array.isArray(childIds) && childIds.length > 0;
  const isCollapsed = collapsedNodeIds.has(id);
  const shouldShowControls = isLeafCard || isFocusedCard;
  const shouldShowEdit = isLeafCard || isFocusedCard;

  const dependencyText = '';

  return (
    <Pressable
      disabled={isLeafCard}
      onPressIn={onPressIn}
      onPress={onPress}
      style={[
        styles.card,
        isLeafCard && styles.leafCard,
        isTreeCard && styles.treeCard,
        isTreeCard && isCollapsedStacked && styles.treeCollapsedCard,
        isFocusedCard && styles.focusedCard,
        isEditing && styles.editingCard,
        isTreeCard && isEditing && styles.treeEditingCard,
        treePosition && {
          left: treePosition.left,
          top: treePosition.top,
          position: 'absolute',
          zIndex: 9000
            - ((treePosition.depth ?? 0) * 80)
            - (treePosition.placementOrder ?? 0),
        },
        isLeafCard && {
          top: visibleIndex * 12,
          transform: [
            { scale: 1 - visibleIndex * 0.035 },
            { rotate: `${visibleIndex % 2 === 0 ? 0 : -2}deg` },
          ],
          zIndex: isEditing
            ? 200
            : 1000 - visibleIndex,
        },
        isLeafCard && {
          transform: [{ rotate: `${visibleIndex % 2 === 0 ? -1.5 : 1.5}deg` }],
        },
      ]}
    >
      <View style={[
        styles.cardControls,
        isTreeCard && styles.treeCardControls,
      ]}
      >
        {isTreeCard && shouldShowControls && hasChildren && (
          <Pressable
            accessibilityLabel={isCollapsed ? 'Expand card' : 'Collapse card'}
            accessibilityRole="button"
            onPressIn={onPressIn}
            onPress={() => {
              onToggleCollapse?.(index);
            }}
            style={({ pressed }) => [
              styles.iconButton,
              isCollapsed && styles.linkButtonActive,
              pressed && styles.iconButtonPressed,
            ]}
          >
            <Text style={styles.iconButtonText}>{isCollapsed ? '+' : '-'}</Text>
          </Pressable>
        )}

        {shouldShowControls && shouldShowEdit && (
          <Pressable
            accessibilityLabel={isEditing ? 'Confirm card' : 'Edit card'}
            accessibilityRole="button"
            onPressIn={onPressIn}
            onPress={() => {
              onCreateEdit(index, text);
            }}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.iconButtonPressed,
            ]}
          >
            <Text style={styles.iconButtonText}>
              {isEditing ? '✓' : '✎'}
            </Text>
          </Pressable>
        )}

        {shouldShowControls && (
          <Pressable
            accessibilityLabel="Delete card"
            accessibilityRole="button"
            onPressIn={onPressIn}
            onPress={() => {
              onDeleteCard?.(index);
            }}
            style={({ pressed }) => [
              styles.iconButton,
              styles.dangerButton,
              pressed && styles.dangerButtonPressed,
            ]}
          >
            <Text style={styles.iconButtonText}>⌫</Text>
          </Pressable>
        )}

      </View>

      {isEditing ? (
        <TextInput
          autoCapitalize="sentences"
          autoCorrect
          autoFocus
          multiline
          onChangeText={onEditingValueChange}
          placeholder="Write card text"
          placeholderTextColor="#94A3B8"
          style={[
            styles.cardInput,
            isTreeCard && styles.treeCardInput,
          ]}
          value={editingValue}
        />
      ) : (
        <Text style={[
          styles.cardText,
          isTreeCard && styles.treeCardText,
          !text && styles.emptyCardText,
        ]}
        >
          {text || 'Empty card'}
        </Text>
      )}

      <View style={[
        styles.dependencyBar,
        isTreeCard && styles.treeDependencyBar,
      ]}
      >
        <Text style={[
          styles.dependencyText,
          isTreeCard && styles.treeDependencyText,
        ]}
        >
          {dependencyText}
        </Text>
      </View>
    </Pressable>
  );
}
