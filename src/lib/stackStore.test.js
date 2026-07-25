import {
  adoptMissionRoot,
  archiveRootTree,
  ensureSystemCards,
  getSnapshot,
  insertRelativeTo,
  loadCards,
  MISSION_CARD_ID,
  push,
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

  it('adopts a mission root and its descendants as an independent user tree', () => {
    const missionIndex = getSnapshot().findIndex((card) => card.id === MISSION_CARD_ID);
    const rootIndex = insertRelativeTo(missionIndex, 'child', 'Mission task');
    const rootId = getSnapshot()[rootIndex].id;
    const childIndex = insertRelativeTo(rootIndex, 'child', 'Mission step');
    const childId = getSnapshot()[childIndex].id;
    const grandchildIndex = insertRelativeTo(childIndex, 'child', 'Mission detail');
    const grandchildId = getSnapshot()[grandchildIndex].id;

    const adoptedIndex = adoptMissionRoot(rootId);
    const cards = getSnapshot();
    const missionCard = cards.find((card) => card.id === MISSION_CARD_ID);
    const missionRoot = cards.find((card) => card.id === rootId);
    const adoptedRoot = cards[adoptedIndex];
    const adoptedChild = cards.find((card) => card.id === adoptedRoot.childIds[0]);
    const adoptedGrandchild = cards.find((card) => card.id === adoptedChild.childIds[0]);

    expect(adoptedRoot.id).not.toBe(missionRoot.id);
    expect(adoptedRoot.text).toBe('Mission task');
    expect(adoptedRoot.parentIds).toEqual([]);
    expect(adoptedChild.text).toBe('Mission step');
    expect(adoptedChild.parentIds).toEqual([adoptedRoot.id]);
    expect(adoptedGrandchild.text).toBe('Mission detail');
    expect(adoptedGrandchild.parentIds).toEqual([adoptedChild.id]);
    expect([adoptedRoot.id, adoptedChild.id, adoptedGrandchild.id]).not.toEqual(
      expect.arrayContaining([rootId, childId, grandchildId]),
    );
    expect(missionCard.childIds).toContain(rootId);
    expect(missionRoot.parentIds).toEqual([MISSION_CARD_ID]);
    expect(missionRoot.childIds).toEqual([childId]);
    expect(Number.isFinite(missionRoot.lastAdoptedAt)).toBe(true);

    loadCards(cards);
    expect(getSnapshot().find((card) => card.id === rootId).lastAdoptedAt).toBe(
      missionRoot.lastAdoptedAt,
    );
  });

  it('does not archive a mission root directly', () => {
    const missionIndex = getSnapshot().findIndex((card) => card.id === MISSION_CARD_ID);
    const childIndex = insertRelativeTo(missionIndex, 'child', 'Mission task');
    const childId = getSnapshot()[childIndex].id;

    expect(archiveRootTree(childId)).toBe(false);
  });

  it('continues to archive and restore standalone user roots', () => {
    const rootIndex = push('User task');
    const rootId = getSnapshot()[rootIndex].id;

    expect(archiveRootTree(rootId)).toBe(true);
    expect(getSnapshot().find((card) => card.id === rootId).parentIds).toEqual([
      TREASURE_CARD_ID,
    ]);

    expect(restoreRootTree(rootId)).toBe(true);
    expect(getSnapshot().find((card) => card.id === rootId).parentIds).toEqual([]);
  });
});
