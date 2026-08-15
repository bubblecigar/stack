import {
  ActivityIndicator,
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
import { Image as CachedImage } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { DeleteHoldIndicator } from './DeleteHoldIndicator';
import { getCardImageSource } from '../lib/cardImageCache';
import { styles } from '../styles/appStyles';

const doneStampImage = require('../../assets/card/done_stamp_gray.png');
const doneStampRingsImage = require('../../assets/card/done_stamp_rings_gray.png');

function DoneStampArtwork({ uri, style }) {
  const [failedUri, setFailedUri] = useState(null);
  const canShowMonster = Boolean(uri && failedUri !== uri);

  if (!canShowMonster) {
    return (
      <View pointerEvents="none" style={style}>
        <Image source={doneStampImage} style={styles.doneStampFullArtwork} />
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={style}>
      <Image source={doneStampRingsImage} style={styles.doneStampFullArtwork} />
      <CachedImage
        cachePolicy="memory-disk"
        contentFit="contain"
        onError={() => setFailedUri(uri)}
        source={getCardImageSource(uri)}
        style={styles.doneStampMonsterArtwork}
      />
    </View>
  );
}

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
  doneCleanupPreviewCardIds = new Set(),
  isPreviewCard = false,
  leafContentMode = 'text',
  collapsedNodeIds = new Set(),
}) {
  const {
    id,
    index,
    done = false,
    doneStampUri = null,
    isImageUploading = false,
    imageUri,
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
  const shouldShowEdit = isFocusedCard && !isSystem && !imageUri;
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
  const isPrimaryDeleteHoldCard = isDeleteHoldActive && isFocusedCard;
  const isTreeDeleteHoldActive = isTreeCard && isPrimaryDeleteHoldCard;
  const isDoneCleanupPreviewCard = (
    done
    && doneCleanupPreviewCardIds?.has?.(id)
  );
  const isDoneCleanupProgressVisible = isDoneCleanupPreviewCard;
  const isDoneCleanupChromeVisible = isDoneCleanupPreviewCard && isPrimaryDeleteHoldCard;
  const isDeleteProgressVisible = isTreeDeleteHoldActive && !isDoneCleanupProgressVisible;
  const editButtonColor = isTreeDeleteHoldActive
    ? (done ? '#0EA5E9' : '#DC2626')
    : (isTreeCard ? '#0EA5E9' : '#0F172A');
  const editButtonPressedColor = isTreeDeleteHoldActive
    ? (done ? '#0284C7' : '#B91C1C')
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
        isLeafCard && imageUri && styles.leafImageCard,
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
        isDoneCleanupChromeVisible && styles.doneCleanupFocusedCard,
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
            isDoneCleanupChromeVisible && styles.doneCleanupTreeCollapsedCornerLine,
          ]}
        />
      ) : null}

      {(isTreeCard || isLeafCard) && (isPrimaryDeleteHoldCard || isDoneCleanupPreviewCard) ? (
        <DeleteHoldIndicator
          active={isPrimaryDeleteHoldCard || isDoneCleanupPreviewCard}
          tone={isDoneCleanupPreviewCard ? 'done' : 'delete'}
          variant={isTreeCard ? 'treeCardFill' : 'cardFill'}
          onComplete={isPrimaryDeleteHoldCard ? () => {
            onDeleteHoldComplete?.(index);
          } : undefined}
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
          <View style={[
            styles.leafContentSurface,
            imageUri && styles.leafImageContentSurface,
          ]}
          >
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
            ) : isImageUploading ? (
              <View
                accessibilityLabel="Uploading card image"
                accessibilityRole="progressbar"
                style={[styles.leafContentLayer, styles.cardImageLoading]}
              >
                <ActivityIndicator color="#64748B" size="large" />
              </View>
            ) : imageUri ? (
              <View style={styles.leafContentLayer}>
                <CachedImage
                  accessibilityLabel="Card image"
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  priority={isLeafTopCard ? 'high' : 'normal'}
                  recyclingKey={imageUri}
                  source={getCardImageSource(imageUri)}
                  style={styles.leafCardImage}
                />
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
              <>
                {imageUri ? (
                  <View
                    pointerEvents="none"
                    style={styles.leafImageDoneStampBackground}
                  />
                ) : null}
                <DoneStampArtwork
                  uri={doneStampUri}
                  style={[
                    styles.leafDoneStampOverlay,
                    imageUri && styles.imageDoneStampArtwork,
                  ]}
                />
              </>
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
            ) : isImageUploading ? (
              <View
                accessibilityLabel="Uploading card image"
                accessibilityRole="progressbar"
                style={[styles.treeCardImage, styles.cardImageLoading]}
              >
                <ActivityIndicator color="#64748B" />
              </View>
            ) : imageUri ? (
              <CachedImage
                accessibilityLabel="Card image"
                cachePolicy="memory-disk"
                contentFit="cover"
                recyclingKey={imageUri}
                source={getCardImageSource(imageUri)}
                style={styles.treeCardImage}
              />
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
              <>
                {imageUri ? (
                  <View
                    pointerEvents="none"
                    style={styles.treeImageDoneStampBackground}
                  />
                ) : null}
                <DoneStampArtwork
                  uri={doneStampUri}
                  style={[
                    styles.treeDoneStampOverlay,
                    imageUri && styles.imageDoneStampArtwork,
                  ]}
                />
              </>
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
