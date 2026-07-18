import {
  Animated,
  Easing,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildTreeLayout } from '../lib/treeLayout';
import { buildPreviewCards, PREVIEW_CARD_ID } from '../lib/previewCards';
import { styles } from '../styles/appStyles';

const MAP_PADDING = 10;
const MIN_NODE_SCALE = 0.01;
const MAP_EDGE_THICKNESS = 1;
const MAP_TREE_LAYOUT_OVERRIDES = {
  childOverlapX: 96,
};
const LEAF_MAP_WIDTH_FACTOR = 0.58;
const LEAF_MAP_HEIGHT = 220;
const LEAF_STACK_TOP = 84;
const LEAF_STACK_HEIGHT = 360;
const LEAF_ADD_CARD_VISIBLE_TOP_OFFSET = 90;

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

function animateValueXY(valueXY, toValue) {
  return Animated.parallel([
    Animated.timing(valueXY.x, {
      toValue: toValue.x,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }),
    Animated.timing(valueXY.y, {
      toValue: toValue.y,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }),
  ]);
}

function getMapState(cards, focusedCardId, expandTreasureTree = false) {
  const treasureCard = cards.find((card) => card?.isTreasureCard);
  if (!treasureCard) {
    return {
      mapCards: cards,
      isTreasureFocusActive: false,
    };
  }

  const cardById = new Map(cards.map((card) => [card.id, card]));
  const hiddenTreasureDescendantIds = new Set();

  function collectDescendants(card) {
    (card?.childIds || []).forEach((childId) => {
      if (hiddenTreasureDescendantIds.has(childId)) {
        return;
      }

      hiddenTreasureDescendantIds.add(childId);
      collectDescendants(cardById.get(childId));
    });
  }

  collectDescendants(treasureCard);

  if (expandTreasureTree) {
    return {
      isTreasureFocusActive: (
        focusedCardId === treasureCard.id
        || hiddenTreasureDescendantIds.has(focusedCardId)
      ),
      mapCards: cards,
    };
  }

  return {
    isTreasureFocusActive: (
      focusedCardId === treasureCard.id
      || hiddenTreasureDescendantIds.has(focusedCardId)
    ),
    mapCards: cards
      .filter((card) => !hiddenTreasureDescendantIds.has(card.id))
      .map((card) => (
        card.id === treasureCard.id
          ? { ...card, childIds: [] }
          : card
      )),
  };
}

