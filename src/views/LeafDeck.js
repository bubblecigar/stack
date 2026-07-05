import {
  Animated,
  Dimensions,
  PanResponder,
  View,
} from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StackCard } from '../components/StackCard';
import { styles } from '../styles/appStyles';

const SCREEN_WIDTH = Dimensions.get('window').width;

const SWIPE_DISTANCE_FACTOR = 0.18;
const SWIPE_VELOCITY = 650;
const SWIPE_OUT_DISTANCE = SCREEN_WIDTH * 1.2;

export function LeafDeck({
  cards,
  editingIndex,
  editingValue,
  focusedCardIndex,
  focusedCardId: controlledFocusedCardId,
  collapsedNodeIds,
  onCreateEdit,
  onDeleteCard,
  onEditingValueChange,
  onLeafSwipe,
  swipeDisabled,
}) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const focusedTextOpacity = useRef(new Animated.Value(1)).current;
  const [activeCardId, setActiveCardId] = useState(null);
  const topFocusedCardId = cards[0]?.id ?? null;
  const effectiveFocusedCardId = controlledFocusedCardId ?? topFocusedCardId;
  const isTransitioningRef = useRef(false);
  const activeAnimationRef = useRef(null);

  useEffect(() => {
    focusedTextOpacity.setValue(0);
    Animated.timing(focusedTextOpacity, {
      toValue: 1,
      duration: 90,
      useNativeDriver: true,
    }).start();
  }, [topFocusedCardId]);

  useEffect(() => () => {
    if (activeAnimationRef.current) {
      activeAnimationRef.current.stop();
      activeAnimationRef.current = null;
    }
  }, []);

  const clearActiveCard = () => {
    isTransitioningRef.current = false;
    setActiveCardId(null);
    slideAnim.setValue(0);
  };

  function snapBack() {
    if (activeAnimationRef.current) {
      activeAnimationRef.current.stop();
    }

    isTransitioningRef.current = true;

    activeAnimationRef.current = Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      damping: 16,
      stiffness: 260,
      mass: 0.9,
    });

    activeAnimationRef.current.start(() => {
      clearActiveCard();
    });
  }

  function triggerLeafSwipe(direction) {
    if (isTransitioningRef.current || cards.length <= 1 || swipeDisabled) {
      return;
    }

    const outTo = direction === 'left' ? -SWIPE_OUT_DISTANCE : SWIPE_OUT_DISTANCE;
    const activeTopId = cards[0]?.id ?? null;
    if (!activeTopId) {
      return;
    }

    isTransitioningRef.current = true;
    setActiveCardId(activeTopId);

    if (activeAnimationRef.current) {
      activeAnimationRef.current.stop();
    }

    activeAnimationRef.current = Animated.timing(slideAnim, {
      toValue: outTo,
      duration: 170,
      useNativeDriver: true,
    });

    activeAnimationRef.current.start(({ finished }) => {
      if (!finished) {
        clearActiveCard();
        return;
      }

      const didSwipe = onLeafSwipe?.(direction) === true;
      if (!didSwipe) {
        snapBack();
        return;
      }

      clearActiveCard();
    });
  }

  function handleSwipeRelease(_, { dx, vx }) {
    if (cards.length <= 1 || swipeDisabled) {
      return;
    }

    const hasDistance = Math.abs(dx) > SCREEN_WIDTH * SWIPE_DISTANCE_FACTOR;
    const hasVelocity = Math.abs(vx) > SWIPE_VELOCITY;
    const isSwipe = hasDistance || hasVelocity;

    if (!isTransitioningRef.current && !isSwipe) {
      snapBack();
      return;
    }

    if (isTransitioningRef.current) {
      return;
    }

    const direction = vx !== 0
      ? (vx > 0 ? 'right' : 'left')
      : (dx > 0 ? 'right' : 'left');

    triggerLeafSwipe(direction);
  }

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, { dx, dy }) => (
      !swipeDisabled
      && !isTransitioningRef.current
      && cards.length > 1
      && Math.abs(dx) > Math.abs(dy)
      && Math.abs(dx) > 8
    ),
    onPanResponderGrant: () => {
      if (swipeDisabled || cards.length <= 1 || isTransitioningRef.current) {
        return;
      }

      const activeTopId = cards[0]?.id ?? null;
      setActiveCardId(activeTopId);
      slideAnim.stopAnimation();
      slideAnim.setValue(0);
    },
    onPanResponderMove: (_, { dx }) => {
      if (swipeDisabled || cards.length <= 1 || isTransitioningRef.current) {
        return;
      }

      slideAnim.setValue(dx);
    },
    onPanResponderRelease: handleSwipeRelease,
    onPanResponderTerminate: handleSwipeRelease,
  }), [
    cards.length,
    cards,
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
            card.id === activeCardId
              ? {
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
                }
              : undefined,
          ]}
        >
          <StackCard
            card={card}
            collapsedNodeIds={collapsedNodeIds}
            editingIndex={editingIndex}
            editingValue={editingValue}
            focusedCardIndex={focusedCardIndex}
            focusedCardId={effectiveFocusedCardId}
            layout="leaf"
            key={`card-${card.id}`}
            visibleIndex={visibleIndex}
            isLeafTopCard={visibleIndex === 0}
            onPress={() => {}}
            onCreateEdit={onCreateEdit}
            onDeleteCard={onDeleteCard}
            onEditingValueChange={onEditingValueChange}
            onToggleCollapse={() => {}}
            leafTextOpacity={card.id === effectiveFocusedCardId ? focusedTextOpacity : 0}
          />
        </Animated.View>
      ))}
    </View>
  );
}
