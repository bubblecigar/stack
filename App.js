import { StatusBar } from 'expo-status-bar';
import {
  LayoutAnimation,
  Platform,
  Text,
  UIManager,
  View,
} from 'react-native';
import {
  useEffect, useMemo, useRef, useState, useSyncExternalStore,
} from 'react';
import {
  addChildLink,
  getSnapshot,
  loadCards,
  push,
  removeAt,
  subscribe,
  updateAt,
} from './stackStore';
import defaultStackData from './defaultStack.json';
import { FloatingControls } from './src/components/FloatingControls';
import { AuthScreen } from './src/views/AuthScreen';
import { LeafDeck } from './src/views/LeafDeck';
import { NodeStructureView } from './src/views/NodeStructureView';
import { TreeCanvas } from './src/views/TreeCanvas';
import { getMe, loadRemoteCards, saveRemoteCards } from './src/lib/apiClient';
import { clearStoredAuthToken, getStoredAuthToken, setStoredAuthToken } from './src/lib/authTokenStore';
import { moveInTraversal } from './src/lib/cardTraversal';
import { styles } from './src/styles/appStyles';

const LEAF_VISIBLE_COUNT = 5;

export default function App() {
  const [authToken, setAuthToken] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [isLoadingUserData, setIsLoadingUserData] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [focusedCardIndex, setFocusedCardIndex] = useState(null);
  const [layoutMode, setLayoutMode] = useState('leaf');
  const [collapsedNodeIds, setCollapsedNodeIds] = useState(() => new Set());
  const [leafTopIndex, setLeafTopIndex] = useState(null);
  const [leafFocusedCardId, setLeafFocusedCardId] = useState(null);

  const stack = useSyncExternalStore(subscribe, getSnapshot);
  const cards = useMemo(() => stack.map((card, index) => ({ ...card, index })), [stack]);
  const shouldRenderLeaf = layoutMode === 'leaf';
  const focusedCardId = focusedCardIndex === null
    ? null
    : cards[focusedCardIndex]?.id ?? null;

  const visibleCards = useMemo(() => {
    if (cards.length === 0) {
      return [];
    }

    const normalizedTop = leafTopIndex === null
      ? cards.length - 1
      : Math.max(
        0,
        Math.min(leafTopIndex, cards.length - 1),
      );

    return Array.from(
      { length: Math.min(LEAF_VISIBLE_COUNT, cards.length) },
      (_, offset) => cards[(normalizedTop + offset) % cards.length],
    );
  }, [cards, leafTopIndex]);

  const hasLoadedDefaultStack = useRef(false);
  const hasLoadedRemoteCards = useRef(false);
  const isApplyingRemoteCards = useRef(false);
  const authUserRef = useRef(null);
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
    authUserRef.current = authUser;
  }, [authUser]);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const storedToken = await getStoredAuthToken();
        if (isMounted && storedToken) {
          setAuthToken(storedToken);
        }
      } finally {
        if (isMounted) {
          setIsRestoringSession(false);
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (cards.length === 0) {
      setLeafFocusedCardId(null);
      setLeafTopIndex(null);
      return;
    }

    const fallbackTopId = cards[cards.length - 1]?.id ?? null;
    setLeafFocusedCardId((current) => current ?? fallbackTopId);

    setLeafTopIndex((currentTop) => (
      currentTop === null ? cards.length - 1 : Math.min(currentTop, cards.length - 1)
    ));
  }, [cards.length]);

  useEffect(() => {
    if (!__DEV__) {
      return;
    }

    if (!authUser || !hasLoadedRemoteCards.current) {
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

  function resetSession() {
    clearStoredAuthToken();
    setAuthToken(null);
    setAuthUser(null);
    setIsRestoringSession(false);
    setIsLoadingUserData(false);
    setSyncError('');
    setEditingIndex(null);
    setEditingValue('');
    setFocusedCardIndex(null);
    setLeafTopIndex(null);
    setLeafFocusedCardId(null);
    setCollapsedNodeIds(new Set());
    hasLoadedDefaultStack.current = false;
    hasLoadedRemoteCards.current = false;
    isApplyingRemoteCards.current = true;
    loadCards([]);
    isApplyingRemoteCards.current = false;
  }

  function handleAuthExpired() {
    resetSession();
  }

  function handleAuthenticated(result) {
    setStoredAuthToken(result.token).catch(() => {});
    setAuthToken(result.token);
    setAuthUser(result.user);
    setSyncError('');
    hasLoadedDefaultStack.current = false;
    hasLoadedRemoteCards.current = false;
  }

  useEffect(() => {
    if (!authToken) {
      return undefined;
    }

    let isMounted = true;

    async function validateToken() {
      try {
        const result = await getMe(authToken);
        if (isMounted) {
          setAuthUser((currentUser) => {
            if (
              currentUser?.id === result.user?.id
              && currentUser?.email === result.user?.email
            ) {
              return currentUser;
            }

            return result.user;
          });
        }
      } catch (error) {
        if (error.status === 401 && isMounted) {
          handleAuthExpired();
          return;
        }

        if (isMounted && !authUserRef.current) {
          resetSession();
        }
      }
    }

    validateToken();
    const intervalId = setInterval(validateToken, 60000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [authToken]);

  useEffect(() => {
    if (!authToken) {
      return undefined;
    }

    let isMounted = true;
    setIsLoadingUserData(true);
    setSyncError('');

    async function loadCardsForUser() {
      try {
        const result = await loadRemoteCards(authToken);

        if (!isMounted) {
          return;
        }

        isApplyingRemoteCards.current = true;
        loadCards(Array.isArray(result.cards) ? result.cards : []);
        isApplyingRemoteCards.current = false;
        hasLoadedRemoteCards.current = true;
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error.status === 401) {
          handleAuthExpired();
          return;
        }

        setSyncError(error.message || 'Could not load user data.');
      } finally {
        if (isMounted) {
          setIsLoadingUserData(false);
        }
      }
    }

    loadCardsForUser();

    return () => {
      isMounted = false;
    };
  }, [authToken]);

  useEffect(() => {
    if (!authToken || !hasLoadedRemoteCards.current || isApplyingRemoteCards.current) {
      return undefined;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setSyncError('');
        await saveRemoteCards(authToken, stack);
      } catch (error) {
        if (error.status === 401) {
          handleAuthExpired();
          return;
        }

        setSyncError(error.message || 'Could not save user data.');
      }
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [authToken, stack]);

  function handleCreateCard() {
    const nextIndex = push('');
    const parentIndex = focusedCardIndex;

    if (parentIndex !== null) {
      addChildLink(parentIndex, nextIndex);
    }

    setEditingIndex(nextIndex);
    setEditingValue('');
    setFocusedCardIndex(nextIndex);
    setLeafTopIndex(nextIndex);
  }

  function handleEditCard(index, text) {
    setEditingIndex(index);
    setEditingValue(text);
    setFocusedCardIndex(index);
    setLeafTopIndex(index);
  }

  function handleCompleteEdit(index, value) {
    if (editingIndex !== index) {
      return;
    }

    updateAt(index, value);
    setEditingIndex(null);
    setEditingValue('');
  }

  function handleConfirmEdit() {
    if (editingIndex === null) {
      return;
    }

    handleCompleteEdit(editingIndex, editingValue);
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

    if (focusedCardIndex === index) {
      setFocusedCardIndex(null);
    } else if (focusedCardIndex > index) {
      setFocusedCardIndex(focusedCardIndex - 1);
    }

    setLeafTopIndex((currentTop) => {
      if (cards.length === 0) {
        return null;
      }

      if (currentTop === null) {
        return Math.max(cards.length - 2, 0);
      }

      const adjustedTop = currentTop - (index < currentTop ? 1 : 0);
      return Math.max(0, Math.min(adjustedTop, cards.length - 2));
    });

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
    if (editingIndex === index) {
      setFocusedCardIndex(index);
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

  function handleTreeCardFocus(index) {
    if (focusedCardIndex !== index) {
      setFocusedCardIndex(index);
    }
  }

  function handleLeafSwipe(direction) {
    if (editingIndex !== null || cards.length === 0) {
      return false;
    }

    if (cards.length === 1) {
      return false;
    }

    const currentCardId = visibleCards[0]?.id ?? leafFocusedCardId ?? cards[0]?.id;
    const traversalMode = direction === 'left' || direction === 'right' ? 'dfs' : 'bfs';
    const nextCard = moveInTraversal(cards, currentCardId, direction, traversalMode);

    if (!nextCard || nextCard.index === undefined) {
      return false;
    }

    setLeafFocusedCardId(nextCard.id);
    setLeafTopIndex(nextCard.index);
    return true;
  }

  const visibleTopCardIndex = visibleCards[0]?.index ?? null;
  const effectiveLeafFocusedIndex = visibleTopCardIndex ?? focusedCardIndex;

  useEffect(() => {
    if (!shouldRenderLeaf) {
      return;
    }

    const visibleTopCardId = visibleCards[0]?.id ?? null;

    if (leafFocusedCardId !== visibleTopCardId) {
      setLeafFocusedCardId(visibleTopCardId);
    }

    const renderedTopIndex = visibleCards[0]?.index ?? null;
    if (cards.length === 0) {
      if (focusedCardIndex !== null) {
        setFocusedCardIndex(null);
      }
      return;
    }

    if (renderedTopIndex === null || focusedCardIndex === renderedTopIndex) {
      return;
    }

    setFocusedCardIndex(renderedTopIndex);
  }, [
    shouldRenderLeaf,
    visibleCards,
    cards.length,
    focusedCardIndex,
    leafFocusedCardId,
  ]);

  function handleToggleLayout() {
    const isLeafToTree = layoutMode === 'leaf';
    const pendingEditIndex = editingIndex;
    const hasPendingEdit = pendingEditIndex !== null;
    const currentlyVisibleLeafCardIndex = visibleCards[0]?.index ?? null;
    const nextFocusedCardIndex = hasPendingEdit ? pendingEditIndex : focusedCardIndex;
    const isFocusedCardVisible = (
      nextFocusedCardIndex !== null
      && visibleCards.some(({ index }) => index === nextFocusedCardIndex)
    );
    const focusedCardInRange = (
      nextFocusedCardIndex !== null
      && nextFocusedCardIndex >= 0
      && nextFocusedCardIndex < cards.length
    );

    if (hasPendingEdit) {
      updateAt(pendingEditIndex, editingValue);
    }

    setLayoutMode((currentMode) => (currentMode === 'leaf' ? 'tree' : 'leaf'));

    if (isLeafToTree) {
      setFocusedCardIndex(isFocusedCardVisible ? nextFocusedCardIndex : currentlyVisibleLeafCardIndex);
      setLeafTopIndex(null);
    } else {
      if (focusedCardInRange) {
        setFocusedCardIndex(nextFocusedCardIndex);
        setLeafTopIndex(nextFocusedCardIndex);
      } else {
        setLeafTopIndex(cards.length > 0 ? cards.length - 1 : null);
      }
    }

    setEditingIndex(null);
    setEditingValue('');
  }

  if (isRestoringSession || (authToken && !authUser)) {
    return (
      <>
        <View style={styles.authContainer}>
          <View style={styles.authPanel}>
            <Text style={styles.authTitle}>Loading</Text>
          </View>
        </View>
        <StatusBar style="dark" />
      </>
    );
  }

  if (!authToken || !authUser) {
    return (
      <>
        <AuthScreen onAuthenticated={handleAuthenticated} />
        <StatusBar style="dark" />
      </>
    );
  }

  return (
    <View style={shouldRenderLeaf ? styles.containerLeafMode : styles.containerTreeMode}>
      {isLoadingUserData ? (
        <View style={styles.syncBanner}>
          <Text style={styles.syncBannerText}>Loading user data</Text>
        </View>
      ) : null}
      {syncError ? (
        <View style={styles.syncBanner}>
          <Text style={styles.syncBannerText}>{syncError}</Text>
        </View>
      ) : null}
      {shouldRenderLeaf ? (
        <LeafDeck
          cards={cards}
          topIndex={leafTopIndex}
          visibleCount={LEAF_VISIBLE_COUNT}
          editingIndex={editingIndex}
          editingValue={editingValue}
          focusedCardIndex={effectiveLeafFocusedIndex}
          focusedCardId={leafFocusedCardId}
          collapsedNodeIds={collapsedNodeIds}
          onCreateEdit={handleToggleEdit}
          onDeleteCard={handleDeleteCard}
          onEditingValueChange={setEditingValue}
          onCompleteEdit={handleCompleteEdit}
          onLeafSwipe={handleLeafSwipe}
          swipeDisabled={editingIndex !== null}
        />
      ) : (
        <TreeCanvas
          cards={cards}
          collapsedNodeIds={collapsedNodeIds}
          focusedCardIndex={focusedCardIndex}
          focusedCardId={focusedCardId}
          editingIndex={editingIndex}
          editingValue={editingValue}
          onCardPress={handleTreeCardPress}
          onCardFocus={handleTreeCardFocus}
          onCreateEdit={handleToggleEdit}
          onToggleCollapse={handleToggleCollapse}
          onDeleteCard={handleDeleteCard}
          onEditingValueChange={setEditingValue}
          onCompleteEdit={handleCompleteEdit}
          onCanvasBlur={() => setFocusedCardIndex(null)}
        />
      )}

      <NodeStructureView
        cards={cards}
        focusedCardIndex={focusedCardIndex}
      />

      <FloatingControls
        layoutMode={layoutMode}
        onToggleMode={handleToggleLayout}
        onCreateCard={handleCreateCard}
      />

      <StatusBar style="light" />
    </View>
  );
}
