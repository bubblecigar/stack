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
  if (!Array.isArray(rawCards) || rawCards.length === 0) {
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
