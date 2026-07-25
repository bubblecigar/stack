import { isTimestampToday } from './cardDates';

export function getDailyVisibleCards(cards = [], missionCardId, now = Date.now()) {
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const missionCard = cardById.get(missionCardId);
  if (!missionCard) {
    return cards;
  }

  const hiddenCardIds = new Set();

  function hideSubtree(card) {
    if (!card || hiddenCardIds.has(card.id)) {
      return;
    }

    hiddenCardIds.add(card.id);
    (card.childIds || [])
      .map((childId) => cardById.get(childId))
      .filter(Boolean)
      .forEach(hideSubtree);
  }

  (missionCard.childIds || [])
    .map((childId) => cardById.get(childId))
    .filter((card) => isTimestampToday(card?.lastAdoptedAt, now))
    .forEach(hideSubtree);

  if (hiddenCardIds.size === 0) {
    return cards;
  }

  return cards
    .filter((card) => !hiddenCardIds.has(card.id))
    .map((card) => ({
      ...card,
      childIds: (card.childIds || []).filter((childId) => !hiddenCardIds.has(childId)),
      parentIds: (card.parentIds || []).filter((parentId) => !hiddenCardIds.has(parentId)),
    }));
}
