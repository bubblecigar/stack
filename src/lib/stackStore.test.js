import {
  adoptMissionRoot,
  archiveRootTree,
  canInsertRelativeTo,
  clearCardImageAt,
  ensureSystemCards,
  getSnapshot,
  hasChildOnlyInsertion,
  insertRelativeTo,
  loadCards,
  MISSION_CARD_ID,
  push,
  removeAt,
  restoreRootTree,
  replaceDoneCascadeWithCollectionAt,
  setCardImageAt,
  setDoneAt,
  setScanStateAt,
  TREASURE_CARD_ID,
  updateAt,
} from '../../stackStore';
import { getCollectionDoneVisualIds } from './doneStampVisual';

describe('system cards', () => {
  beforeEach(() => {
    loadCards([]);
  });

  it('allows treasure siblings while blocking a treasure parent', () => {
    ensureSystemCards();
    const treasureIndex = getSnapshot().findIndex((card) => card.id === TREASURE_CARD_ID);
    const treasureCard = getSnapshot()[treasureIndex];

    expect(canInsertRelativeTo(treasureCard, 'parent')).toBe(false);
    expect(canInsertRelativeTo(treasureCard, 'previousSibling')).toBe(true);
    expect(canInsertRelativeTo(treasureCard, 'nextSibling')).toBe(false);

    const newRootIndex = insertRelativeTo(treasureIndex, 'previousSibling', 'New root');
    expect(newRootIndex).toBe(treasureIndex);
    expect(getSnapshot()[newRootIndex]).toMatchObject({
      parentIds: [],
      text: 'New root',
    });
    expect(getSnapshot()[newRootIndex + 1].id).toBe(TREASURE_CARD_ID);
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

  it('persists a validated Done visual without changing toggle semantics', () => {
    const cardIndex = push('Hatch me');
    const cardId = getSnapshot()[cardIndex].id;
    const [doneVisualId] = getCollectionDoneVisualIds();

    setDoneAt(cardIndex, true, doneVisualId);
    expect(getSnapshot()[cardIndex]).toMatchObject({
      done: true,
      doneVisualId,
    });

    setDoneAt(cardIndex, false);
    expect(getSnapshot()[cardIndex]).toMatchObject({
      done: false,
      doneVisualId,
    });

    loadCards(getSnapshot());
    expect(getSnapshot().find((card) => card.id === cardId)).toMatchObject({
      done: false,
      doneVisualId,
    });
  });

  it('replaces a completed cascade root with a persistent locked collection card', () => {
    const parentIndex = push('Parent');
    const parentId = getSnapshot()[parentIndex].id;
    const targetIndex = insertRelativeTo(parentIndex, 'child', 'Void target');
    const targetId = getSnapshot()[targetIndex].id;
    const childIndex = insertRelativeTo(targetIndex, 'child', 'Completed child');
    const childId = getSnapshot()[childIndex].id;
    const survivingIndex = insertRelativeTo(childIndex, 'child', 'Not done');
    const survivingId = getSnapshot()[survivingIndex].id;
    const collectionVisualId = getCollectionDoneVisualIds()
      .find((visualId) => visualId.startsWith('food-'));

    setDoneAt(targetIndex, true, collectionVisualId);
    setDoneAt(childIndex, true);
    const removedCards = replaceDoneCascadeWithCollectionAt(targetIndex, collectionVisualId);

    expect(removedCards.map((card) => card.id)).toEqual([targetId, childId]);
    expect(getSnapshot().find((card) => card.id === targetId)).toMatchObject({
      childIds: [survivingId],
      done: false,
      collectionVisualId,
      isCollectionCard: true,
      locked: true,
      parentIds: [parentId],
      systemType: 'collection',
      text: '',
    });
    expect(getSnapshot().find((card) => card.id === parentId).childIds).toEqual([targetId]);
    expect(getSnapshot().find((card) => card.id === survivingId).parentIds).toEqual([targetId]);

    const collectionIndex = getSnapshot().findIndex((card) => card.id === targetId);
    updateAt(collectionIndex, 'Edited');
    setDoneAt(collectionIndex, true);
    expect(getSnapshot()[collectionIndex]).toMatchObject({
      done: false,
      text: '',
    });
    expect(hasChildOnlyInsertion(getSnapshot()[collectionIndex])).toBe(false);

    const insertedParentIndex = insertRelativeTo(collectionIndex, 'parent', 'Collection keeper');
    const insertedParent = getSnapshot()[insertedParentIndex];
    expect(insertedParent.id).not.toBe(targetId);
    expect(insertedParent.childIds).toEqual([targetId]);
    expect(getSnapshot().find((card) => card.id === targetId).parentIds).toEqual([
      insertedParent.id,
    ]);

    loadCards(getSnapshot());
    expect(getSnapshot().find((card) => card.id === targetId)).toMatchObject({
      collectionVisualId,
      isCollectionCard: true,
      systemType: 'collection',
    });

    const reloadedCollectionIndex = getSnapshot().findIndex((card) => card.id === targetId);
    expect(removeAt(reloadedCollectionIndex)).toHaveLength(1);
    expect(getSnapshot().some((card) => card.id === targetId)).toBe(false);
    expect(getSnapshot().find((card) => card.id === insertedParent.id).childIds).toEqual([
      survivingId,
    ]);
    expect(getSnapshot().find((card) => card.id === survivingId).parentIds).toEqual([
      insertedParent.id,
    ]);
  });

  it('normalizes legacy monster cards into collection cards', () => {
    const monsterVisualId = getCollectionDoneVisualIds()
      .find((visualId) => visualId.startsWith('monster-'));

    loadCards([{
      childIds: [],
      id: 42,
      isMonsterCard: true,
      monsterVisualId,
      parentIds: [],
      systemType: 'monster',
    }]);

    expect(getSnapshot().find((card) => card.id === 42)).toMatchObject({
      collectionVisualId: monsterVisualId,
      isCollectionCard: true,
      systemType: 'collection',
    });
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

  it('keeps promoted children in a deleted root parent\'s position', () => {
    loadCards([
      {
        childIds: [3, 4],
        id: 1,
        parentIds: [],
        text: 'Parent',
      },
      {
        childIds: [],
        id: 2,
        parentIds: [],
        text: 'Following root',
      },
      {
        childIds: [],
        id: 3,
        parentIds: [1],
        text: 'First child',
      },
      {
        childIds: [],
        id: 4,
        parentIds: [1],
        text: 'Second child',
      },
    ]);

    const parentIndex = getSnapshot().findIndex((card) => card.id === 1);
    removeAt(parentIndex);

    const activeRootIds = getSnapshot()
      .filter((card) => (
        card.id !== MISSION_CARD_ID
        && card.id !== TREASURE_CARD_ID
        && card.parentIds.length === 0
      ))
      .map((card) => card.id);
    expect(activeRootIds).toEqual([3, 4, 2]);
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
