import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  PanResponder,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import { constrainAddRelation } from '../lib/cardInsertion';
import {
  MATH_KEYBOARD_GRID_COLUMNS,
  MATH_KEYBOARD_GRID_ROWS,
} from '../lib/mathKeyboardConfig';
import { styles } from '../styles/appStyles';

const voidStampImage = require('../../assets/card/void_stamp_gray.png');

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
const SETTINGS_PANEL_CENTER_OFFSET_Y = -(SCREEN_HEIGHT / 2 + 70);
const SETTINGS_PANEL_TOGGLE_DURATION_MS = 260;
const MATH_KEYBOARD_DRAG_THRESHOLD = 8;
const SYSTEM_CARD_EXPLANATIONS = {
  mission: {
    body: 'Print these cards to your card list. Use them to give your day a clear direction and a simple place to begin.',
    title: 'Printer',
  },
  treasure: {
    body: 'All ideas are treasures.\nWrite them down, think and drop.',
    title: 'Treasure',
  },
};
const SYSTEM_MATH_KEY_ICONS = {
  delete: 'backspace-outline',
  newline: 'keyboard-return',
  space: 'keyboard-space',
};

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

function padTimePart(value) {
  return String(value).padStart(2, '0');
}

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function formatControlDate(date) {
  return `${date.getFullYear()} ${MONTH_LABELS[date.getMonth()]} ${date.getDate()}`;
}

function formatControlTime(date) {
  return [
    padTimePart(date.getHours()),
    padTimePart(date.getMinutes()),
    padTimePart(date.getSeconds()),
  ].join(' : ');
}

function getCalendarDays(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dayCells = Array.from(
    { length: daysInMonth },
    (_, dayIndex) => ({ day: dayIndex + 1, isBlank: false }),
  );
  const leadingBlankCells = Array.from(
    { length: firstWeekday },
    (_, blankIndex) => ({ day: `leading-${blankIndex}`, isBlank: true }),
  );
  const cells = [...leadingBlankCells, ...dayCells];
  const trailingBlankCount = Math.max(42 - cells.length, 0);
  const trailingBlankCells = Array.from(
    { length: trailingBlankCount },
    (_, blankIndex) => ({ day: `trailing-${blankIndex}`, isBlank: true }),
  );

  return [...cells, ...trailingBlankCells];
}

function getMathKeyboardDraftValues(keys) {
  return (Array.isArray(keys) ? keys : []).map((key) => key?.label || '');
}

