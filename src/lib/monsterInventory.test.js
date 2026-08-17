import { getCompletionMonsterInventory } from './monsterInventory';
import { getMonsterDoneVisualIds } from './doneStampVisual';

describe('getCompletionMonsterInventory', () => {
  it('returns only monster completion nodes from the selected app day', () => {
    const [firstMonsterId, secondMonsterId] = getMonsterDoneVisualIds();
    const dayReference = new Date(2026, 7, 17, 12).getTime();
    const previousDay = new Date(2026, 7, 16, 12).getTime();

    expect(getCompletionMonsterInventory({
      nodes: [
        {
          completedAt: dayReference,
          id: 'monster-1',
          monsterVisualId: firstMonsterId,
        },
        {
          completedAt: dayReference,
          id: 'done-card',
        },
        {
          completedAt: previousDay,
          id: 'old-monster',
          monsterVisualId: secondMonsterId,
        },
      ],
    }, dayReference)).toEqual([
      {
        id: 'monster-1',
        monsterVisualId: firstMonsterId,
      },
    ]);
  });
});
