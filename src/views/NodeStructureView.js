import { View } from 'react-native';
import { useMemo, useState } from 'react';
import { buildTreeLayout } from '../lib/treeLayout';
import { styles } from '../styles/appStyles';

const MAP_PADDING = 10;
const MIN_NODE_SCALE = 0.01;
const PREVIEW_CARD_ID = 'add-preview-card';
const MAP_EDGE_THICKNESS = 1;
const MAP_TREE_LAYOUT_OVERRIDES = {
  childOverlapX: 96,
};

function getOrthogonalEdgeSegments(fromNode, toNode) {
  const elbowX = fromNode.x + ((toNode.x - fromNode.x) / 2);
  const points = [
    { x: fromNode.x, y: fromNode.y },
    { x: elbowX, y: fromNode.y },
    { x: elbowX, y: toNode.y },
    { x: toNode.x, y: toNode.y },
  ];

  return points.slice(0, -1).map((start, index) => {
    const end = points[index + 1];
    const isHorizontal = start.y === end.y;
    const left = Math.min(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const width = isHorizontal ? Math.abs(end.x - start.x) : MAP_EDGE_THICKNESS;
    const height = isHorizontal ? MAP_EDGE_THICKNESS : Math.abs(end.y - start.y);

    if (width <= 0 && height <= 0) {
      return null;
    }

    return {
      height: Math.max(height, MAP_EDGE_THICKNESS),
      left,
      top,
      width: Math.max(width, MAP_EDGE_THICKNESS),
    };
  }).filter(Boolean);
}

function insertNearSibling(childIds, targetId, previewId, placement) {
  const existingIds = childIds.filter((id) => id !== previewId);
  const targetPosition = existingIds.indexOf(targetId);

  if (targetPosition === -1) {
    return placement === 'previous'
      ? [previewId, ...existingIds]
      : [...existingIds, previewId];
  }

  const insertPosition = placement === 'previous'
    ? targetPosition
    : targetPosition + 1;

  return [
    ...existingIds.slice(0, insertPosition),
    previewId,
    ...existingIds.slice(insertPosition),
  ];
}

function buildPreviewCards(cards, focusedCardIndex, relation) {
  if (!relation || focusedCardIndex === null) {
    return cards;
  }

  const targetCard = cards[focusedCardIndex];
  if (!targetCard) {
    return cards;
  }

  const targetId = targetCard.id;
  const previewCard = {
    childIds: [],
    id: PREVIEW_CARD_ID,
    index: -1,
    parentIds: [],
    text: '',
  };

  if (relation === 'parent') {
    const previousParentIds = targetCard.parentIds || [];
    const rewrittenCards = cards.map((card) => {
      if (card.id === targetId) {
        return {
          ...card,
          parentIds: [PREVIEW_CARD_ID],
        };
      }

      if (previousParentIds.includes(card.id)) {
        return {
          ...card,
          childIds: card.childIds.map((childId) => (
            childId === targetId ? PREVIEW_CARD_ID : childId
          )),
        };
      }

      return card;
    });

    return [
      ...rewrittenCards.slice(0, focusedCardIndex),
      {
        ...previewCard,
        childIds: [targetId],
        parentIds: previousParentIds,
      },
      ...rewrittenCards.slice(focusedCardIndex),
    ];
  }

  if (relation === 'previousSibling' || relation === 'nextSibling') {
    const parentIds = targetCard.parentIds || [];
    const placement = relation === 'previousSibling' ? 'previous' : 'next';
    const insertIndex = relation === 'previousSibling'
      ? focusedCardIndex
      : focusedCardIndex + 1;

    if (parentIds.length === 0) {
      return [
        ...cards.slice(0, insertIndex),
        previewCard,
        ...cards.slice(insertIndex),
      ];
    }

    return [
      ...cards.map((card) => {
        if (!parentIds.includes(card.id)) {
          return card;
        }

        return {
          ...card,
          childIds: insertNearSibling(card.childIds, targetId, PREVIEW_CARD_ID, placement),
        };
      }),
      {
        ...previewCard,
        parentIds,
      },
    ];
  }

  return [
    ...cards.map((card) => {
      if (card.id !== targetId) {
        return card;
      }

      return {
        ...card,
        childIds: [...card.childIds.filter((id) => id !== PREVIEW_CARD_ID), PREVIEW_CARD_ID],
      };
    }),
    {
      ...previewCard,
      parentIds: [targetId],
    },
  ];
}

export function NodeStructureView({
  cards,
  focusedCardIndex,
  focusedCardId: controlledFocusedCardId = null,
  addPreviewRelation = null,
  deleteTargetActive = false,
}) {
  if (cards.length === 0) {
    return null;
  }

  const [mapSize, setMapSize] = useState({
    width: 180,
    height: 120,
  });

  const focusedCardId = controlledFocusedCardId ?? (focusedCardIndex === null
    ? null
    : cards[focusedCardIndex]?.id ?? null);
  const previewCards = useMemo(
    () => buildPreviewCards(cards, focusedCardIndex, addPreviewRelation),
    [addPreviewRelation, cards, focusedCardIndex],
  );
  const mapLayout = useMemo(
    () => buildTreeLayout(previewCards, new Set(), MAP_TREE_LAYOUT_OVERRIDES),
    [previewCards],
  );

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
    const nodeCenters = positionedCards.map((entry) => ({
      x: entry.left + (mapLayout.nodeWidth / 2),
      y: entry.top + (mapLayout.nodeHeight / 2),
    }));
    const minCenterX = Math.min(...nodeCenters.map((center) => center.x), 0);
    const minCenterY = Math.min(...nodeCenters.map((center) => center.y), 0);

    return {
      nodes: positionedCards.map((entry, entryIndex) => {
        const center = nodeCenters[entryIndex];

        return {
          card: entry.card,
          x: MAP_PADDING + (center.x - minCenterX) * safeScale,
          y: MAP_PADDING + (center.y - minCenterY) * safeScale,
          isFocused: entry.card.id === focusedCardId,
          isPreview: entry.card.id === PREVIEW_CARD_ID,
          isDone: Boolean(entry.card.done),
          isDeleteTarget: deleteTargetActive && entry.card.id === focusedCardId,
        };
      }),
      scale: safeScale,
    };
  }, [
    focusedCardId,
    deleteTargetActive,
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
      pointerEvents="none"
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

            const edgeSegments = getOrthogonalEdgeSegments(fromNode, toNode);

            if (edgeSegments.length === 0) {
              return null;
            }

            return edgeSegments.map((segment, segmentIndex) => (
              <View
                key={`edge-${entry.card.id}-${childId}-${segmentIndex}`}
                style={[
                  styles.nodeViewMapLine,
                  (entry.card.id === PREVIEW_CARD_ID || childId === PREVIEW_CARD_ID)
                    && styles.nodeViewMapLinePreview,
                  segment,
                ]}
              />
            ));
          });
        })}
        {nodeEntries.nodes.map((entry) => (
          <View
            key={`map-node-${entry.card.id}`}
            style={[
              styles.nodeViewMapNode,
              entry.isDone && styles.nodeViewMapNodeDone,
              entry.isFocused && styles.nodeViewMapNodeFocused,
              entry.isPreview && styles.nodeViewMapNodePreview,
              entry.isDeleteTarget && styles.nodeViewMapNodeDeleteTarget,
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
