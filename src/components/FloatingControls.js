import {
  Animated,
  Dimensions,
  Easing,
  Image,
  PanResponder,
  Pressable,
  View,
} from 'react-native';
import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import { constrainAddRelation } from '../lib/cardInsertion';
import {
  CARD_BACKGROUND_OPTIONS,
  DEFAULT_CARD_BACKGROUND_COLOR,
} from '../lib/cardBackground';
import { STAMP_ASSETS } from '../config/stampAssets';
import { styles } from '../styles/appStyles';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DELETE_HOLD_MS = 500;
const ADD_POINT_DEAD_ZONE = 28;
const ADD_POINT_SWITCH_DISTANCE = 36;
const ADD_POINT_AXIS_BIAS = 1.25;
const ADD_CARD_BASE_ROTATION = 45;
const ADD_CARD_MAX_TILT = 18;
const ADD_CARD_MAX_HORIZONTAL_OFFSET = 96;
const ADD_CARD_MAX_VERTICAL_OFFSET = 82;
const MODE_DOUBLE_TAP_DELAY_MS = 280;
const DELETE_CARD_TOGGLE_DURATION_MS = 220;
const SETTINGS_PANEL_TRIGGER_Y = SCREEN_HEIGHT * 0.34;
const SETTINGS_PANEL_TRIGGER_DRAG_Y = -160;
const SETTINGS_PANEL_CENTER_OFFSET_X = 0;
const SETTINGS_PANEL_CENTER_OFFSET_Y = -(SCREEN_HEIGHT / 2 + 150);
const SETTINGS_PANEL_TOGGLE_DURATION_MS = 260;
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

