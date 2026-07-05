import { View } from 'react-native';
import { useMemo } from 'react';
import { buildTreeLayout } from '../lib/treeLayout';
import { styles } from '../styles/appStyles';

const MAP_WIDTH = 160;
const MAP_HEIGHT = 94;
const MAP_PADDING = 8;
const MIN_NODE_SCALE = 0.06;

export function NodeStructureView({ cards, focusedCardIndex }) {
  if (cards.length === 0) {
    return null;
  }

  const mapLayout = useMemo(() => buildTreeLayout(cards, new Set()), [cards]);

  const nodeEntries = useMemo(() => {
    const positionedCards = mapLayout.positionedCards || [];
    const maxW = Math.max(mapLayout.maxWidth || 1, 1);
    const maxH = Math.max(mapLayout.maxHeight || 1, 1);
    const scale = Math.min(
      (MAP_WIDTH - (MAP_PADDING * 2)) / maxW,
      (MAP_HEIGHT - (MAP_PADDING * 2)) / maxH,
      1,
    );
    const safeScale = Math.max(scale, MIN_NODE_SCALE);

    return {
      nodes: positionedCards.map((entry) => {
        const x = MAP_PADDING + (entry.left + (mapLayout.nodeWidth / 2)) * safeScale;
        const y = MAP_PADDING + (entry.top + (mapLayout.nodeHeight / 2)) * safeScale;

        return {
          card: entry.card,
          x,
          y,
          isFocused: entry.card.index === focusedCardIndex,
        };
      }),
      scale: safeScale,
    };
  }, [
    focusedCardIndex,
    mapLayout.maxHeight,
    mapLayout.maxWidth,
    mapLayout.nodeHeight,
    mapLayout.nodeWidth,
    mapLayout.positionedCards,
  ]);

  const nodeById = useMemo(() => {
    const keyed = new Map();
    nodeEntries.nodes.forEach((entry) => {
      keyed.set(entry.card.id, entry);
    });
    return keyed;
  }, [nodeEntries.nodes]);

  return (
    <View style={styles.nodeView}>
      <View style={styles.nodeViewCanvas}>
        {mapLayout.positionedCards.map((entry) => {
          if (!entry.card || !Array.isArray(entry.card.childIds)) {
            return null;
          }

          const fromNode = nodeById.get(entry.card.id);
          if (!fromNode) {
            return null;
          }

          return entry.card.childIds.map((childId) => {
            const toNode = nodeById.get(childId);
            if (!toNode) {
              return null;
            }

            const dx = toNode.x - fromNode.x;
            const dy = toNode.y - fromNode.y;
            const length = Math.hypot(dx, dy);

            if (length <= 0) {
              return null;
            }

            return (
              <View
                key={`edge-${entry.card.id}-${childId}`}
                style={[
                  styles.nodeViewMapLine,
                  {
                    left: fromNode.x,
                    top: fromNode.y,
                    width: length,
                    transform: [{
                      rotate: `${(Math.atan2(dy, dx) * 180) / Math.PI}deg`,
                    }],
                  },
                ]}
              />
            );
          });
        })}
        {nodeEntries.nodes.map((entry) => (
          <View
            key={`map-node-${entry.card.id}`}
            style={[
              styles.nodeViewMapNode,
              entry.isFocused && styles.nodeViewMapNodeFocused,
              {
                left: entry.x,
                top: entry.y,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}
