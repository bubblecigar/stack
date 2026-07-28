export function getHiddenSystemCardIds(cards = [], hiddenRootIds = []) {
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const hiddenCardIds = new Set();

  function collectHiddenSubtree(card) {
    if (!card || hiddenCardIds.has(card.id)) {
      return;
    }

    hiddenCardIds.add(card.id);
    (Array.isArray(card.childIds) ? card.childIds : [])
      .map((childId) => cardById.get(childId))
      .filter(Boolean)
      .forEach(collectHiddenSubtree);
  }

  hiddenRootIds
    .map((rootId) => cardById.get(rootId))
    .filter(Boolean)
    .forEach(collectHiddenSubtree);

  return hiddenCardIds;
}

export function getVisibleCardsExcludingIds(cards = [], hiddenCardIds = new Set()) {
  if (!hiddenCardIds || hiddenCardIds.size === 0) {
    return cards;
  }

  return cards
    .filter((card) => !hiddenCardIds.has(card.id))
    .map((card) => ({
      ...card,
      childIds: (Array.isArray(card.childIds) ? card.childIds : [])
        .filter((childId) => !hiddenCardIds.has(childId)),
      parentIds: (Array.isArray(card.parentIds) ? card.parentIds : [])
        .filter((parentId) => !hiddenCardIds.has(parentId)),
    }));
}
