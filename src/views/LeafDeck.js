import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  View,
} from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StackCard } from '../components/StackCard';
import { styles } from '../styles/appStyles';

const SCREEN_WIDTH = Dimensions.get('window').width;

const DEFAULT_VISIBLE_COUNT = 5;
const SWIPE_DISTANCE_FACTOR = 0.22;
const SWIPE_VELOCITY = 0.55;
const SWIPE_OUT_DISTANCE = SCREEN_WIDTH * 1.28;
const SWIPE_OUT_DURATION = 260;
const INSERT_TO_BOTTOM_DURATION = 420;
const SLOT_Y_STEP = 12;
const SLOT_SCALE_STEP = 0.035;
const SLOT_OPACITY_STEP = 0.12;
const SLOT_ROTATE_STEP = 1.1;

function normalizeTopIndex(cards, topIndex) {
  if (cards.length === 0) {
    return null;
  }

  if (topIndex === null || topIndex === undefined) {
    return cards.length - 1;
  }

  return Math.max(0, Math.min(topIndex, cards.length - 1));
}

function getCircularCard(cards, topIndex, offset) {
  if (cards.length === 0 || topIndex === null) {
    return null;
  }

  return cards[(topIndex + offset + cards.length) % cards.length] ?? null;
}

function getVisibleSlotCount(cards, visibleCount) {
  return Math.min(visibleCount, cards.length);
}

function getSlotMetrics(slot) {
  const safeSlot = Math.max(slot, 0);
  const rotationSign = safeSlot % 2 === 0 ? -1 : 1;

  return {
    translateY: safeSlot * SLOT_Y_STEP,
    scale: 1 - safeSlot * SLOT_SCALE_STEP,
    opacity: Math.max(1 - safeSlot * SLOT_OPACITY_STEP, 0.4),
    rotate: `${rotationSign * Math.min(safeSlot, 2) * SLOT_ROTATE_STEP}deg`,
  };
}

function getSwipeDirection(dx, vx) {
  if (Math.abs(vx) > 0.01) {
    return vx > 0 ? 'right' : 'left';
  }

  return dx > 0 ? 'right' : 'left';
}

