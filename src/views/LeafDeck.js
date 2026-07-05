import { PanResponder, View } from 'react-native';
import { useMemo, useState } from 'react';
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
  const [swipeOffset, setSwipeOffset] = useState(0);
  const SWIPE_THRESHOLD = 64;

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, { dx, dy }) => (
      !swipeDisabled
      && Math.abs(dx) > Math.abs(dy)
      && Math.abs(dx) > 8
    ),
    onPanResponderMove: (_, { dx }) => {
      setSwipeOffset(dx);
    },
    onPanResponderRelease: (_, { dx }) => {
      if (dx < -SWIPE_THRESHOLD) {
        onLeafSwipe?.('left');
      } else if (dx > SWIPE_THRESHOLD) {
        onLeafSwipe?.('right');
      }

      setSwipeOffset(0);
    },
    onPanResponderTerminate: () => {
      setSwipeOffset(0);
    },
    onPanResponderGrant: () => {
      setSwipeOffset(0);
    },
  }), [swipeDisabled, onLeafSwipe]);

  return (
    <View
      {...panResponder.panHandlers}
      style={[styles.deck, { transform: [{ translateX: swipeOffset }] }]}
    >
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
