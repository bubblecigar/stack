import { Kalam_400Regular } from '@expo-google-fonts/kalam';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Alert,
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
  adoptMissionRoot,
  archiveRootTree,
  clearCardImageAt,
  ensureSystemCards,
  getSnapshot,
  insertRelativeTo,
  isSystemCard,
  loadCards,
  MISSION_CARD_ID,
  push,
  removeAt,
  removeDoneCascadeAt,
  restoreRootTree,
  setCardImageAt,
  setScanStateAt,
  setDoneAt,
  subscribe,
  TREASURE_CARD_ID,
  updateAt,
} from './stackStore';
import defaultStackData from './defaultStack.json';
import { CompletionProgressTree } from './src/components/CompletionProgressTree';
import { FloatingControls } from './src/components/FloatingControls';
import { AuthScreen } from './src/views/AuthScreen';
import { LeafDeck } from './src/views/LeafDeck';
import { NodeStructureView } from './src/views/NodeStructureView';
import { TreeCanvas } from './src/views/TreeCanvas';
import {
  createScanJob,
  deleteCardImage,
  failScanJobImageUpload,
  getMe,
  loadRemoteCards,
  loadScanJob,
  loadRemoteUserData,
  resolveApiAssetUrl,
  saveRemoteCards,
  saveRemoteUserData,
  uploadScanJobImage,
  uploadCardImage,
} from './src/lib/apiClient';
import { clearStoredAuthToken, getStoredAuthToken, setStoredAuthToken } from './src/lib/authTokenStore';
import {
  getCollapsibleDescendantIds,
  moveInTraversal,
} from './src/lib/cardTraversal';
import { getDailyVisibleCards } from './src/lib/cardVisibility';
import {
  getHiddenSystemCardIds,
  getVisibleCardsExcludingIds,
} from './src/lib/systemVisibility';
import {
  deleteTextAtSelection,
  insertTextAtSelection,
} from './src/lib/textEditActions';
import {
  playDoneStampSound,
  playLeafSwipeSound,
  playModeFlipSound,
  playTrashSound,
  setSoundEffectsEnabled,
} from './src/lib/soundEffects';
import { getStoredUiState, setStoredUiState } from './src/lib/uiStateStore';
import { ensureDailyReminderScheduled } from './src/lib/dailyReminder';
import {
  moveMathKeyboardKey,
  normalizeMathKeyboardKeys,
  updateMathKeyboardKeyAt,
} from './src/lib/mathKeyboardConfig';
import {
  getStoredMathKeyboardKeys,
  setStoredMathKeyboardKeys,
} from './src/lib/mathKeyboardStore';
import {
  appendScanTreeResultToPlaceholder,
  formatScanResultTitle,
  SCAN_PLACEHOLDER_TEXT,
  updatePendingScanPlaceholder,
} from './src/lib/scanPlaceholder';
import { SCAN_CARDS_PROMPT } from './src/lib/scanPrompt';
import { createScanRequestId } from './src/lib/scanJobs';
import { styles } from './src/styles/appStyles';

