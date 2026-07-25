import {
  archiveRootTree,
  ensureSystemCards,
  getSnapshot,
  insertRelativeTo,
  loadCards,
  MISSION_CARD_ID,
  restoreRootTree,
  TREASURE_CARD_ID,
} from '../../stackStore';

describe('system cards', () => {
  beforeEach(() => {
    loadCards([]);
  });

  it('adds one mission card and one treasure card to existing data', () => {
    loadCards([
      {
        childIds: [],
        id: 1,
        parentIds: [],
        stamps: [],
        text: 'Existing card',
      },
    ]);
    ensureSystemCards();

    const cards = getSnapshot();
    expect(cards.filter((card) => card.id === MISSION_CARD_ID)).toHaveLength(1);
    expect(cards.filter((card) => card.id === TREASURE_CARD_ID)).toHaveLength(1);
    expect(cards.map((card) => card.id)).toEqual([
      MISSION_CARD_ID,
      1,
      TREASURE_CARD_ID,
    ]);
  });

  it('archives a mission child by moving its root link to treasure', () => {
    const missionIndex = getSnapshot().findIndex((card) => card.id === MISSION_CARD_ID);
    const childIndex = insertRelativeTo(missionIndex, 'child', 'Mission task');
    const childId = getSnapshot()[childIndex].id;

    expect(archiveRootTree(childId)).toBe(true);

    const archivedCards = getSnapshot();
    const missionCard = archivedCards.find((card) => card.id === MISSION_CARD_ID);
    const treasureCard = archivedCards.find((card) => card.id === TREASURE_CARD_ID);
    const archivedCard = archivedCards.find((card) => card.id === childId);

    expect(missionCard.childIds).not.toContain(childId);
    expect(treasureCard.childIds).toContain(childId);
    expect(archivedCard.parentIds).toEqual([TREASURE_CARD_ID]);

    expect(restoreRootTree(childId)).toBe(true);
    expect(getSnapshot().find((card) => card.id === childId).parentIds).toEqual([]);
  });
});
