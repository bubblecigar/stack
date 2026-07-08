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
  removeDoneCascadeAt,
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
import {
  getMe,
  loadRemoteCards,
  loadRemoteUserData,
  saveRemoteCards,
  saveRemoteUserData,
} from './src/lib/apiClient';
import { clearStoredAuthToken, getStoredAuthToken, setStoredAuthToken } from './src/lib/authTokenStore';
import { moveInTraversal } from './src/lib/cardTraversal';
import { styles } from './src/styles/appStyles';

const LEAF_VISIBLE_COUNT = 5;
const TREE_COMPLETION_CANVAS_KEY = 'treeCompletionCanvas';
const TREE_COMPLETION_CANVAS_WIDTH = 1600;
const TREE_COMPLETION_CANVAS_HEIGHT = 1200;
const TREE_COMPLETION_CANVAS_PADDING = 48;
const TREE_COMPLETION_CANVAS_LINE_HEIGHT = 30;
const TREE_COMPLETION_TEXT_START_X = 32;
const TREE_COMPLETION_TEXT_START_Y = 48;
const EMPTY_TREE_COMPLETION_CANVAS = {
  imagePng: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  width: TREE_COMPLETION_CANVAS_WIDTH,
  height: TREE_COMPLETION_CANVAS_HEIGHT,
  entries: [],
  nextY: TREE_COMPLETION_TEXT_START_Y,
  updatedAt: null,
};

function getLeafRootScopedCards(cards, currentCardId) {
  if (currentCardId === null || currentCardId === undefined) {
    return cards;
  }

  const cardById = new Map(cards.map((card) => [card.id, card]));
  const currentCard = cardById.get(currentCardId);
  if (!currentCard) {
    return cards;
  }

  const ancestorRootIds = new Set();
  const visitedAncestors = new Set();

  function collectAncestorRoots(card) {
    if (!card || visitedAncestors.has(card.id)) {
      return;
    }

    visitedAncestors.add(card.id);
    const parentIds = Array.isArray(card.parentIds) ? card.parentIds : [];
    const parentCards = parentIds
      .map((parentId) => cardById.get(parentId))
      .filter(Boolean);

    if (parentCards.length === 0) {
      ancestorRootIds.add(card.id);
      return;
    }

    parentCards.forEach(collectAncestorRoots);
  }

  collectAncestorRoots(currentCard);

  if (ancestorRootIds.size === 0) {
    return cards;
  }

  const scopedIds = new Set();
  function collectDescendants(card) {
    if (!card || scopedIds.has(card.id)) {
      return;
    }

    scopedIds.add(card.id);
    (card.childIds || [])
      .map((childId) => cardById.get(childId))
      .filter(Boolean)
      .forEach(collectDescendants);
  }

  ancestorRootIds.forEach((rootId) => {
    collectDescendants(cardById.get(rootId));
  });

  return cards.filter((card) => scopedIds.has(card.id));
}

function getRootTreeCardIds(cards, currentCardId) {
  if (currentCardId === null || currentCardId === undefined) {
    return new Set();
  }

  const cardById = new Map(cards.map((card) => [card.id, card]));
  const currentCard = cardById.get(currentCardId);
  if (!currentCard) {
    return new Set();
  }

  const rootIds = new Set();
  const visitedAncestors = new Set();

  function collectRootIds(card) {
    if (!card || visitedAncestors.has(card.id)) {
      return;
    }

    visitedAncestors.add(card.id);
    const parentCards = (Array.isArray(card.parentIds) ? card.parentIds : [])
      .map((parentId) => cardById.get(parentId))
      .filter(Boolean);

    if (parentCards.length === 0) {
      rootIds.add(card.id);
      return;
    }

    parentCards.forEach(collectRootIds);
  }

  collectRootIds(currentCard);

  const rootTreeCardIds = new Set();
  function collectDescendantIds(card) {
    if (!card || rootTreeCardIds.has(card.id)) {
      return;
    }

    rootTreeCardIds.add(card.id);
    (card.childIds || [])
      .map((childId) => cardById.get(childId))
      .filter(Boolean)
      .forEach(collectDescendantIds);
  }

  rootIds.forEach((rootId) => {
    collectDescendantIds(cardById.get(rootId));
  });

  return rootTreeCardIds;
}

function wrapCanvasText(context, text, maxWidth) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let currentLine = '';

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(nextLine).width <= maxWidth || !currentLine) {
      currentLine = nextLine;
      return;
    }

    lines.push(currentLine);
    currentLine = word;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}

