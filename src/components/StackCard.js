import { Pressable, Text, TextInput, View, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { styles } from '../styles/appStyles';

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
  collapsedNodeIds,
  treePosition,
  isCollapsedStacked = false,
  onPress,
  onPressIn,
  onCreateEdit,
  onToggleCollapse,
  onDeleteCard,
  onEditingValueChange,
  onCompleteEdit,
  onFocusCard,
  leafContentMode = 'text',
}) {
  const {
    id,
    index,
    childIds,
    text,
  } = card;

  const isLeafCard = layout === 'leaf';
  const isTreeCard = layout === 'tree';
  const isEditing = editingIndex === index;
  const isFocusedCard = (
    isLeafCard
      ? isLeafTopCard
      : (focusedCardId != null
        ? focusedCardId === id
        : focusedCardIndex === index)
  );
  const hasChildren = Array.isArray(childIds) && childIds.length > 0;
  const isCollapsed = collapsedNodeIds.has(id);
  const shouldShowControls = !hideControls && isFocusedCard;
  const shouldShowEdit = isFocusedCard;

  const treeStackLayer = treePosition
    ? (
      9000
      - ((treePosition.depth ?? 0) * 80)
      - (treePosition.placementOrder ?? 0)
    )
    : -1;

  const zLayer = isTreeCard
    ? (treeStackLayer + (isFocusedCard ? 5 : 0))
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

  function handleControlPressIn(event) {
    event?.stopPropagation?.();
    onPressIn?.();
  }

  function handleControlPress(event, action) {
    event?.stopPropagation?.();
    action?.();
  }

  return (
    <Pressable
      disabled={isLeafCard}
      onPressIn={onPressIn}
      onPress={onPress}
      style={[
        styles.card,
        isLeafCard && styles.leafCard,
        isTreeCard && styles.treeCard,
        isTreeCard && isCollapsedStacked && styles.treeCollapsedCard,
        isEditing && isLeafCard && styles.leafEditingCard,
        isTreeCard && treePosition && {
          left: treePosition.left,
          top: treePosition.top,
          position: 'absolute',
        },
        isFocusedCard && !isLeafCard && styles.focusedCard,
        zLayer != null ? { zIndex: zLayer } : null,
      ]}
    >
      <View style={[
        styles.cardControls,
        isTreeCard && styles.treeCardControls,
      ]}
      >
        {isTreeCard && shouldShowControls && hasChildren && (
          <Pressable
            accessibilityLabel={isCollapsed ? 'Expand card' : 'Collapse card'}
            accessibilityRole="button"
            onPressIn={handleControlPressIn}
            onPress={(event) => handleControlPress(event, () => {
              onToggleCollapse?.(index);
            })}
            style={({ pressed }) => [
              styles.iconButton,
              isCollapsed && styles.linkButtonActive,
              pressed && styles.iconButtonPressed,
            ]}
          >
            <Text style={styles.iconButtonText}>{isCollapsed ? '+' : '-'}</Text>
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
              pressed && styles.iconButtonPressed,
            ]}
          >
            <Text style={styles.iconButtonText}>
              {isEditing ? '✓' : '✎'}
            </Text>
          </Pressable>
        )}

        {shouldShowControls && (
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
        <Animated.View style={styles.cardInputWrap}>
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
            scrollEnabled={false}
            onChangeText={onEditingValueChange}
            onEndEditing={(event) => {
              onCompleteEdit?.(index, event.nativeEvent.text);
            }}
            onSubmitEditing={(event) => {
              onCompleteEdit?.(index, event.nativeEvent.text);
            }}
            placeholder="Write card text"
            placeholderTextColor="#94A3B8"
            style={[
              styles.cardInput,
              isTreeCard && styles.treeCardInput,
            ]}
            submitBehavior="submit"
            value={editingValue}
          />
        </Animated.View>
      ) : (
        isLeafCard ? (
          <View style={styles.leafContentSurface}>
            {leafContentMode === 'placeholder' ? (
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
                <Text style={[
                  styles.cardText,
                  !text && styles.emptyCardText,
                ]}
                >
                  {text || 'Empty card'}
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <Animated.View
            style={{ opacity: 1 }}
          >
            <Text style={[
              styles.cardText,
              isTreeCard && styles.treeCardText,
              !text && styles.emptyCardText,
            ]}
            >
              {text || 'Empty card'}
            </Text>
          </Animated.View>
        )
      )}

      <View style={[
        styles.dependencyBar,
        isTreeCard && styles.treeDependencyBar,
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
