import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
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
  focusedCardIndex,
  focusedCardId = null,
  isLeafTopCard = false,
  hideControls = false,
  treePosition,
  isCollapsedStacked = false,
  isArchivedRoot = false,
  isRootCard = false,
  isTreasureCard = false,
  onPress,
  onPressIn,
  onCreateEdit,
  onArchiveRootTree,
  onRestoreRootTree,
  onDeleteCard,
  onDeleteHoldComplete,
  onEditingValueChange,
  onCompleteEdit,
  onFocusCard,
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
  const isTreasure = isTreasureCard || Boolean(card?.isTreasureCard);
  const isEditing = editingIndex === index;
  const isFocusedCard = (
    isLeafCard
      ? isLeafTopCard
      : (focusedCardId != null
        ? focusedCardId === id
        : focusedCardIndex === index)
  );
  const shouldShowControls = !hideControls && isFocusedCard;
  const shouldShowEdit = isFocusedCard && !isTreasure;
  const shouldShowArchive = (
    shouldShowControls
    && isTreeCard
    && (isRootCard || isArchivedRoot)
    && !isTreasure
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
  const canShowDoneStamp = done && !isTreasure;
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
  const treasureMessage = `Every thought is a treasure
keep and explore
think and drop`;

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
      onChangeText={onEditingValueChange}
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
        isTreeCard && isTreasure && styles.treasureCard,
        isLeafCard && isTreasure && styles.leafTreasureCard,
        isTreeCard && isPreviewCard && styles.treePreviewCard,
        isTreeCard && isCollapsedStacked && styles.treeCollapsedCard,
        isEditing && isLeafCard && styles.leafEditingCard,
        isTreeCard && treePosition && {
          left: treePosition.left,
          top: treePosition.top,
          position: 'absolute',
        },
        isFocusedCard && !isLeafCard && styles.focusedCard,
        isFocusedCard && isTreasure && styles.focusedTreasureCard,
        isDeleteProgressVisible && styles.deleteFocusedCard,
        zLayer != null ? { zIndex: zLayer } : null,
      ]}
    >
      {shouldShowCollapsedCornerLine ? (
        <View
          pointerEvents="none"
          style={[
            styles.treeCollapsedCornerLine,
            isTreasure && styles.treasureTreeCollapsedCornerLine,
            isFocusedCard && styles.focusedTreeCollapsedCornerLine,
            isFocusedCard && isTreasure && styles.focusedTreasureTreeCollapsedCornerLine,
            isDeleteProgressVisible && styles.deleteTreeCollapsedCornerLine,
          ]}
        />
      ) : null}

      <View style={[
        styles.cardControls,
        isTreeCard && styles.treeCardControls,
      ]}
      >
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

      {isTreeCard && isFocusedCard ? (
        <DeleteHoldIndicator
          active={isDeleteHoldActive}
          onComplete={() => {
            onDeleteHoldComplete?.(index);
          }}
        />
      ) : null}

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
            {isTreasure ? (
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
                  <MaterialCommunityIcons
                    color="#F8FAFC"
                    name="treasure-chest-outline"
                    size={treasureIconSize}
                    style={styles.treasureCardIconHighlight}
                  />
                  <MaterialCommunityIcons
                    color="#6B7280"
                    name="treasure-chest-outline"
                    size={treasureIconSize}
                    style={styles.treasureCardIconShadow}
                  />
                  <MaterialCommunityIcons
                    color="#9CA3AF"
                    name="treasure-chest-outline"
                    size={treasureIconSize}
                  />
                </View>
                <Text style={styles.leafTreasureText}>
                  {treasureMessage}
                </Text>
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
            {isTreasure ? (
              <View style={styles.treasureCardIconWrap}>
                <MaterialCommunityIcons
                  color="#F8FAFC"
                  name="treasure-chest-outline"
                  size={30}
                  style={styles.treasureCardIconHighlight}
                />
                <MaterialCommunityIcons
                  color="#6B7280"
                  name="treasure-chest-outline"
                  size={30}
                  style={styles.treasureCardIconShadow}
                />
                <MaterialCommunityIcons
                  color="#9CA3AF"
                  name="treasure-chest-outline"
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
        isTreasure && styles.hiddenDependencyBar,
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
