import { useMemo } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { resolveApiAssetUrl } from '../lib/apiClient';
import { isTimestampInAppDay } from '../lib/appDay';
import { getDoneMonsterPath } from '../lib/doneStampVisual';
import { styles } from '../styles/appStyles';
import { DoneStampArtwork } from './DoneStampArtwork';

const COMPLETION_STAMP_SIZE = 44;
const COMPLETION_OVERLAY_PADDING = 18;
const COMPLETION_STAMP_GAP = 6;

function buildCompletionStampLayout(cards = [], availableWidth = 0) {
  const usableWidth = Math.max(
    availableWidth - (COMPLETION_OVERLAY_PADDING * 2),
    COMPLETION_STAMP_SIZE,
  );
  const columns = Math.max(
    Math.floor(
      (usableWidth + COMPLETION_STAMP_GAP)
      / (COMPLETION_STAMP_SIZE + COMPLETION_STAMP_GAP),
    ),
    1,
  );

  return cards.map((card, index) => ({
    card,
    x: (index % columns) * (COMPLETION_STAMP_SIZE + COMPLETION_STAMP_GAP),
    y: Math.floor(index / columns) * (COMPLETION_STAMP_SIZE + COMPLETION_STAMP_GAP),
  }));
}

export function CompletionProgressTree({
  dayReference = Date.now(),
  treeCompletionCanvas = null,
}) {
  const windowSize = useWindowDimensions();
  const completionNodes = Array.isArray(treeCompletionCanvas?.nodes)
    ? treeCompletionCanvas.nodes.filter((node) => (
      isTimestampInAppDay(node?.completedAt, dayReference)
    ))
    : [];
  const positionedStamps = useMemo(
    () => buildCompletionStampLayout(completionNodes, windowSize.width),
    [completionNodes, windowSize.width],
  );

  if (positionedStamps.length === 0) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.completionProgressLayer}>
      <View style={styles.completionProgressStampField}>
        {positionedStamps.map((entry, entryIndex) => (
          <DoneStampArtwork
            key={entry.card.id || `completion-stamp-${entryIndex}`}
            uri={resolveApiAssetUrl(getDoneMonsterPath(entry.card.doneVisualId))}
            style={[
              styles.completionProgressStamp,
              {
                left: COMPLETION_OVERLAY_PADDING + entry.x,
                top: COMPLETION_OVERLAY_PADDING + entry.y,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}
