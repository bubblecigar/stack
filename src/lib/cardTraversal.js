function getRootCards(cards) {
  return cards.filter((card) => (
    !Array.isArray(card.parentIds) || card.parentIds.length === 0
  ));
}

function getOrderedChildCards(card, cardById) {
  return (card.childIds || [])
    .map((childId) => cardById.get(childId))
    .filter(Boolean);
}

export function buildCardTraversal(cards = [], mode = 'dfs') {
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const roots = getRootCards(cards);
  const orderedCards = [];
  const seen = new Set();

  function addCard(card) {
    if (!card || seen.has(card.id)) {
      return false;
    }

    seen.add(card.id);
    orderedCards.push(card);
    return true;
  }

  if (mode === 'bfs') {
    const queue = [...roots];

    while (queue.length > 0) {
      const card = queue.shift();

      if (!addCard(card)) {
        continue;
      }

      queue.push(...getOrderedChildCards(card, cardById));
    }
  } else {
    const visit = (card) => {
      if (!addCard(card)) {
        return;
      }

      getOrderedChildCards(card, cardById).forEach(visit);
    };

    roots.forEach(visit);
  }

  cards.forEach((card) => {
    if (!seen.has(card.id)) {
      orderedCards.push(card);
      seen.add(card.id);
    }
  });

  return orderedCards;
}

export function moveInTraversal(cards, currentCardId, direction, mode) {
  if (cards.length <= 1) {
    return null;
  }

  const traversal = buildCardTraversal(cards, mode);
  const currentIndex = traversal.findIndex((card) => card.id === currentCardId);

  if (currentIndex < 0) {
    return traversal[0] ?? null;
  }

  const step = direction === 'right' || direction === 'down' ? 1 : -1;
  const nextIndex = (currentIndex + step + traversal.length) % traversal.length;
  return traversal[nextIndex] ?? null;
}
