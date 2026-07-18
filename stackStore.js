let nextCardId = 1;
let stack = [];
const listeners = new Set();
export const TREASURE_CARD_ID = 'treasure-card';

function isTreasureCard(card) {
  return card?.id === TREASURE_CARD_ID || card?.systemType === 'treasure' || card?.isTreasureCard;
}

function createTreasureCard(childIds = []) {
  return {
    childIds,
    done: false,
    id: TREASURE_CARD_ID,
    isTreasureCard: true,
    locked: true,
    parentIds: [],
    stamps: [],
    systemType: 'treasure',
    text: 'Treasure',
  };
}

function uniqueLinkedIds(ids, ownerId) {
  const seen = new Set();

  return ids.filter((id) => {
    if (id === ownerId || seen.has(id)) {
      return false;
    }

    seen.add(id);
    return true;
  });
}

function emitChange() {
  listeners.forEach((listener) => listener());
}

export function subscribe(listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot() {
  return stack;
}

export function push(value) {
  const nextValue = value.trim();
  const nextIndex = stack.length;

  stack = [
    ...stack,
    {
      childIds: [],
      done: false,
      id: nextCardId,
      parentIds: [],
      stamps: [],
      text: nextValue,
    },
  ];
  nextCardId += 1;
  emitChange();

  return nextIndex;
}

function createCard(value) {
  const card = {
    childIds: [],
    done: false,
    id: nextCardId,
    parentIds: [],
    stamps: [],
    text: value.trim(),
  };
  nextCardId += 1;
  return card;
}

function insertNearSibling(childIds, targetId, newId, placement) {
  const existingIds = childIds.filter((id) => id !== newId);
  const targetPosition = existingIds.indexOf(targetId);

  if (targetPosition === -1) {
    return placement === 'previous'
      ? [newId, ...existingIds]
      : [...existingIds, newId];
  }

  const insertPosition = placement === 'previous'
    ? targetPosition
    : targetPosition + 1;

  return [
    ...existingIds.slice(0, insertPosition),
    newId,
    ...existingIds.slice(insertPosition),
  ];
}

export function insertRelativeTo(targetIndex, relation, value = '') {
  if (targetIndex < 0 || targetIndex >= stack.length) {
    return push(value);
  }

  const targetCard = stack[targetIndex];
  if (isTreasureCard(targetCard) && relation !== 'child') {
    return targetIndex;
  }

  const targetId = targetCard.id;
  const newCard = createCard(value);
  const newId = newCard.id;
  const nextIndex = stack.length;

  if (relation === 'parent') {
    const previousParentIds = targetCard.parentIds;
    const rewrittenCards = stack.map((card) => {
      if (card.id === targetId) {
        return {
          ...card,
          parentIds: [newId],
        };
      }

      if (previousParentIds.includes(card.id)) {
        return {
          ...card,
          childIds: card.childIds.map((childId) => (
            childId === targetId ? newId : childId
          )),
        };
      }

      return card;
    });

    stack = [
      ...rewrittenCards.slice(0, targetIndex),
      {
        ...newCard,
        childIds: [targetId],
        parentIds: previousParentIds,
      },
      ...rewrittenCards.slice(targetIndex),
    ];
    emitChange();
    return targetIndex;
  }

  if (relation === 'previousSibling' || relation === 'nextSibling') {
    const placement = relation === 'previousSibling' ? 'previous' : 'next';
    const parentIds = targetCard.parentIds;
    const insertIndex = relation === 'previousSibling'
      ? targetIndex
      : targetIndex + 1;

    if (parentIds.length === 0) {
      stack = [
        ...stack.slice(0, insertIndex),
        newCard,
        ...stack.slice(insertIndex),
      ];
      emitChange();
      return insertIndex;
    }

    stack = [
      ...stack.map((card) => {
        if (!parentIds.includes(card.id)) {
          return card;
        }

        return {
          ...card,
          childIds: insertNearSibling(card.childIds, targetId, newId, placement),
        };
      }),
      {
        ...newCard,
        parentIds,
      },
    ];
    emitChange();
    return nextIndex;
  }

  stack = [
    ...stack.map((card) => {
      if (card.id !== targetId) {
        return card;
      }

      return {
        ...card,
        childIds: card.childIds.includes(newId)
          ? card.childIds
          : [...card.childIds, newId],
      };
    }),
    {
      ...newCard,
      parentIds: [targetId],
    },
  ];
  emitChange();
  return nextIndex;
}

function normalizeIncomingCard(rawCard, nextGeneratedId) {
  const text = typeof rawCard === 'string'
    ? rawCard
    : rawCard?.text ?? '';

  const rawChildIds = Array.isArray(rawCard?.childIds) ? rawCard.childIds : [];
  const rawParentIds = Array.isArray(rawCard?.parentIds) ? rawCard.parentIds : [];
  const rawStamps = Array.isArray(rawCard?.stamps) ? rawCard.stamps : [];

  function normalizeLinkedId(id) {
    if (typeof id === 'string') {
      const trimmedId = id.trim();
      if (trimmedId === TREASURE_CARD_ID) {
        return trimmedId;
      }

      const numericStringId = Number(trimmedId);
      return Number.isInteger(numericStringId) ? numericStringId : null;
    }

    const numericId = Number(id);
    return Number.isInteger(numericId) ? numericId : null;
  }

  const childIds = rawChildIds.map(normalizeLinkedId).filter((id) => id !== null);
  const parentIds = rawParentIds.map(normalizeLinkedId).filter((id) => id !== null);
  const stamps = rawStamps
    .map((stamp, stampIndex) => {
      const x = Number(stamp?.x);
      const y = Number(stamp?.y);

      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null;
      }

      return {
        id: String(stamp?.id ?? `stamp-${stampIndex}`),
        type: String(stamp?.type ?? 'clock'),
        x: Math.min(Math.max(x, 0), 1),
        y: Math.min(Math.max(y, 0), 1),
      };
    })
    .filter(Boolean);

  const rawId = rawCard?.id;
  const numericId = Number(rawId);
  const id = rawId === TREASURE_CARD_ID
    ? TREASURE_CARD_ID
    : (Number.isInteger(numericId) && numericId > 0 ? numericId : nextGeneratedId);
  const isTreasure = id === TREASURE_CARD_ID || rawCard?.systemType === 'treasure' || rawCard?.isTreasureCard;

  return {
    childIds,
    done: isTreasure ? false : Boolean(rawCard?.done),
    id,
    parentIds,
    stamps,
    ...(isTreasure ? {
      isTreasureCard: true,
      locked: true,
      parentIds: [],
      systemType: 'treasure',
    } : {}),
    text: String(text),
  };
}

