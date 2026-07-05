import { StatusBar } from 'expo-status-bar';
import {
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  getSnapshot,
  loadCards,
  push,
  removeAt,
  subscribe,
  updateAt,
} from './stackStore';
import defaultStackData from './defaultStack.json';
import { FloatingControls } from './src/components/FloatingControls';
import { LeafDeck } from './src/views/LeafDeck';
import { TreeCanvas } from './src/views/TreeCanvas';
import { styles } from './src/styles/appStyles';
import { View } from 'react-native';

export default function App() {
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [linkingIndex, setLinkingIndex] = useState(null);
  const [focusedCardIndex, setFocusedCardIndex] = useState(null);
  const [layoutMode, setLayoutMode] = useState('leaf');
  const [collapsedNodeIds, setCollapsedNodeIds] = useState(() => new Set());

  const stack = useSyncExternalStore(subscribe, getSnapshot);
  const cards = useMemo(() => stack.map((card, index) => ({ ...card, index })), [stack]);
  const visibleCards = useMemo(() => cards.slice(-4).reverse(), [cards]);

  const hasLoadedDefaultStack = useRef(false);
  const treeCardPressState = useRef({
    index: null,
    timestamp: 0,
  });

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    if (!__DEV__) {
      return;
    }

    if (hasLoadedDefaultStack.current || stack.length > 0) {
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

  function handleCreateCard() {
    const nextIndex = push('');
    setEditingIndex(nextIndex);
    setEditingValue('');
    setLinkingIndex(null);
    setFocusedCardIndex(nextIndex);
  }

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

  function handleTouchCard(index) {
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

    handleTouchCard(index);
  }

  function handleToggleLayout() {
    setLayoutMode((currentMode) => (currentMode === 'leaf' ? 'tree' : 'leaf'));
    setFocusedCardIndex(null);
    setEditingIndex(null);
    setEditingValue('');
    setLinkingIndex(null);
  }

  const shouldRenderLeaf = layoutMode === 'leaf';

  return (
    <View style={styles.container}>
      {shouldRenderLeaf ? (
        <LeafDeck
          cards={visibleCards}
          editingIndex={editingIndex}
          editingValue={editingValue}
          focusedCardIndex={focusedCardIndex}
          collapsedNodeIds={collapsedNodeIds}
          linkingIndex={linkingIndex}
          onCreateEdit={handleToggleEdit}
          onToggleLinking={handleToggleLinking}
          onDeleteCard={handleDeleteCard}
          onEditingValueChange={setEditingValue}
        />
      ) : (
        <TreeCanvas
          cards={cards}
          collapsedNodeIds={collapsedNodeIds}
          focusedCardIndex={focusedCardIndex}
          editingIndex={editingIndex}
          editingValue={editingValue}
          linkingIndex={linkingIndex}
          onCardPress={handleTreeCardPress}
          onTreeTouch={handleTouchCard}
          onCreateEdit={handleToggleEdit}
          onToggleCollapse={handleToggleCollapse}
          onToggleLinking={handleToggleLinking}
          onDeleteCard={handleDeleteCard}
          onEditingValueChange={setEditingValue}
        />
      )}

      <FloatingControls
        layoutMode={layoutMode}
        onToggleMode={handleToggleLayout}
        onCreateCard={handleCreateCard}
      />

      <StatusBar style="light" />
    </View>
  );
}
