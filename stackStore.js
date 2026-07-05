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

export function toggleChildLink(parentIndex, childIndex) {
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
  const hasLink = stack[parentIndex].childIds.includes(childId);

  stack = stack.map((card) => {
    if (card.id === parentId) {
      return {
        ...card,
        childIds: hasLink
          ? card.childIds.filter((id) => id !== childId)
          : [...card.childIds, childId],
      };
    }

    if (card.id === childId) {
      return {
        ...card,
        parentIds: hasLink
          ? card.parentIds.filter((id) => id !== parentId)
          : [...card.parentIds, parentId],
      };
    }

    return card;
  });
  emitChange();
}