export function LeafDeck({
  cards,
  topIndex,
  visibleCount = DEFAULT_VISIBLE_COUNT,
  editingIndex,
  editingValue,
  focusedCardIndex,
  focusedCardId: controlledFocusedCardId,
  collapsedNodeIds,
  onCreateEdit,
  onDeleteCard,
  onEditingValueChange,
  onCompleteEdit,
  onLeafSwipe,
  swipeDisabled,
}) {
  const dragX = useRef(new Animated.Value(0)).current;
  const insertProgress = useRef(new Animated.Value(1)).current;
  const animationRef = useRef(null);
  const insertAnimationRef = useRef(null);
  const isAnimatingRef = useRef(false);
  const [insertingDirection, setInsertingDirection] = useState(null);
  const [displayCard, setDisplayCard] = useState(null);

  const normalizedTopIndex = normalizeTopIndex(cards, topIndex);
  const visualSlots = useMemo(
    () => Array.from(
      { length: getVisibleSlotCount(cards, visibleCount) },
      (_, slot) => slot,
    ),
    [cards.length, visibleCount],
  );
  const topCard = getCircularCard(cards, normalizedTopIndex, 0);
  const activeCard = displayCard ?? topCard;
  const isEditingActiveCard = activeCard != null && editingIndex === activeCard.index;
  const effectiveFocusedCardId = controlledFocusedCardId ?? topCard?.id ?? null;
  const visualCard = {
    id: 'leaf-visual-card',
    index: -1,
    childIds: [],
    text: '',
  };

  const swipeProgress = dragX.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: [1, 0, 1],
    extrapolate: 'clamp',
  });

  useEffect(() => () => {
    if (animationRef.current) {
      animationRef.current.stop();
      animationRef.current = null;
    }

    if (insertAnimationRef.current) {
      insertAnimationRef.current.stop();
      insertAnimationRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isAnimatingRef.current) {
      return;
    }

    setDisplayCard(topCard);
  }, [
    topCard,
  ]);

  function stopCurrentAnimation() {
    if (animationRef.current) {
      animationRef.current.stop();
      animationRef.current = null;
    }
  }

  function unlockDeck() {
    isAnimatingRef.current = false;
    animationRef.current = null;
  }

  function resetDrag() {
    dragX.setValue(0);
  }

  function getNextCardForSwipe(direction) {
    const directionStep = direction === 'right' ? 1 : -1;
    return getCircularCard(cards, normalizedTopIndex, directionStep);
  }

  function animateInsertToBottom(direction) {
    if (visualSlots.length <= 1) {
      setInsertingDirection(null);
      insertProgress.setValue(1);
      return;
    }

    if (insertAnimationRef.current) {
      insertAnimationRef.current.stop();
      insertAnimationRef.current = null;
    }

    insertProgress.setValue(0);
    setInsertingDirection(direction);

    insertAnimationRef.current = Animated.timing(insertProgress, {
      toValue: 1,
      duration: INSERT_TO_BOTTOM_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    insertAnimationRef.current.start(() => {
      insertAnimationRef.current = null;
      setInsertingDirection(null);
    });
  }

  function animateBackToRest() {
    stopCurrentAnimation();
    isAnimatingRef.current = true;

    animationRef.current = Animated.spring(dragX, {
      toValue: 0,
      useNativeDriver: true,
      speed: 22,
      bounciness: 6,
    });

    animationRef.current.start(() => {
      resetDrag();
      unlockDeck();
    });
  }

  function animateSwipeOut(direction) {
    if (isAnimatingRef.current || swipeDisabled || visualSlots.length <= 1) {
      return;
    }

    stopCurrentAnimation();
    isAnimatingRef.current = true;

    const targetX = direction === 'right' ? SWIPE_OUT_DISTANCE : -SWIPE_OUT_DISTANCE;
    const nextDisplayCard = getNextCardForSwipe(direction);

    animationRef.current = Animated.timing(dragX, {
      toValue: targetX,
      duration: SWIPE_OUT_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    animationRef.current.start(({ finished }) => {
      if (!finished) {
        resetDrag();
        unlockDeck();
        return;
      }

      const didSwipe = onLeafSwipe?.(direction) === true;
      if (!didSwipe) {
        animateBackToRest();
        return;
      }

      animateInsertToBottom(direction);
      setDisplayCard(nextDisplayCard);
      requestAnimationFrame(() => {
        resetDrag();
        unlockDeck();
      });
    });
  }

  function handleRelease(_, gestureState) {
    if (swipeDisabled || visualSlots.length <= 1 || isAnimatingRef.current) {
      return;
    }

    const { dx, vx } = gestureState;
    const hasDistance = Math.abs(dx) >= SCREEN_WIDTH * SWIPE_DISTANCE_FACTOR;
    const hasVelocity = Math.abs(vx) >= SWIPE_VELOCITY;

    if (!hasDistance && !hasVelocity) {
      animateBackToRest();
      return;
    }

    animateSwipeOut(getSwipeDirection(dx, vx));
  }

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, { dx, dy }) => (
      !swipeDisabled
      && !isAnimatingRef.current
      && visualSlots.length > 1
      && Math.abs(dx) > Math.abs(dy)
      && Math.abs(dx) > 8
    ),
    onPanResponderGrant: () => {
      if (swipeDisabled || visualSlots.length <= 1 || isAnimatingRef.current) {
        return;
      }

      stopCurrentAnimation();
      resetDrag();
    },
    onPanResponderMove: (_, { dx }) => {
      if (swipeDisabled || visualSlots.length <= 1 || isAnimatingRef.current) {
        return;
      }

      dragX.setValue(dx);
    },
    onPanResponderRelease: handleRelease,
    onPanResponderTerminate: handleRelease,
  }), [
    visualSlots.length,
    onLeafSwipe,
    swipeDisabled,
  ]);

  const bottomSlot = Math.max(visualSlots.length - 1, 0);
  const bottomMetrics = getSlotMetrics(bottomSlot);
  const insertStartX = insertingDirection === 'left'
    ? -SWIPE_OUT_DISTANCE
    : SWIPE_OUT_DISTANCE;
  const insertStartRotate = insertingDirection === 'left' ? '-10deg' : '10deg';

  return (
    <View {...panResponder.panHandlers} style={styles.deck}>
      {visualSlots.map((slot) => {
        const isTopSlot = slot === 0;
        const shouldRenderEditableTopSlot = isTopSlot && isEditingActiveCard;
        const currentMetrics = getSlotMetrics(slot);
        const promotedMetrics = getSlotMetrics(slot - 1);
        const zIndex = 1000 - slot;
        const elevation = Math.max(12 - slot, 1);
        const slotOpacity = isTopSlot
          ? currentMetrics.opacity
          : swipeProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [currentMetrics.opacity, promotedMetrics.opacity],
            extrapolate: 'clamp',
          });

        const slotTransform = isTopSlot
          ? [
            { translateX: dragX },
            {
              translateY: dragX.interpolate({
                inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
                outputRange: [-8, 0, -8],
                extrapolate: 'clamp',
              }),
            },
            {
              rotate: dragX.interpolate({
                inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
                outputRange: ['-10deg', '0deg', '10deg'],
                extrapolate: 'clamp',
              }),
            },
          ]
          : [
            {
              translateY: swipeProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [currentMetrics.translateY, promotedMetrics.translateY],
                extrapolate: 'clamp',
              }),
            },
            {
              scale: swipeProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [currentMetrics.scale, promotedMetrics.scale],
                extrapolate: 'clamp',
              }),
            },
            {
              rotate: swipeProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [currentMetrics.rotate, promotedMetrics.rotate],
                extrapolate: 'clamp',
              }),
            },
          ];

        return (
          <Animated.View
            key={`leaf-slot-${slot}`}
            style={[
              styles.deckSlot,
              {
                opacity: slotOpacity,
                zIndex,
                elevation,
                transform: slotTransform,
              },
            ]}
          >
            <StackCard
              card={shouldRenderEditableTopSlot ? activeCard : visualCard}
              collapsedNodeIds={collapsedNodeIds}
              editingIndex={shouldRenderEditableTopSlot ? editingIndex : null}
              editingValue={shouldRenderEditableTopSlot ? editingValue : ''}
              focusedCardIndex={focusedCardIndex}
              focusedCardId={effectiveFocusedCardId}
              hideControls={!shouldRenderEditableTopSlot}
              isLeafTopCard={isTopSlot}
              layout="leaf"
              visibleIndex={slot}
              onPress={() => {}}
              onCreateEdit={onCreateEdit}
              onDeleteCard={onDeleteCard}
              onEditingValueChange={onEditingValueChange}
              onCompleteEdit={onCompleteEdit}
              onToggleCollapse={() => {}}
              leafContentMode={
                shouldRenderEditableTopSlot
                  ? 'text'
                  : (isTopSlot ? 'blank' : 'placeholder')
              }
            />
          </Animated.View>
        );
      })}
      {insertingDirection ? (
        <Animated.View
          key="leaf-bottom-insert"
          pointerEvents="none"
          style={[
            styles.deckSlot,
            {
              opacity: insertProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [1, bottomMetrics.opacity],
                extrapolate: 'clamp',
              }),
              zIndex: 1000 - bottomSlot - 1,
              elevation: Math.max(10 - bottomSlot, 0),
              transform: [
                {
                  translateX: insertProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [insertStartX, 0],
                    extrapolate: 'clamp',
                  }),
                },
                {
                  translateY: insertProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-8, bottomMetrics.translateY],
                    extrapolate: 'clamp',
                  }),
                },
                {
                  scale: insertProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, bottomMetrics.scale],
                    extrapolate: 'clamp',
                  }),
                },
                {
                  rotate: insertProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [insertStartRotate, bottomMetrics.rotate],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}
        >
          <StackCard
            card={visualCard}
            collapsedNodeIds={collapsedNodeIds}
            editingIndex={null}
            editingValue=""
            focusedCardIndex={focusedCardIndex}
            focusedCardId={effectiveFocusedCardId}
            hideControls
            isLeafTopCard={false}
            layout="leaf"
            visibleIndex={bottomSlot}
            onPress={() => {}}
            onCreateEdit={onCreateEdit}
            onDeleteCard={onDeleteCard}
            onEditingValueChange={onEditingValueChange}
            onCompleteEdit={onCompleteEdit}
            onToggleCollapse={() => {}}
            leafContentMode="placeholder"
          />
        </Animated.View>
      ) : null}
      {activeCard && !isEditingActiveCard ? (
        <Animated.View
          key="leaf-current-overlay"
          style={[
            styles.deckSlot,
            styles.leafCurrentOverlay,
            {
              transform: [
                { translateX: dragX },
                {
                  translateY: dragX.interpolate({
                    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
                    outputRange: [-8, 0, -8],
                    extrapolate: 'clamp',
                  }),
                },
                {
                  rotate: dragX.interpolate({
                    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
                    outputRange: ['-10deg', '0deg', '10deg'],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}
        >
          <StackCard
            card={activeCard}
            collapsedNodeIds={collapsedNodeIds}
            editingIndex={editingIndex}
            editingValue={editingValue}
            focusedCardIndex={focusedCardIndex}
            focusedCardId={effectiveFocusedCardId}
            isLeafOverlay
            isLeafTopCard
            layout="leaf"
            visibleIndex={0}
            onPress={() => {}}
            onCreateEdit={onCreateEdit}
            onDeleteCard={onDeleteCard}
            onEditingValueChange={onEditingValueChange}
            onCompleteEdit={onCompleteEdit}
            onToggleCollapse={() => {}}
            leafContentMode="text"
          />
        </Animated.View>
      ) : null}
    </View>
  );
}
