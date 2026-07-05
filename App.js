import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  LayoutAnimation,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import {
  getSnapshot,
  loadCards,
  push,
  removeAt,
  subscribe,
  toggleChildLink,
  updateAt,
} from './stackStore';
import defaultStackData from './defaultStack.json';

export default function App() {
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [linkingIndex, setLinkingIndex] = useState(null);
  const [focusedCardIndex, setFocusedCardIndex] = useState(null);
  const [layoutMode, setLayoutMode] = useState('leaf');
  const [collapsedNodeIds, setCollapsedNodeIds] = useState(() => new Set());
  const hasLoadedDefaultStack = useRef(false);
  const treeCardPressState = useRef({
    index: null,
    timestamp: 0,
  });
  const treeHorizontalScrollRef = useRef(null);
  const treeVerticalScrollRef = useRef(null);
  const treeViewportRef = useRef({
    width: 0,
    height: 0,
  });
  const stack = useSyncExternalStore(subscribe, getSnapshot);
  const cards = stack.map((card, index) => ({ ...card, index }));
  const treeCanvasPadding = 160;
  const visibleCards = stack
    .map((card, index) => ({ ...card, index }))
    .slice(-4)
    .reverse();

  function handleCreateCard() {
    const nextIndex = push('');
    setEditingIndex(nextIndex);
    setEditingValue('');
    setLinkingIndex(null);
    setFocusedCardIndex(nextIndex);
  }

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    if (!__DEV__) {
      return;
    }

    if (hasLoadedDefaultStack.current) {
      return;
    }

    if (stack.length > 0) {
      hasLoadedDefaultStack.current = true;
      return;
    }

    const seedCards = Array.isArray(defaultStackData?.cards)
      ? defaultStackData.cards
      : [];
    if (seedCards.length > 0) {
      loadCards(seedCards);
    }

    hasLoadedDefaultStack.current = true;
  }, [stack.length]);

  function handleEditCard(index, text) {
    setEditingIndex(index);
    setEditingValue(text);
    setLinkingIndex(null);
    if (layoutMode === 'tree') {
      setFocusedCardIndex(index);
    } else {
      setFocusedCardIndex(null);
    }
  }

  function handleConfirmEdit() {
    if (editingIndex === null) {
      return;
    }

    updateAt(editingIndex, editingValue);
    setEditingIndex(null);
    setEditingValue('');
  }

  function handleToggleEdit(index, text) {
    if (editingIndex === index) {
      handleConfirmEdit();
      return;
    }

    handleEditCard(index, text);
  }

  function handleDeleteCard(index) {
    const removedCard = stack[index];

    if (editingIndex === index) {
      setEditingIndex(null);
      setEditingValue('');
    } else if (editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }

    if (linkingIndex === index) {
      setLinkingIndex(null);
    } else if (linkingIndex > index) {
      setLinkingIndex(linkingIndex - 1);
    }

    if (focusedCardIndex === index) {
      setFocusedCardIndex(null);
    } else if (focusedCardIndex > index) {
      setFocusedCardIndex(focusedCardIndex - 1);
    }

    if (removedCard) {
      setCollapsedNodeIds((currentCollapsed) => {
        if (!currentCollapsed.has(removedCard.id)) {
          return currentCollapsed;
        }

        const nextCollapsed = new Set(currentCollapsed);
        nextCollapsed.delete(removedCard.id);
        return nextCollapsed;
      });
    }

    removeAt(index);
  }

  function handleToggleLinking(index) {
    setEditingIndex(null);
    setEditingValue('');
    if (layoutMode === 'tree') {
      setFocusedCardIndex(index);
    } else {
      setFocusedCardIndex(null);
    }
    setLinkingIndex((currentIndex) => (
      currentIndex === index ? null : index
    ));
  }

  function handleFocusCard(index, layout) {
    if (layout !== 'tree') {
      return;
    }

    setFocusedCardIndex(index);
  }

  function handleTouchCard(index, layout) {
    if (layout !== 'tree') {
      return;
    }

    setFocusedCardIndex(index);
  }

  function handleToggleCollapse(index) {
    const card = cards[index];

    if (!card || !Array.isArray(card.childIds) || card.childIds.length === 0) {
      return;
    }

    const cardId = card.id;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    setCollapsedNodeIds((currentCollapsed) => {
      const nextCollapsed = new Set(currentCollapsed);

      if (nextCollapsed.has(cardId)) {
        nextCollapsed.delete(cardId);
      } else {
        nextCollapsed.add(cardId);
      }

      return nextCollapsed;
    });
  }

  function handleTreeCardPress(index) {
    if (layoutMode !== 'tree') {
      return;
    }

    const now = Date.now();
    const previousIndex = treeCardPressState.current.index;
    const previousTimestamp = treeCardPressState.current.timestamp;
    const hasDoubleTapped = (
      previousIndex === index
      && now - previousTimestamp <= 280
    );

    treeCardPressState.current = {
      index,
      timestamp: now,
    };

    if (hasDoubleTapped) {
      handleToggleCollapse(index);
    }

    setFocusedCardIndex(index);
  }

  function handleLinkAsAncestor(index) {
    if (linkingIndex === null) {
      return;
    }

    toggleChildLink(index, linkingIndex);
  }

  function handleLinkAsChild(index) {
    if (linkingIndex === null) {
      return;
    }

    toggleChildLink(linkingIndex, index);
  }

  useEffect(() => {
    if (layoutMode !== 'tree' || focusedCardIndex === null) {
      return;
    }

    const viewport = treeViewportRef.current;
    if (!viewport.width || !viewport.height) {
      return;
    }

    const {
      maxHeight,
      maxWidth,
      positionedCards,
      nodeWidth,
      nodeHeight,
    } = buildTreeLayout();
    const focusedEntry = positionedCards.find(({ card }) => card.index === focusedCardIndex);

    if (!focusedEntry) {
      return;
    }

    const contentWidth = maxWidth + (treeCanvasPadding * 2);
    const contentHeight = maxHeight + (treeCanvasPadding * 2);
    const centeredX = focusedEntry.left + treeCanvasPadding + (nodeWidth / 2);
    const centeredY = focusedEntry.top + treeCanvasPadding + (nodeHeight / 2);

    const targetX = Math.min(
      Math.max(centeredX - (viewport.width / 2), 0),
      Math.max(contentWidth - viewport.width, 0),
    );
    const targetY = Math.min(
      Math.max(centeredY - (viewport.height / 2), 0),
      Math.max(contentHeight - viewport.height, 0),
    );

    treeHorizontalScrollRef.current?.scrollTo({
      x: targetX,
      animated: true,
    });
    treeVerticalScrollRef.current?.scrollTo({
      y: targetY,
      animated: true,
    });
  }, [focusedCardIndex, layoutMode, cards, collapsedNodeIds]);

  function buildTreeLayout() {
    const cardById = new Map(cards.map((card) => [card.id, card]));
    const rootCards = cards.filter((card) => (
      !Array.isArray(card.parentIds) || card.parentIds.length === 0
    ));
    const seen = new Set();
    const visiting = new Set();
    const positionedCards = [];

    const treeNodeWidth = 240;
    const treeNodeHeight = 125;
    const treeNodeOverlapX = treeNodeWidth / 2;
    const depthStepX = treeNodeWidth - treeNodeOverlapX;
    const childOverlapY = 16;
    const rootGapY = 64;
    const collapsedStackGapY = 18;
    const collapsedStackPeek = 28;
    let cursorY = 14;
    let maxX = 0;
    let maxY = 0;
    const collapsedBranchSlots = new Map();

    function getCollapsedBranchSlot(anchorId) {
      const previousSlot = collapsedBranchSlots.get(anchorId) || 0;
      collapsedBranchSlots.set(anchorId, previousSlot + 1);
      return previousSlot;
    }

    function placeCard(card, depth, startY, collapsedContext = null) {
      if (!card || seen.has(card.id) || visiting.has(card.id)) {
        return { top: startY, bottom: startY };
      }

      visiting.add(card.id);

      const isHiddenFromCollapsedContext = collapsedContext !== null;
      const isCollapsed = collapsedNodeIds.has(card.id);
      const left = isHiddenFromCollapsedContext
        ? collapsedContext.left
        : depth * depthStepX;
      const top = isHiddenFromCollapsedContext
        ? collapsedContext.baseTop + (getCollapsedBranchSlot(collapsedContext.anchorId) * collapsedStackGapY)
        : startY;

      positionedCards.push({
        card,
        left,
        top,
        isCollapsedStacked: isHiddenFromCollapsedContext,
      });

      seen.add(card.id);
      maxX = Math.max(maxX, left + treeNodeWidth);
      maxY = Math.max(maxY, top + treeNodeHeight);

      let nextY = top + treeNodeHeight - childOverlapY;
      let subtreeBottom = top + treeNodeHeight;
      const processedChildren = new Set();

      (card.childIds || []).forEach((childId) => {
        if (processedChildren.has(childId)) {
          return;
        }

        const childCard = cardById.get(childId);
        if (!childCard) {
          return;
        }

        processedChildren.add(childId);

        const nextCollapsedContext = {
          anchorId: card.id,
          left: left,
          baseTop: top + treeNodeHeight - collapsedStackPeek,
        };

        const childBounds = isCollapsed || isHiddenFromCollapsedContext
          ? placeCard(
              childCard,
              depth + 1,
              nextY,
              nextCollapsedContext,
            )
          : placeCard(childCard, depth + 1, nextY);

        if (!isCollapsed) {
          subtreeBottom = Math.max(subtreeBottom, childBounds.bottom);
          nextY = childBounds.bottom - childOverlapY;
        }

        subtreeBottom = Math.max(subtreeBottom, childBounds.bottom);
      });

      visiting.delete(card.id);
      return {
        top,
        bottom: subtreeBottom,
      };
    }

    rootCards.forEach((rootCard) => {
      const bounds = placeCard(rootCard, 0, cursorY);
      cursorY = bounds.bottom + rootGapY;
      maxY = Math.max(maxY, bounds.bottom);
    });

    cards.forEach((card) => {
      if (seen.has(card.id)) {
        return;
      }

      const bounds = placeCard(card, 0, cursorY);
      cursorY = bounds.bottom + rootGapY;
      maxY = Math.max(maxY, bounds.bottom);
    });

    return {
      maxHeight: Math.max(maxY + 100, 260),
      maxWidth: Math.max(maxX + 40, depthStepX + treeNodeWidth),
      nodeWidth: treeNodeWidth,
      nodeHeight: treeNodeHeight,
      horizontalStep: depthStepX,
      positionedCards,
    };
  }

  function renderCard({
    controls,
    isEditing = false,
    key,
    layout = 'leaf',
    onChangeText,
    dependencyText,
    dependencyControls,
    onPress,
    treePosition,
    pileIndex,
    isCollapsedStacked = false,
    value,
    isFocused,
  }) {
    const isLeafCard = layout === 'leaf';
    const isTreeCard = layout === 'tree';

    return (
      <Pressable
        disabled={layout === 'leaf'}
        onPress={onPress}
        key={key}
        style={[
          styles.card,
          isLeafCard && styles.leafCard,
          isTreeCard && styles.treeCard,
          isTreeCard && isCollapsedStacked && styles.treeCollapsedCard,
          isFocused && styles.focusedCard,
          isEditing && styles.editingCard,
          isTreeCard && isEditing && styles.treeEditingCard,
          treePosition && {
            left: treePosition.left,
            top: treePosition.top,
            position: 'absolute',
          },
          isLeafCard && {
            top: pileIndex * 12,
            transform: [
              { scale: 1 - pileIndex * 0.035 },
              { rotate: `${pileIndex % 2 === 0 ? 0 : -2}deg` },
            ],
            zIndex: isEditing
              ? visibleCards.length + 2
              : visibleCards.length + 1 - pileIndex,
          },
          isLeafCard && {
            transform: [{ rotate: `${pileIndex % 2 === 0 ? -1.5 : 1.5}deg` }],
          },
        ]}
      >
        <View style={[
          styles.cardControls,
          isTreeCard && styles.treeCardControls,
        ]}
        >
          {controls}
        </View>

        {isEditing ? (
          <TextInput
            autoCapitalize="sentences"
            autoCorrect
            autoFocus
            multiline
            onChangeText={onChangeText}
            placeholder="Write card text"
            placeholderTextColor="#94A3B8"
            style={[
              styles.cardInput,
              isTreeCard && styles.treeCardInput,
            ]}
            value={value}
          />
        ) : (
          <Text style={[
            styles.cardText,
            isTreeCard && styles.treeCardText,
            !value && styles.emptyCardText,
          ]}
          >
            {value || 'Empty card'}
          </Text>
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
          {dependencyControls}
        </View>
      </Pressable>
    );
  }

  function renderStackCard(
    card,
    visibleIndex,
    layout = 'leaf',
    { treePosition, isCollapsedStacked = false } = {}
  ) {
    const {
      childIds,
      id,
      index,
      parentIds,
      text,
    } = card;
    const pileIndex = visibleIndex;
    const isEditing = editingIndex === index;
    const isFocusedCard = focusedCardIndex === index;
    const isLinkingSource = linkingIndex === index;
    const canLinkToCard = linkingIndex !== null && linkingIndex !== index;
    const sourceCard = linkingIndex === null ? null : stack[linkingIndex];
    const isAncestorLinked = sourceCard?.parentIds.includes(id);
    const isChildLinked = sourceCard?.childIds.includes(id);
    const hasChildren = Array.isArray(childIds) && childIds.length > 0;
    const isCollapsed = collapsedNodeIds.has(id);
    const dependencyText = `A ${parentIds.length} · C ${childIds.length}`;

    return renderCard({
      controls: (
        <>
          {layout === 'tree' && hasChildren && (
            <Pressable
              accessibilityLabel={isCollapsed ? 'Expand card' : 'Collapse card'}
              accessibilityRole="button"
              onPress={() => {
                handleTouchCard(index, layout);
                handleToggleCollapse(index);
              }}
              style={({ pressed }) => [
                styles.iconButton,
                isCollapsed && styles.linkButtonActive,
                pressed && styles.iconButtonPressed,
              ]}
            >
              <Text style={styles.iconButtonText}>{isCollapsed ? '+' : '-'}</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityLabel={isEditing ? 'Confirm card' : 'Edit card'}
            accessibilityRole="button"
            onPress={() => {
              handleTouchCard(index, layout);
              handleToggleEdit(index, text);
            }}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.iconButtonPressed,
            ]}
          >
            <Text style={styles.iconButtonText}>
              {isEditing ? '✓' : '✎'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel={
              isLinkingSource ? 'Cancel card linking' : 'Link card'
            }
            accessibilityRole="button"
            onPress={() => {
              handleTouchCard(index, layout);
              handleToggleLinking(index);
            }}
            style={({ pressed }) => [
              styles.iconButton,
              isLinkingSource && styles.linkButtonActive,
              pressed && styles.iconButtonPressed,
            ]}
          >
            <Text style={styles.iconButtonText}>↔</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Delete card"
            accessibilityRole="button"
            onPress={() => {
              handleTouchCard(index, layout);
              handleDeleteCard(index);
            }}
            style={({ pressed }) => [
              styles.iconButton,
              styles.dangerButton,
              pressed && styles.dangerButtonPressed,
            ]}
          >
            <Text style={styles.iconButtonText}>⌫</Text>
          </Pressable>
        </>
      ),
      dependencyControls: canLinkToCard && (
        <View style={styles.linkTargetControls}>
          <Pressable
            accessibilityLabel="Link as ancestor"
            accessibilityRole="button"
            onPress={() => {
              handleTouchCard(index, layout);
              handleLinkAsAncestor(index);
            }}
            style={({ pressed }) => [
              styles.dependencyButton,
              isAncestorLinked && styles.dependencyButtonActive,
              pressed && styles.dependencyButtonPressed,
            ]}
          >
            <Text style={[
              styles.dependencyButtonText,
              isAncestorLinked && styles.dependencyButtonTextActive,
            ]}
            >
              A
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Link as child"
            accessibilityRole="button"
            onPress={() => {
              handleTouchCard(index, layout);
              handleLinkAsChild(index);
            }}
            style={({ pressed }) => [
              styles.dependencyButton,
              isChildLinked && styles.dependencyButtonActive,
              pressed && styles.dependencyButtonPressed,
            ]}
          >
            <Text style={[
              styles.dependencyButtonText,
              isChildLinked && styles.dependencyButtonTextActive,
            ]}
            >
              C
            </Text>
          </Pressable>
        </View>
      ),
      dependencyText,
      isEditing,
      onPress: layout === 'tree'
        ? () => handleTreeCardPress(index)
        : () => handleFocusCard(index, layout),
      treePosition,
      isCollapsedStacked,
      isFocused: isFocusedCard,
      key: `card-${id}`,
      layout,
      onChangeText: setEditingValue,
      pileIndex,
      value: isEditing ? editingValue : text,
    });
  }

  function renderLeafView() {
    return (
      <View style={styles.deck}>
        {visibleCards.map((card, visibleIndex) => (
          renderStackCard(card, visibleIndex, 'leaf')
        ))}
      </View>
    );
  }

  function renderTreeView() {
    const {
      maxHeight,
      maxWidth,
      positionedCards,
    } = buildTreeLayout();
    const contentWidth = maxWidth + (treeCanvasPadding * 2);
    const contentHeight = maxHeight + (treeCanvasPadding * 2);
    const paddedPositionedCards = positionedCards.map((entry) => ({
      ...entry,
      left: entry.left + treeCanvasPadding,
      top: entry.top + treeCanvasPadding,
      isCollapsedStacked: entry.isCollapsedStacked,
    }));

    return (
      <View
        style={styles.treeViewport}
        onLayout={(event) => {
          const { height, width } = event.nativeEvent.layout;

          treeViewportRef.current = {
            height,
            width,
          };
        }}
      >
        <ScrollView
          ref={treeHorizontalScrollRef}
          style={styles.treeScroll}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.treeHorizontalContent}
        >
          <ScrollView
            ref={treeVerticalScrollRef}
            style={styles.treeScroll}
            contentContainerStyle={styles.treeContent}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.treeCanvas,
                { height: contentHeight, width: contentWidth },
              ]}
            >
              {paddedPositionedCards.map(({
                card,
                left,
                top,
                isCollapsedStacked,
              }) => (
                renderStackCard(card, 0, 'tree', {
                  treePosition: { left, top },
                  isCollapsedStacked,
                })
              ))}
            </View>
          </ScrollView>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {layoutMode === 'leaf' ? renderLeafView() : renderTreeView()}

      <View style={styles.floatingControls}>
          <Pressable
            accessibilityLabel="Toggle stack layout"
            accessibilityRole="button"
            onPress={() => {
              setLayoutMode((currentMode) => (
                currentMode === 'leaf' ? 'tree' : 'leaf'
              ));
              setFocusedCardIndex(null);
              setEditingIndex(null);
              setEditingValue('');
              setLinkingIndex(null);
            }}
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

        <Pressable
          accessibilityLabel="Add card"
          accessibilityRole="button"
          onPress={handleCreateCard}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        >
          <Text style={styles.fabIcon}>+</Text>
        </Pressable>
      </View>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  floatingControls: {
    position: 'absolute',
    right: 24,
    bottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deck: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  treeScroll: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    paddingRight: 0,
    paddingLeft: 0,
  },
  treeViewport: {
    flex: 1,
    width: '100%',
  },
  treeContent: {
    alignItems: 'flex-start',
    paddingBottom: 96,
    paddingTop: 8,
  },
  treeHorizontalContent: {
    flexGrow: 1,
  },
  treeCanvas: {
    position: 'relative',
    pointerEvents: 'box-none',
    alignItems: 'flex-start',
  },
  card: {
    minHeight: 360,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    shadowColor: '#0F172A',
    shadowOffset: {
      width: 0,
      height: 14,
    },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 12,
  },
  leafCard: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  treeCard: {
    position: 'relative',
    width: 240,
    minHeight: 110,
    maxHeight: 130,
    padding: 16,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  treeCollapsedCard: {
    opacity: 0.98,
  },
  treeEditingCard: {
    minHeight: 220,
    justifyContent: 'center',
  },
  treeCardControls: {
    top: 8,
    right: 8,
    gap: 6,
    transform: [{ scale: 0.8 }],
  },
  treeCardText: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'left',
  },
  treeCardInput: {
    minHeight: 72,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    textAlign: 'left',
    textAlignVertical: 'top',
    paddingTop: 0,
  },
  treeDependencyBar: {
    left: 10,
    right: 10,
    bottom: 8,
    gap: 6,
  },
  treeDependencyText: {
    fontSize: 10,
    fontWeight: '700',
  },
  focusedCard: {
    borderColor: '#0EA5E9',
    borderWidth: 4,
    shadowColor: '#0EA5E9',
    shadowOpacity: 0.3,
    elevation: 14,
  },
  editingCard: {
    zIndex: 20,
    borderColor: '#2563EB',
    borderWidth: 2,
  },
  cardControls: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    gap: 8,
    zIndex: 2,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPressed: {
    backgroundColor: '#2563EB',
  },
  linkButtonActive: {
    backgroundColor: '#7C3AED',
  },
  dangerButton: {
    backgroundColor: '#DC2626',
  },
  dangerButtonPressed: {
    backgroundColor: '#B91C1C',
  },
  iconButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
  },
  cardText: {
    color: '#0F172A',
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 40,
    textAlign: 'center',
  },
  emptyCardText: {
    color: '#94A3B8',
  },
  cardInput: {
    width: '100%',
    minHeight: 180,
    color: '#0F172A',
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 40,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  dependencyBar: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  dependencyText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '800',
  },
  linkTargetControls: {
    flexDirection: 'row',
    gap: 8,
  },
  dependencyButton: {
    minWidth: 34,
    height: 30,
    borderColor: '#CBD5E1',
    borderRadius: 15,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dependencyButtonActive: {
    borderColor: '#2563EB',
    backgroundColor: '#DBEAFE',
  },
  dependencyButtonPressed: {
    borderColor: '#2563EB',
  },
  dependencyButtonText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '900',
  },
  dependencyButtonTextActive: {
    color: '#1D4ED8',
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 12,
  },
  fabPressed: {
    backgroundColor: '#1D4ED8',
    transform: [{ scale: 0.96 }],
  },
  modeFab: {
    backgroundColor: '#0F172A',
  },
  modeFabPressed: {
    backgroundColor: '#334155',
    transform: [{ scale: 0.96 }],
  },
  modeFabText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 26,
  },
  fabIcon: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '500',
    lineHeight: 42,
    marginTop: -2,
  },
});
