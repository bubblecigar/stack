import { View } from 'react-native';
import { useMemo, useState } from 'react';
import { buildTreeLayout } from '../lib/treeLayout';
import { styles } from '../styles/appStyles';

const MAP_PADDING = 10;
const MIN_NODE_SCALE = 0.06;

export function NodeStructureView({ cards, focusedCardIndex }) {
  if (cards.length === 0) {
    return null;
  }

  const [mapSize, setMapSize] = useState({
    width: 180,
    height: 120,
  });

  const mapLayout = useMemo(() => buildTreeLayout(cards, new Set()), [cards]);

  const nodeEntries = useMemo(() => {
    const positionedCards = mapLayout.positionedCards || [];
    const maxW = Math.max(mapLayout.maxWidth || 1, 1);
    const maxH = Math.max(mapLayout.maxHeight || 1, 1);
    const availableWidth = Math.max(mapSize.width - (MAP_PADDING * 2), 1);
    const availableHeight = Math.max(mapSize.height - (MAP_PADDING * 2), 1);
    const scale = Math.min(
      availableWidth / maxW,
      availableHeight / maxH,
      1,
    );
    const safeScale = Math.max(scale, MIN_NODE_SCALE);
    const centeredOffsetX = (Math.max(mapSize.width, 1) - maxW * safeScale) / 2;
    const centeredOffsetY = (Math.max(mapSize.height, 1) - maxH * safeScale) / 2;

    return {
      nodes: positionedCards.map((entry) => {
        return {
          card: entry.card,
          x: MAP_PADDING + centeredOffsetX + (entry.left + (mapLayout.nodeWidth / 2)) * safeScale,
          y: MAP_PADDING + centeredOffsetY + (entry.top + (mapLayout.nodeHeight / 2)) * safeScale,
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
    mapSize.height,
    mapSize.width,
  ]);

  const nodeById = useMemo(() => {
    const keyed = new Map();
    nodeEntries.nodes.forEach((entry) => {
      keyed.set(entry.card.id, entry);
    });
    return keyed;
  }, [nodeEntries.nodes]);

  return (
    <View
      style={styles.nodeView}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setMapSize((current) => (
          current.width === width && current.height === height
            ? current
            : { width, height }
        ));
      }}
    >
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
