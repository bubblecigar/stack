import {
  Animated,
  Easing,
  Image,
  PanResponder,
  Pressable,
  View,
} from 'react-native';
import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import { styles } from '../styles/appStyles';

const treeViewCardImage = require('../../assets/tree_view.png');
const clockButtonImage = require('../../assets/card/clock.png');

const DELETE_HOLD_MS = 500;
const ADD_POINT_DEAD_ZONE = 16;
const ADD_POINT_SWITCH_DISTANCE = 24;
const ADD_POINT_AXIS_BIAS = 1.25;
const ADD_CARD_BASE_ROTATION = 45;
const ADD_CARD_MAX_TILT = 18;
const ADD_CARD_MAX_HORIZONTAL_OFFSET = 96;
const ADD_CARD_MAX_VERTICAL_OFFSET = 82;
const MODE_DOUBLE_TAP_DELAY_MS = 280;
const CLOCK_DRAG_THRESHOLD = 8;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getAddCardRotation(dx, dy) {
  if (Math.hypot(dx, dy) <= ADD_POINT_DEAD_ZONE) {
    return ADD_CARD_BASE_ROTATION;
  }

  const horizontalTilt = clamp(dx / 4, -ADD_CARD_MAX_TILT, ADD_CARD_MAX_TILT);
  const verticalTilt = clamp(dy / 8, -8, 8);

  return ADD_CARD_BASE_ROTATION + horizontalTilt + verticalTilt;
}

function getAddCardVerticalOffset(dy) {
  return clamp(dy * 0.72, -ADD_CARD_MAX_VERTICAL_OFFSET, ADD_CARD_MAX_VERTICAL_OFFSET);
}

function getAddCardHorizontalOffset(dx) {
  return clamp(dx * 0.72, -ADD_CARD_MAX_HORIZONTAL_OFFSET, ADD_CARD_MAX_HORIZONTAL_OFFSET);
}