export function FloatingControls({
  layoutMode,
  onToggleMode,
  onCreateCard,
  onAddPreviewChange,
  onAddHoldChange,
  onDeleteHoldChange,
  newCardBackgroundColor = DEFAULT_CARD_BACKGROUND_COLOR,
  onNewCardBackgroundColorChange,
  onRootDoubleTap,
  canDeleteCurrentCard = false,
  deleteTargetDone = false,
  childInsertionOnly = false,
  parentInsertionBlocked = false,
  disableCardInsertion = false,
  rootDoubleTapEnabled = false,
}) {
  const shouldShowDelete = canDeleteCurrentCard;
  const [isAddPressed, setIsAddPressed] = useState(false);
  const [addCardRotation, setAddCardRotation] = useState(ADD_CARD_BASE_ROTATION);
  const [addCardOffsetX, setAddCardOffsetX] = useState(0);
  const [addCardOffsetY, setAddCardOffsetY] = useState(0);
  const [shouldRenderDelete, setShouldRenderDelete] = useState(shouldShowDelete);
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [settingsPanelOffsetX, setSettingsPanelOffsetX] = useState(0);
  const [settingsPanelOffsetY, setSettingsPanelOffsetY] = useState(0);
  const flipProgress = useRef(new Animated.Value(layoutMode === 'tree' ? 1 : 0)).current;
  const deleteSlideProgress = useRef(new Animated.Value(shouldShowDelete ? 1 : 0)).current;
  const settingsPanelProgress = useRef(new Animated.Value(0)).current;
  const addRelationRef = useRef(null);
  const lastModeTapRef = useRef(0);
  const addStartRef = useRef({
    pageX: 0,
    pageY: 0,
  });
  const selectedColorIndex = CARD_BACKGROUND_OPTIONS.findIndex(
    ({ color }) => color === newCardBackgroundColor,
  );
  const secondaryCardColor = CARD_BACKGROUND_OPTIONS[
    (selectedColorIndex + 1) % CARD_BACKGROUND_OPTIONS.length
  ];

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

  useEffect(() => {
    if (shouldShowDelete) {
      setShouldRenderDelete(true);
    } else {
      onDeleteHoldChange?.(false);
    }

    Animated.timing(deleteSlideProgress, {
      toValue: shouldShowDelete ? 1 : 0,
      duration: DELETE_CARD_TOGGLE_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !shouldShowDelete) {
        setShouldRenderDelete(false);
      }
    });
  }, [
    deleteSlideProgress,
    onDeleteHoldChange,
    shouldShowDelete,
  ]);

  useEffect(() => {
    Animated.timing(settingsPanelProgress, {
      toValue: isSettingsPanelOpen ? 1 : 0,
      duration: SETTINGS_PANEL_TOGGLE_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [
    isSettingsPanelOpen,
    settingsPanelProgress,
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

    if (disableCardInsertion) {
      if (addRelationRef.current !== null) {
        addRelationRef.current = null;
        onAddPreviewChange?.(null);
      }
      return;
    }

    const relation = constrainAddRelation(
      getAddRelationFromPoint(
        dx,
        dy,
        addRelationRef.current,
      ),
      childInsertionOnly,
      parentInsertionBlocked,
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

  function pinSettingsPanel() {
    setSettingsPanelOffsetX(SETTINGS_PANEL_CENTER_OFFSET_X);
    setSettingsPanelOffsetY(SETTINGS_PANEL_CENTER_OFFSET_Y);
    setIsSettingsPanelOpen(true);
    resetAddPointing();
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
      if (rootDoubleTapEnabled) {
        onRootDoubleTap?.();
      } else {
        onToggleMode?.();
      }
    }
  }

  function shouldOpenSettingsPanel(event, gestureState) {
    const dropY = typeof gestureState.moveY === 'number'
      ? gestureState.moveY
      : event.nativeEvent.pageY;
    const isInUpperPanel = typeof dropY === 'number' && dropY <= SETTINGS_PANEL_TRIGGER_Y;
    const isStrongUpwardDrag = gestureState.dy <= SETTINGS_PANEL_TRIGGER_DRAG_Y;

    return (
      gestureState.dy < -ADD_POINT_DEAD_ZONE
      && (isInUpperPanel || isStrongUpwardDrag)
    );
  }

  const addPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !isSettingsPanelOpen,
    onMoveShouldSetPanResponder: () => !isSettingsPanelOpen,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (event) => {
      if (isSettingsPanelOpen) {
        return;
      }

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
      onAddHoldChange?.(!disableCardInsertion);
      onAddPreviewChange?.(null);
    },
    onPanResponderMove: (event, gestureState) => {
      if (isSettingsPanelOpen) {
        return;
      }

      const { dx, dy } = getAddGestureDelta(event, gestureState);
      if (shouldOpenSettingsPanel(event, gestureState)) {
        pinSettingsPanel();
        return;
      }

      updateAddRelation(dx, dy);
    },
    onPanResponderRelease: (event, gestureState) => {
      if (isSettingsPanelOpen) {
        return;
      }

      const { dx, dy } = getAddGestureDelta(event, gestureState);
      if (shouldOpenSettingsPanel(event, gestureState)) {
        pinSettingsPanel();
        return;
      }

      const relation = constrainAddRelation(
        getAddRelationFromPoint(
          dx,
          dy,
          addRelationRef.current,
        ),
        childInsertionOnly,
        parentInsertionBlocked,
      );
      resetAddPointing();

      if (!disableCardInsertion && relation) {
        onCreateCard?.(relation, newCardBackgroundColor);
        return;
      }

      handleModeTap(dx, dy);
    },
    onPanResponderTerminate: () => {
      resetAddPointing();
    },
  }), [
    childInsertionOnly,
    disableCardInsertion,
    isSettingsPanelOpen,
    onAddHoldChange,
    onAddPreviewChange,
    onCreateCard,
    parentInsertionBlocked,
    onRootDoubleTap,
    onToggleMode,
    rootDoubleTapEnabled,
    newCardBackgroundColor,
  ]);

  function handleDeletePressIn() {
    onDeleteHoldChange?.(true);
  }

  function handleDeletePressOut() {
    onDeleteHoldChange?.(false);
  }

  function renderColorPicker(isInteractive = false) {
    return (
      <View
        accessibilityElementsHidden={!isInteractive}
        importantForAccessibility={isInteractive ? 'auto' : 'no-hide-descendants'}
        pointerEvents={isInteractive ? 'auto' : 'none'}
        style={styles.settingsColorPicker}
      >
        <Pressable
          accessibilityHint="Moves to the next card color"
          accessibilityLabel={`Switch to ${secondaryCardColor.label} card background`}
          accessibilityRole="button"
          onPress={() => onNewCardBackgroundColorChange?.(secondaryCardColor.color)}
          style={({ pressed }) => [
            styles.settingsColorCorner,
            styles.settingsColorCornerBottomRight,
            pressed && styles.settingsColorCornerPressed,
          ]}
        >
          <View
            pointerEvents="none"
            style={[
              styles.settingsColorCornerTriangle,
              styles.settingsColorTriangleBottomRight,
              { borderBottomColor: secondaryCardColor.color },
            ]}
          />
          <View pointerEvents="none" style={styles.settingsColorCutEdge} />
        </Pressable>
      </View>
    );
  }

  return (
    <>
      {shouldRenderDelete ? (
        <Animated.View
          pointerEvents={shouldShowDelete ? 'auto' : 'none'}
          style={[
            styles.deleteCardFloatingControl,
            {
              opacity: deleteSlideProgress,
              transform: [
                {
                  translateX: deleteSlideProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [84, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Pressable
            accessibilityHint="Hold until the circle completes to delete the current card"
            accessibilityLabel="Delete current card"
            accessibilityRole="button"
            delayLongPress={DELETE_HOLD_MS}
            onPressIn={handleDeletePressIn}
            onPressOut={handleDeletePressOut}
            style={({ pressed }) => [
              styles.deleteCardButton,
              pressed && styles.deleteCardButtonPressed,
            ]}
          >
            <Image
              pointerEvents="none"
              source={deleteTargetDone
                ? STAMP_ASSETS.void.doneCard
                : STAMP_ASSETS.void.default}
              style={styles.deleteStampIcon}
            />
          </Pressable>
        </Animated.View>
      ) : null}

      {isSettingsPanelOpen ? (
        <Pressable
          accessibilityLabel="Close settings panel"
          accessibilityRole="button"
          onPress={() => setIsSettingsPanelOpen(false)}
          style={styles.settingsPanelBackdrop}
        />
      ) : null}

      <Animated.View
        style={[
          styles.addFloatingControl,
          isSettingsPanelOpen && styles.settingsPanelFloatingControl,
          {
            transform: [
              {
                translateX: settingsPanelProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-180, -180 + settingsPanelOffsetX],
                }),
              },
              {
                translateY: settingsPanelProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, settingsPanelOffsetY],
                }),
              },
            ],
          },
        ]}
      >
        <View
          {...addPanResponder.panHandlers}
          accessibilityHint={rootDoubleTapEnabled
            ? 'Double tap to collapse all cards or expand non-treasure cards.'
            : 'Drag to insert a card. Double tap to toggle leaf or tree view.'}
          accessibilityLabel={rootDoubleTapEnabled
            ? 'Expand or collapse cards'
            : 'Insert card or toggle view'}
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
                  {
                    rotate: settingsPanelProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [`${addCardRotation}deg`, '0deg'],
                    }),
                  },
                ],
              },
            ]}
          >
            <Animated.View
              pointerEvents={layoutMode === 'leaf' ? 'box-none' : 'none'}
              style={[
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
              <View
                pointerEvents="none"
                style={[
                  styles.settingsSecondaryCard,
                  { backgroundColor: secondaryCardColor.color },
                ]}
              />
              <View
                style={[
                  styles.addCardButton,
                  { backgroundColor: newCardBackgroundColor },
                ]}
              >
                {renderColorPicker(isSettingsPanelOpen && layoutMode === 'leaf')}
              </View>
            </Animated.View>
            <Animated.View
              pointerEvents={layoutMode === 'tree' ? 'box-none' : 'none'}
              style={[
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
              <View
                pointerEvents="none"
                style={[
                  styles.settingsSecondaryCard,
                  { backgroundColor: secondaryCardColor.color },
                ]}
              />
              <View
                style={[
                  styles.addCardButton,
                  { backgroundColor: newCardBackgroundColor },
                ]}
              >
                {renderColorPicker(isSettingsPanelOpen && layoutMode === 'tree')}
              </View>
            </Animated.View>
          </Animated.View>
        </View>
      </Animated.View>
    </>
  );
}
