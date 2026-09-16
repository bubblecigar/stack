import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  Pressable,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image as CachedImage } from 'expo-image';
import {
  forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState,
} from 'react';
import { DoneStampArtwork } from './DoneStampArtwork';
import { constrainAddRelation } from '../lib/cardInsertion';
import {
  CARD_BACKGROUND_OPTIONS,
  DEFAULT_CARD_BACKGROUND_COLOR,
} from '../lib/cardBackground';
import { STAMP_ASSETS, STAMP_RENDER_SCALE } from '../config/stampAssets';
import { getCardImageSource } from '../lib/cardImageCache';
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
const DONE_STAMP_DRAG_THRESHOLD = 6;
const SETTINGS_PANEL_TRIGGER_Y = SCREEN_HEIGHT * 0.34;
const SETTINGS_PANEL_TRIGGER_DRAG_Y = -160;
const SETTINGS_PANEL_CENTER_OFFSET_X = 0;
const SETTINGS_PANEL_CENTER_OFFSET_Y = -(SCREEN_HEIGHT / 2 + 150);
const SETTINGS_PANEL_TOGGLE_DURATION_MS = 260;
const STAMP_SPIN_HALF_DURATION_MS = 150;
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

export const FloatingControls = forwardRef(function FloatingControls({
  layoutMode,
  audioEnabled = true,
  onToggleMode,
  onCreateCard,
  onAudioEnabledChange,
  onAddPreviewChange,
  onAddHoldChange,
  onDeleteHoldChange,
  newCardBackgroundColor = DEFAULT_CARD_BACKGROUND_COLOR,
  onNewCardBackgroundColorChange,
  onRootDoubleTap,
  onLogout,
  canDeleteCurrentCard = false,
  idleDoneStampEnabled = false,
  onIdleDoneStampDrop,
  deleteTargetDone = false,
  childInsertionOnly = false,
  parentInsertionBlocked = false,
  disableCardInsertion = false,
  rootDoubleTapEnabled = false,
  deckCard = null,
  deckCards = [],
  deckTreeSize = 0,
}, forwardedRef) {
  const shouldShowDelete = canDeleteCurrentCard;
  const activeStampSource = idleDoneStampEnabled
    ? STAMP_ASSETS.done
    : (deleteTargetDone ? STAMP_ASSETS.void.doneCard : STAMP_ASSETS.void.default);
  const [isAddPressed, setIsAddPressed] = useState(false);
  const [addCardRotation, setAddCardRotation] = useState(ADD_CARD_BASE_ROTATION);
  const [addCardOffsetX, setAddCardOffsetX] = useState(0);
  const [addCardOffsetY, setAddCardOffsetY] = useState(0);
  const [idleStampOffset, setIdleStampOffset] = useState({ x: 0, y: 0 });
  const [isIdleStampDragging, setIsIdleStampDragging] = useState(false);
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [settingsPanelOffsetX, setSettingsPanelOffsetX] = useState(0);
  const [settingsPanelOffsetY, setSettingsPanelOffsetY] = useState(0);
  const [displayedStampSource, setDisplayedStampSource] = useState(activeStampSource);
  const flipProgress = useRef(new Animated.Value(layoutMode === 'tree' ? 1 : 0)).current;
  const stampSpinProgress = useRef(new Animated.Value(0)).current;
  const displayedStampSourceRef = useRef(activeStampSource);
  const settingsPanelProgress = useRef(new Animated.Value(0)).current;
  const onIdleDoneStampDropRef = useRef(onIdleDoneStampDrop);
  const addRelationRef = useRef(null);
  const lastModeTapRef = useRef(0);
  const addStartRef = useRef({
    pageX: 0,
    pageY: 0,
  });
  const insertionCardRef = useRef(null);
  const selectedColorIndex = CARD_BACKGROUND_OPTIONS.findIndex(
    ({ color }) => color === newCardBackgroundColor,
  );
  const secondaryCardColor = CARD_BACKGROUND_OPTIONS[
    (selectedColorIndex + 1) % CARD_BACKGROUND_OPTIONS.length
  ];
  const heldPileColors = useMemo(() => {
    const layerCount = Math.min(Math.max(deckTreeSize - 1, 0), 2);
    if (layerCount === 0) {
      return [];
    }

    const descendantColors = deckCards
      .slice(1)
      .map((card) => card.backgroundColor || '#FFFFFF');
    const representativeColors = [...new Set(descendantColors)];

    descendantColors.forEach((color) => {
      if (representativeColors.length < layerCount) {
        representativeColors.push(color);
      }
    });

    while (representativeColors.length < layerCount) {
      representativeColors.push(deckCard?.backgroundColor || '#FFFFFF');
    }

    return representativeColors.slice(0, layerCount);
  }, [deckCard?.backgroundColor, deckCards, deckTreeSize]);

  useImperativeHandle(forwardedRef, () => ({
    measureInsertionCard: () => new Promise((resolve) => {
      if (!insertionCardRef.current?.measureInWindow) {
        resolve(null);
        return;
      }

      insertionCardRef.current.measureInWindow((x, y, width, height) => {
        resolve({ x, y, width, height });
      });
    }),
  }), []);

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
    if (displayedStampSourceRef.current === activeStampSource) {
      return undefined;
    }

    let cancelled = false;
    stampSpinProgress.stopAnimation();

    Animated.timing(stampSpinProgress, {
      toValue: 1,
      duration: STAMP_SPIN_HALF_DURATION_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished || cancelled) {
        return;
      }

      displayedStampSourceRef.current = activeStampSource;
      setDisplayedStampSource(activeStampSource);
      stampSpinProgress.setValue(-1);
      Animated.timing(stampSpinProgress, {
        toValue: 0,
        duration: STAMP_SPIN_HALF_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });

    return () => {
      cancelled = true;
      stampSpinProgress.stopAnimation();
    };
  }, [activeStampSource, stampSpinProgress]);

  onIdleDoneStampDropRef.current = onIdleDoneStampDrop;

  useEffect(() => {
    if (!shouldShowDelete) {
      onDeleteHoldChange?.(false);
    }
  }, [onDeleteHoldChange, shouldShowDelete]);

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

  function handleModeDoubleTap(dx, dy) {
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

      handleModeDoubleTap(dx, dy);
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

  const idleDoneStampPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      setIdleStampOffset({ x: 0, y: 0 });
      setIsIdleStampDragging(true);
    },
    onPanResponderMove: (_, gestureState) => {
      setIdleStampOffset({ x: gestureState.dx, y: gestureState.dy });
    },
    onPanResponderRelease: (event, gestureState) => {
      const dropX = typeof gestureState.moveX === 'number'
        ? gestureState.moveX
        : event.nativeEvent.pageX;
      const dropY = typeof gestureState.moveY === 'number'
        ? gestureState.moveY
        : event.nativeEvent.pageY;
      const didDrag = Math.hypot(gestureState.dx, gestureState.dy) >= DONE_STAMP_DRAG_THRESHOLD;

      setIdleStampOffset({ x: 0, y: 0 });
      setIsIdleStampDragging(false);

      if (didDrag && typeof dropX === 'number' && typeof dropY === 'number') {
        onIdleDoneStampDropRef.current?.(dropX, dropY);
      }
    },
    onPanResponderTerminate: () => {
      setIdleStampOffset({ x: 0, y: 0 });
      setIsIdleStampDragging(false);
    },
  }), []);

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

  function renderHeldInsertionCard() {
    if (!deckCard) {
      return null;
    }

    return (
      <View pointerEvents="none" style={styles.addHeldCardContent}>
        {deckCard.imageUri ? (
          <CachedImage
            cachePolicy="memory-disk"
            contentFit="cover"
            recyclingKey={deckCard.imageUri}
            source={getCardImageSource(deckCard.imageUri)}
            style={styles.addHeldCardImage}
          />
        ) : (
          <Text
            numberOfLines={8}
            style={[
              styles.addHeldCardText,
              deckCard.done && styles.addHeldCardTextDone,
            ]}
          >
            {deckCard.text}
          </Text>
        )}
        {deckCard.done ? (
          <DoneStampArtwork
            uri={deckCard.doneStampUri}
            style={styles.addHeldDoneStamp}
          />
        ) : null}
      </View>
    );
  }

  function renderHeldCardPile() {
    if (!deckCard || deckTreeSize <= 1) {
      return null;
    }

    return (
      <>
        <View
          pointerEvents="none"
          style={[
            styles.addHeldPileLayer,
            styles.addHeldPileLayerBack,
            { backgroundColor: heldPileColors[0] },
          ]}
        />
        {deckTreeSize > 2 ? (
          <View
            pointerEvents="none"
            style={[
              styles.addHeldPileLayer,
              styles.addHeldPileLayerMiddle,
              { backgroundColor: heldPileColors[1] },
            ]}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      {shouldShowDelete || idleDoneStampEnabled ? (
        <View
          style={[
            styles.deleteCardFloatingControl,
            idleDoneStampEnabled && {
              transform: [
                { translateX: idleStampOffset.x },
                { translateY: idleStampOffset.y },
              ],
            },
          ]}
        >
          {idleDoneStampEnabled ? (
            <View
              {...idleDoneStampPanResponder.panHandlers}
              accessibilityHint="Drag onto a card to toggle done"
              accessibilityLabel="Done stamp"
              accessibilityRole="button"
              style={[
                styles.deleteCardButton,
                isIdleStampDragging && styles.deleteCardButtonPressed,
              ]}
            >
              <Animated.Image
                pointerEvents="none"
                source={displayedStampSource}
                style={[
                  styles.deleteStampIcon,
                  {
                    transform: [
                      { perspective: 700 },
                      { rotate: '-8deg' },
                      {
                        rotateY: stampSpinProgress.interpolate({
                          inputRange: [-1, 0, 1],
                          outputRange: ['-90deg', '0deg', '90deg'],
                        }),
                      },
                      { scale: STAMP_RENDER_SCALE },
                    ],
                  },
                ]}
              />
            </View>
          ) : (
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
              <Animated.Image
                pointerEvents="none"
                source={displayedStampSource}
                style={[
                  styles.deleteStampIcon,
                  {
                    transform: [
                      { perspective: 700 },
                      { rotate: '-8deg' },
                      {
                        rotateY: stampSpinProgress.interpolate({
                          inputRange: [-1, 0, 1],
                          outputRange: ['-90deg', '0deg', '90deg'],
                        }),
                      },
                      { scale: STAMP_RENDER_SCALE },
                    ],
                  },
                ]}
              />
            </Pressable>
          )}
        </View>
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
          accessibilityHint={deckCard
            ? (rootDoubleTapEnabled
              ? 'Drag to explicitly insert the held tree. Double tap to collapse or expand the visible tree.'
              : 'Drag to explicitly insert the held tree. Double tap to switch view.')
            : (rootDoubleTapEnabled
              ? 'Double tap to collapse all cards or expand non-treasure cards.'
              : 'Drag to insert a card. Double tap to switch view.')}
          accessibilityLabel={deckCard
            ? (rootDoubleTapEnabled
              ? 'Insert held tree or expand or collapse cards'
              : 'Insert held tree or switch view')
            : (rootDoubleTapEnabled
              ? 'Expand or collapse cards'
              : 'Insert card or switch view')}
          accessibilityRole="button"
          style={[
            styles.addCardControl,
            isAddPressed && styles.addCardControlPressed,
          ]}
        >
          <Animated.View
            ref={insertionCardRef}
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
              {deckCard ? renderHeldCardPile() : (
                <View
                  pointerEvents="none"
                  style={[
                    styles.settingsSecondaryCard,
                    { backgroundColor: secondaryCardColor.color },
                  ]}
                />
              )}
              <View
                style={[
                  styles.addCardButton,
                  {
                    backgroundColor: deckCard
                      ? (deckCard.backgroundColor || '#FFFFFF')
                      : newCardBackgroundColor,
                  },
                ]}
              >
                {deckCard
                  ? renderHeldInsertionCard()
                  : renderColorPicker(isSettingsPanelOpen && layoutMode === 'leaf')}
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
              {deckCard ? renderHeldCardPile() : (
                <View
                  pointerEvents="none"
                  style={[
                    styles.settingsSecondaryCard,
                    { backgroundColor: secondaryCardColor.color },
                  ]}
                />
              )}
              <View
                style={[
                  styles.addCardButton,
                  {
                    backgroundColor: deckCard
                      ? (deckCard.backgroundColor || '#FFFFFF')
                      : newCardBackgroundColor,
                  },
                ]}
              >
                {deckCard
                  ? renderHeldInsertionCard()
                  : renderColorPicker(isSettingsPanelOpen && layoutMode === 'tree')}
              </View>
            </Animated.View>
            <View pointerEvents="box-none" style={styles.settingsPanelContent}>
              <View style={styles.settingsPanelAudioRow}>
                <Pressable
                  accessibilityLabel="Log out"
                  accessibilityRole="button"
                  onPress={onLogout}
                  style={({ pressed }) => [
                    styles.settingsIconButton,
                    pressed && styles.settingsIconButtonPressed,
                  ]}
                >
                  <MaterialCommunityIcons color="#6B7280" name="logout" size={20} />
                </Pressable>
                <Pressable
                  accessibilityLabel={audioEnabled ? 'Turn audio off' : 'Turn audio on'}
                  accessibilityRole="button"
                  onPress={() => onAudioEnabledChange?.(!audioEnabled)}
                  style={({ pressed }) => [
                    styles.settingsIconButton,
                    pressed && styles.settingsIconButtonPressed,
                  ]}
                >
                  <MaterialCommunityIcons
                    color="#6B7280"
                    name={audioEnabled ? 'volume-high' : 'volume-off'}
                    size={20}
                  />
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </View>
      </Animated.View>
    </>
  );
});
