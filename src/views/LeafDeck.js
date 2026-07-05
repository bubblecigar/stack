import { Animated, Dimensions, PanResponder, View } from 'react-native';
import { useMemo, useRef, useState } from 'react';
import { StackCard } from '../components/StackCard';
import { styles } from '../styles/appStyles';

const SCREEN_WIDTH = Dimensions.get('window').width;

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
  const SWIPE_THRESHOLD = 54;
  const SWIPE_VELOCITY = 420;
  const SWIPE_OUT_DISTANCE = SCREEN_WIDTH * 1.2;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [activeCardId, setActiveCardId] = useState(null);

  function triggerLeafSwipe(direction) {
    const outTo = direction === 'left' ? -SWIPE_OUT_DISTANCE : SWIPE_OUT_DISTANCE;

    Animated.timing(slideAnim, {
      toValue: outTo,
      duration: 70,
      useNativeDriver: true,
    }).start(() => {
      const didSwipe = onLeafSwipe?.(direction) === true;

      if (!didSwipe) {
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 14,
          stiffness: 260,
          mass: 0.8,
        }).start();
        setActiveCardId(null);
        return;
      }

      setActiveCardId(null);
    });
  }

  function snapBack() {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      damping: 16,
      stiffness: 260,
      mass: 0.9,
    }).start(() => {
      setActiveCardId(null);
    });
  }

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, { dx, dy }) => (
      !swipeDisabled
      && cards.length > 1
      && Math.abs(dx) > Math.abs(dy)
      && Math.abs(dx) > 8
    ),
    onPanResponderGrant: () => {
      if (swipeDisabled || cards.length <= 1) {
        return;
      }

      setActiveCardId(cards[0]?.id ?? null);
      slideAnim.stopAnimation();
      slideAnim.setValue(0);
    },
    onPanResponderMove: (_, { dx }) => {
      if (swipeDisabled || cards.length <= 1) {
        return;
      }

      slideAnim.setValue(dx);
    },
    onPanResponderRelease: (_, { dx, vx }) => {
      if (swipeDisabled || cards.length <= 1) {
        return;
      }

      const isSwipe = Math.abs(dx) > SWIPE_THRESHOLD || Math.abs(vx) > SWIPE_VELOCITY;

      if (!isSwipe) {
        snapBack();
        return;
      }

      const direction = dx > 0 || (dx === 0 && vx > 0) ? 'right' : 'left';
      triggerLeafSwipe(direction);
    },
    onPanResponderTerminate: () => {
      snapBack();
    },
  }), [
    cards.length,
    onLeafSwipe,
    swipeDisabled,
  ]);

  return (
    <View {...panResponder.panHandlers} style={styles.deck}>
      {cards.map((card, visibleIndex) => (
        <Animated.View
          key={`card-wrap-${card.id}`}
    style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              justifyContent: 'center',
              zIndex: 1000 - visibleIndex,
            },
            (card.id === activeCardId) ? {
              transform: [
                { translateX: slideAnim },
                {
                  rotate: slideAnim.interpolate({
                    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
                    outputRange: ['-14deg', '0deg', '14deg'],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            } : undefined,
          ]}
        >
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
        </Animated.View>
      ))}
    </View>
  );
}
