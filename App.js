import { Kalam_400Regular } from '@expo-google-fonts/kalam';
import { useFonts } from 'expo-font';
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
  getSnapshot,
  insertRelativeTo,
  loadCards,
  push,
  removeAt,
  setDoneAt,
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
  const [fontsLoaded] = useFonts({
    Kalam_400Regular,
  });
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
  const [leafPinnedDoneCardId, setLeafPinnedDoneCardId] = useState(null);
  const [isDeleteHoldActive, setIsDeleteHoldActive] = useState(false);
  const [addPreviewRelation, setAddPreviewRelation] = useState(null);
  const [isAddHoldActive, setIsAddHoldActive] = useState(false);

  const stack = useSyncExternalStore(subscribe, getSnapshot);
  const cards = useMemo(() => stack.map((card, index) => ({ ...card, index })), [stack]);
  const shouldRenderLeaf = layoutMode === 'leaf';
  const focusedCardId = focusedCardIndex === null
    ? null
    : cards[focusedCardIndex]?.id ?? null;

  const leafCards = useMemo(() => cards.filter((card) => (
    !card.done || (leafPinnedDoneCardId !== null && card.id === leafPinnedDoneCardId)
  )), [cards, leafPinnedDoneCardId]);

  const leafTopPosition = useMemo(() => {
    if (leafCards.length === 0) {
      return null;
    }

    if (leafTopIndex === null) {
      return leafCards.length - 1;
    }

    const matchingPosition = leafCards.findIndex((card) => card.index === leafTopIndex);
    return matchingPosition >= 0 ? matchingPosition : leafCards.length - 1;
  }, [leafCards, leafTopIndex]);

  const visibleCards = useMemo(() => {
    if (leafCards.length === 0) {
      return [];
    }

    if (leafTopPosition === null) {
      return [];
    }

    const normalizedTop = leafTopPosition;

    return Array.from(
      { length: Math.min(LEAF_VISIBLE_COUNT, leafCards.length) },
      (_, offset) => leafCards[(normalizedTop + offset) % leafCards.length],
    );
  }, [leafCards, leafTopPosition]);

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
      setLeafPinnedDoneCardId(null);
      return;
    }

    const fallbackTopCard = leafCards[leafCards.length - 1] ?? null;
    const fallbackTopId = fallbackTopCard?.id ?? null;
    setLeafFocusedCardId((current) => current ?? fallbackTopId);

    setLeafTopIndex((currentTop) => (
      currentTop === null ? fallbackTopCard?.index ?? null : Math.min(currentTop, cards.length - 1)
    ));
  }, [cards.length, leafCards]);

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
    setLeafPinnedDoneCardId(null);
    setIsDeleteHoldActive(false);
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

  function handleCreateCard(relation = 'child') {
    setAddPreviewRelation(null);
    setLeafPinnedDoneCardId(null);
    const currentIndex = shouldRenderLeaf
      ? visibleTopCardIndex
      : focusedCardIndex;
    const nextIndex = currentIndex === null
      ? push('')
      : insertRelativeTo(currentIndex, relation, '');

    setEditingIndex(nextIndex);
    setEditingValue('');
    setFocusedCardIndex(nextIndex);
    setLeafTopIndex(nextIndex);
  }

  function handleEditCard(index, text) {
    setLeafPinnedDoneCardId(null);
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
    setIsDeleteHoldActive(false);
    if (removedCard?.id === leafPinnedDoneCardId) {
      setLeafPinnedDoneCardId(null);
    }

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
    if (editingIndex !== null || leafCards.length === 0) {
      return false;
    }

    const traversalCards = cards.filter((card) => !card.done);

    if (traversalCards.length === 0) {
      if (!visibleCards[0]?.done) {
        return false;
      }

      setLeafPinnedDoneCardId(null);
      setLeafFocusedCardId(null);
      setLeafTopIndex(null);
      return true;
    }

    const currentCardId = visibleCards[0]?.id ?? leafFocusedCardId ?? traversalCards[0]?.id;
    const traversalMode = direction === 'left' || direction === 'right' ? 'dfs' : 'bfs';
    const nextCard = traversalCards.length === 1
      ? traversalCards[0]
      : moveInTraversal(traversalCards, currentCardId, direction, traversalMode);

    if (!nextCard || nextCard.index === undefined) {
      return false;
    }

    if (nextCard.id === currentCardId && !visibleCards[0]?.done) {
      return false;
    }

    setLeafPinnedDoneCardId(null);
    setLeafFocusedCardId(nextCard.id);
    setLeafTopIndex(nextCard.index);
    return true;
  }

  const visibleTopCardIndex = visibleCards[0]?.index ?? null;
  const effectiveLeafFocusedIndex = visibleTopCardIndex ?? focusedCardIndex;
  const canDeleteCurrentCard = shouldRenderLeaf
    ? visibleTopCardIndex !== null
    : focusedCardIndex !== null;
  const nodeMapCards = cards;
  const nodeMapFocusedCardId = shouldRenderLeaf ? leafFocusedCardId : focusedCardId;
  const nodeMapFocusedCardIndex = nodeMapFocusedCardId === null
    ? null
    : nodeMapCards.findIndex((card) => card.id === nodeMapFocusedCardId);

  function handleDeleteCurrentLeafCard() {
    if (!shouldRenderLeaf || visibleTopCardIndex === null) {
      setIsDeleteHoldActive(false);
      return;
    }

    handleDeleteCard(visibleTopCardIndex);
  }

  function handleDoneCurrentLeafCard() {
    if (!shouldRenderLeaf || visibleTopCardIndex === null) {
      return;
    }

    const currentCard = cards[visibleTopCardIndex];
    if (!currentCard) {
      return;
    }

    if (currentCard.done) {
      setDoneAt(visibleTopCardIndex, false);
      setLeafPinnedDoneCardId(null);
      setLeafFocusedCardId(currentCard.id);
      setLeafTopIndex(visibleTopCardIndex);
      return;
    }

    setLeafPinnedDoneCardId(currentCard.id);
    setDoneAt(visibleTopCardIndex, true);
    setLeafFocusedCardId(currentCard.id);
    setLeafTopIndex(visibleTopCardIndex);
  }

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
    setIsDeleteHoldActive(false);
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
      setLeafPinnedDoneCardId(null);
      setFocusedCardIndex(isFocusedCardVisible ? nextFocusedCardIndex : currentlyVisibleLeafCardIndex);
      setLeafTopIndex(null);
    } else {
      if (focusedCardInRange) {
        setLeafPinnedDoneCardId(cards[nextFocusedCardIndex]?.done ? cards[nextFocusedCardIndex]?.id ?? null : null);
        setFocusedCardIndex(nextFocusedCardIndex);
        setLeafTopIndex(nextFocusedCardIndex);
      } else {
        setLeafPinnedDoneCardId(null);
        setLeafTopIndex(cards.length > 0 ? cards.length - 1 : null);
      }
    }

    setEditingIndex(null);
    setEditingValue('');
  }

  if (!fontsLoaded || isRestoringSession || (authToken && !authUser)) {
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
    <View style={styles.appShell}>
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
            cards={leafCards}
            topIndex={leafTopPosition}
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
            isDeleteHoldActive={isDeleteHoldActive}
            isAddHoldActive={isAddHoldActive}
            addPreviewRelation={addPreviewRelation}
            onDeleteCurrentCard={handleDeleteCurrentLeafCard}
            onDoneCurrentCard={handleDoneCurrentLeafCard}
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
            onDeleteHoldComplete={handleDeleteCard}
            onEditingValueChange={setEditingValue}
            onCompleteEdit={handleCompleteEdit}
            isDeleteHoldActive={isDeleteHoldActive}
            onCanvasBlur={() => setFocusedCardIndex(null)}
          />
        )}
      </View>

      <NodeStructureView
        addPreviewRelation={addPreviewRelation}
        cards={nodeMapCards}
        deleteTargetActive={isDeleteHoldActive}
        focusedCardId={nodeMapFocusedCardId}
        focusedCardIndex={nodeMapFocusedCardIndex >= 0 ? nodeMapFocusedCardIndex : null}
      />

      <FloatingControls
        canDeleteCurrentCard={canDeleteCurrentCard}
        layoutMode={layoutMode}
        onDeleteHoldChange={setIsDeleteHoldActive}
        onAddHoldChange={setIsAddHoldActive}
        onAddPreviewChange={setAddPreviewRelation}
        onToggleMode={handleToggleLayout}
        onCreateCard={handleCreateCard}
      />

      <StatusBar style="light" />
    </View>
  );
}