function getAddRelationFromPoint(dx, dy, fallbackRelation = null) {
  const distance = Math.hypot(dx, dy);

  if (distance <= ADD_POINT_DEAD_ZONE) {
    return null;
  }

  if (distance < ADD_POINT_SWITCH_DISTANCE) {
    return fallbackRelation;
  }

  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (absX >= absY * ADD_POINT_AXIS_BIAS) {
    return dx >= 0 ? 'child' : 'parent';
  }

  if (absY >= absX * ADD_POINT_AXIS_BIAS) {
    return dy < 0 ? 'previousSibling' : 'nextSibling';
  }

  return fallbackRelation;
}

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
  onAddPreviewChange,
  onAddHoldChange,
  onDeleteHoldChange,
  onClockDrop,
  canDeleteCurrentCard = false,
}) {
  const shouldShowDelete = canDeleteCurrentCard;
  const shouldShowFocus = layoutMode === 'leaf';
  const [isAddPressed, setIsAddPressed] = useState(false);
  const [addCardRotation, setAddCardRotation] = useState(ADD_CARD_BASE_ROTATION);
  const [addCardOffsetX, setAddCardOffsetX] = useState(0);
  const [addCardOffsetY, setAddCardOffsetY] = useState(0);
  const [clockOffsetX, setClockOffsetX] = useState(0);
  const [clockOffsetY, setClockOffsetY] = useState(0);
  const flipProgress = useRef(new Animated.Value(layoutMode === 'tree' ? 1 : 0)).current;
  const addRelationRef = useRef(null);
  const lastModeTapRef = useRef(0);
  const addStartRef = useRef({
    pageX: 0,
    pageY: 0,
  });

  useEffect(() => {
    Animated.timing(flipProgress, {
      toValue: layoutMode === 'tree' ? 1 : 0,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [
    flipProgress,
    layoutMode,
  ]);

  const clockPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      setClockOffsetX(0);
      setClockOffsetY(0);
    },
    onPanResponderMove: (_, gestureState) => {
      setClockOffsetX(gestureState.dx);
      setClockOffsetY(gestureState.dy);
    },
    onPanResponderRelease: (event, gestureState) => {
      const didDrag = Math.hypot(gestureState.dx, gestureState.dy) >= CLOCK_DRAG_THRESHOLD;
      const { pageX, pageY } = event.nativeEvent;

      setClockOffsetX(0);
      setClockOffsetY(0);

      if (didDrag && typeof pageX === 'number' && typeof pageY === 'number') {
        onClockDrop?.({
          pageX,
          pageY,
        });
      }
    },
    onPanResponderTerminate: () => {
      setClockOffsetX(0);
      setClockOffsetY(0);
    },
  }), [
    onClockDrop,
  ]);

  function getAddGestureDelta(event, gestureState) {
    const { pageX, pageY } = event.nativeEvent;

    if (typeof pageX === 'number' && typeof pageY === 'number') {
      return {
        dx: pageX - addStartRef.current.pageX,
        dy: pageY - addStartRef.current.pageY,
      };
    }

    return {
      dx: gestureState.dx,
      dy: gestureState.dy,
    };
  }

  function updateAddRelation(dx, dy) {
    setAddCardRotation(getAddCardRotation(dx, dy));
    setAddCardOffsetX(getAddCardHorizontalOffset(dx));
    setAddCardOffsetY(getAddCardVerticalOffset(dy));

    const relation = getAddRelationFromPoint(
      dx,
      dy,
      addRelationRef.current,
    );

    if (relation === addRelationRef.current) {
      return;
    }

    addRelationRef.current = relation;
    onAddPreviewChange?.(relation);
  }

  function resetAddPointing() {
    setIsAddPressed(false);
    setAddCardRotation(ADD_CARD_BASE_ROTATION);
    setAddCardOffsetX(0);
    setAddCardOffsetY(0);
    addRelationRef.current = null;
    onAddHoldChange?.(false);
    onAddPreviewChange?.(null);
  }

  function handleModeTap(dx, dy) {
    if (Math.hypot(dx, dy) > ADD_POINT_DEAD_ZONE) {
      lastModeTapRef.current = 0;
      return;
    }

    const now = Date.now();
    const isDoubleTap = now - lastModeTapRef.current <= MODE_DOUBLE_TAP_DELAY_MS;
    lastModeTapRef.current = now;

    if (isDoubleTap) {
      lastModeTapRef.current = 0;
      onToggleMode?.();
    }
  }

  const addPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (event) => {
      const { pageX = 0, pageY = 0 } = event.nativeEvent;
      addStartRef.current = {
        pageX,
        pageY,
      };
      addRelationRef.current = null;
      setIsAddPressed(true);
      setAddCardRotation(ADD_CARD_BASE_ROTATION);
      setAddCardOffsetX(0);
      setAddCardOffsetY(0);
      onAddHoldChange?.(true);
      onAddPreviewChange?.(null);
    },
    onPanResponderMove: (event, gestureState) => {
      const { dx, dy } = getAddGestureDelta(event, gestureState);
      updateAddRelation(dx, dy);
    },
    onPanResponderRelease: (event, gestureState) => {
      const { dx, dy } = getAddGestureDelta(event, gestureState);
      const relation = getAddRelationFromPoint(
        dx,
        dy,
        addRelationRef.current,
      );
      resetAddPointing();
      if (relation) {
        onCreateCard?.(relation);
        return;
      }

      handleModeTap(dx, dy);
    },
    onPanResponderTerminate: () => {
      resetAddPointing();
    },
  }), [
    onAddHoldChange,
    onAddPreviewChange,
    onCreateCard,
    onToggleMode,
  ]);

  function handleDeletePressIn() {
    onDeleteHoldChange?.(true);
  }

  function handleDeletePressOut() {
    onDeleteHoldChange?.(false);
  }

  return (
    <>
      {shouldShowFocus ? (
        <View style={styles.focusFloatingControl}>
          <View
            {...clockPanResponder.panHandlers}
            accessibilityLabel="Drag clock stamp"
            accessibilityRole="button"
            style={[
              styles.fab,
              styles.focusFab,
              {
                transform: [
                  { translateX: clockOffsetX },
                  { translateY: clockOffsetY },
                ],
              },
            ]}
          >
            <Image
              source={clockButtonImage}
              style={styles.focusFabImage}
            />
          </View>
        </View>
      ) : null}

      {shouldShowDelete ? (
        <View style={styles.floatingControls}>
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
        </View>
      ) : null}

      <View style={styles.addFloatingControl}>
        <View
          {...addPanResponder.panHandlers}
          accessibilityHint="Drag to insert a card. Double tap to toggle leaf or tree view."
          accessibilityLabel="Insert card or toggle view"
          accessibilityRole="button"
          style={[
            styles.addCardControl,
            isAddPressed && styles.addCardControlPressed,
          ]}
        >
          <Animated.View
            style={[
              styles.addCardButtonShell,
              {
                transform: [
                  { translateX: addCardOffsetX },
                  { translateY: addCardOffsetY },
                  { rotate: `${addCardRotation}deg` },
                ],
              },
            ]}
          >
            <Animated.View
              style={[
                styles.addCardButton,
                styles.addCardFace,
                {
                  transform: [
                    { perspective: 900 },
                    {
                      rotateY: flipProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '180deg'],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Image
                source={treeViewCardImage}
                style={styles.addCardButtonImage}
              />
            </Animated.View>
            <Animated.View
              style={[
                styles.addCardButton,
                styles.addCardFace,
                {
                  transform: [
                    { perspective: 900 },
                    {
                      rotateY: flipProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['180deg', '360deg'],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Image
                source={treeViewCardImage}
                style={[
                  styles.addCardButtonImage,
                  styles.addCardButtonBackImage,
                ]}
              />
            </Animated.View>
          </Animated.View>
        </View>
      </View>
    </>
  );
}