function loadCanvasImage(source) {
  return new Promise((resolve) => {
    if (!source || typeof window === 'undefined' || !window.Image) {
      resolve(null);
      return;
    }

    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
  });
}

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
  const [treeCompletionCanvas, setTreeCompletionCanvas] = useState(EMPTY_TREE_COMPLETION_CANVAS);

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
    setTreeCompletionCanvas(EMPTY_TREE_COMPLETION_CANVAS);
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
        const [cardsResult, canvasResult] = await Promise.all([
          loadRemoteCards(authToken),
          loadRemoteUserData(authToken, TREE_COMPLETION_CANVAS_KEY),
        ]);

        if (!isMounted) {
          return;
        }

        isApplyingRemoteCards.current = true;
        loadCards(Array.isArray(cardsResult.cards) ? cardsResult.cards : []);
        isApplyingRemoteCards.current = false;
        setTreeCompletionCanvas(canvasResult.value || EMPTY_TREE_COMPLETION_CANVAS);
        hasLoadedRemoteCards.current = true;

        if (!canvasResult.value) {
          saveRemoteUserData(
            authToken,
            TREE_COMPLETION_CANVAS_KEY,
            EMPTY_TREE_COMPLETION_CANVAS,
          ).catch(() => {});
        }
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

  async function writeRemovedCardsToTreeCanvas(removedCards) {
    const removedTexts = removedCards
      .map((card) => String(card?.text || '').trim())
      .filter(Boolean);

    if (removedTexts.length === 0) {
      return;
    }

    const currentCanvas = treeCompletionCanvas || EMPTY_TREE_COMPLETION_CANVAS;
    const baseWidth = Math.max(
      Number(currentCanvas.width) || TREE_COMPLETION_CANVAS_WIDTH,
      TREE_COMPLETION_CANVAS_WIDTH,
    );
    const baseHeight = Math.max(
      Number(currentCanvas.height) || TREE_COMPLETION_CANVAS_HEIGHT,
      TREE_COMPLETION_CANVAS_HEIGHT,
    );
    const startY = Math.max(
      Number(currentCanvas.nextY) || TREE_COMPLETION_TEXT_START_Y,
      TREE_COMPLETION_TEXT_START_Y,
    );

    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      const nextEntries = [
        ...(Array.isArray(currentCanvas.entries) ? currentCanvas.entries : []),
        ...removedTexts.map((text, textIndex) => ({
          id: `removed-${Date.now()}-${textIndex}`,
          text,
          x: TREE_COMPLETION_TEXT_START_X,
          y: startY + (textIndex * TREE_COMPLETION_CANVAS_LINE_HEIGHT),
        })),
      ];
      const nextCanvas = {
        ...currentCanvas,
        entries: nextEntries,
        height: baseHeight,
        nextY: startY + (removedTexts.length * TREE_COMPLETION_CANVAS_LINE_HEIGHT),
        updatedAt: Date.now(),
        width: baseWidth,
      };

      setTreeCompletionCanvas(nextCanvas);
      if (authToken) {
        saveRemoteUserData(
          authToken,
          TREE_COMPLETION_CANVAS_KEY,
          nextCanvas,
        ).catch(() => {});
      }
      return;
    }

    const measureCanvas = document.createElement('canvas');
    const measureContext = measureCanvas.getContext('2d');
    measureContext.font = '28px Kalam, Kalam_400Regular, cursive';
    const maxTextWidth = baseWidth - TREE_COMPLETION_TEXT_START_X - TREE_COMPLETION_CANVAS_PADDING;
    const wrappedLines = removedTexts.flatMap((text) => (
      wrapCanvasText(measureContext, text, maxTextWidth)
    ));
    const requiredHeight = startY
      + (wrappedLines.length * TREE_COMPLETION_CANVAS_LINE_HEIGHT)
      + TREE_COMPLETION_CANVAS_PADDING;
    const nextHeight = Math.max(baseHeight, requiredHeight);
    const existingImage = await loadCanvasImage(currentCanvas.imagePng);

    const canvas = document.createElement('canvas');
    canvas.width = baseWidth;
    canvas.height = nextHeight;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (existingImage) {
      context.drawImage(existingImage, 0, 0, baseWidth, baseHeight);
    }

    context.font = '28px Kalam, Kalam_400Regular, cursive';
    context.fillStyle = '#475569';
    context.globalAlpha = 0.72;
    let y = startY;
    wrappedLines.forEach((line) => {
      context.fillText(line, TREE_COMPLETION_TEXT_START_X, y);
      y += TREE_COMPLETION_CANVAS_LINE_HEIGHT;
    });
    context.globalAlpha = 1;

    const nextCanvas = {
      entries: [
        ...(Array.isArray(currentCanvas.entries) ? currentCanvas.entries : []),
        ...wrappedLines.map((text, lineIndex) => ({
          id: `removed-${Date.now()}-${lineIndex}`,
          text,
          x: TREE_COMPLETION_TEXT_START_X,
          y: startY + (lineIndex * TREE_COMPLETION_CANVAS_LINE_HEIGHT),
        })),
      ],
      imagePng: canvas.toDataURL('image/png'),
      width: baseWidth,
      height: nextHeight,
      nextY: y + TREE_COMPLETION_CANVAS_LINE_HEIGHT,
      updatedAt: Date.now(),
    };

    setTreeCompletionCanvas(nextCanvas);
    if (authToken) {
      saveRemoteUserData(
        authToken,
        TREE_COMPLETION_CANVAS_KEY,
        nextCanvas,
      ).catch(() => {});
    }
  }

  function handleDeleteCard(index) {
    const removedCard = cards[index];
    if (!removedCard) {
      return;
    }

    const candidateIds = new Set();
    const visitedIds = new Set();

    function collectCandidateIds(cardId) {
      if (visitedIds.has(cardId)) {
        return;
      }

      visitedIds.add(cardId);
      candidateIds.add(cardId);

      const candidateCard = cards.find((card) => card.id === cardId);
      if (!candidateCard) {
        return;
      }

      (candidateCard.childIds || []).forEach(collectCandidateIds);
    }

    if (removedCard.done) {
      collectCandidateIds(removedCard.id);
    } else {
      candidateIds.add(removedCard.id);
    }

    const removedCards = removedCard.done
      ? cards.filter((card) => candidateIds.has(card.id) && card.done)
      : [removedCard];
    const removedCardIds = new Set(removedCards.map((card) => card.id));
    const removedIndexes = removedCards
      .map((card) => card.index)
      .filter((itemIndex) => Number.isInteger(itemIndex))
      .sort((left, right) => left - right);
    const nextCardCount = Math.max(cards.length - removedIndexes.length, 0);

    function adjustIndexAfterRemoval(currentIndex) {
      if (currentIndex === null || currentIndex === undefined) {
        return null;
      }

      const currentCard = cards[currentIndex];
      if (currentCard && removedCardIds.has(currentCard.id)) {
        return null;
      }

      const removedBeforeCount = removedIndexes.filter((removedIndex) => (
        removedIndex < currentIndex
      )).length;
      const adjustedIndex = currentIndex - removedBeforeCount;
      return nextCardCount > 0
        ? Math.max(0, Math.min(adjustedIndex, nextCardCount - 1))
        : null;
    }

    setIsDeleteHoldActive(false);
    if (removedCardIds.has(leafPinnedDoneCardId)) {
      setLeafPinnedDoneCardId(null);
    }

    const nextEditingIndex = adjustIndexAfterRemoval(editingIndex);
    if (nextEditingIndex === null) {
      setEditingIndex(null);
      setEditingValue('');
    } else if (nextEditingIndex !== editingIndex) {
      setEditingIndex(nextEditingIndex);
    }

    setFocusedCardIndex(adjustIndexAfterRemoval(focusedCardIndex));

    setLeafTopIndex((currentTop) => {
      if (nextCardCount === 0) {
        return null;
      }

      if (currentTop === null) {
        return nextCardCount - 1;
      }

      return adjustIndexAfterRemoval(currentTop) ?? Math.min(currentTop, nextCardCount - 1);
    });

    if (removedCardIds.size > 0) {
      setCollapsedNodeIds((currentCollapsed) => {
        if (![...removedCardIds].some((cardId) => currentCollapsed.has(cardId))) {
          return currentCollapsed;
        }

        const nextCollapsed = new Set(currentCollapsed);
        removedCardIds.forEach((cardId) => {
          nextCollapsed.delete(cardId);
        });
        return nextCollapsed;
      });
    }

    if (removedCard.done) {
      removeDoneCascadeAt(index);
      writeRemovedCardsToTreeCanvas(removedCards);
      return;
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

    const currentCardId = visibleCards[0]?.id ?? leafFocusedCardId ?? cards[0]?.id;
    const rootScopedCards = getLeafRootScopedCards(cards, currentCardId);
    const traversalCards = rootScopedCards.filter((card) => !card.done);

    if (traversalCards.length === 0) {
      if (!visibleCards[0]?.done) {
        return false;
      }

      setLeafPinnedDoneCardId(null);
      setLeafFocusedCardId(null);
      setLeafTopIndex(null);
      return true;
    }

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
  const nodeMapFocusedCardId = shouldRenderLeaf ? leafFocusedCardId : focusedCardId;
  const nodeMapCards = shouldRenderLeaf
    ? getLeafRootScopedCards(cards, nodeMapFocusedCardId)
    : cards;
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
      const treeFocusedCardIndex = isFocusedCardVisible
        ? nextFocusedCardIndex
        : currentlyVisibleLeafCardIndex;
      const treeFocusedCardId = treeFocusedCardIndex === null
        ? null
        : cards[treeFocusedCardIndex]?.id ?? null;
      const expandedRootTreeIds = getRootTreeCardIds(cards, treeFocusedCardId);

      if (expandedRootTreeIds.size > 0) {
        setCollapsedNodeIds((currentCollapsed) => {
          let didExpand = false;
          const nextCollapsed = new Set(currentCollapsed);

          expandedRootTreeIds.forEach((cardId) => {
            if (nextCollapsed.delete(cardId)) {
              didExpand = true;
            }
          });

          return didExpand ? nextCollapsed : currentCollapsed;
        });
      }

      setLeafPinnedDoneCardId(null);
      setFocusedCardIndex(treeFocusedCardIndex);
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
            treeCompletionCanvas={treeCompletionCanvas}
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
        canDeleteCurrentCard={!shouldRenderLeaf && canDeleteCurrentCard}
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