export function NodeStructureView({
  cards,
  focusedCardIndex,
  focusedCardId: controlledFocusedCardId = null,
  addPreviewRelation = null,
  anchorFocusedNode = false,
  deleteTargetActive = false,
  expandTreasureTree = false,
}) {
  const [mapSize, setMapSize] = useState({
    width: 180,
    height: 120,
  });
  const windowSize = useWindowDimensions();
  const mapOffset = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const cursorPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const cursorHasPosition = useRef(false);
  const focusedAnchorRef = useRef(null);
  const [focusedAnchor, setFocusedAnchor] = useState(null);
  const [showFocusedCursor, setShowFocusedCursor] = useState(false);

  const focusedCardId = controlledFocusedCardId ?? (focusedCardIndex === null
    ? null
    : cards[focusedCardIndex]?.id ?? null);
  const mapState = useMemo(
    () => getMapState(cards, focusedCardId, expandTreasureTree),
    [cards, expandTreasureTree, focusedCardId],
  );
  const { mapCards, isTreasureFocusActive } = mapState;
  const mapFocusedCardIndex = focusedCardId === null
    ? null
    : mapCards.findIndex((card) => card.id === focusedCardId);
  const previewCards = useMemo(
    () => buildPreviewCards(
      mapCards,
      mapFocusedCardIndex >= 0 ? mapFocusedCardIndex : null,
      addPreviewRelation,
    ),
    [addPreviewRelation, mapCards, mapFocusedCardIndex],
  );
  const mapLayout = useMemo(
    () => buildTreeLayout(previewCards, new Set(), MAP_TREE_LAYOUT_OVERRIDES),
    [previewCards],
  );
  const effectiveMapSize = anchorFocusedNode
    ? {
      width: Math.max(windowSize.width * LEAF_MAP_WIDTH_FACTOR, 1),
      height: LEAF_MAP_HEIGHT,
    }
    : mapSize;
  const leafFocusedAnchor = useMemo(() => {
    const stackBottom = LEAF_STACK_TOP + LEAF_STACK_HEIGHT;
    const addButtonTop = windowSize.height - LEAF_ADD_CARD_VISIBLE_TOP_OFFSET;

    return {
      x: windowSize.width * 0.2,
      y: stackBottom + ((addButtonTop - stackBottom) / 2),
    };
  }, [
    windowSize.height,
    windowSize.width,
  ]);

  const nodeEntries = useMemo(() => {
    const positionedCards = mapLayout.positionedCards || [];
    const maxW = Math.max(mapLayout.maxWidth || 1, 1);
    const maxH = Math.max(mapLayout.maxHeight || 1, 1);
    const availableWidth = Math.max(effectiveMapSize.width - (MAP_PADDING * 2), 1);
    const availableHeight = Math.max(effectiveMapSize.height - (MAP_PADDING * 2), 1);
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
          isTreasure: Boolean(entry.card.isTreasureCard),
          isTreasureFocusActive: Boolean(entry.card.isTreasureCard) && isTreasureFocusActive,
          isDeleteTarget: deleteTargetActive && entry.card.id === focusedCardId,
        };
      }),
      scale: safeScale,
    };
  }, [
    focusedCardId,
    isTreasureFocusActive,
    deleteTargetActive,
    mapLayout.maxHeight,
    mapLayout.maxWidth,
    mapLayout.nodeHeight,
    mapLayout.nodeWidth,
    mapLayout.positionedCards,
    effectiveMapSize.height,
    effectiveMapSize.width,
  ]);

  const nodeById = useMemo(() => {
    const keyed = new Map();
    nodeEntries.nodes.forEach((entry) => {
      keyed.set(entry.card.id, entry);
    });
    return keyed;
  }, [nodeEntries.nodes]);
  const focusedNode = useMemo(
    () => nodeEntries.nodes.find((entry) => entry.isFocused) || null,
    [nodeEntries.nodes],
  );

  useEffect(() => {
    if (!focusedNode) {
      cursorHasPosition.current = false;
      focusedAnchorRef.current = null;
      setFocusedAnchor(null);
      setShowFocusedCursor(false);
      return undefined;
    }

    if (!anchorFocusedNode) {
      const nextPosition = {
        x: focusedNode.x,
        y: focusedNode.y,
      };

      focusedAnchorRef.current = null;
      setFocusedAnchor(null);
      mapOffset.setValue({ x: 0, y: 0 });

      if (!cursorHasPosition.current) {
        cursorPosition.setValue(nextPosition);
        cursorHasPosition.current = true;
        setShowFocusedCursor(true);
        return undefined;
      }

      setShowFocusedCursor(true);
      const cursorAnimation = animateValueXY(cursorPosition, nextPosition);

      cursorAnimation.start();
      return () => {
        cursorAnimation.stop();
      };
    }

    const nextAnchor = leafFocusedAnchor;
    const nextOffset = {
      x: nextAnchor.x - focusedNode.x,
      y: nextAnchor.y - focusedNode.y,
    };

    cursorHasPosition.current = false;
    setFocusedAnchor(nextAnchor);

    if (!focusedAnchorRef.current) {
      focusedAnchorRef.current = nextAnchor;
      mapOffset.setValue(nextOffset);
      setShowFocusedCursor(true);
      return undefined;
    }

    focusedAnchorRef.current = nextAnchor;
    setShowFocusedCursor(true);
    const animation = animateValueXY(mapOffset, nextOffset);

    animation.start();
    return () => {
      animation.stop();
    };
  }, [anchorFocusedNode, cursorPosition, leafFocusedAnchor, mapOffset, focusedNode]);

  const focusedCursorPosition = anchorFocusedNode && focusedAnchor
    ? focusedAnchor
    : {
      x: cursorPosition.x,
      y: cursorPosition.y,
    };

  if (mapCards.length === 0) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={[
        styles.nodeView,
        anchorFocusedNode && styles.nodeViewLeafAnchored,
      ]}
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
        <Animated.View
          style={[
            styles.nodeViewMapLayer,
            {
              transform: [
                { translateX: anchorFocusedNode ? mapOffset.x : 0 },
                { translateY: anchorFocusedNode ? mapOffset.y : 0 },
              ],
            },
          ]}
        >
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
            entry.isTreasure ? (
              <Text
                key={`map-node-${entry.card.id}`}
                style={[
                  styles.nodeViewMapTreasureStar,
                  entry.isTreasureFocusActive && styles.nodeViewMapTreasureStarActive,
                  {
                    left: entry.x,
                    top: entry.y,
                  },
                ]}
              >
                ★
              </Text>
            ) : (
              <View
                key={`map-node-${entry.card.id}`}
                style={[
                  styles.nodeViewMapNode,
                  entry.isDone && styles.nodeViewMapNodeDone,
                  entry.isPreview && styles.nodeViewMapNodePreview,
                  entry.isDeleteTarget && styles.nodeViewMapNodeDeleteTarget,
                  {
                    left: entry.x,
                    top: entry.y,
                  },
                ]}
              />
            )
          ))}
        </Animated.View>
        {focusedNode && !focusedNode.isTreasure && showFocusedCursor && (!anchorFocusedNode || focusedAnchor) && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.nodeViewMapNode,
              styles.nodeViewMapNodeFocused,
              focusedNode.isDeleteTarget && styles.nodeViewMapNodeDeleteTarget,
              {
                left: focusedCursorPosition.x,
                top: focusedCursorPosition.y,
              },
            ]}
          />
        )}
      </View>
    </View>
  );
}