const LEAF_VISIBLE_COUNT = 5;
const TREE_COMPLETION_CANVAS_KEY = 'treeCompletionCanvas';
const DAY_START_OFFSET_MS = ((4 * 60) + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const EMPTY_TREE_COMPLETION_CANVAS = {
  entries: [],
  nodes: [],
  updatedAt: null,
};

function getDoneCleanupCardIds(cards, rootCardId) {
  const rootCard = cards.find((card) => card.id === rootCardId);
  if (!rootCard?.done) {
    return new Set();
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

  collectCandidateIds(rootCard.id);

  return new Set(
    cards
      .filter((card) => candidateIds.has(card.id) && card.done)
      .map((card) => card.id),
  );
}

function getCompletionDayKey(timestamp = Date.now()) {
  const date = new Date(Number(timestamp) - DAY_START_OFFSET_MS);
  if (Number.isNaN(date.getTime())) {
    return getCompletionDayKey(Date.now());
  }

  return date.toISOString().slice(0, 10);
}

function getTreeCompletionCanvasKey(timestamp = Date.now()) {
  return `${TREE_COMPLETION_CANVAS_KEY}:${getCompletionDayKey(timestamp)}`;
}

function getNextCompletionDayBoundary(timestamp = Date.now()) {
  const current = new Date(timestamp);
  const boundary = new Date(
    current.getFullYear(),
    current.getMonth(),
    current.getDate(),
    4,
    30,
    0,
    0,
  );

  if (timestamp >= boundary.getTime()) {
    boundary.setDate(boundary.getDate() + 1);
  }

  return boundary.getTime();
}

function isPreviousDayTimestamp(timestamp) {
  const date = new Date(Number(timestamp) - DAY_START_OFFSET_MS);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const yesterday = new Date(Date.now() - DAY_START_OFFSET_MS);
  yesterday.setDate(yesterday.getDate() - 1);

  return date.getFullYear() === yesterday.getFullYear()
    && date.getMonth() === yesterday.getMonth()
    && date.getDate() === yesterday.getDate();
}

function countPreviousDayCompletedTasks(treeCompletionCanvas) {
  const completionNodes = Array.isArray(treeCompletionCanvas?.nodes)
    ? treeCompletionCanvas.nodes
    : [];
  if (completionNodes.length > 0) {
    return completionNodes.length;
  }

  const completionEntries = Array.isArray(treeCompletionCanvas?.entries)
    ? treeCompletionCanvas.entries
    : [];

  return completionEntries.filter((entry) => isPreviousDayTimestamp(entry?.completedAt)).length;
}

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

function getRootIdsForCard(cards, currentCardId) {
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
  return rootIds;
}

function getFocusedSystemRootId(cards, currentCardId) {
  if (currentCardId === MISSION_CARD_ID || currentCardId === TREASURE_CARD_ID) {
    return currentCardId;
  }

  const rootIds = getRootIdsForCard(cards, currentCardId);
  return [MISSION_CARD_ID, TREASURE_CARD_ID]
    .find((systemCardId) => rootIds.has(systemCardId)) ?? null;
}

function getLeafTraversalCards(cards, systemTreeCards, currentCardId) {
  if (getFocusedSystemRootId(systemTreeCards, currentCardId)) {
    return getLeafRootScopedCards(systemTreeCards, currentCardId);
  }

  return getLeafRootScopedCards(cards, currentCardId);
}

function getSystemSubtreeCards(cards, systemCardId) {
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const systemCard = cardById.get(systemCardId);
  if (!systemCard) {
    return [];
  }

  const subtreeIds = new Set();
  function collectSubtree(card) {
    if (!card || subtreeIds.has(card.id)) {
      return;
    }

    subtreeIds.add(card.id);
    (card.childIds || [])
      .map((childId) => cardById.get(childId))
      .filter(Boolean)
      .forEach(collectSubtree);
  }

  collectSubtree(systemCard);
  return cards.filter((card) => subtreeIds.has(card.id));
}

function getSystemTreeCards(cards) {
  const renderCards = cards.map((card) => ({
    ...card,
    isArchivedRoot: (
      card.id !== TREASURE_CARD_ID
      && Array.isArray(card.parentIds)
      && card.parentIds.includes(TREASURE_CARD_ID)
    ),
    isMissionRoot: (
      card.id !== MISSION_CARD_ID
      && Array.isArray(card.parentIds)
      && card.parentIds.includes(MISSION_CARD_ID)
    ),
  }));
  const missionCards = renderCards.filter((card) => card.isMissionCard);
  const normalCards = renderCards.filter((card) => !isSystemCard(card));
  const treasureCards = renderCards.filter((card) => card.isTreasureCard);

  return [...missionCards, ...normalCards, ...treasureCards];
}

function getOppositeSwipeDirection(direction) {
  if (direction === 'left') {
    return 'right';
  }

  if (direction === 'right') {
    return 'left';
  }

  return direction === 'down' ? 'up' : 'down';
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Kalam_400Regular,
  });
  const [authToken, setAuthToken] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [isLoadingUserData, setIsLoadingUserData] = useState(false);
  const [hasLoadedUserData, setHasLoadedUserData] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [editingSelection, setEditingSelection] = useState(null);
  const [suppressEditingKeyboard, setSuppressEditingKeyboard] = useState(false);
  const [editingKeyboardOpenRequest, setEditingKeyboardOpenRequest] = useState(0);
  const [focusedCardIndex, setFocusedCardIndex] = useState(null);
  const [layoutMode, setLayoutMode] = useState('leaf');
  const [collapsedNodeIds, setCollapsedNodeIds] = useState(() => new Set());
  const [leafTopIndex, setLeafTopIndex] = useState(null);
  const [leafFocusedCardId, setLeafFocusedCardId] = useState(null);
  const [isDeleteHoldActive, setIsDeleteHoldActive] = useState(false);
  const [addPreviewRelation, setAddPreviewRelation] = useState(null);
  const [isAddHoldActive, setIsAddHoldActive] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isUpdatingCardImage, setIsUpdatingCardImage] = useState(false);
  const [settingsPanelCloseRequest, setSettingsPanelCloseRequest] = useState(0);
  const [mathKeyboardKeys, setMathKeyboardKeys] = useState(() => normalizeMathKeyboardKeys([]));
  const [currentDayReference, setCurrentDayReference] = useState(() => Date.now());
  const [treeCompletionCanvas, setTreeCompletionCanvas] = useState(EMPTY_TREE_COMPLETION_CANVAS);
  const [previousDayTreeCompletionCanvas, setPreviousDayTreeCompletionCanvas] = useState(
    EMPTY_TREE_COMPLETION_CANVAS,
  );

  const stack = useSyncExternalStore(subscribe, getSnapshot);
  const cards = useMemo(() => stack.map((card, index) => ({
    ...card,
    imageUri: resolveApiAssetUrl(card.imagePath),
    index,
  })), [stack]);
  const hiddenSystemCardIds = useMemo(
    () => getHiddenSystemCardIds(cards, [MISSION_CARD_ID]),
    [cards],
  );
  const dailyVisibleCards = useMemo(
    () => getVisibleCardsExcludingIds(
      getDailyVisibleCards(cards, MISSION_CARD_ID, currentDayReference),
      hiddenSystemCardIds,
    ),
    [cards, currentDayReference, hiddenSystemCardIds],
  );
  const shouldRenderLeaf = layoutMode === 'leaf';
  const previousDayCompletedTaskCount = useMemo(
    () => countPreviousDayCompletedTasks(previousDayTreeCompletionCanvas),
    [previousDayTreeCompletionCanvas],
  );
  const currentTreeCompletionCanvasKey = useMemo(
    () => getTreeCompletionCanvasKey(currentDayReference),
    [currentDayReference],
  );
  const previousTreeCompletionCanvasKey = useMemo(
    () => getTreeCompletionCanvasKey(currentDayReference - DAY_MS),
    [currentDayReference],
  );
  const focusedCardId = focusedCardIndex === null
    ? null
    : (focusedCardIndex < 0 ? TREASURE_CARD_ID : cards[focusedCardIndex]?.id ?? null);
  const isSystemCardFocused = !shouldRenderLeaf && isSystemCard(
    cards.find((card) => card.id === focusedCardId),
  );
  const systemTreeCards = useMemo(
    () => getSystemTreeCards(dailyVisibleCards),
    [dailyVisibleCards],
  );
  const leafScopeFocusedCardId = shouldRenderLeaf
    ? leafFocusedCardId
    : focusedCardId;
  const focusedControlCardId = shouldRenderLeaf ? leafFocusedCardId : focusedCardId;
  const focusedControlCard = cards.find((card) => card.id === focusedControlCardId);
  const focusedSystemCardType = focusedControlCard?.isMissionCard
    ? 'mission'
    : (focusedControlCard?.isTreasureCard ? 'treasure' : null);
  const doneCleanupPreviewCardIds = useMemo(() => {
    if (!isDeleteHoldActive || !focusedControlCardId) {
      return new Set();
    }

    return getDoneCleanupCardIds(cards, focusedControlCardId);
  }, [
    cards,
    focusedControlCardId,
    isDeleteHoldActive,
  ]);

  const leafCards = useMemo(
    () => {
      const scopedCards = getLeafTraversalCards(
        dailyVisibleCards,
        systemTreeCards,
        leafScopeFocusedCardId,
      );

      if (scopedCards.length > 0) {
        return scopedCards;
      }

      return dailyVisibleCards;
    },
    [dailyVisibleCards, leafScopeFocusedCardId, systemTreeCards],
  );

  const leafTopPosition = useMemo(() => {
    if (leafCards.length === 0) {
      return null;
    }

    if (leafFocusedCardId === TREASURE_CARD_ID) {
      const treasurePosition = leafCards.findIndex((card) => card.id === TREASURE_CARD_ID);
      if (treasurePosition >= 0) {
        return treasurePosition;
      }
    }

    const defaultLeafPosition = Math.max(
      -1,
      ...leafCards.map((card, position) => (isSystemCard(card) ? -1 : position)),
    );
    const fallbackPosition = defaultLeafPosition >= 0
      ? defaultLeafPosition
      : leafCards.length - 1;

    if (leafTopIndex === null) {
      return fallbackPosition;
    }

    const matchingPosition = leafCards.findIndex((card) => card.index === leafTopIndex);
    return matchingPosition >= 0
      ? matchingPosition
      : fallbackPosition;
  }, [leafCards, leafFocusedCardId, leafTopIndex]);

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
  const restoredUiStateUserIdRef = useRef(null);
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
    let isMounted = true;

    async function loadMathKeyboardKeys() {
      const storedKeys = await getStoredMathKeyboardKeys();
      if (isMounted) {
        setMathKeyboardKeys(storedKeys);
      }
    }

    loadMathKeyboardKeys();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const now = Date.now();
    const timeoutId = setTimeout(() => {
      setCurrentDayReference(Date.now());
    }, Math.max(getNextCompletionDayBoundary(now) - now, 1));

    return () => clearTimeout(timeoutId);
  }, [currentDayReference]);

  useEffect(() => {
    authUserRef.current = authUser;
  }, [authUser]);

  useEffect(() => {
    setSoundEffectsEnabled(isAudioEnabled);
  }, [isAudioEnabled]);

  useEffect(() => {
    if (!authUser || !hasLoadedUserData) {
      return;
    }

    ensureDailyReminderScheduled({
      previousDayCompletedCount: previousDayCompletedTaskCount,
    }).catch(() => {});
  }, [authUser, hasLoadedUserData, previousDayCompletedTaskCount]);

  useEffect(() => {
    if (!isSystemCardFocused) {
      return;
    }

    setAddPreviewRelation(null);
    setIsAddHoldActive(false);
  }, [isSystemCardFocused]);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const storedToken = await getStoredAuthToken();
        if (isMounted && storedToken) {
          setAuthToken(storedToken);
        }
      } catch {
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

    const fallbackTopCard = leafCards[leafCards.length - 1] ?? null;
    const fallbackTopId = fallbackTopCard?.id ?? null;
    setLeafFocusedCardId((current) => current ?? fallbackTopId);

    setLeafTopIndex((currentTop) => (
      currentTop === null ? fallbackTopCard?.index ?? null : Math.min(currentTop, cards.length - 1)
    ));
  }, [cards.length, leafCards]);

  useEffect(() => {
    if (focusedCardId !== null && hiddenSystemCardIds.has(focusedCardId)) {
      setFocusedCardIndex(null);
    }

    if (leafFocusedCardId !== null && hiddenSystemCardIds.has(leafFocusedCardId)) {
      setLeafFocusedCardId(null);
      setLeafTopIndex(null);
    }
  }, [focusedCardId, hiddenSystemCardIds, leafFocusedCardId]);

  useEffect(() => {
    if (!__DEV__) {
      return;
    }

    if (!authUser || !hasLoadedRemoteCards.current) {
      return;
    }

    const hasUserCards = stack.some((card) => !isSystemCard(card));
    if (hasLoadedDefaultStack.current || hasUserCards) {
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
    setHasLoadedUserData(false);
    setSyncError('');
    setEditingIndex(null);
    setEditingValue('');
    setEditingSelection(null);
    setFocusedCardIndex(null);
    setLeafTopIndex(null);
    setLeafFocusedCardId(null);
    setIsDeleteHoldActive(false);
    setCollapsedNodeIds(new Set());
    setTreeCompletionCanvas(EMPTY_TREE_COMPLETION_CANVAS);
    setPreviousDayTreeCompletionCanvas(EMPTY_TREE_COMPLETION_CANVAS);
    hasLoadedDefaultStack.current = false;
    hasLoadedRemoteCards.current = false;
    restoredUiStateUserIdRef.current = null;
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
    setHasLoadedUserData(false);
    setSyncError('');
    hasLoadedDefaultStack.current = false;
    hasLoadedRemoteCards.current = false;
    restoredUiStateUserIdRef.current = null;
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
    const userId = authUser?.id ?? null;

    if (!authToken) {
      return undefined;
    }

    if (userId === null) {
      return undefined;
    }

    let isMounted = true;
    setHasLoadedUserData(false);
    setIsLoadingUserData(true);
    setSyncError('');

    const localUiStateResultPromise = getStoredUiState(userId).then(
      (state) => ({ error: null, state }),
      (error) => ({ error, state: null }),
    );

    localUiStateResultPromise.then(({ error, state }) => {
      if (!isMounted || error || !state) {
        return;
      }

      setLayoutMode(state.layoutMode);
      setCollapsedNodeIds(new Set(state.collapsedNodeIds));
    });

    async function loadCardsForUser() {
      try {
        const [
          [cardsResult, todayCanvasResult, previousDayCanvasResult],
          localUiStateResult,
        ] = await Promise.all([
          Promise.all([
            loadRemoteCards(authToken),
            loadRemoteUserData(authToken, currentTreeCompletionCanvasKey),
            loadRemoteUserData(authToken, previousTreeCompletionCanvasKey),
          ]),
          localUiStateResultPromise,
        ]);

        if (!isMounted) {
          return;
        }

        const nextCards = Array.isArray(cardsResult.cards) ? cardsResult.cards : [];
        const restoredUiState = localUiStateResult.state;

        isApplyingRemoteCards.current = true;
        loadCards(nextCards);
        ensureSystemCards(restoredUiState?.archivedRootIds || []);
        isApplyingRemoteCards.current = false;
        const loadedCards = getSnapshot();
        setTreeCompletionCanvas(todayCanvasResult.value || EMPTY_TREE_COMPLETION_CANVAS);
        setPreviousDayTreeCompletionCanvas(
          previousDayCanvasResult.value || EMPTY_TREE_COMPLETION_CANVAS,
        );

        if (restoredUiState) {
          const loadedCardIds = new Set(loadedCards.map((card) => card.id));
          setLayoutMode(restoredUiState.layoutMode);
          setCollapsedNodeIds(new Set(
            restoredUiState.collapsedNodeIds.filter((cardId) => loadedCardIds.has(cardId)),
          ));

          const nextFocusedIndex = restoredUiState.focusedCardId === null
            ? null
            : loadedCards.findIndex((card) => card.id === restoredUiState.focusedCardId);
          setFocusedCardIndex(nextFocusedIndex >= 0 ? nextFocusedIndex : null);

          const nextLeafFocusedIndex = restoredUiState.leafFocusedCardId === null
            ? -1
            : loadedCards.findIndex((card) => card.id === restoredUiState.leafFocusedCardId);
          if (nextLeafFocusedIndex >= 0) {
            setLeafFocusedCardId(restoredUiState.leafFocusedCardId);
            setLeafTopIndex(nextLeafFocusedIndex);
          }
        } else {
          setCollapsedNodeIds(new Set());
        }

        hasLoadedRemoteCards.current = true;
        if (localUiStateResult.error) {
          setSyncError('Could not load local UI state.');
        } else {
          restoredUiStateUserIdRef.current = userId;
        }

        if (!todayCanvasResult.value) {
          saveRemoteUserData(
            authToken,
            currentTreeCompletionCanvasKey,
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
          setHasLoadedUserData(true);
        }
      }
    }

    loadCardsForUser();

    return () => {
      isMounted = false;
    };
  }, [
    authToken,
    authUser?.id,
    currentTreeCompletionCanvasKey,
    previousTreeCompletionCanvasKey,
  ]);

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

    const currentIndex = shouldRenderLeaf
      ? visibleTopCardIndex
      : focusedCardIndex;
    const currentCard = currentIndex === null || currentIndex < 0
      ? null
      : cards[currentIndex];
    if (isSystemCard(currentCard) && relation !== 'child') {
      return;
    }

    const nextIndex = currentIndex === null || currentIndex < 0
      ? push('')
      : insertRelativeTo(currentIndex, relation, '');

    if (nextIndex === currentIndex && isSystemCard(currentCard)) {
      return;
    }

    setEditingIndex(nextIndex);
    setSuppressEditingKeyboard(false);
    setEditingValue('');
    setEditingSelection({ start: 0, end: 0 });
    setFocusedCardIndex(nextIndex);
    setLeafTopIndex(nextIndex);
  }

  function handleEditCard(index, text) {
    if (isSystemCard(cards[index])) {
      return;
    }

    setEditingIndex(index);
    setSuppressEditingKeyboard(false);
    setEditingValue(text);
    const textLength = String(text || '').length;
    setEditingSelection({ start: textLength, end: textLength });
    setFocusedCardIndex(index);
    setLeafTopIndex(index);
  }

  function handleCompleteEdit(index, value) {
    if (editingIndex !== index) {
      return;
    }

    updateAt(index, value);
    setEditingIndex(null);
    setSuppressEditingKeyboard(false);
    setEditingValue('');
    setEditingSelection(null);
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
    const removedCardIds = new Set(removedCards
      .map((card) => Number(card?.id))
      .filter((cardId) => Number.isInteger(cardId)));

    if (removedCardIds.size === 0) {
      return;
    }

    const completedAt = Date.now();
    const completionCanvasKey = getTreeCompletionCanvasKey(completedAt);
    const currentCanvas = completionCanvasKey === currentTreeCompletionCanvasKey
      ? (treeCompletionCanvas || EMPTY_TREE_COMPLETION_CANVAS)
      : EMPTY_TREE_COMPLETION_CANVAS;
    const { imagePng: _unusedImagePng, ...currentComputedCanvas } = currentCanvas;
    const completionGroupId = `completion-${completedAt}`;
    const nodeIdByCardId = new Map([...removedCardIds].map((cardId) => [
      cardId,
      `removed-${completedAt}-${cardId}`,
    ]));
    const nextNodes = removedCards
      .filter((card) => removedCardIds.has(card.id))
      .map((card) => ({
        childIds: Array.isArray(card.childIds)
          ? card.childIds
            .filter((childId) => removedCardIds.has(childId))
            .map((childId) => nodeIdByCardId.get(childId))
          : [],
        completedAt,
        groupId: completionGroupId,
        id: nodeIdByCardId.get(card.id),
        originalId: card.id,
        parentIds: Array.isArray(card.parentIds)
          ? card.parentIds
            .filter((parentId) => removedCardIds.has(parentId))
            .map((parentId) => nodeIdByCardId.get(parentId))
          : [],
        text: String(card.text || '').trim(),
      }));

    const nextCanvas = {
      ...currentComputedCanvas,
      entries: Array.isArray(currentCanvas.entries) ? currentCanvas.entries : [],
      nodes: [
        ...(Array.isArray(currentCanvas.nodes) ? currentCanvas.nodes : []),
        ...nextNodes,
      ],
      updatedAt: completedAt,
    };

    if (completionCanvasKey === currentTreeCompletionCanvasKey) {
      setTreeCompletionCanvas(nextCanvas);
    } else {
      setCurrentDayReference(completedAt);
      setTreeCompletionCanvas(nextCanvas);
    }

    if (authToken) {
      saveRemoteUserData(
        authToken,
        completionCanvasKey,
        nextCanvas,
      ).catch(() => {});
    }
  }

  function handleDeleteCard(index) {
    const removedCard = cards[index];
    if (!removedCard || isSystemCard(removedCard)) {
      return;
    }

    playTrashSound();

    const doneCleanupCardIds = removedCard.done
      ? getDoneCleanupCardIds(cards, removedCard.id)
      : new Set([removedCard.id]);
    const removedCards = removedCard.done
      ? cards.filter((card) => doneCleanupCardIds.has(card.id))
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
    const nextEditingIndex = adjustIndexAfterRemoval(editingIndex);
    if (nextEditingIndex === null) {
      setEditingIndex(null);
      setEditingValue('');
      setEditingSelection(null);
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
    const card = index < 0
      ? systemTreeCards.find((candidateCard) => candidateCard.id === TREASURE_CARD_ID)
      : cards[index];

    if (!card || !Array.isArray(card.childIds) || card.childIds.length === 0) {
      return;
    }

    const cardId = card.id;
    const systemDescendantIds = isSystemCard(card)
      ? getCollapsibleDescendantIds(systemTreeCards, cardId)
      : [];

    playModeFlipSound();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    setCollapsedNodeIds((currentCollapsed) => {
      const nextCollapsed = new Set(currentCollapsed);

      if (nextCollapsed.has(cardId)) {
        nextCollapsed.delete(cardId);
      } else {
        nextCollapsed.add(cardId);
        systemDescendantIds.forEach((descendantId) => {
          nextCollapsed.add(descendantId);
        });
      }

      return nextCollapsed;
    });
  }

  function handleToggleAllTreeCards() {
    const collapsibleCards = systemTreeCards
      .filter((card) => Array.isArray(card.childIds) && card.childIds.length > 0);
    const collapsibleIds = collapsibleCards.map((card) => card.id);
    const expandableIds = collapsibleCards
      .filter((card) => (
        card.id !== TREASURE_CARD_ID
        && !card.isTreasureCard
        && !card.isArchivedRoot
      ))
      .map((card) => card.id);

    if (collapsibleIds.length === 0) {
      return;
    }

    playModeFlipSound();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    setCollapsedNodeIds((currentCollapsed) => {
      const shouldExpandAll = collapsibleIds.every((cardId) => currentCollapsed.has(cardId));
      const nextCollapsed = new Set(currentCollapsed);

      if (shouldExpandAll) {
        expandableIds.forEach((cardId) => {
          nextCollapsed.delete(cardId);
        });
      } else {
        collapsibleIds.forEach((cardId) => {
          nextCollapsed.add(cardId);
        });
      }

      if (shouldExpandAll && expandableIds.length === 0) {
        return currentCollapsed;
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

  function handleArchiveRootTree(rootId) {
    const rootCard = cards.find((card) => card.id === rootId);
    const parentIds = Array.isArray(rootCard?.parentIds) ? rootCard.parentIds : [];
    if (!rootCard || parentIds.length > 0) {
      return;
    }

    if (!archiveRootTree(rootId)) {
      return;
    }
    setFocusedCardIndex(null);
    setEditingIndex(null);
    setEditingValue('');
    setEditingSelection(null);
    setIsDeleteHoldActive(false);
    setAddPreviewRelation(null);
  }

  function handleAdoptMissionRoot(rootId) {
    const adoptedIndex = adoptMissionRoot(rootId);
    if (adoptedIndex < 0) {
      return;
    }

    setFocusedCardIndex(adoptedIndex);
    setEditingIndex(null);
    setEditingValue('');
    setEditingSelection(null);
    setIsDeleteHoldActive(false);
    setAddPreviewRelation(null);
  }

  function handleRestoreRootTree(rootId) {
    const rootCard = cards.find((card) => card.id === rootId);
    if (!rootCard) {
      return;
    }

    if (!restoreRootTree(rootId)) {
      return;
    }
    const restoredIndex = getSnapshot().findIndex((card) => card.id === rootId);
    setFocusedCardIndex(restoredIndex >= 0 ? restoredIndex : rootCard.index);
    setEditingIndex(null);
    setEditingValue('');
    setEditingSelection(null);
    setIsDeleteHoldActive(false);
    setAddPreviewRelation(null);
  }

  function handleLeafSwipe(direction) {
    if (editingIndex !== null || leafCards.length === 0) {
      return false;
    }

    const currentCardId = visibleCards[0]?.id ?? leafFocusedCardId ?? cards[0]?.id;
    const traversalCards = getLeafTraversalCards(
      dailyVisibleCards,
      systemTreeCards,
      currentCardId,
    );

    if (traversalCards.length === 0) {
      setLeafFocusedCardId(null);
      setLeafTopIndex(null);
      return true;
    }

    const traversalDirection = getOppositeSwipeDirection(direction);
    const traversalMode = direction === 'left' || direction === 'right' ? 'dfs' : 'bfs';
    const nextCard = traversalCards.length === 1
      ? traversalCards[0]
      : moveInTraversal(traversalCards, currentCardId, traversalDirection, traversalMode);

    if (!nextCard || nextCard.index === undefined) {
      return false;
    }

    if (nextCard.id === currentCardId && !visibleCards[0]?.done) {
      return false;
    }

    setLeafFocusedCardId(nextCard.id);
    setLeafTopIndex(nextCard.index);
    playLeafSwipeSound();
    return true;
  }

  const visibleTopCardIndex = visibleCards[0]?.index ?? null;
  const effectiveLeafFocusedIndex = visibleTopCardIndex ?? focusedCardIndex;
  const insertionTargetIndex = shouldRenderLeaf ? visibleTopCardIndex : focusedCardIndex;
  const insertionTargetCard = insertionTargetIndex === null || insertionTargetIndex < 0
    ? null
    : cards[insertionTargetIndex];
  const isSystemInsertionTarget = isSystemCard(insertionTargetCard);
  const nodeMapFocusedCardId = shouldRenderLeaf ? leafFocusedCardId : focusedCardId;
  const focusedSystemRootId = shouldRenderLeaf
    ? getFocusedSystemRootId(systemTreeCards, nodeMapFocusedCardId)
    : null;
  const canDeleteCurrentCard = shouldRenderLeaf
    ? (
      visibleTopCardIndex !== null
      && visibleTopCardIndex >= 0
      && !isSystemCard(cards[visibleTopCardIndex])
    )
    : (
      focusedCardIndex !== null
      && focusedCardIndex >= 0
      && !isSystemCard(cards[focusedCardIndex])
    );
  const nodeMapCards = shouldRenderLeaf
    ? (focusedSystemRootId
      ? getSystemSubtreeCards(systemTreeCards, focusedSystemRootId)
      : getLeafRootScopedCards(dailyVisibleCards, nodeMapFocusedCardId))
    : systemTreeCards;
  const nodeMapFocusedCardIndex = nodeMapFocusedCardId === null
    ? null
    : nodeMapCards.findIndex((card) => card.id === nodeMapFocusedCardId);

  useEffect(() => {
    const userId = authUser?.id ?? null;
    if (
      userId === null
      || restoredUiStateUserIdRef.current !== userId
      || !hasLoadedRemoteCards.current
    ) {
      return undefined;
    }

    setStoredUiState(userId, {
      archivedRootIds: [],
      collapsedNodeIds: [...collapsedNodeIds],
      focusedCardId,
      layoutMode,
      leafFocusedCardId,
    }).catch(() => {
      if (authUserRef.current?.id === userId) {
        setSyncError('Could not save local UI state.');
      }
    });

    return undefined;
  }, [
    authUser?.id,
    collapsedNodeIds,
    focusedCardId,
    layoutMode,
    leafFocusedCardId,
  ]);

  function handleDeleteCurrentLeafCard() {
    if (!shouldRenderLeaf || visibleTopCardIndex === null || visibleTopCardIndex < 0) {
      setIsDeleteHoldActive(false);
      return;
    }

    handleDeleteCard(visibleTopCardIndex);
  }

  function handleDoneCurrentLeafCard() {
    if (!shouldRenderLeaf || visibleTopCardIndex === null || visibleTopCardIndex < 0) {
      return;
    }

    const currentCard = cards[visibleTopCardIndex];
    if (!currentCard || isSystemCard(currentCard)) {
      return;
    }

    if (currentCard.done) {
      setDoneAt(visibleTopCardIndex, false);
      setLeafFocusedCardId(currentCard.id);
      setLeafTopIndex(visibleTopCardIndex);
      return;
    }

    setDoneAt(visibleTopCardIndex, true);
    setLeafFocusedCardId(currentCard.id);
    setLeafTopIndex(visibleTopCardIndex);
    playDoneStampSound();
  }

  function persistMathKeyboardKeys(nextKeys) {
    setMathKeyboardKeys(nextKeys);
    setStoredMathKeyboardKeys(nextKeys).catch(() => {});
  }

  function handleUpdateMathKeyboardKey(index, value) {
    persistMathKeyboardKeys(updateMathKeyboardKeyAt(mathKeyboardKeys, index, value));
  }

  function handleMoveMathKeyboardKey(sourceIndex, targetIndex) {
    persistMathKeyboardKeys(moveMathKeyboardKey(mathKeyboardKeys, sourceIndex, targetIndex));
  }

  async function removeImageFromCard(cardId) {
    if (!authToken || isUpdatingCardImage) {
      return;
    }

    setIsUpdatingCardImage(true);
    try {
      await deleteCardImage(authToken, cardId);
      const currentIndex = getSnapshot().findIndex((card) => card.id === cardId);
      if (currentIndex >= 0 && clearCardImageAt(currentIndex)) {
        await saveRemoteCards(authToken, getSnapshot());
      }
    } catch (error) {
      if (error.status === 401) {
        handleAuthExpired();
        return;
      }
      Alert.alert('Could not remove image', error.message || 'Try again.');
    } finally {
      setIsUpdatingCardImage(false);
    }
  }

  async function takePhotoForCard(cardId) {
    if (!authToken || isUpdatingCardImage) {
      return;
    }

    setIsUpdatingCardImage(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera access needed', 'Allow Papers to take a photo for this card.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        base64: false,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.82,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset?.uri) {
        return;
      }

      const uploadedImage = await uploadCardImage(
        authToken,
        cardId,
        asset.uri,
        asset.mimeType || 'image/jpeg',
      );
      const currentIndex = getSnapshot().findIndex((card) => card.id === cardId);
      if (currentIndex < 0) {
        return;
      }

      setEditingIndex(null);
      setEditingValue('');
      setEditingSelection(null);
      setCardImageAt(
        currentIndex,
        uploadedImage.imagePath,
        uploadedImage.imageMimeType,
      );
      await saveRemoteCards(authToken, getSnapshot());
    } catch (error) {
      if (error.status === 401) {
        handleAuthExpired();
        return;
      }
      Alert.alert('Could not attach image', error.message || 'Try again.');
    } finally {
      setIsUpdatingCardImage(false);
    }
  }

  function handleCardCameraPress(card) {
    if (!card || isSystemCard(card) || isUpdatingCardImage) {
      return;
    }

    if (card.imagePath) {
      Alert.alert(
        'Remove attached image?',
        'The card will become an empty text card.',
        [
          { style: 'cancel', text: 'Cancel' },
          {
            onPress: () => removeImageFromCard(card.id),
            style: 'destructive',
            text: 'Remove',
          },
        ],
      );
      return;
    }

    takePhotoForCard(card.id);
  }

  function focusScanRoot(index) {
    const card = getSnapshot()[index];
    setFocusedCardIndex(index);
    setLeafTopIndex(index);
    setLeafFocusedCardId(card?.id ?? null);
  }

  function updateScanPlaceholderTextIfPending(placeholderId, value) {
    return updatePendingScanPlaceholder({
      getCards: getSnapshot,
      placeholderId,
      text: value,
      updateCardAt: updateAt,
    });
  }

  function appendScannedTreeToPlaceholder(placeholderId, scanTree) {
    const placeholderIndex = appendScanTreeResultToPlaceholder({
      getCards: getSnapshot,
      insertChildAt: (index, text) => insertRelativeTo(index, 'child', text),
      placeholderId,
      scanTree,
      updateCardAt: updateAt,
    });

    if (placeholderIndex !== -1) {
      focusScanRoot(placeholderIndex);
    }

    return placeholderIndex !== -1;
  }

  async function pickScanImage(source) {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera access needed', 'Allow camera access to scan a photo into cards.');
        return null;
      }

      return ImagePicker.launchCameraAsync({
        allowsEditing: false,
        base64: false,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.72,
      });
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo access to scan an image into cards.');
      return null;
    }

    return ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      base64: false,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.72,
    });
  }

  async function scanCardsFromImageSource(source) {
    if (!authToken) {
      return;
    }

    let placeholderId = null;
    let placeholderAsset = null;
    let scanRequestId = null;

    try {
      const result = await pickScanImage(source);

      if (!result || result.canceled) {
        return;
      }

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert('Scan failed', 'Could not read the selected image.');
        return;
      }

      setSettingsPanelCloseRequest((currentRequest) => currentRequest + 1);
      placeholderAsset = asset;
      const placeholderIndex = push(SCAN_PLACEHOLDER_TEXT);
      placeholderId = getSnapshot()[placeholderIndex]?.id ?? null;
      scanRequestId = createScanRequestId();
      setScanStateAt(placeholderIndex, scanRequestId, 'pending');
      focusScanRoot(placeholderIndex);

      await saveRemoteCards(authToken, getSnapshot());
      const { job } = await createScanJob(authToken, {
        clientRequestId: scanRequestId,
        mimeType: asset.mimeType || 'image/jpeg',
        placeholderId,
        prompt: SCAN_CARDS_PROMPT,
      });

      let uploadError = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          await uploadScanJobImage(
            authToken,
            job.id,
            asset.uri,
            asset.mimeType || 'image/jpeg',
          );
          uploadError = null;
          break;
        } catch (error) {
          uploadError = error;
          const currentJob = await loadScanJob(authToken, job.id).catch(() => null);
          if (currentJob?.job?.status !== 'uploading') {
            uploadError = null;
            break;
          }
        }
      }

      if (uploadError) {
        const failureResult = await failScanJobImageUpload(
          authToken,
          job.id,
          uploadError.message || 'Image upload failed.',
        );
        if (failureResult.job?.status === 'failed') {
          throw uploadError;
        }
      }
    } catch (error) {
      if (placeholderId !== null) {
        const currentIndex = updateScanPlaceholderTextIfPending(
          placeholderId,
          `${formatScanResultTitle(placeholderAsset)}\nScan failed: ${error.message || 'Could not scan the selected image.'}`,
        );
        if (currentIndex !== -1) {
          if (scanRequestId) {
            setScanStateAt(currentIndex, scanRequestId, 'failed');
          }
          focusScanRoot(currentIndex);
          Alert.alert('Scan failed', error.message || 'Could not scan the selected image.');
        }
      } else {
        Alert.alert('Scan failed', error.message || 'Could not scan the selected image.');
      }
    }
  }

  function handleScanCardsFromImage() {
    scanCardsFromImageSource('camera');
  }

  function getMathNotationTarget() {
    const targetIndex = visibleTopCardIndex;
    if (targetIndex === null || targetIndex < 0) {
      return null;
    }

    const targetCard = cards[targetIndex];
    if (!targetCard || isSystemCard(targetCard) || targetCard.imagePath) {
      return null;
    }

    const isEditingTargetCard = editingIndex === targetIndex;
    const currentValue = isEditingTargetCard
      ? editingValue
      : String(targetCard.text || '');
    const selection = isEditingTargetCard && editingSelection
      ? editingSelection
      : { start: currentValue.length, end: currentValue.length };

    return {
      currentValue,
      isEditingTargetCard,
      selection,
      targetCard,
      targetIndex,
    };
  }

  function applyMathNotationEdit(target, nextValue, nextSelection) {
    setEditingIndex(target.targetIndex);
    setSuppressEditingKeyboard(true);
    setEditingValue(nextValue);
    setEditingSelection(nextSelection);

    setFocusedCardIndex(target.targetIndex);
    setLeafTopIndex(target.targetIndex);
    setLeafFocusedCardId(target.targetCard.id);
  }

  function handleInsertMathNotation(notation) {
    if (!shouldRenderLeaf || notation === null || notation === undefined) {
      return;
    }

    const target = getMathNotationTarget();
    if (!target) {
      return;
    }

    const { nextValue, nextSelection } = insertTextAtSelection(
      target.currentValue,
      notation,
      target.selection,
    );
    applyMathNotationEdit(target, nextValue, nextSelection);
  }

  function handleDeleteMathNotation() {
    if (!shouldRenderLeaf) {
      return;
    }

    const target = getMathNotationTarget();
    if (!target) {
      return;
    }

    const { nextValue, nextSelection } = deleteTextAtSelection(
      target.currentValue,
      target.selection,
    );
    applyMathNotationEdit(target, nextValue, nextSelection);
  }

  function handleOpenSystemKeyboard() {
    if (!shouldRenderLeaf) {
      return;
    }

    const target = getMathNotationTarget();
    if (!target) {
      return;
    }

    setEditingIndex(target.targetIndex);
    setSuppressEditingKeyboard(false);
    setEditingValue(target.currentValue);
    setEditingSelection(target.selection);
    setFocusedCardIndex(target.targetIndex);
    setLeafTopIndex(target.targetIndex);
    setLeafFocusedCardId(target.targetCard.id);
    setEditingKeyboardOpenRequest((currentRequest) => currentRequest + 1);
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
    if (leafCards.length === 0) {
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
    leafCards.length,
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
    playModeFlipSound();

    if (isLeafToTree) {
      const treeFocusedCardIndex = isFocusedCardVisible
        ? nextFocusedCardIndex
        : currentlyVisibleLeafCardIndex;
      const treeFocusedCardId = treeFocusedCardIndex === null
        ? null
        : (treeFocusedCardIndex === -1 ? TREASURE_CARD_ID : cards[treeFocusedCardIndex]?.id ?? null);
      const treeExpansionCards = getFocusedSystemRootId(systemTreeCards, treeFocusedCardId)
        ? systemTreeCards
        : dailyVisibleCards;
      const expandedRootTreeIds = getRootTreeCardIds(treeExpansionCards, treeFocusedCardId);

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

      setFocusedCardIndex(treeFocusedCardIndex);
      setLeafTopIndex(null);
    } else {
      if (nextFocusedCardIndex === -1) {
        setFocusedCardIndex(-1);
        setLeafTopIndex(-1);
        setLeafFocusedCardId(TREASURE_CARD_ID);
      } else if (focusedCardInRange) {
        setFocusedCardIndex(nextFocusedCardIndex);
        setLeafTopIndex(nextFocusedCardIndex);
        setLeafFocusedCardId(cards[nextFocusedCardIndex]?.id ?? null);
      } else {
        setFocusedCardIndex(-1);
        setLeafTopIndex(-1);
        setLeafFocusedCardId(TREASURE_CARD_ID);
      }
    }

    setEditingIndex(null);
    setEditingValue('');
    setEditingSelection(null);
  }

  if (
    !fontsLoaded
    || isRestoringSession
    || (authToken && !authUser)
    || (authToken && authUser && !hasLoadedUserData)
  ) {
    return (
      <>
        <View style={styles.authContainer}>
          <View style={styles.loadingPanel}>
            <ActivityIndicator
              size="large"
              color="#2563EB"
            />
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
        <CompletionProgressTree treeCompletionCanvas={treeCompletionCanvas} />
        {shouldRenderLeaf ? (
          <LeafDeck
            cards={leafCards}
            topIndex={leafTopPosition}
            visibleCount={LEAF_VISIBLE_COUNT}
            editingIndex={editingIndex}
            editingValue={editingValue}
            editingSelection={editingSelection}
            suppressEditingKeyboard={suppressEditingKeyboard}
            editingKeyboardOpenRequest={editingKeyboardOpenRequest}
            mathKeyboardKeys={mathKeyboardKeys}
            doneCleanupPreviewCardIds={doneCleanupPreviewCardIds}
            focusedCardIndex={effectiveLeafFocusedIndex}
            focusedCardId={leafFocusedCardId}
            collapsedNodeIds={collapsedNodeIds}
            onCreateEdit={handleToggleEdit}
            onDeleteCard={handleDeleteCard}
            onEditingValueChange={setEditingValue}
            onEditingSelectionChange={setEditingSelection}
            onCompleteEdit={handleCompleteEdit}
            onCameraPress={handleCardCameraPress}
            onDeleteMathNotation={handleDeleteMathNotation}
            onInsertMathNotation={handleInsertMathNotation}
            onOpenSystemKeyboard={handleOpenSystemKeyboard}
            onLeafSwipe={handleLeafSwipe}
            isDeleteHoldActive={isDeleteHoldActive}
            isAddHoldActive={isAddHoldActive}
            addPreviewRelation={addPreviewRelation}
            onDeleteCurrentCard={handleDeleteCurrentLeafCard}
            onDoneCurrentCard={handleDoneCurrentLeafCard}
            swipeDisabled={editingIndex !== null}
            cameraDisabled={isUpdatingCardImage}
          />
        ) : (
          <TreeCanvas
            addPreviewRelation={addPreviewRelation}
            cards={systemTreeCards}
            collapsedNodeIds={collapsedNodeIds}
            focusedCardIndex={focusedCardIndex}
            focusedCardId={focusedCardId}
            editingIndex={editingIndex}
            editingValue={editingValue}
            doneCleanupPreviewCardIds={doneCleanupPreviewCardIds}
            onCardPress={handleTreeCardPress}
            onCardFocus={handleTreeCardFocus}
            onCreateEdit={handleToggleEdit}
            onToggleCollapse={handleToggleCollapse}
            onDeleteCard={handleDeleteCard}
            onDeleteHoldComplete={handleDeleteCard}
            onAdoptMissionRoot={handleAdoptMissionRoot}
            onArchiveRootTree={handleArchiveRootTree}
            onRestoreRootTree={handleRestoreRootTree}
            onEditingValueChange={setEditingValue}
            onCompleteEdit={handleCompleteEdit}
            isDeleteHoldActive={isDeleteHoldActive}
            onCanvasBlur={() => setFocusedCardIndex(null)}
          />
        )}
      </View>

      <NodeStructureView
        addPreviewRelation={addPreviewRelation}
        anchorFocusedNode={shouldRenderLeaf}
        cards={nodeMapCards}
        deleteTargetActive={isDeleteHoldActive}
        expandedSystemCardId={focusedSystemRootId}
        focusedCardId={nodeMapFocusedCardId}
        focusedCardIndex={nodeMapFocusedCardIndex >= 0 ? nodeMapFocusedCardIndex : null}
      />

      <FloatingControls
        canDeleteCurrentCard={!shouldRenderLeaf && canDeleteCurrentCard}
        audioEnabled={isAudioEnabled}
        childInsertionOnly={isSystemInsertionTarget}
        focusedSystemCardType={focusedSystemCardType}
        mathKeyboardKeys={mathKeyboardKeys}
        user={authUser}
        layoutMode={layoutMode}
        onAudioEnabledChange={setIsAudioEnabled}
        onDeleteHoldChange={setIsDeleteHoldActive}
        onAddHoldChange={setIsAddHoldActive}
        onAddPreviewChange={setAddPreviewRelation}
        onLogout={resetSession}
        onMoveMathKeyboardKey={handleMoveMathKeyboardKey}
        onRootDoubleTap={handleToggleAllTreeCards}
        rootDoubleTapEnabled={!shouldRenderLeaf && focusedCardIndex === null}
        onUpdateMathKeyboardKey={handleUpdateMathKeyboardKey}
        settingsPanelCloseRequest={settingsPanelCloseRequest}
        onToggleMode={handleToggleLayout}
        onCreateCard={handleCreateCard}
        disableCardInsertion={insertionTargetCard === null}
      />

      <StatusBar style="light" />
    </View>
  );
}
