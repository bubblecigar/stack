export const PREVIEW_CARD_ID = 'add-preview-card';

function insertNearSibling(childIds, targetId, previewId, placement) {
  const existingIds = childIds.filter((id) => id !== previewId);
  const targetPosition = existingIds.indexOf(targetId);

  if (targetPosition === -1) {
    return placement === 'previous'
      ? [previewId, ...existingIds]
      : [...existingIds, previewId];
  }

  const insertPosition = placement === 'previous'
    ? targetPosition
    : targetPosition + 1;

  return [
    ...existingIds.slice(0, insertPosition),
    previewId,
    ...existingIds.slice(insertPosition),
  ];
}

export function buildPreviewCards(cards, focusedCardIndex, relation, backgroundColor = null) {
  if (!relation) {
    return cards;
  }

  const previewCard = {
    backgroundColor,
    childIds: [],
    id: PREVIEW_CARD_ID,
    index: -1,
    parentIds: [],
    text: '',
  };

  if (focusedCardIndex === null) {
    const insertsAtStart = relation === 'parent' || relation === 'previousSibling';
    const missionIndex = cards.findIndex((card) => (
      card?.systemType === 'mission' || card?.isMissionCard
    ));
    const treasureIndex = cards.findIndex((card) => (
      card?.systemType === 'treasure' || card?.isTreasureCard
    ));
    const insertIndex = insertsAtStart
      ? (missionIndex >= 0 ? missionIndex + 1 : 0)
      : (treasureIndex >= 0 ? treasureIndex : cards.length);

    return [
      ...cards.slice(0, insertIndex),
      previewCard,
      ...cards.slice(insertIndex),
    ];
  }

  const targetCard = cards[focusedCardIndex];
  if (!targetCard) {
    return cards;
  }

  const targetId = targetCard.id;
  if (relation === 'parent') {
    const previousParentIds = targetCard.parentIds || [];
    const rewrittenCards = cards.map((card) => {
      if (card.id === targetId) {
        return {
          ...card,
          parentIds: [PREVIEW_CARD_ID],
        };
      }

      if (previousParentIds.includes(card.id)) {
        return {
          ...card,
          childIds: card.childIds.map((childId) => (
            childId === targetId ? PREVIEW_CARD_ID : childId
          )),
        };
      }

      return card;
    });

    return [
      ...rewrittenCards.slice(0, focusedCardIndex),
      {
        ...previewCard,
        childIds: [targetId],
        parentIds: previousParentIds,
      },
      ...rewrittenCards.slice(focusedCardIndex),
    ];
  }

  if (relation === 'previousSibling' || relation === 'nextSibling') {
    const parentIds = targetCard.parentIds || [];
    const placement = relation === 'previousSibling' ? 'previous' : 'next';
    const insertIndex = relation === 'previousSibling'
      ? focusedCardIndex
      : focusedCardIndex + 1;

    if (parentIds.length === 0) {
      return [
        ...cards.slice(0, insertIndex),
        previewCard,
        ...cards.slice(insertIndex),
      ];
    }

    return [
      ...cards.map((card) => {
        if (!parentIds.includes(card.id)) {
          return card;
        }

        return {
          ...card,
          childIds: insertNearSibling(card.childIds, targetId, PREVIEW_CARD_ID, placement),
        };
      }),
      {
        ...previewCard,
        parentIds,
      },
    ];
  }

  return [
    ...cards.map((card) => {
      if (card.id !== targetId) {
        return card;
      }

      return {
        ...card,
        childIds: [...card.childIds.filter((id) => id !== PREVIEW_CARD_ID), PREVIEW_CARD_ID],
      };
    }),
    {
      ...previewCard,
      parentIds: [targetId],
    },
  ];
}
