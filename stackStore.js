let nextCardId = 1;
let stack = [];
const listeners = new Set();

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
      id: nextCardId,
      parentIds: [],
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
    id: nextCardId,
    parentIds: [],
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

  const childIds = rawChildIds.map((id) => Number(id)).filter((id) => Number.isInteger(id));
  const parentIds = rawParentIds.map((id) => Number(id)).filter((id) => Number.isInteger(id));

  const rawId = Number(rawCard?.id);
  const id = Number.isInteger(rawId) && rawId > 0
    ? rawId
    : nextGeneratedId;

  return {
    childIds,
    id,
    parentIds,
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
    emitChange();
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
    nextGeneratedId = Math.max(nextGeneratedId, rawCard.id + 1);
    return rawCard;
  });

  stack = normalizedCards;
  nextCardId = Math.max(nextCardId, nextGeneratedId);
  emitChange();
}

export function updateAt(index, value) {
  const nextValue = value.trim();

  if (index < 0 || index >= stack.length) {
    return;
  }

  stack = stack.map((card, itemIndex) => (
    itemIndex === index ? { ...card, text: nextValue } : card
  ));
  emitChange();
}

export function removeAt(index) {
  if (index < 0 || index >= stack.length) {
    return;
  }

  const removedCardId = stack[index].id;

  stack = stack
    .filter((_, itemIndex) => itemIndex !== index)
    .map((card) => ({
      ...card,
      childIds: card.childIds.filter((id) => id !== removedCardId),
      parentIds: card.parentIds.filter((id) => id !== removedCardId),
    }));
  emitChange();
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
