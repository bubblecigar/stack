import { PanResponder, View } from 'react-native';
import { useMemo } from 'react';
import { StackCard } from '../components/StackCard';
import { styles } from '../styles/appStyles';

export function LeafDeck({
  cards,
  editingIndex,
  editingValue,
  focusedCardIndex,
  collapsedNodeIds,
  onCreateEdit,
  onDeleteCard,
  onEditingValueChange,
  onLeafSwipe,
  swipeDisabled,
}) {
  const SWIPE_THRESHOLD = 64;

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, { dx, dy }) => (
      !swipeDisabled
      && Math.abs(dx) > Math.abs(dy)
      && Math.abs(dx) > 8
    ),
    onPanResponderMove: () => {},
    onPanResponderRelease: (_, { dx }) => {
      if (dx < -SWIPE_THRESHOLD) {
        onLeafSwipe?.('left');
      } else if (dx > SWIPE_THRESHOLD) {
        onLeafSwipe?.('right');
      }
    },
    onPanResponderTerminate: () => {},
    onPanResponderGrant: () => {},
  }), [swipeDisabled, onLeafSwipe]);

  return (
    <View {...panResponder.panHandlers} style={styles.deck}>
      {cards.map((card, visibleIndex) => (
        <StackCard
          card={card}
          collapsedNodeIds={collapsedNodeIds}
          editingIndex={editingIndex}
          editingValue={editingValue}
          focusedCardIndex={focusedCardIndex}
          layout="leaf"
          key={`card-${card.id}`}
          visibleIndex={visibleIndex}
          onPress={() => {}}
          onCreateEdit={onCreateEdit}
          onDeleteCard={onDeleteCard}
          onEditingValueChange={onEditingValueChange}
          onToggleCollapse={() => {}}
        />
      ))}
    </View>
  );
}
