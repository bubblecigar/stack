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
      childIds: [2, 5],
      done: false,
      id: 1,
      parentIds: [],
      text: 'Root ancestor',
    },
    {
      childIds: [3, 4],
      done: false,
      id: 2,
      parentIds: [1],
      text: 'Primary child',
    },
    {
      childIds: [],
      done: false,
      id: 3,
      parentIds: [2],
      text: 'Grandchild branch one',
    },
    {
      childIds: [],
      done: false,
      id: 4,
      parentIds: [2],
      text: 'Grandchild branch two',
    },
    {
      childIds: [],
      done: false,
      id: 5,
      parentIds: [1],
      text: 'Secondary child',
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
