import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
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
  isMissionRoot = false,
  isMissionCard = false,
  isTreasureCard = false,
  onPress,
  onPressIn,
  onCreateEdit,
  onAdoptMissionRoot,
  onDeleteCard,
  onDeleteHoldComplete,
  onEditingValueChange,
  onEditingSelectionChange,
  onCompleteEdit,
  onFocusCard,
  onHoldCard,
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
  const isPrimaryDeleteHoldCard = isDeleteHoldActive && isFocusedCard;
  const shouldShowControls = !hideControls && isFocusedCard && !isPrimaryDeleteHoldCard;
  const shouldShowEdit = (
    isFocusedCard
    && !isSystem
    && !imageUri
  );
  const shouldShowAdoptMission = (
    shouldShowControls
    && isTreeCard
    && isMissionRootCard
    && !isEditing
  );
  const shouldShowHold = (
    shouldShowControls
    && isTreeCard
    && !isSystem
    && !isEditing
    && typeof onHoldCard === 'function'
  );
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
    ? '#0EA5E9'
    : (isTreeCard ? '#0EA5E9' : '#0F172A');
  const editButtonPressedColor = isTreeDeleteHoldActive
    ? '#0284C7'
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
  const previewTreeStackLayer = treePosition
    ? (
      13000
      - ((treePosition.depth ?? 0) * 80)
      - (treePosition.placementOrder ?? 0)
    )
    : 13000;

  const zLayer = isTreeCard
    ? (isPreviewCard ? previewTreeStackLayer : (isFocusedCard ? 12000 : treeStackLayer))
    : null;

  const dependencyText = '';
  const editingInputRef = useRef(null);
  const placeholderPulse = useRef(new Animated.Value(0)).current;
  const deleteHoldProgress = useRef(new Animated.Value(0)).current;
  const treeEditReveal = useRef(new Animated.Value(0)).current;
  const treeHoldReveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isTreeCard || !shouldShowControls || !shouldShowEdit) {
      treeEditReveal.setValue(0);
      return undefined;
    }

    treeEditReveal.setValue(0);
    const animation = Animated.timing(treeEditReveal, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    animation.start();

    return () => animation.stop();
  }, [
    isEditing,
    isTreeCard,
    shouldShowControls,
    shouldShowEdit,
    treeEditReveal,
  ]);

  useEffect(() => {
    if (!shouldShowHold) {
      treeHoldReveal.setValue(0);
      return undefined;
    }

    treeHoldReveal.setValue(0);
    const animation = Animated.timing(treeHoldReveal, {
      toValue: 1,
      duration: 240,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    });

    animation.start();

    return () => animation.stop();
  }, [
    shouldShowHold,
    treeHoldReveal,
  ]);

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

  const cardElement = (
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
        isTreeCard && styles.treeCardForeground,
        isFocusedCard && !isLeafCard && styles.focusedCard,
        isFocusedCard && isSystem && styles.focusedTreasureCard,
        isDeleteProgressVisible && styles.deleteFocusedCard,
        isDoneCleanupChromeVisible && styles.doneCleanupFocusedCard,
        isTreeCard
          && (isPrimaryDeleteHoldCard || isDoneCleanupPreviewCard)
          && { opacity: treeDeleteFadeOpacity },
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

        {shouldShowControls && shouldShowEdit && !isTreeCard && (
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
                  overrideSource={isDoneCleanupPreviewCard
                    ? STAMP_ASSETS.card.void
                    : null}
                  uri={doneStampUri}
                  style={[
                    styles.leafDoneStampOverlay,
                    imageUri && styles.imageDoneStampArtwork,
                    deleteStampAnimatedStyle,
                  ]}
                />
              </>
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
                  overrideSource={isFocusedCard || isDoneCleanupPreviewCard
                    ? STAMP_ASSETS.card.void
                    : null}
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

  if (!isTreeCard || !treePosition) {
    return cardElement;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.treeCardFrame,
        {
          left: treePosition.left,
          top: treePosition.top,
          zIndex: zLayer,
        },
      ]}
    >
      {shouldShowHold ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.iconButton,
            styles.treeHoldButton,
            styles.treeHoldEar,
            {
              opacity: treeHoldReveal,
              transform: [
                {
                  translateX: treeHoldReveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
                {
                  scale: treeHoldReveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.88, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <Feather
            name="corner-left-down"
            size={24}
            color="#0EA5E9"
          />
        </Animated.View>
      ) : null}

      {cardElement}

      {shouldShowControls && shouldShowEdit ? (
        <Animated.View
          style={[
            styles.treeEditButton,
            {
              opacity: treeEditReveal,
              transform: [
                {
                  translateX: treeEditReveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-24, 0],
                  }),
                },
                {
                  scale: treeEditReveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.72, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <Pressable
            accessibilityLabel={isEditing ? 'Confirm card' : 'Edit card'}
            accessibilityRole="button"
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 18 }}
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
              styles.treeEditButtonSurface,
              pressed && styles.treeEditButtonPressed,
            ]}
          >
            {isEditing ? (
              <MaterialCommunityIcons color="#0EA5E9" name="check-underline" size={25} />
            ) : (
              <AntDesign color="#0EA5E9" name="edit" size={23} />
            )}
          </Pressable>
        </Animated.View>
      ) : null}

      {shouldShowHold ? (
        <Pressable
          accessibilityLabel="Pick up card tree"
          accessibilityRole="button"
          hitSlop={{ top: 8, right: 18, bottom: 8, left: 8 }}
          onPressIn={handleControlPressIn}
          onPress={(event) => handleControlPress(event, () => {
            onHoldCard?.(index);
          })}
          style={[
            styles.iconButton,
            styles.holdButton,
            styles.treeHoldButton,
            styles.treeHoldHitTarget,
          ]}
        />
      ) : null}
    </View>
  );
}