export function loadCards(rawCards) {
  if (!Array.isArray(rawCards)) {
    return;
  }

  if (rawCards.length === 0) {
    stack = [];
    nextCardId = 1;
    ensureTreasureCard();
    return;
  }

  let nextGeneratedId = nextCardId;
  const usedIds = new Set();

  const normalizedCards = rawCards.map((card) => {
    const rawCard = normalizeIncomingCard(card, nextGeneratedId);
    if (usedIds.has(rawCard.id)) {
      const fallbackId = nextGeneratedId;
      nextGeneratedId += 1;
      usedIds.add(fallbackId);
      return {
        ...rawCard,
        id: fallbackId,
      };
    }

    usedIds.add(rawCard.id);
    if (typeof rawCard.id === 'number') {
      nextGeneratedId = Math.max(nextGeneratedId, rawCard.id + 1);
    }
    return rawCard;
  });

  stack = normalizedCards;
  nextCardId = Math.max(nextCardId, nextGeneratedId);
  ensureTreasureCard();
  emitChange();
}

export function ensureTreasureCard(legacyArchivedRootIds = []) {
  const existingTreasureCard = stack.find(isTreasureCard);
  const cardIds = new Set(stack.map((card) => card.id));
  const existingTreasureChildIds = Array.isArray(existingTreasureCard?.childIds)
    ? existingTreasureCard.childIds
    : [];
  const migratedRootIds = legacyArchivedRootIds.filter((rootId) => (
    cardIds.has(rootId) && rootId !== TREASURE_CARD_ID
  ));
  const treasureChildIds = uniqueLinkedIds(
    [...existingTreasureChildIds, ...migratedRootIds],
    TREASURE_CARD_ID,
  ).filter((childId) => cardIds.has(childId));
  let didChange = false;

  const nextStack = stack.map((card) => {
    if (isTreasureCard(card)) {
      const nextTreasureCard = createTreasureCard(treasureChildIds);
      didChange = didChange || JSON.stringify(card) !== JSON.stringify(nextTreasureCard);
      return nextTreasureCard;
    }

    if (!treasureChildIds.includes(card.id)) {
      return card;
    }

    const nextParentIds = uniqueLinkedIds([
      ...(Array.isArray(card.parentIds) ? card.parentIds : []),
      TREASURE_CARD_ID,
    ], card.id);
    if (
      nextParentIds.length === card.parentIds.length
      && nextParentIds.every((parentId, parentIndex) => parentId === card.parentIds[parentIndex])
    ) {
      return card;
    }

    didChange = true;
    return {
      ...card,
      parentIds: nextParentIds,
    };
  });

  stack = existingTreasureCard
    ? nextStack
    : [createTreasureCard(treasureChildIds), ...nextStack];

  if (!existingTreasureCard) {
    didChange = true;
  }

  if (didChange) {
    emitChange();
  }
}

export function updateAt(index, value) {
  const nextValue = value.trim();

  if (index < 0 || index >= stack.length || isTreasureCard(stack[index])) {
    return;
  }

  stack = stack.map((card, itemIndex) => (
    itemIndex === index ? { ...card, text: nextValue } : card
  ));
  emitChange();
}

export function setDoneAt(index, done = true) {
  if (index < 0 || index >= stack.length || isTreasureCard(stack[index])) {
    return;
  }

  stack = stack.map((card, itemIndex) => (
    itemIndex === index ? { ...card, done: Boolean(done) } : card
  ));
  emitChange();
}

