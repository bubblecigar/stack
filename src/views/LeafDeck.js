import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Keyboard,
  PanResponder,
  View,
} from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DeleteHoldIndicator } from '../components/DeleteHoldIndicator';
import { StackCard } from '../components/StackCard';
import { styles } from '../styles/appStyles';

const doneStampImage = require('../../assets/card/done_stamp_red.png');
const undoneStampImage = require('../../assets/card/done_stamp_gray.png');

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

const DEFAULT_VISIBLE_COUNT = 5;
const SWIPE_DISTANCE_FACTOR = 0.22;
const SWIPE_VELOCITY = 0.55;
const SWIPE_OUT_DISTANCE_X = SCREEN_WIDTH * 1.28;
const SWIPE_OUT_DISTANCE_Y = SCREEN_HEIGHT * 0.72;
const SWIPE_OUT_DURATION = 260;
const INSERT_TO_BOTTOM_DURATION = 420;
const SLOT_Y_STEP = 12;
const SLOT_SCALE_STEP = 0.035;
const SLOT_OPACITY_STEP = 0.12;
const SLOT_ROTATE_STEP = 1.1;
const DOUBLE_TAP_DELAY_MS = 280;
const TAP_MOVE_TOLERANCE = 12;
const ADD_PREVIEW_DURATION = 220;
const ADD_PREVIEW_START_X = SCREEN_WIDTH * 0.42;
const ADD_PREVIEW_START_Y = SCREEN_HEIGHT * 0.22;
const ADD_PREVIEW_END_X = 34;
const ADD_PREVIEW_END_Y = 24;
const ADD_PREVIEW_DOWN_END_Y = 76;
const ADD_PREVIEW_PULSE_DURATION = 900;
const DONE_STAMP_DRAG_THRESHOLD = 6;

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

function getSwipeDirection(dx, dy, vx, vy) {
  const isHorizontal = Math.abs(dx) >= Math.abs(dy);

  if (isHorizontal) {
    if (Math.abs(vx) > 0.01) {
      return vx > 0 ? 'right' : 'left';
    }

    return dx > 0 ? 'right' : 'left';
  }

  if (Math.abs(vy) > 0.01) {
    return vy > 0 ? 'down' : 'up';
  }

  return dy > 0 ? 'down' : 'up';
}

function getSwipeTarget(direction) {
  if (direction === 'left') {
    return { x: -SWIPE_OUT_DISTANCE_X, y: 0 };
  }

  if (direction === 'right') {
    return { x: SWIPE_OUT_DISTANCE_X, y: 0 };
  }

  return {
    x: 0,
    y: direction === 'down' ? SWIPE_OUT_DISTANCE_Y : -SWIPE_OUT_DISTANCE_Y,
  };
}

function getAddPreviewStartTarget(relation) {
  if (relation === 'parent') {
    return { x: ADD_PREVIEW_START_X, y: 0 };
  }

  if (relation === 'child') {
    return { x: -ADD_PREVIEW_START_X, y: 0 };
  }

  if (relation === 'previousSibling') {
    return { x: 0, y: ADD_PREVIEW_START_Y };
  }

  if (relation === 'nextSibling') {
    return { x: 0, y: -ADD_PREVIEW_START_Y };
  }

  return { x: 0, y: 0 };
}

function getAddPreviewStartRotation(relation) {
  if (relation === 'parent') {
    return '-7deg';
  }

  if (relation === 'child') {
    return '7deg';
  }

  if (relation === 'previousSibling') {
    return '-5deg';
  }

  if (relation === 'nextSibling') {
    return '5deg';
  }

  return '0deg';
}

function getAddPreviewEndTarget(relation) {
  if (relation === 'parent') {
    return { x: ADD_PREVIEW_END_X, y: 0 };
  }

  if (relation === 'child') {
    return { x: -ADD_PREVIEW_END_X, y: 0 };
  }

  if (relation === 'previousSibling') {
    return { x: 0, y: ADD_PREVIEW_END_Y };
  }

  if (relation === 'nextSibling') {
    return { x: 0, y: -ADD_PREVIEW_DOWN_END_Y };
  }

  return { x: 0, y: 0 };
}

