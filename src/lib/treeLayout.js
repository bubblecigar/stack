const DEFAULT_TREE_LAYOUT = {
  treeNodeWidth: 220,
  treeNodeHeight: 112,
  childOverlapX: 146,
  childOverlapY: 16,
  rootGapY: 64,
  collapsedStackGapY: 0,
  collapsedStackPeek: 0,
};

export function buildTreeLayout(cards = [], collapsedNodeIds = new Set(), overrides = {}) {
  const config = {
    ...DEFAULT_TREE_LAYOUT,
    ...overrides,
  };

  const cardById = new Map(cards.map((card) => [card.id, card]));
  const rootCards = cards.filter((card) => (
    !Array.isArray(card.parentIds) || card.parentIds.length === 0
  )).sort((leftCard, rightCard) => {
    const leftIsTreasure = Boolean(leftCard?.isTreasureCard);
    const rightIsTreasure = Boolean(rightCard?.isTreasureCard);

    if (leftIsTreasure === rightIsTreasure) {
      return 0;
    }

    return leftIsTreasure ? 1 : -1;
  });

  const seen = new Set();
  const visiting = new Set();
  const positionedCards = [];

  const depthStepX = Math.max(
    config.treeNodeWidth - config.childOverlapX,
    config.treeNodeWidth / 4,
  );

  let cursorY = 14;
  let maxX = 0;
  let maxY = 0;
  let placementOrder = 0;

  function placeCard(card, depth, startY, collapsedContext = null) {
    if (!card || seen.has(card.id) || visiting.has(card.id)) {
      return { top: startY, bottom: startY };
    }

    visiting.add(card.id);

    const isInCollapsedContext = collapsedContext !== null;
    const isDirectlyCollapsed = collapsedNodeIds.has(card.id);
    const isCollapsed = isDirectlyCollapsed || isInCollapsedContext;
    const left = isInCollapsedContext
      ? collapsedContext.left
      : depth * depthStepX;
    const top = isInCollapsedContext
      ? collapsedContext.baseTop
      : startY;

    positionedCards.push({
      card,
      left,
      top,
      placementOrder,
      depth,
      isCollapsedStacked: isInCollapsedContext,
    });
    placementOrder += 1;

    seen.add(card.id);
    maxX = Math.max(maxX, left + config.treeNodeWidth);
    maxY = Math.max(maxY, top + config.treeNodeHeight);

    let nextY = top + config.treeNodeHeight - config.childOverlapY;
    let subtreeBottom = top + config.treeNodeHeight;
    const processedChildren = new Set();
    let collapsedChildIndex = 0;

    (card.childIds || []).forEach((childId) => {
      if (processedChildren.has(childId)) {
        return;
      }

      const childCard = cardById.get(childId);
      if (!childCard) {
        return;
      }

      processedChildren.add(childId);

      const nextCollapsedContext = {
        left,
        baseTop: isCollapsed
          ? top + config.collapsedStackPeek + (collapsedChildIndex * config.collapsedStackGapY)
          : 0,
      };

      const childStartY = isCollapsed
        ? top + config.collapsedStackPeek + (collapsedChildIndex * config.collapsedStackGapY)
        : nextY;

      const childBounds = placeCard(
        childCard,
        depth + 1,
        childStartY,
        isCollapsed ? nextCollapsedContext : null,
      );

      if (!isCollapsed) {
        subtreeBottom = Math.max(subtreeBottom, childBounds.bottom);
        nextY = childBounds.bottom - config.childOverlapY;
      }

      collapsedChildIndex += 1;
      subtreeBottom = Math.max(subtreeBottom, childBounds.bottom);
    });

    visiting.delete(card.id);
    return {
      top,
      bottom: subtreeBottom,
    };
  }

  rootCards.forEach((rootCard) => {
    const bounds = placeCard(rootCard, 0, cursorY);
    cursorY = bounds.bottom + config.rootGapY;
    maxY = Math.max(maxY, bounds.bottom);
  });

  cards.forEach((card) => {
    if (seen.has(card.id)) {
      return;
    }

    const bounds = placeCard(card, 0, cursorY);
    cursorY = bounds.bottom + config.rootGapY;
    maxY = Math.max(maxY, bounds.bottom);
  });

  return {
    maxHeight: Math.max(maxY + 100, 260),
    maxWidth: Math.max(maxX + 40, depthStepX + config.treeNodeWidth),
    nodeWidth: config.treeNodeWidth,
    nodeHeight: config.treeNodeHeight,
    positionedCards,
  };
}

export const TREE_CANVAS_PADDING = 420;
export { DEFAULT_TREE_LAYOUT };
