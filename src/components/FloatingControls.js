import {
  PanResponder,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useMemo, useRef, useState } from 'react';
import { styles } from '../styles/appStyles';

const DELETE_HOLD_MS = 500;
const ADD_POINT_DEAD_ZONE = 16;
const ADD_POINT_SWITCH_DISTANCE = 24;
const ADD_POINT_AXIS_BIAS = 1.25;
const ADD_CARD_BASE_ROTATION = 45;
const ADD_CARD_MAX_TILT = 18;
const ADD_CARD_MAX_VERTICAL_OFFSET = 82;

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
  canDeleteCurrentCard = false,
}) {
  const shouldShowDelete = layoutMode === 'leaf' && canDeleteCurrentCard;
  const [isAddPressed, setIsAddPressed] = useState(false);
  const [addCardRotation, setAddCardRotation] = useState(ADD_CARD_BASE_ROTATION);
  const [addCardOffsetY, setAddCardOffsetY] = useState(0);
  const addRelationRef = useRef(null);
  const addStartRef = useRef({
    pageX: 0,
    pageY: 0,
  });

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
    setAddCardOffsetY(0);
    addRelationRef.current = null;
    onAddHoldChange?.(false);
    onAddPreviewChange?.(null);
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
      }
    },
    onPanResponderTerminate: () => {
      resetAddPointing();
    },
  }), [
    onAddHoldChange,
    onAddPreviewChange,
    onCreateCard,
  ]);

  function handleDeletePressIn() {
    onDeleteHoldChange?.(true);
  }

  function handleDeletePressOut() {
    onDeleteHoldChange?.(false);
  }

  return (
    <>
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
          accessibilityLabel="Add card"
          accessibilityRole="button"
          style={[
            styles.addCardControl,
            isAddPressed && styles.addCardControlPressed,
          ]}
        >
          <View
            style={[
              styles.addCardButton,
              {
                transform: [
                  { translateY: addCardOffsetY },
                  { rotate: `${addCardRotation}deg` },
                ],
              },
            ]}
          />
        </View>
      </View>
    </>
  );
}
