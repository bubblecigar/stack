import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  const hasLoadedDefaultStack = useRef(false);
  const stack = useSyncExternalStore(subscribe, getSnapshot);
  const cards = stack.map((card, index) => ({ ...card, index }));
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

  function buildTreeLayout() {
    const cardById = new Map(cards.map((card) => [card.id, card]));
    const rootCards = cards.filter((card) => (
      !Array.isArray(card.parentIds) || card.parentIds.length === 0
    ));
    const seen = new Set();
    const visiting = new Set();
    const positionedCards = [];

    const treeNodeWidth = 280;
    const treeNodeHeight = 170;
    const depthStepX = 300;
    const childStepY = 190;
    const rootGapY = 80;
    let cursorY = 14;
    let maxX = 0;
    let maxY = 0;

    function placeCard(card, depth, startY) {
      if (!card || seen.has(card.id) || visiting.has(card.id)) {
        return { top: startY, bottom: startY };
      }

      visiting.add(card.id);

      const left = depth * depthStepX;
      const top = startY;

      positionedCards.push({
        card,
        left,
        top,
      });

      seen.add(card.id);
      maxX = Math.max(maxX, left + treeNodeWidth);
      maxY = Math.max(maxY, top + treeNodeHeight);

      let nextY = top + treeNodeHeight + childStepY;
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
        const childBounds = placeCard(childCard, depth + 1, nextY);
        nextY = childBounds.bottom + childStepY;
      });

      visiting.delete(card.id);
      return {
        top,
        bottom: Math.max(top + treeNodeHeight, nextY - childStepY),
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
    { treePosition } = {}
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
    const dependencyText = `A ${parentIds.length} · C ${childIds.length}`;

    return renderCard({
      controls: (
        <>
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
      onPress: () => handleFocusCard(index, layout),
      treePosition,
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

    return (
      <ScrollView
        style={styles.treeScroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.treeHorizontalContent}
      >
        <ScrollView
          style={styles.treeScroll}
          contentContainerStyle={styles.treeContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.treeCanvas, { height: maxHeight, width: maxWidth }]}>
            {positionedCards.map(({ card, left, top }) => (
              renderStackCard(card, 0, 'tree', {
                treePosition: { left, top },
              })
            ))}
          </View>
        </ScrollView>
      </ScrollView>
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
    paddingRight: 24,
    paddingLeft: 24,
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
    minHeight: 140,
    maxHeight: 160,
    padding: 16,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
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
