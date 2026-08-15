import {
  adoptMissionRoot,
  archiveRootTree,
  clearCardImageAt,
  ensureSystemCards,
  getSnapshot,
  insertRelativeTo,
  loadCards,
  MISSION_CARD_ID,
  push,
  restoreRootTree,
  setCardImageAt,
  setScanStateAt,
  TREASURE_CARD_ID,
  updateAt,
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

  it('moves archived roots to the bottom of the treasure tree', () => {
    const firstRootIndex = push('First root');
    const firstRootId = getSnapshot()[firstRootIndex].id;
    const secondRootIndex = push('Second root');
    const secondRootId = getSnapshot()[secondRootIndex].id;

    expect(archiveRootTree(secondRootId)).toBe(true);
    expect(archiveRootTree(firstRootId)).toBe(true);

    const cards = getSnapshot();
    expect(cards.find((card) => card.id === TREASURE_CARD_ID).childIds).toEqual([
      secondRootId,
      firstRootId,
    ]);
    expect(cards.map((card) => card.id).slice(-2)).toEqual([
      secondRootId,
      firstRootId,
    ]);
  });

  it('moves restored roots to the bottom of the active root list', () => {
    const firstRootIndex = push('First root');
    const firstRootId = getSnapshot()[firstRootIndex].id;
    const secondRootIndex = push('Second root');
    const secondRootId = getSnapshot()[secondRootIndex].id;
    const thirdRootIndex = push('Third root');
    const thirdRootId = getSnapshot()[thirdRootIndex].id;

    expect(archiveRootTree(firstRootId)).toBe(true);
    expect(restoreRootTree(firstRootId)).toBe(true);

    const userRootIds = getSnapshot()
      .filter((card) => (
        card.id !== MISSION_CARD_ID
        && card.id !== TREASURE_CARD_ID
        && (!Array.isArray(card.parentIds) || card.parentIds.length === 0)
      ))
      .map((card) => card.id);
    expect(userRootIds).toEqual([
      secondRootId,
      thirdRootId,
      firstRootId,
    ]);
  });

  it('preserves whitespace when editing an existing card', () => {
    const cardIndex = push('Formula');

    updateAt(cardIndex, 'a + b \n ');

    expect(getSnapshot()[cardIndex].text).toBe('a + b \n ');
  });

  it('persists scan coordination metadata across reloads', () => {
    const cardIndex = push('Generating scan result...');
    setScanStateAt(cardIndex, 'scan-request-1', 'pending');

    loadCards(getSnapshot());

    const card = getSnapshot().find((candidate) => candidate.scanRequestId === 'scan-request-1');
    expect(card.scanStatus).toBe('pending');
  });

  it('converts between text and image cards across reloads', () => {
    const cardIndex = push('Discard this text');

    expect(setCardImageAt(
      cardIndex,
      '/api/card-images/7/1-123e4567-e89b-12d3-a456-426614174000.jpg',
      'image/jpeg',
    )).toBe(true);
    expect(getSnapshot()[cardIndex]).toMatchObject({
      imageMimeType: 'image/jpeg',
      imagePath: '/api/card-images/7/1-123e4567-e89b-12d3-a456-426614174000.jpg',
      text: '',
    });

    loadCards(getSnapshot());
    const reloadedCardIndex = getSnapshot().findIndex((card) => card.imagePath);
    expect(clearCardImageAt(reloadedCardIndex)).toBe(true);
    expect(getSnapshot()[reloadedCardIndex]).toEqual(expect.objectContaining({ text: '' }));
    expect(getSnapshot()[reloadedCardIndex].imagePath).toBeUndefined();
  });
});