function getAddPreviewEndRotation(relation) {
  if (relation === 'parent') {
    return '-4deg';
  }

  if (relation === 'child') {
    return '4deg';
  }

  if (relation === 'previousSibling') {
    return '-3deg';
  }

  if (relation === 'nextSibling') {
    return '3deg';
  }

  return '0deg';
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
  isDeleteHoldActive = false,
  isAddHoldActive = false,
  addPreviewRelation = null,
  onDeleteCurrentCard,
  onDoneCurrentCard,
  swipeDisabled,
}) {
  const dragX = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const swipeProgressValue = useRef(new Animated.Value(0)).current;
  const insertProgress = useRef(new Animated.Value(1)).current;
  const addPreviewProgress = useRef(new Animated.Value(0)).current;
  const addPreviewPulse = useRef(new Animated.Value(0)).current;
  const animationRef = useRef(null);
  const insertAnimationRef = useRef(null);
  const addPreviewAnimationRef = useRef(null);
  const addPreviewPulseRef = useRef(null);
  const isAnimatingRef = useRef(false);
  const lastTapRef = useRef({
    timestamp: 0,
  });
  const touchStartRef = useRef(null);
  const inputTouchRef = useRef(false);
  const topCardFrameRef = useRef(null);
  const topCardFrameBoundsRef = useRef(null);
  const [doneStampOffsetX, setDoneStampOffsetX] = useState(0);
  const [doneStampOffsetY, setDoneStampOffsetY] = useState(0);
  const [isDoneStampDragging, setIsDoneStampDragging] = useState(false);
  const [insertingDirection, setInsertingDirection] = useState(null);
  const [displayCard, setDisplayCard] = useState(null);
  const [animatedAddPreviewRelation, setAnimatedAddPreviewRelation] = useState(null);

  function reportTopCardFrame() {
    topCardFrameRef.current?.measureInWindow?.((x, y, width, height) => {
      topCardFrameBoundsRef.current = {
        height,
        width,
        x,
        y,
      };
    });
  }

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
  const activeCardDone = Boolean(activeCard?.done);
  const canSwipeDeck = visualSlots.length > 1 || activeCardDone;
  const effectiveFocusedCardId = controlledFocusedCardId ?? topCard?.id ?? null;
  const visualCard = {
    id: 'leaf-visual-card',
    index: -1,
    childIds: [],
    text: '',
  };

  const swipeProgress = swipeProgressValue;

  useEffect(() => () => {
    if (animationRef.current) {
      animationRef.current.stop();
      animationRef.current = null;
    }

    if (insertAnimationRef.current) {
      insertAnimationRef.current.stop();
      insertAnimationRef.current = null;
    }

    if (addPreviewAnimationRef.current) {
      addPreviewAnimationRef.current.stop();
      addPreviewAnimationRef.current = null;
    }

    if (addPreviewPulseRef.current) {
      addPreviewPulseRef.current.stop();
      addPreviewPulseRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isAnimatingRef.current) {
      return;
    }

    setDisplayCard(topCard);
    requestAnimationFrame(reportTopCardFrame);
  }, [
    topCard,
  ]);

  useEffect(() => {
    if (addPreviewAnimationRef.current) {
      addPreviewAnimationRef.current.stop();
      addPreviewAnimationRef.current = null;
    }

    if (addPreviewPulseRef.current) {
      addPreviewPulseRef.current.stop();
      addPreviewPulseRef.current = null;
    }

    if (!isAddHoldActive || !addPreviewRelation) {
      addPreviewProgress.setValue(0);
      addPreviewPulse.setValue(0);
      setAnimatedAddPreviewRelation(null);
      return;
    }

    addPreviewProgress.setValue(0);
    addPreviewPulse.setValue(0);
    setAnimatedAddPreviewRelation(addPreviewRelation);

    addPreviewAnimationRef.current = Animated.timing(addPreviewProgress, {
      toValue: 1,
      duration: ADD_PREVIEW_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    addPreviewAnimationRef.current.start(({ finished }) => {
      addPreviewAnimationRef.current = null;

      if (!finished) {
        return;
      }

      addPreviewPulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(addPreviewPulse, {
            toValue: 1,
            duration: ADD_PREVIEW_PULSE_DURATION,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(addPreviewPulse, {
            toValue: 0,
            duration: ADD_PREVIEW_PULSE_DURATION,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      );

      addPreviewPulseRef.current.start();
    });
  }, [
    addPreviewProgress,
    addPreviewPulse,
    addPreviewRelation,
    isAddHoldActive,
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
    dragY.setValue(0);
    swipeProgressValue.setValue(0);
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

    animationRef.current = Animated.parallel([
      Animated.spring(dragX, {
        toValue: 0,
        useNativeDriver: true,
        speed: 22,
        bounciness: 6,
      }),
      Animated.spring(dragY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 22,
        bounciness: 6,
      }),
      Animated.spring(swipeProgressValue, {
        toValue: 0,
        useNativeDriver: true,
        speed: 22,
        bounciness: 6,
      }),
    ]);

    animationRef.current.start(() => {
      resetDrag();
      unlockDeck();
    });
  }

  function animateSwipeOut(direction) {
    if (isAnimatingRef.current || swipeDisabled || !canSwipeDeck) {
      return;
    }

    stopCurrentAnimation();
    isAnimatingRef.current = true;

    const swipeTarget = getSwipeTarget(direction);

    animationRef.current = Animated.parallel([
      Animated.timing(dragX, {
        toValue: swipeTarget.x,
        duration: SWIPE_OUT_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(dragY, {
        toValue: swipeTarget.y,
        duration: SWIPE_OUT_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(swipeProgressValue, {
        toValue: 1,
        duration: SWIPE_OUT_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

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
      setDisplayCard(null);
      requestAnimationFrame(() => {
        resetDrag();
        unlockDeck();
      });
    });
  }

  function animateDeleteSwipeAway() {
    if (isAnimatingRef.current || !activeCard || activeCard.index < 0) {
      onDeleteCurrentCard?.();
      return;
    }

    stopCurrentAnimation();
    isAnimatingRef.current = true;

    animationRef.current = Animated.parallel([
      Animated.timing(dragX, {
        toValue: 0,
        duration: SWIPE_OUT_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(dragY, {
        toValue: -SWIPE_OUT_DISTANCE_Y,
        duration: SWIPE_OUT_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(swipeProgressValue, {
        toValue: 1,
        duration: SWIPE_OUT_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    animationRef.current.start(() => {
      onDeleteCurrentCard?.();
      resetDrag();
      unlockDeck();
    });
  }

  function handleRelease(_, gestureState) {
    if (swipeDisabled || !canSwipeDeck || isAnimatingRef.current) {
      return;
    }

    const { dx, dy, vx, vy } = gestureState;
    const isHorizontal = Math.abs(dx) >= Math.abs(dy);
    const primaryDistance = isHorizontal ? Math.abs(dx) : Math.abs(dy);
    const primaryVelocity = isHorizontal ? Math.abs(vx) : Math.abs(vy);
    const distanceThreshold = isHorizontal
      ? SCREEN_WIDTH * SWIPE_DISTANCE_FACTOR
      : SCREEN_HEIGHT * 0.14;
    const hasDistance = primaryDistance >= distanceThreshold;
    const hasVelocity = primaryVelocity >= SWIPE_VELOCITY;

    if (!hasDistance && !hasVelocity) {
      animateBackToRest();
      return;
    }

    animateSwipeOut(getSwipeDirection(dx, dy, vx, vy));
  }

  function handleDeckTouchStart(event) {
    const { pageX = 0, pageY = 0 } = event.nativeEvent;
    touchStartRef.current = {
      pageX,
      pageY,
    };
  }

  function handleDeckTouchEnd(event) {
    if (editingIndex !== null) {
      if (inputTouchRef.current) {
        inputTouchRef.current = false;
        touchStartRef.current = null;
        return;
      }

      if (!touchStartRef.current) {
        return;
      }

      const { pageX = 0, pageY = 0 } = event.nativeEvent;
      const deltaX = Math.abs(pageX - touchStartRef.current.pageX);
      const deltaY = Math.abs(pageY - touchStartRef.current.pageY);
      touchStartRef.current = null;

      if (Math.max(deltaX, deltaY) <= TAP_MOVE_TOLERANCE) {
        Keyboard.dismiss();
      }

      return;
    }

    if (
      swipeDisabled
      || isAnimatingRef.current
      || !activeCard
      || activeCard.index < 0
      || !touchStartRef.current
    ) {
      touchStartRef.current = null;
      return;
    }

    const { pageX = 0, pageY = 0 } = event.nativeEvent;
    const deltaX = Math.abs(pageX - touchStartRef.current.pageX);
    const deltaY = Math.abs(pageY - touchStartRef.current.pageY);
    touchStartRef.current = null;

    if (Math.max(deltaX, deltaY) > TAP_MOVE_TOLERANCE) {
      return;
    }

    const now = Date.now();
    const isDoubleTap = now - lastTapRef.current.timestamp <= DOUBLE_TAP_DELAY_MS;
    lastTapRef.current = {
      timestamp: now,
    };

    if (isDoubleTap) {
      onCreateEdit?.(activeCard.index, activeCard.text);
    }
  }

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, { dx, dy }) => (
      !swipeDisabled
      && !isDeleteHoldActive
      && !isAnimatingRef.current
      && canSwipeDeck
      && Math.max(Math.abs(dx), Math.abs(dy)) > 8
    ),
    onPanResponderGrant: () => {
      if (swipeDisabled || !canSwipeDeck || isAnimatingRef.current) {
        return;
      }

      stopCurrentAnimation();
      resetDrag();
    },
    onPanResponderMove: (_, { dx, dy }) => {
      if (swipeDisabled || !canSwipeDeck || isAnimatingRef.current) {
        return;
      }

      dragX.setValue(dx);
      dragY.setValue(dy);
      swipeProgressValue.setValue(Math.min(
        Math.max(Math.max(Math.abs(dx) / SCREEN_WIDTH, Math.abs(dy) / SCREEN_HEIGHT) * 2.5, 0),
        1,
      ));
    },
    onPanResponderRelease: handleRelease,
    onPanResponderTerminate: handleRelease,
  }), [
    canSwipeDeck,
    visualSlots.length,
    onLeafSwipe,
    swipeDisabled,
  ]);

  const doneStampPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => activeCard?.index >= 0,
    onMoveShouldSetPanResponder: () => activeCard?.index >= 0,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      reportTopCardFrame();
      setDoneStampOffsetX(0);
      setDoneStampOffsetY(0);
      setIsDoneStampDragging(true);
    },
    onPanResponderMove: (_, gestureState) => {
      setDoneStampOffsetX(gestureState.dx);
      setDoneStampOffsetY(gestureState.dy);
    },
    onPanResponderRelease: (event, gestureState) => {
      const dropX = typeof gestureState.moveX === 'number'
        ? gestureState.moveX
        : event.nativeEvent.pageX;
      const dropY = typeof gestureState.moveY === 'number'
        ? gestureState.moveY
        : event.nativeEvent.pageY;
      const bounds = topCardFrameBoundsRef.current;
      const didDrag = Math.hypot(gestureState.dx, gestureState.dy) >= DONE_STAMP_DRAG_THRESHOLD;
      const isInsideCard = Boolean(
        bounds
        && typeof dropX === 'number'
        && typeof dropY === 'number'
        && dropX >= bounds.x
        && dropX <= bounds.x + bounds.width
        && dropY >= bounds.y
        && dropY <= bounds.y + bounds.height,
      );

      setDoneStampOffsetX(0);
      setDoneStampOffsetY(0);
      setIsDoneStampDragging(false);

      if (didDrag && isInsideCard) {
        onDoneCurrentCard?.();
      }
    },
    onPanResponderTerminate: () => {
      setDoneStampOffsetX(0);
      setDoneStampOffsetY(0);
      setIsDoneStampDragging(false);
    },
  }), [
    activeCard?.index,
    onDoneCurrentCard,
  ]);

  const bottomSlot = Math.max(visualSlots.length - 1, 0);
  const bottomMetrics = getSlotMetrics(bottomSlot);
  const insertStartTarget = insertingDirection
    ? getSwipeTarget(insertingDirection)
    : { x: 0, y: 0 };
  const insertStartRotate = insertingDirection === 'left' || insertingDirection === 'up'
    ? '-10deg'
    : '10deg';
  const addPreviewStartTarget = getAddPreviewStartTarget(animatedAddPreviewRelation);
  const addPreviewEndTarget = getAddPreviewEndTarget(animatedAddPreviewRelation);
  const addPreviewTranslateX = addPreviewProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [addPreviewStartTarget.x, addPreviewEndTarget.x],
    extrapolate: 'clamp',
  });
  const addPreviewTranslateY = addPreviewProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [addPreviewStartTarget.y, addPreviewEndTarget.y],
    extrapolate: 'clamp',
  });
  const addPreviewScale = addPreviewProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.88, 1],
    extrapolate: 'clamp',
  });
  const addPreviewBaseOpacity = addPreviewProgress.interpolate({
    inputRange: [0, 0.24, 1],
    outputRange: [0, 0.68, 0.86],
    extrapolate: 'clamp',
  });
  const addPreviewPulseOpacity = addPreviewPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.9],
    extrapolate: 'clamp',
  });
  const addPreviewOpacity = Animated.multiply(addPreviewBaseOpacity, addPreviewPulseOpacity);
  const addPreviewRotate = addPreviewProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [
      getAddPreviewStartRotation(animatedAddPreviewRelation),
      getAddPreviewEndRotation(animatedAddPreviewRelation),
    ],
    extrapolate: 'clamp',
  });

  return (
    <View
      {...panResponder.panHandlers}
      onTouchEnd={handleDeckTouchEnd}
      onTouchStart={handleDeckTouchStart}
      style={styles.deck}
    >
      {visualSlots.map((slot) => {
        const isTopSlot = slot === 0;
        const shouldRenderActiveTopSlot = isTopSlot && activeCard;
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
              translateY: Animated.add(
                dragY,
                swipeProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -8],
                  extrapolate: 'clamp',
                }),
              ),
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
            <View
              ref={shouldRenderActiveTopSlot ? topCardFrameRef : null}
              style={styles.leafCardFrame}
              onLayout={shouldRenderActiveTopSlot ? reportTopCardFrame : undefined}
            >
              <StackCard
                card={shouldRenderActiveTopSlot ? activeCard : visualCard}
                collapsedNodeIds={collapsedNodeIds}
                editingIndex={shouldRenderActiveTopSlot ? editingIndex : null}
                editingValue={shouldRenderActiveTopSlot ? editingValue : ''}
                focusedCardIndex={focusedCardIndex}
                focusedCardId={effectiveFocusedCardId}
                hideControls
                isLeafTopCard={isTopSlot}
                layout="leaf"
                visibleIndex={slot}
                onPress={() => {}}
                onCreateEdit={onCreateEdit}
                onDeleteCard={onDeleteCard}
                onEditingValueChange={onEditingValueChange}
                onCompleteEdit={onCompleteEdit}
                onPressIn={() => {
                  if (shouldRenderActiveTopSlot && editingIndex === activeCard.index) {
                    inputTouchRef.current = true;
                  }
                }}
                onToggleCollapse={() => {}}
                leafContentMode={
                  shouldRenderActiveTopSlot
                    ? 'text'
                    : 'placeholder'
                }
              />
              {shouldRenderActiveTopSlot ? (
                <DeleteHoldIndicator
                  active={isDeleteHoldActive && activeCard?.index >= 0}
                  onComplete={animateDeleteSwipeAway}
                />
              ) : null}
              {shouldRenderActiveTopSlot && isAddHoldActive && animatedAddPreviewRelation ? (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.leafAddPreviewOverlay,
                    {
                      opacity: addPreviewOpacity,
                      transform: [
                        { translateX: addPreviewTranslateX },
                        { translateY: addPreviewTranslateY },
                        { scale: addPreviewScale },
                        { rotate: addPreviewRotate },
                      ],
                    },
                  ]}
                >
                  <View style={styles.leafAddPreviewCardFrame}>
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
                      visibleIndex={0}
                      onPress={() => {}}
                      onCreateEdit={onCreateEdit}
                      onDeleteCard={onDeleteCard}
                      onEditingValueChange={onEditingValueChange}
                      onCompleteEdit={onCompleteEdit}
                      onToggleCollapse={() => {}}
                      leafContentMode="none"
                    />
                  </View>
                </Animated.View>
              ) : null}
            </View>
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
                    outputRange: [insertStartTarget.x, 0],
                    extrapolate: 'clamp',
                  }),
                },
                {
                  translateY: insertProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [insertStartTarget.y - 8, bottomMetrics.translateY],
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
      {activeCard?.index >= 0 ? (
        <View
          {...doneStampPanResponder.panHandlers}
          accessibilityHint={activeCardDone
            ? 'Drag onto the current card to clear done'
            : 'Drag onto the current card to mark it done'}
          accessibilityLabel={activeCardDone
            ? 'Clear current card done'
            : 'Mark current card done'}
          accessibilityRole="button"
          style={[
            styles.leafDoneStampButton,
            isDoneStampDragging && styles.leafDoneStampButtonPressed,
            {
              transform: [
                { translateX: doneStampOffsetX },
                { translateY: doneStampOffsetY },
              ],
            },
          ]}
        >
          <Image
            pointerEvents="none"
            source={activeCardDone ? undoneStampImage : doneStampImage}
            style={styles.leafDoneStampIcon}
          />
        </View>
      ) : null}
    </View>
  );
}
