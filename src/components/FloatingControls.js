import {
  PanResponder,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useMemo, useRef, useState } from 'react';
import { styles } from '../styles/appStyles';

const DELETE_HOLD_MS = 1000;
const ADD_POINT_SWITCH_DISTANCE = 36;
const ADD_POINT_AXIS_BIAS = 1.2;

function getAddRelationFromPoint(dx, dy, fallbackRelation = 'child') {
  const distance = Math.hypot(dx, dy);

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
  onDeleteHoldChange,
  canDeleteCurrentCard = false,
}) {
  const shouldShowDelete = layoutMode === 'leaf' && canDeleteCurrentCard;
  const [isAddPressed, setIsAddPressed] = useState(false);
  const [addRelation, setAddRelation] = useState(null);
  const addRelationRef = useRef('child');

  function updateAddRelation(gestureState) {
    const relation = getAddRelationFromPoint(
      gestureState.dx,
      gestureState.dy,
      addRelationRef.current,
    );

    if (relation === addRelationRef.current) {
      return;
    }

    addRelationRef.current = relation;
    setAddRelation(relation);
    onAddPreviewChange?.(relation);
  }

  function resetAddPointing() {
    setIsAddPressed(false);
    setAddRelation(null);
    onAddPreviewChange?.(null);
  }

  const addPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      addRelationRef.current = 'child';
      setIsAddPressed(true);
      setAddRelation('child');
      onAddPreviewChange?.('child');
    },
    onPanResponderMove: (_, gestureState) => {
      updateAddRelation(gestureState);
    },
    onPanResponderRelease: (_, gestureState) => {
      const relation = getAddRelationFromPoint(
        gestureState.dx,
        gestureState.dy,
        addRelationRef.current,
      );
      resetAddPointing();
      onCreateCard?.(relation);
    },
    onPanResponderTerminate: () => {
      resetAddPointing();
    },
  }), [
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
        {isAddPressed ? (
          <View pointerEvents="none" style={styles.addDirectionPad}>
            <View
              style={[
                styles.addDirectionHint,
                styles.addDirectionHintLeft,
                addRelation === 'parent' && styles.addDirectionHintActive,
              ]}
            >
              <Text style={styles.addDirectionHintText}>P</Text>
            </View>
            <View
              style={[
                styles.addDirectionHint,
                styles.addDirectionHintRight,
                addRelation === 'child' && styles.addDirectionHintActive,
              ]}
            >
              <Text style={styles.addDirectionHintText}>C</Text>
            </View>
            <View
              style={[
                styles.addDirectionHint,
                styles.addDirectionHintUp,
                addRelation === 'previousSibling' && styles.addDirectionHintActive,
              ]}
            >
              <Text style={styles.addDirectionHintText}>↑</Text>
            </View>
            <View
              style={[
                styles.addDirectionHint,
                styles.addDirectionHintDown,
                addRelation === 'nextSibling' && styles.addDirectionHintActive,
              ]}
            >
              <Text style={styles.addDirectionHintText}>↓</Text>
            </View>
          </View>
        ) : null}
        <View
          {...addPanResponder.panHandlers}
          accessibilityLabel="Add card"
          accessibilityRole="button"
          style={[
            styles.fab,
            isAddPressed && styles.fabPressed,
          ]}
        >
          <Text style={styles.fabIcon}>+</Text>
        </View>
      </View>
    </>
  );
}
