import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import AntDesign from '@expo/vector-icons/AntDesign';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useRef } from 'react';
import { DeleteHoldIndicator } from './DeleteHoldIndicator';
import { styles } from '../styles/appStyles';

const doneStampImage = require('../../assets/card/done_stamp_gray.png');

export function StackCard({
  card,
  visibleIndex,
  layout,
  editingIndex,
  editingValue,
  suppressEditingKeyboard = false,
  editingKeyboardOpenRequest = 0,
  focusedCardIndex,
  focusedCardId = null,
  isLeafTopCard = false,
  hideControls = false,
  treePosition,
  isCollapsedStacked = false,
  isArchivedRoot = false,
  isMissionRoot = false,
  isRootCard = false,
  isMissionCard = false,
  isTreasureCard = false,
  onPress,
  onPressIn,
  onCreateEdit,
  onAdoptMissionRoot,
  onArchiveRootTree,
  onRestoreRootTree,
  onDeleteCard,
  onDeleteHoldComplete,
  onEditingValueChange,
  onEditingSelectionChange,
  onCompleteEdit,
  onFocusCard,
  editingSelection,
  isDeleteHoldActive = false,
  isPreviewCard = false,
  leafContentMode = 'text',
  collapsedNodeIds = new Set(),
}) {
  const {
    id,
    index,
    done = false,
    text,
  } = card;

  const isLeafCard = layout === 'leaf';
  const isTreeCard = layout === 'tree';
  const isMission = isMissionCard || Boolean(card?.isMissionCard);
  const isTreasure = isTreasureCard || Boolean(card?.isTreasureCard);
  const isSystem = isMission || isTreasure;
  const SystemCardIcon = isMission ? AntDesign : MaterialCommunityIcons;
  const systemCardIconName = isMission ? 'printer' : 'treasure-chest-outline';
  const isMissionRootCard = isMissionRoot || Boolean(card?.isMissionRoot);
  const isEditing = editingIndex === index;
  const isFocusedCard = (
    isLeafCard
      ? isLeafTopCard
      : (focusedCardId != null
        ? focusedCardId === id
        : focusedCardIndex === index)
  );
  const shouldShowControls = !hideControls && isFocusedCard;
  const shouldShowEdit = isFocusedCard && !isSystem;
  const shouldShowAdoptMission = (
    shouldShowControls
    && isTreeCard
    && isMissionRootCard
    && !isEditing
  );
  const shouldShowArchive = (
    shouldShowControls
    && isTreeCard
    && (isRootCard || isArchivedRoot)
    && !isSystem
    && !isEditing
  );
  const isTreeDeleteHoldActive = isTreeCard && isDeleteHoldActive;
  const isDeleteProgressVisible = isTreeDeleteHoldActive && isFocusedCard;
  const editButtonColor = isTreeDeleteHoldActive
    ? '#DC2626'
    : (isTreeCard ? '#0EA5E9' : '#0F172A');
  const editButtonPressedColor = isTreeDeleteHoldActive
    ? '#B91C1C'
    : (isTreeCard ? '#0284C7' : '#2563EB');
  const treasureIconSize = isLeafCard ? 40 : 30;
  const canShowDoneStamp = done && !isSystem;
  const shouldShowCollapsedCornerLine = (
    isTreeCard
    && !isCollapsedStacked
    && !isPreviewCard
    && collapsedNodeIds?.has?.(id)
  );

  const treeStackLayer = treePosition
    ? (
      9000
      - ((treePosition.depth ?? 0) * 80)
      - (treePosition.placementOrder ?? 0)
    )
    : -1;

  const zLayer = isTreeCard
    ? (isFocusedCard ? 12000 : treeStackLayer)
    : null;

  const dependencyText = '';
  const editingInputRef = useRef(null);
  const placeholderPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isLeafCard || leafContentMode !== 'placeholder') {
      placeholderPulse.setValue(0);
      return undefined;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(placeholderPulse, {
          toValue: 1,
          duration: 520,
          useNativeDriver: true,
        }),
        Animated.timing(placeholderPulse, {
          toValue: 0,
          duration: 520,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [
    isLeafCard,
    leafContentMode,
    placeholderPulse,
  ]);

  const placeholderOpacity = placeholderPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.18, 1],
  });

  useEffect(() => {
    if (!isEditing || suppressEditingKeyboard) {
      return;
    }

    editingInputRef.current?.focus?.();
  }, [
    editingKeyboardOpenRequest,
    isEditing,
    suppressEditingKeyboard,
  ]);

  function handleControlPressIn(event) {
    event?.stopPropagation?.();
    onPressIn?.();
  }

  function handleControlPress(event, action) {
    event?.stopPropagation?.();
    action?.();
  }

  const editingInput = (
    <TextInput
      ref={editingInputRef}
      onFocus={() => {
        onFocusCard?.(index);
        onPressIn?.();
      }}
      onTouchStart={() => {
        onPressIn?.();
      }}
      autoCapitalize="sentences"
      autoCorrect
      autoFocus
      multiline
      returnKeyType="done"
      scrollEnabled={isLeafCard}
      showSoftInputOnFocus={!suppressEditingKeyboard}
      onChangeText={onEditingValueChange}
      onSelectionChange={(event) => {
        onEditingSelectionChange?.(event.nativeEvent.selection);
      }}
      onEndEditing={(event) => {
        onCompleteEdit?.(index, event.nativeEvent.text);
      }}
      onSubmitEditing={(event) => {
        onCompleteEdit?.(index, event.nativeEvent.text);
      }}
      style={[
        styles.cardInput,
        isLeafCard && styles.leafCardInput,
        isTreeCard && styles.treeCardInput,
      ]}
      selection={editingSelection || undefined}
      submitBehavior="submit"
      value={editingValue}
    />
  );

  return (
    <Pressable
      disabled={isLeafCard || isPreviewCard}
      onPressIn={onPressIn}
      onPress={onPress}
      style={[
        styles.card,
        isLeafCard && styles.leafCard,
        isTreeCard && styles.treeCard,
        isTreeCard && isSystem && styles.treasureCard,
        isLeafCard && isSystem && styles.leafTreasureCard,
        isTreeCard && isPreviewCard && styles.treePreviewCard,
        isTreeCard && isCollapsedStacked && styles.treeCollapsedCard,
        isEditing && isLeafCard && styles.leafEditingCard,
        isTreeCard && treePosition && {
          left: treePosition.left,
          top: treePosition.top,
          position: 'absolute',
        },
        isFocusedCard && !isLeafCard && styles.focusedCard,
        isFocusedCard && isSystem && styles.focusedTreasureCard,
        isDeleteProgressVisible && styles.deleteFocusedCard,
        zLayer != null ? { zIndex: zLayer } : null,
      ]}
    >
      {shouldShowCollapsedCornerLine ? (
        <View
          pointerEvents="none"
          style={[
            styles.treeCollapsedCornerLine,
            isSystem && styles.treasureTreeCollapsedCornerLine,
            isFocusedCard && styles.focusedTreeCollapsedCornerLine,
            isFocusedCard && isSystem && styles.focusedTreasureTreeCollapsedCornerLine,
            isDeleteProgressVisible && styles.deleteTreeCollapsedCornerLine,
          ]}
        />
      ) : null}

      {(isTreeCard || isLeafCard) && isFocusedCard ? (
        <DeleteHoldIndicator
          active={isDeleteHoldActive}
          variant={isTreeCard ? 'treeCardFill' : 'cardFill'}
          onComplete={() => {
            onDeleteHoldComplete?.(index);
          }}
        />
      ) : null}

      <View style={[
        styles.cardControls,
        isTreeCard && styles.treeCardControls,
      ]}
      >
        {shouldShowAdoptMission && (
          <Pressable
            accessibilityLabel="Adopt mission"
            accessibilityRole="button"
            onPressIn={handleControlPressIn}
            onPress={(event) => handleControlPress(event, () => {
              onAdoptMissionRoot?.(id);
            })}
            style={({ pressed }) => [
              styles.iconButton,
              styles.archiveButton,
              pressed && styles.archiveButtonPressed,
            ]}
          >
            <MaterialCommunityIcons
              color="#FFFFFF"
              name="flag-plus-outline"
              size={18}
            />
          </Pressable>
        )}

        {shouldShowArchive && (
          <Pressable
            accessibilityLabel={isArchivedRoot ? 'Restore tree' : 'Archive tree'}
            accessibilityRole="button"
            onPressIn={handleControlPressIn}
            onPress={(event) => handleControlPress(event, () => {
              if (isArchivedRoot) {
                onRestoreRootTree?.(id);
                return;
              }

              onArchiveRootTree?.(id);
            })}
            style={({ pressed }) => [
              styles.iconButton,
              styles.archiveButton,
              pressed && styles.archiveButtonPressed,
            ]}
          >
            <MaterialCommunityIcons
              color="#FFFFFF"
              name={isArchivedRoot ? 'archive-arrow-up-outline' : 'treasure-chest-outline'}
              size={18}
            />
          </Pressable>
        )}

        {shouldShowControls && shouldShowEdit && (
          <Pressable
            accessibilityLabel={isEditing ? 'Confirm card' : 'Edit card'}
            accessibilityRole="button"
            onPressIn={handleControlPressIn}
            onPress={(event) => handleControlPress(event, () => {
              if (isEditing) {
                onCompleteEdit?.(index, editingValue);
                return;
              }

              onCreateEdit(index, text);
            })}
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: pressed ? editButtonPressedColor : editButtonColor,
              },
            ]}
          >
            {isEditing ? (
              <Text style={styles.iconButtonText}>✓</Text>
            ) : (
              <MaterialCommunityIcons color="#FFFFFF" name="pencil" size={18} />
            )}
          </Pressable>
        )}

        {shouldShowControls && !isTreeCard && (
          <Pressable
            accessibilityLabel="Delete card"
            accessibilityRole="button"
            onPressIn={handleControlPressIn}
            onPress={(event) => handleControlPress(event, () => {
              onDeleteCard?.(index);
            })}
            style={({ pressed }) => [
              styles.iconButton,
              styles.dangerButton,
              pressed && styles.dangerButtonPressed,
            ]}
          >
            <Text style={styles.iconButtonText}>⌫</Text>
          </Pressable>
        )}

      </View>

      {isEditing ? (
        isLeafCard ? (
          <View style={styles.leafContentSurface}>
            <View style={styles.leafContentLayer}>
              {editingInput}
            </View>
          </View>
        ) : (
          <Animated.View style={styles.cardInputWrap}>
            {editingInput}
          </Animated.View>
        )
      ) : (
        isLeafCard ? (
          <View style={styles.leafContentSurface}>
            {isSystem ? (
              <View style={[
                styles.leafContentLayer,
                styles.leafTreasureContent,
              ]}
              >
                <View style={[
                  styles.treasureCardIconWrap,
                  styles.leafTreasureIconWrap,
                ]}
                >
                  <SystemCardIcon
                    color="#F8FAFC"
                    name={systemCardIconName}
                    size={treasureIconSize}
                    style={styles.treasureCardIconHighlight}
                  />
                  <SystemCardIcon
                    color="#6B7280"
                    name={systemCardIconName}
                    size={treasureIconSize}
                    style={styles.treasureCardIconShadow}
                  />
                  <SystemCardIcon
                    color="#9CA3AF"
                    name={systemCardIconName}
                    size={treasureIconSize}
                  />
                </View>
              </View>
            ) : leafContentMode === 'placeholder' ? (
              <View
                pointerEvents="none"
                style={[
                  styles.leafContentLayer,
                  styles.leafPlaceholder,
                ]}
              >
                <Animated.View
                  style={[
                    styles.leafPlaceholderBar,
                    {
                      opacity: placeholderOpacity,
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.leafPlaceholderBar,
                    {
                      opacity: placeholderOpacity,
                      width: '74%',
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.leafPlaceholderBar,
                    {
                      opacity: placeholderOpacity,
                      width: '58%',
                    },
                  ]}
                />
              </View>
            ) : leafContentMode === 'text' ? (
              <View style={styles.leafContentLayer}>
                <ScrollView
                  contentContainerStyle={styles.leafContentScrollContent}
                  showsVerticalScrollIndicator={false}
                  style={styles.leafContentScroll}
                >
                  <Text style={[
                    styles.cardText,
                    done && styles.doneCardText,
                    !text && styles.emptyCardText,
                  ]}
                  >
                    {text}
                  </Text>
                </ScrollView>
              </View>
            ) : null}
            {canShowDoneStamp ? (
              <Image
                pointerEvents="none"
                source={doneStampImage}
                style={styles.leafDoneStampOverlay}
              />
            ) : null}
          </View>
        ) : (
          <Animated.View style={{ opacity: 1 }}>
            {isSystem ? (
              <View style={styles.treasureCardIconWrap}>
                <SystemCardIcon
                  color="#F8FAFC"
                  name={systemCardIconName}
                  size={30}
                  style={styles.treasureCardIconHighlight}
                />
                <SystemCardIcon
                  color="#6B7280"
                  name={systemCardIconName}
                  size={30}
                  style={styles.treasureCardIconShadow}
                />
                <SystemCardIcon
                  color="#9CA3AF"
                  name={systemCardIconName}
                  size={30}
                />
              </View>
            ) : (
              <Text style={[
                styles.cardText,
                isTreeCard && styles.treeCardText,
                isTreeCard && isPreviewCard && styles.treePreviewCardText,
                done && styles.doneCardText,
                !text && styles.emptyCardText,
              ]}
              >
                {text}
              </Text>
            )}
            {done ? (
              <Image
                pointerEvents="none"
                source={doneStampImage}
                style={styles.treeDoneStampOverlay}
              />
            ) : null}
          </Animated.View>
        )
      )}

      <View style={[
        styles.dependencyBar,
        isTreeCard && styles.treeDependencyBar,
        isSystem && styles.hiddenDependencyBar,
      ]}
      >
        <Text style={[
          styles.dependencyText,
          isTreeCard && styles.treeDependencyText,
        ]}
        >
          {dependencyText}
        </Text>
      </View>
    </Pressable>
  );
}
