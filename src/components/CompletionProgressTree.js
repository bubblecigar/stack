import { useMemo } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { styles } from '../styles/appStyles';

const COMPLETION_NODE_SIZE = 14;
const COMPLETION_OVERLAY_PADDING = 18;
const COMPLETION_NODE_STEP_X = 28;
const COMPLETION_NODE_STEP_Y = 24;
const COMPLETION_ROW_STEP_Y = 42;
const COMPLETION_EDGE_THICKNESS = 1;

function isTodayTimestamp(timestamp) {
  const date = new Date(Number(timestamp));
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

function buildWrappedCompletionLayout(cards = [], availableWidth = 0) {
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const rootCards = cards.filter((card) => (
    !Array.isArray(card.parentIds) || card.parentIds.length === 0
  ));
  const positionedCards = [];
  const seen = new Set();
  const visiting = new Set();
  const edges = [];
  let order = 0;
  let maxY = 0;
  const usableWidth = Math.max(availableWidth - (COMPLETION_OVERLAY_PADDING * 2), COMPLETION_NODE_SIZE);
  const maxColumns = Math.max(
    Math.floor((usableWidth - COMPLETION_NODE_SIZE) / COMPLETION_NODE_STEP_X) + 1,
    1,
  );

  function placeCard(card, depth) {
    if (!card || seen.has(card.id) || visiting.has(card.id)) {
      return;
    }

    visiting.add(card.id);
    const row = Math.floor(order / maxColumns);
    const column = order % maxColumns;
    const y = (row * COMPLETION_ROW_STEP_Y) + (depth * COMPLETION_NODE_STEP_Y);

    positionedCards.push({
      card,
      x: column * COMPLETION_NODE_STEP_X,
      y,
    });
    order += 1;
    maxY = Math.max(maxY, y);
    seen.add(card.id);

    (card.childIds || []).forEach((childId) => {
      const childCard = cardById.get(childId);
      if (!childCard) {
        return;
      }

      edges.push({
        fromId: card.id,
        toId: childCard.id,
      });
      placeCard(childCard, depth + 1);
    });

    visiting.delete(card.id);
  }

  rootCards.forEach((rootCard) => placeCard(rootCard, 0));
  cards.forEach((card) => placeCard(card, 0));

  return {
    maxHeight: maxY + COMPLETION_NODE_SIZE,
    maxWidth: Math.min(
      ((Math.min(Math.max(order, 1), maxColumns) - 1) * COMPLETION_NODE_STEP_X) + COMPLETION_NODE_SIZE,
      usableWidth,
    ),
    edges,
    positionedCards,
  };
}

function getCompletionEdgeSegments(fromNode, toNode) {
  const fromX = COMPLETION_OVERLAY_PADDING + fromNode.x + COMPLETION_NODE_SIZE;
  const fromY = COMPLETION_OVERLAY_PADDING + fromNode.y + (COMPLETION_NODE_SIZE / 2);
  const toX = COMPLETION_OVERLAY_PADDING + toNode.x;
  const toY = COMPLETION_OVERLAY_PADDING + toNode.y + (COMPLETION_NODE_SIZE / 2);
  const elbowX = fromX + ((toX - fromX) / 2);
  const points = [
    { x: fromX, y: fromY },
    { x: elbowX, y: fromY },
    { x: elbowX, y: toY },
    { x: toX, y: toY },
  ];

  return points.slice(0, -1).map((start, index) => {
    const end = points[index + 1];
    const isHorizontal = start.y === end.y;
    const left = Math.min(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const width = isHorizontal ? Math.abs(end.x - start.x) : COMPLETION_EDGE_THICKNESS;
    const height = isHorizontal ? COMPLETION_EDGE_THICKNESS : Math.abs(end.y - start.y);

    if (width <= 0 && height <= 0) {
      return null;
    }

    return {
      height: Math.max(height, COMPLETION_EDGE_THICKNESS),
      left,
      top,
      width: Math.max(width, COMPLETION_EDGE_THICKNESS),
    };
  }).filter(Boolean);
}

export function CompletionProgressTree({ treeCompletionCanvas = null }) {
  const windowSize = useWindowDimensions();
  const completionNodes = Array.isArray(treeCompletionCanvas?.nodes)
    ? treeCompletionCanvas.nodes.filter((node) => isTodayTimestamp(node?.completedAt))
    : [];
  const completionLayout = useMemo(
    () => buildWrappedCompletionLayout(completionNodes, windowSize.width),
    [completionNodes, windowSize.width],
  );

  if (completionLayout.positionedCards.length === 0) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.completionProgressLayer}>
      <View style={styles.completionProgressNodeField}>
        {completionLayout.edges.flatMap((edge, edgeIndex) => {
          const fromNode = completionLayout.positionedCards.find((entry) => (
            entry.card.id === edge.fromId
          ));
          const toNode = completionLayout.positionedCards.find((entry) => (
            entry.card.id === edge.toId
          ));

          if (!fromNode || !toNode) {
            return [];
          }

          return getCompletionEdgeSegments(fromNode, toNode).map((segment, segmentIndex) => (
            <View
              key={`completion-edge-${edgeIndex}-${segmentIndex}`}
              style={[
                styles.completionProgressEdge,
                segment,
              ]}
            />
          ));
        })}
        {completionLayout.positionedCards.map((entry, entryIndex) => (
          <View
            key={entry.card.id || `completion-node-${entryIndex}`}
            style={[
              styles.completionProgressNode,
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
