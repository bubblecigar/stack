export function createInitialCards() {
  return [
    {
      childIds: [],
      done: false,
      id: 'mission-card',
      isMissionCard: true,
      locked: true,
      parentIds: [],
      systemType: 'mission',
      text: 'Mission',
    },
    {
      childIds: [],
      done: false,
      id: 1,
      parentIds: [4],
      text: 'Swipe the white card to add a new card.',
    },
    {
      childIds: [],
      done: false,
      id: 2,
      parentIds: [4],
      text: 'Double-tap the white card to switch between leaf and tree views.',
    },
    {
      childIds: [],
      done: false,
      id: 3,
      parentIds: [4],
      text: 'Press and hold the stamp to delete the selected card.',
    },
    {
      childIds: [1, 2, 3],
      done: false,
      id: 4,
      parentIds: [],
      text: 'Welcome to Stack\nStart with these three gestures.',
    },
    {
      childIds: [],
      done: false,
      id: 'treasure-card',
      isTreasureCard: true,
      locked: true,
      parentIds: [],
      systemType: 'treasure',
      text: 'Treasure',
    },
  ];
}
