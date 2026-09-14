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
import { DoneStampArtwork } from './DoneStampArtwork';
import { STAMP_ASSETS } from '../config/stampAssets';
import { getCardImageSource } from '../lib/cardImageCache';
import { styles } from '../styles/appStyles';
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function CollectionCardContent({ imageUri, layout }) {
  const isLeaf = layout === 'leaf';

  return (
    <View style={[
      styles.monsterCardContent,
      isLeaf && styles.leafMonsterCardContent,
    ]}
    >
      <CachedImage
        accessibilityLabel="Summoned collection"
        cachePolicy="memory-disk"
        contentFit="contain"
        source={getCardImageSource(imageUri)}
        style={[
          styles.monsterCardArtwork,
          isLeaf && styles.leafMonsterCardArtwork,
        ]}
      />
    </View>
  );
}

export function StackCard({
  audioEnabled = true,
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
  isMissionRoot = false,
  isRootCard = false,
  isMissionCard = false,
  isTreasureCard = false,
  onPress,
  onPressIn,
  onCreateEdit,
  onAdoptMissionRoot,
  onAudioEnabledChange,
  onArchiveRootTree,
  onRestoreRootTree,
  onDeleteCard,
  onDeleteHoldComplete,
  onEditingValueChange,
  onEditingSelectionChange,
  onCompleteEdit,
  onFocusCard,
  onLogout,
  userName = '',
  editingSelection,
  isDeleteHoldActive = false,
  doneCleanupPreviewCardIds = new Set(),
  isPreviewCard = false,
  leafContentMode = 'text',
  collapsedNodeIds = new Set(),
}) {
  const {
    backgroundColor,
    id,
    index,
    done = false,
    doneStampUri = null,
    isImageUploading = false,
    imageUri,
    collectionImageUri = null,
    text,
  } = card;

  const isLeafCard = layout === 'leaf';
  const isTreeCard = layout === 'tree';
  const isMission = isMissionCard || Boolean(card?.isMissionCard);
  const isTreasure = isTreasureCard || Boolean(card?.isTreasureCard);
  const isCollection = Boolean(card?.isCollectionCard || card?.systemType === 'collection');
  const isSystem = isMission || isTreasure || isCollection;
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
  const shouldShowEdit = (
    isFocusedCard
    && !isSystem
    && !imageUri
    && !(isTreeCard && done)
  );
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
  const isBlueDeleteTheme = isDoneCleanupPreviewCard || (
    isCollection && isPrimaryDeleteHoldCard
  );
  const isDoneCleanupChromeVisible = isBlueDeleteTheme && isPrimaryDeleteHoldCard;
  const isDeleteProgressVisible = (
    isTreeDeleteHoldActive
    && !isDoneCleanupProgressVisible
    && !isCollection
  );
  const editButtonColor = isTreeDeleteHoldActive
    ? (done || isCollection ? '#0EA5E9' : '#DC2626')
    : (isTreeCard ? '#0EA5E9' : '#0F172A');
  const editButtonPressedColor = isTreeDeleteHoldActive
    ? (done || isCollection ? '#0284C7' : '#B91C1C')
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
    ? (isPreviewCard ? 13000 : (isFocusedCard ? 12000 : treeStackLayer))
    : null;

  const dependencyText = '';
  const editingInputRef = useRef(null);
  const placeholderPulse = useRef(new Animated.Value(0)).current;
  const deleteHoldProgress = useRef(new Animated.Value(0)).current;

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
  const deleteStampRotation = deleteHoldProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['-8deg', '352deg'],
    extrapolate: 'clamp',
  });
  const deleteStampScale = deleteHoldProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.08],
    extrapolate: 'clamp',
  });
  const deleteCompletionFlashOpacity = deleteHoldProgress.interpolate({
    inputRange: [0, 0.66, 0.9, 1],
    outputRange: [0, 0, 0.8, 0],
    extrapolate: 'clamp',
  });
  const treeDeleteFadeOpacity = deleteHoldProgress.interpolate({
    inputRange: [0, 0.64, 0.99, 1],
    outputRange: [1, 1, 0, 1],
    extrapolate: 'clamp',
  });
  const deleteStampAnimatedStyle = isDoneCleanupPreviewCard
    ? {
      transform: [
        { rotate: deleteStampRotation },
        { scale: deleteStampScale },
      ],
    }
    : null;

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    editingInputRef.current?.focus?.();
  }, [
    isEditing,
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
    <AnimatedPressable
      disabled={isLeafCard || isPreviewCard}
      onPressIn={onPressIn}
      onPress={onPress}
      style={[
        styles.card,
        isLeafCard && styles.leafCard,
        isLeafCard && imageUri && styles.leafImageCard,
        isTreeCard && styles.treeCard,
        !isSystem && backgroundColor ? { backgroundColor } : null,
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
        isTreeCard
          && (isPrimaryDeleteHoldCard || isDoneCleanupPreviewCard)
          && { opacity: treeDeleteFadeOpacity },
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
          progressValue={deleteHoldProgress}
          tone={isBlueDeleteTheme ? 'done' : 'delete'}
          variant={isTreeCard ? 'treeCardFill' : 'cardFill'}
          onComplete={isPrimaryDeleteHoldCard ? () => {
            onDeleteHoldComplete?.(index);
          } : undefined}
        />
      ) : null}

      {isLeafCard && (isPrimaryDeleteHoldCard || isDoneCleanupPreviewCard) ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.deleteCompletionFlash,
            { opacity: deleteCompletionFlashOpacity },
          ]}
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
            {isCollection ? (
              <CollectionCardContent
                imageUri={collectionImageUri}
                layout="leaf"
              />
            ) : isTreasure ? (
              <View style={styles.leafTreasureProfile}>
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
                {userName ? (
                  <Text numberOfLines={1} style={styles.leafTreasureUserName}>
                    {userName}
                  </Text>
                ) : null}
              </View>
            ) : isSystem ? (
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
                  overrideSource={isDoneCleanupPreviewCard ? STAMP_ASSETS.void.doneCard : null}
                  uri={doneStampUri}
                  style={[
                    styles.leafDoneStampOverlay,
                    imageUri && styles.imageDoneStampArtwork,
                    deleteStampAnimatedStyle,
                  ]}
                />
              </>
            ) : null}
            {isTreasure && isLeafTopCard ? (
              <View style={styles.leafTreasureSettingsRow}>
                <Pressable
                  accessibilityLabel={audioEnabled ? 'Turn audio off' : 'Turn audio on'}
                  accessibilityRole="button"
                  onPressIn={handleControlPressIn}
                  onPress={(event) => handleControlPress(
                    event,
                    () => onAudioEnabledChange?.(!audioEnabled),
                  )}
                  style={({ pressed }) => [
                    styles.leafTreasureSettingsButton,
                    pressed && styles.leafTreasureSettingsButtonPressed,
                  ]}
                >
                  <MaterialCommunityIcons
                    color="#6B7280"
                    name={audioEnabled ? 'volume-high' : 'volume-off'}
                    size={24}
                  />
                </Pressable>
                <Pressable
                  accessibilityLabel="Log out"
                  accessibilityRole="button"
                  onPressIn={handleControlPressIn}
                  onPress={(event) => handleControlPress(event, onLogout)}
                  style={({ pressed }) => [
                    styles.leafTreasureSettingsButton,
                    pressed && styles.leafTreasureSettingsButtonPressed,
                  ]}
                >
                  <MaterialCommunityIcons color="#6B7280" name="logout" size={24} />
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : (
          <Animated.View style={{ opacity: 1 }}>
            {isCollection ? (
              <CollectionCardContent
                imageUri={collectionImageUri}
                layout="tree"
              />
            ) : isSystem ? (
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
                  overrideSource={isDoneCleanupPreviewCard ? STAMP_ASSETS.void.doneCard : null}
                  uri={doneStampUri}
                  style={[
                    styles.treeDoneStampOverlay,
                    imageUri && styles.imageDoneStampArtwork,
                    deleteStampAnimatedStyle,
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
    </AnimatedPressable>
  );
}
