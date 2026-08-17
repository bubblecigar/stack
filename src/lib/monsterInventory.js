import { isTimestampInAppDay } from './appDay';
import { getDoneMonsterPath } from './doneStampVisual';

export function getCompletionMonsterInventory(
  treeCompletionCanvas,
  dayReference = Date.now(),
) {
  const completionNodes = Array.isArray(treeCompletionCanvas?.nodes)
    ? treeCompletionCanvas.nodes
    : [];

  return completionNodes
    .filter((node) => (
      isTimestampInAppDay(node?.completedAt, dayReference)
      && Boolean(getDoneMonsterPath(node?.monsterVisualId))
    ))
    .map((node, index) => ({
      id: node.id || `completion-monster-${node.completedAt}-${index}`,
      monsterVisualId: node.monsterVisualId,
    }));
}