export function addStampAt(index, stamp) {
  if (index < 0 || index >= stack.length || !stamp || isTreasureCard(stack[index])) {
    return;
  }

  const x = Number(stamp.x);
  const y = Number(stamp.y);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return;
  }

  const nextStamp = {
    id: String(stamp.id ?? `stamp-${Date.now()}`),
    type: String(stamp.type ?? 'clock'),
    x: Math.min(Math.max(x, 0), 1),
    y: Math.min(Math.max(y, 0), 1),
  };

  stack = stack.map((card, itemIndex) => (
    itemIndex === index
      ? {
        ...card,
        stamps: [...(Array.isArray(card.stamps) ? card.stamps : []), nextStamp],
      }
      : card
  ));
  emitChange();
}

export function removeAt(index) {
  if (index < 0 || index >= stack.length) {
    return [];
  }

  const removedCard = stack[index];
  const removedCardId = removedCard.id;
  const removedChildIds = Array.isArray(removedCard.childIds) ? removedCard.childIds : [];
  const removedParentIds = Array.isArray(removedCard.parentIds) ? removedCard.parentIds : [];
  const removedCards = [removedCard];

  if (isTreasureCard(removedCard)) {
    return [];
  }

  stack = stack
    .filter((_, itemIndex) => itemIndex !== index)
    .map((card) => ({
      ...card,
      childIds: uniqueLinkedIds(
        card.childIds.flatMap((id) => (
          id === removedCardId ? removedChildIds : [id]
        )),
        card.id,
      ),
      parentIds: uniqueLinkedIds(
        card.parentIds.flatMap((id) => (
          id === removedCardId ? removedParentIds : [id]
        )),
        card.id,
      ),
    }));
  emitChange();
  return removedCards;
}

export function archiveRootTree(rootId) {
  const rootCard = stack.find((card) => card.id === rootId);
  const treasureCard = stack.find(isTreasureCard);
  if (
    !rootCard
    || !treasureCard
    || isTreasureCard(rootCard)
    || (Array.isArray(rootCard.parentIds) && rootCard.parentIds.length > 0)
  ) {
    return false;
  }

  stack = stack.map((card) => {
    if (isTreasureCard(card)) {
      return {
        ...card,
        childIds: uniqueLinkedIds([...(card.childIds || []), rootId], card.id),
      };
    }

    if (card.id === rootId) {
      return {
        ...card,
        parentIds: uniqueLinkedIds([...(card.parentIds || []), TREASURE_CARD_ID], card.id),
      };
    }

    return card;
  });
  emitChange();
  return true;
}

export function restoreRootTree(rootId) {
  const rootCard = stack.find((card) => card.id === rootId);
  if (!rootCard || isTreasureCard(rootCard)) {
    return false;
  }

  const didHaveTreasureParent = (rootCard.parentIds || []).includes(TREASURE_CARD_ID);
  if (!didHaveTreasureParent) {
    return false;
  }

  stack = stack.map((card) => {
    if (isTreasureCard(card)) {
      return {
        ...card,
        childIds: (card.childIds || []).filter((childId) => childId !== rootId),
      };
    }

    if (card.id === rootId) {
      return {
        ...card,
        parentIds: (card.parentIds || []).filter((parentId) => parentId !== TREASURE_CARD_ID),
      };
    }

    return card;
  });
  emitChange();
  return true;
}

export function removeDoneCascadeAt(index) {
  if (index < 0 || index >= stack.length || !stack[index]?.done) {
    return [];
  }

  const rootId = stack[index].id;
  const candidateIds = new Set();
  const visitedIds = new Set();

  function collectCandidateIds(cardId) {
    if (visitedIds.has(cardId)) {
      return;
    }

    visitedIds.add(cardId);
    candidateIds.add(cardId);

    const card = stack.find((item) => item.id === cardId);
    if (!card) {
      return;
    }

    (card.childIds || []).forEach(collectCandidateIds);
  }

  collectCandidateIds(rootId);

  const removedCards = [];

  while (true) {
    const nextDoneIndex = stack.findIndex((card) => (
      candidateIds.has(card.id) && card.done
    ));

    if (nextDoneIndex === -1) {
      break;
    }

    const [removedCard] = removeAt(nextDoneIndex);
    if (!removedCard) {
      break;
    }

    removedCards.push(removedCard);
    candidateIds.delete(removedCard.id);
  }

  return removedCards;
}

export function addChildLink(parentIndex, childIndex) {
  if (
    parentIndex < 0 ||
    parentIndex >= stack.length ||
    childIndex < 0 ||
    childIndex >= stack.length ||
    parentIndex === childIndex
  ) {
    return;
  }

  const parentId = stack[parentIndex].id;
  const childId = stack[childIndex].id;

  stack = stack.map((card) => {
    if (card.id === parentId) {
      return {
        ...card,
        childIds: card.childIds.includes(childId)
          ? card.childIds
          : [...card.childIds, childId],
      };
    }

    if (card.id === childId) {
      return {
        ...card,
        parentIds: card.parentIds.includes(parentId)
          ? card.parentIds
          : [...card.parentIds, parentId],
      };
    }

    return card;
  });
  emitChange();
}