export function FloatingControls({
  layoutMode,
  user = null,
  audioEnabled = true,
  mathKeyboardKeys = [],
  onToggleMode,
  onCreateCard,
  onAudioEnabledChange,
  onAddPreviewChange,
  onAddHoldChange,
  onDeleteHoldChange,
  onLogout,
  onMoveMathKeyboardKey,
  onUpdateMathKeyboardKey,
  canDeleteCurrentCard = false,
  childInsertionOnly = false,
  disableCardInsertion = false,
  focusedSystemCardType = null,
}) {
  const shouldShowDelete = canDeleteCurrentCard;
  const systemCardExplanation = SYSTEM_CARD_EXPLANATIONS[focusedSystemCardType] ?? null;
  const [isAddPressed, setIsAddPressed] = useState(false);
  const [addCardRotation, setAddCardRotation] = useState(ADD_CARD_BASE_ROTATION);
  const [addCardOffsetX, setAddCardOffsetX] = useState(0);
  const [addCardOffsetY, setAddCardOffsetY] = useState(0);
  const [shouldRenderDelete, setShouldRenderDelete] = useState(shouldShowDelete);
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [settingsPanelOffsetX, setSettingsPanelOffsetX] = useState(0);
  const [settingsPanelOffsetY, setSettingsPanelOffsetY] = useState(0);
  const [mathKeyboardDraftValues, setMathKeyboardDraftValues] = useState(
    () => getMathKeyboardDraftValues(mathKeyboardKeys),
  );
  const [mathKeyboardDragState, setMathKeyboardDragState] = useState({
    sourceIndex: null,
    targetIndex: null,
  });
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const flipProgress = useRef(new Animated.Value(layoutMode === 'tree' ? 1 : 0)).current;
  const deleteSlideProgress = useRef(new Animated.Value(shouldShowDelete ? 1 : 0)).current;
  const settingsPanelProgress = useRef(new Animated.Value(0)).current;
  const addRelationRef = useRef(null);
  const lastModeTapRef = useRef(0);
  const addStartRef = useRef({
    pageX: 0,
    pageY: 0,
  });
  const mathKeyboardGridRef = useRef(null);
  const mathKeyboardGridLayoutRef = useRef({
    height: 0,
    pageX: 0,
    pageY: 0,
    width: 0,
  });
  const mathKeyboardDragSourceIndexRef = useRef(null);
  const mathKeyboardDragStartRef = useRef({
    pageX: 0,
    pageY: 0,
  });
  const mathKeyboardInputRefs = useRef([]);

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
    setMathKeyboardDraftValues(getMathKeyboardDraftValues(mathKeyboardKeys));
  }, [mathKeyboardKeys]);

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

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

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
      onToggleMode?.();
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

  function closeSettingsPanel() {
    setIsSettingsPanelOpen(false);
  }

  const userLabel = user?.email || 'Unknown user';
  const controlDateLabel = formatControlDate(currentTime);
  const controlTimeLabel = formatControlTime(currentTime);
  const calendarDays = getCalendarDays(currentTime);
  const currentDay = currentTime.getDate();

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
      );
      resetAddPointing();

      if (!disableCardInsertion && relation) {
        onCreateCard?.(relation);
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
    onToggleMode,
  ]);

  function handleDeletePressIn() {
    onDeleteHoldChange?.(true);
  }

  function handleDeletePressOut() {
    onDeleteHoldChange?.(false);
  }

  function handleLogoutPress() {
    Alert.alert(
      'Log out?',
      'You will need to sign in again to access your cards.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Continue',
          onPress: () => {
            Alert.alert(
              'Confirm logout',
              'Are you sure you want to log out?',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
                {
                  text: 'Log out',
                  style: 'destructive',
                  onPress: () => onLogout?.(),
                },
              ],
            );
          },
        },
      ],
    );
  }

  function renderMathKeyboardConfig() {
    function updateGridLayoutFromRef() {
      mathKeyboardGridRef.current?.measureInWindow?.((pageX, pageY, width, height) => {
        mathKeyboardGridLayoutRef.current = {
          height,
          pageX,
          pageY,
          width,
        };
      });
    }

    function getMathKeyboardSlotIndexFromPoint(pageX, pageY) {
      const layout = mathKeyboardGridLayoutRef.current;
      if (
        !layout.width
        || !layout.height
        || pageX < layout.pageX
        || pageX > layout.pageX + layout.width
        || pageY < layout.pageY
        || pageY > layout.pageY + layout.height
      ) {
        return null;
      }

      const column = clamp(
        Math.floor(((pageX - layout.pageX) / layout.width) * MATH_KEYBOARD_GRID_COLUMNS),
        0,
        MATH_KEYBOARD_GRID_COLUMNS - 1,
      );
      const row = clamp(
        Math.floor(((pageY - layout.pageY) / layout.height) * MATH_KEYBOARD_GRID_ROWS),
        0,
        MATH_KEYBOARD_GRID_ROWS - 1,
      );

      return (row * MATH_KEYBOARD_GRID_COLUMNS) + column;
    }

    function canDragMathKeyboardKey(key) {
      return !key?.isReserved;
    }

    function handleMathKeyboardKeyDragStart(event, keyIndex) {
      mathKeyboardDragSourceIndexRef.current = keyIndex;
      mathKeyboardDragStartRef.current = {
        pageX: event.nativeEvent.pageX,
        pageY: event.nativeEvent.pageY,
      };
      setMathKeyboardDragState({
        sourceIndex: keyIndex,
        targetIndex: keyIndex,
      });
      updateGridLayoutFromRef();
    }

    function handleMathKeyboardKeyDragMove(event) {
      const sourceIndex = mathKeyboardDragSourceIndexRef.current;
      if (sourceIndex === null) {
        return;
      }

      const targetIndex = getMathKeyboardSlotIndexFromPoint(
        event.nativeEvent.pageX,
        event.nativeEvent.pageY,
      );
      const targetKey = targetIndex === null
        ? null
        : mathKeyboardKeys[targetIndex];
      const nextTargetIndex = targetIndex !== null && !targetKey?.isReserved
        ? targetIndex
        : null;

      setMathKeyboardDragState((currentState) => (
        currentState.sourceIndex === sourceIndex
        && currentState.targetIndex === nextTargetIndex
          ? currentState
          : {
            sourceIndex,
            targetIndex: nextTargetIndex,
          }
      ));
    }

    function handleMathKeyboardKeyDragRelease(event) {
      const sourceIndex = mathKeyboardDragSourceIndexRef.current;
      mathKeyboardDragSourceIndexRef.current = null;
      setMathKeyboardDragState({
        sourceIndex: null,
        targetIndex: null,
      });

      if (sourceIndex === null) {
        return;
      }

      const dragDistance = Math.hypot(
        event.nativeEvent.pageX - mathKeyboardDragStartRef.current.pageX,
        event.nativeEvent.pageY - mathKeyboardDragStartRef.current.pageY,
      );
      const sourceKey = mathKeyboardKeys[sourceIndex];

      if (dragDistance < MATH_KEYBOARD_DRAG_THRESHOLD) {
        if (!sourceKey?.isSystem && !sourceKey?.isReserved) {
          mathKeyboardInputRefs.current[sourceIndex]?.focus?.();
        }
        return;
      }

      const targetIndex = getMathKeyboardSlotIndexFromPoint(
        event.nativeEvent.pageX,
        event.nativeEvent.pageY,
      );

      if (targetIndex === null) {
        return;
      }

      onMoveMathKeyboardKey?.(sourceIndex, targetIndex);
    }

    function updateDraftKey(keyIndex, nextValue) {
      setMathKeyboardDraftValues((currentValues) => {
        const nextValues = [...currentValues];
        nextValues[keyIndex] = nextValue;
        return nextValues;
      });
    }

    function commitDraftKey(keyIndex) {
      onUpdateMathKeyboardKey?.(
        keyIndex,
        mathKeyboardDraftValues[keyIndex] ?? '',
      );
    }

    return (
      <View
        onStartShouldSetResponder={() => true}
        style={styles.addCardMathKeyboardConfig}
      >
        <View
          onLayout={updateGridLayoutFromRef}
          ref={mathKeyboardGridRef}
          style={styles.addCardMathKeyboardGrid}
        >
          {mathKeyboardKeys.map((key, keyIndex) => (
            <View
              key={`math-keyboard-config-slot-${keyIndex}`}
              style={[
                styles.addCardMathKeyboardKey,
                key.isEmpty && styles.addCardMathKeyboardEmptyKey,
                key.isReserved && styles.addCardMathKeyboardReservedKey,
                key.isSystem && styles.addCardMathKeyboardSystemKey,
                mathKeyboardDragState.targetIndex === keyIndex
                  && mathKeyboardDragState.sourceIndex !== keyIndex
                  && styles.addCardMathKeyboardDropTargetKey,
                mathKeyboardDragState.sourceIndex === keyIndex
                  && styles.addCardMathKeyboardDraggingKey,
              ]}
              onResponderGrant={(event) => handleMathKeyboardKeyDragStart(event, keyIndex)}
              onResponderMove={handleMathKeyboardKeyDragMove}
              onResponderRelease={handleMathKeyboardKeyDragRelease}
              onResponderTerminationRequest={() => false}
              onResponderTerminate={() => {
                mathKeyboardDragSourceIndexRef.current = null;
                setMathKeyboardDragState({
                  sourceIndex: null,
                  targetIndex: null,
                });
              }}
              onStartShouldSetResponder={() => canDragMathKeyboardKey(key)}
            >
              {key.isReserved ? null : key.isSystem ? (
                <MaterialCommunityIcons
                  color="#94A3B8"
                  name={SYSTEM_MATH_KEY_ICONS[key.systemKeyId]}
                  size={16}
                />
              ) : (
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  numberOfLines={1}
                  onBlur={() => commitDraftKey(keyIndex)}
                  onChangeText={(nextValue) => updateDraftKey(keyIndex, nextValue)}
                  onSubmitEditing={() => commitDraftKey(keyIndex)}
                  pointerEvents="none"
                  ref={(inputRef) => {
                    mathKeyboardInputRefs.current[keyIndex] = inputRef;
                  }}
                  returnKeyType="done"
                  selectTextOnFocus
                  style={[
                    styles.addCardMathKeyboardKeyInput,
                    key.isEmpty && styles.addCardMathKeyboardEmptyKeyInput,
                  ]}
                  value={mathKeyboardDraftValues[keyIndex] ?? key.label}
                />
              )}
            </View>
          ))}
        </View>
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
              source={voidStampImage}
              style={styles.deleteStampIcon}
            />
          </Pressable>
        </Animated.View>
      ) : null}

      {isSettingsPanelOpen ? (
        <Pressable
          accessibilityLabel="Close settings panel"
          accessibilityRole="button"
          onPress={closeSettingsPanel}
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
              <View
                pointerEvents="none"
                style={styles.addCardCalendarSurface}
              >
                <View style={styles.addCardCalendarBinding} />
                <View style={styles.addCardCalendarRingRow}>
                  <View style={styles.addCardCalendarRing} />
                  <View style={styles.addCardCalendarRing} />
                </View>
              </View>
              {systemCardExplanation ? (
                <View
                  pointerEvents="none"
                  style={styles.addCardSystemExplanation}
                >
                  <Text style={styles.addCardSystemExplanationTitle}>
                    {systemCardExplanation.title}
                  </Text>
                  <Text style={styles.addCardSystemExplanationBody}>
                    {systemCardExplanation.body}
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.addCardButtonChrono}>
                    <Text style={styles.addCardButtonChronoText}>
                      {controlTimeLabel}
                    </Text>
                  </View>
                  {renderMathKeyboardConfig()}
                </>
              )}
            </Animated.View>
            <Animated.View
              pointerEvents={layoutMode === 'tree' ? 'box-none' : 'none'}
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
              <View
                pointerEvents="none"
                style={styles.addCardCalendarSurface}
              >
                <View style={styles.addCardCalendarBinding} />
                <View style={styles.addCardCalendarRingRow}>
                  <View style={styles.addCardCalendarRing} />
                  <View style={styles.addCardCalendarRing} />
                </View>
              </View>
              {systemCardExplanation ? (
                <View
                  pointerEvents="none"
                  style={styles.addCardSystemExplanation}
                >
                  <Text style={styles.addCardSystemExplanationTitle}>
                    {systemCardExplanation.title}
                  </Text>
                  <Text style={styles.addCardSystemExplanationBody}>
                    {systemCardExplanation.body}
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.addCardButtonChrono}>
                    <Text style={styles.addCardButtonChronoText}>
                      {controlDateLabel}
                    </Text>
                  </View>
                  <View
                    pointerEvents="none"
                    style={styles.addCardCalendarGrid}
                  >
                    {calendarDays.map((cell) => (
                      <View
                        key={`calendar-day-${cell.day}`}
                        style={[
                          styles.addCardCalendarDateSquare,
                          cell.isBlank && styles.addCardCalendarDateSquareBlank,
                          cell.day === currentDay && styles.addCardCalendarDateSquareToday,
                        ]}
                      />
                    ))}
                  </View>
                </>
              )}
            </Animated.View>
            <View
              pointerEvents="box-none"
              style={styles.settingsPanelContent}
            >
              <Text
                numberOfLines={1}
                pointerEvents="none"
                style={styles.settingsPanelUserName}
              >
                {userLabel}
              </Text>

              <View style={styles.settingsPanelAudioRow}>
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
                    color="#CBD5E1"
                    name={audioEnabled ? 'volume-high' : 'volume-off'}
                    size={24}
                  />
                </Pressable>
                <Pressable
                  accessibilityLabel="Log out"
                  accessibilityRole="button"
                  onPress={handleLogoutPress}
                  style={({ pressed }) => [
                    styles.settingsIconButton,
                    pressed && styles.settingsIconButtonPressed,
                  ]}
                >
                  <MaterialCommunityIcons
                    color="#CBD5E1"
                    name="logout"
                    size={24}
                  />
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </View>
      </Animated.View>
    </>
  );
}
