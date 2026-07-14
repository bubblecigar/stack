import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import {
  PanResponder, ScrollView, View,
} from 'react-native';
import { styles } from '../styles/appStyles';
import { buildTreeLayout, TREE_CANVAS_PADDING } from '../lib/treeLayout';
import { buildPreviewCards, PREVIEW_CARD_ID } from '../lib/previewCards';
import { StackCard } from '../components/StackCard';

export function TreeCanvas({
  cards,
  collapsedNodeIds,
  focusedCardIndex,
  focusedCardId,
  editingIndex,
  editingValue,
  onCardPress,
  onCardFocus,
  onCreateEdit,
  onToggleCollapse,
  onDeleteCard,
  onDeleteHoldComplete,
  onArchiveRootTree,
  onRestoreRootTree,
  onEditingValueChange,
  onCompleteEdit,
  onCanvasBlur,
  isDeleteHoldActive = false,
  addPreviewRelation = null,
}) {
  const treeHorizontalScrollRef = useRef(null);
  const treeVerticalScrollRef = useRef(null);
  const cardTouchRef = useRef(false);
  const didCanvasPanRef = useRef(false);
  const treeScrollOffsetRef = useRef({
    x: 0,
    y: 0,
  });
  const treePanStartOffsetRef = useRef({
    x: 0,
    y: 0,
  });
  const [treeViewport, setTreeViewport] = useState({
    width: 0,
    height: 0,
  });

  function handleCardPressIn() {
    cardTouchRef.current = true;
  }

  function handleCanvasTouchEnd() {
    const didCanvasPan = didCanvasPanRef.current;
    const wasCardTouch = cardTouchRef.current;
    didCanvasPanRef.current = false;
    cardTouchRef.current = false;

    if (wasCardTouch || didCanvasPan) {
      return;
    }

    onCanvasBlur?.();
  }

  const previewCards = useMemo(
    () => {
      const localFocusedPosition = cards.findIndex((card) => card.index === focusedCardIndex);
      return buildPreviewCards(
        cards,
        localFocusedPosition >= 0 ? localFocusedPosition : null,
        addPreviewRelation,
      );
    },
    [addPreviewRelation, cards, focusedCardIndex],
  );

  const {
    maxHeight,
    maxWidth,
    nodeWidth,
    nodeHeight,
    positionedCards,
  } = buildTreeLayout(previewCards, collapsedNodeIds);

  const contentWidth = maxWidth + (TREE_CANVAS_PADDING * 2);
  const contentHeight = maxHeight + (TREE_CANVAS_PADDING * 2);
  const maxScrollX = Math.max(contentWidth - treeViewport.width, 0);
  const maxScrollY = Math.max(contentHeight - treeViewport.height, 0);

  function scrollTreeTo(x, y, animated = false) {
    const targetX = Math.min(Math.max(x, 0), maxScrollX);
    const targetY = Math.min(Math.max(y, 0), maxScrollY);

    treeScrollOffsetRef.current = {
      x: targetX,
      y: targetY,
    };
    treeHorizontalScrollRef.current?.scrollTo({ x: targetX, animated });
    treeVerticalScrollRef.current?.scrollTo({ y: targetY, animated });
  }

  const treePanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gestureState) => (
      Math.hypot(gestureState.dx, gestureState.dy) > 6
    ),
    onPanResponderGrant: () => {
      didCanvasPanRef.current = false;
      treePanStartOffsetRef.current = treeScrollOffsetRef.current;
    },
    onPanResponderMove: (_, gestureState) => {
      didCanvasPanRef.current = true;
      scrollTreeTo(
        treePanStartOffsetRef.current.x - gestureState.dx,
        treePanStartOffsetRef.current.y - gestureState.dy,
      );
    },
  }), [
    maxScrollX,
    maxScrollY,
  ]);

  useEffect(() => {
    if (focusedCardIndex === null) {
      return;
    }

    const viewport = treeViewport;
    if (!viewport.width || !viewport.height) {
      return;
    }

    const focusedEntry = positionedCards.find(({ card }) => card.index === focusedCardIndex);
    if (!focusedEntry) {
      return;
    }

    const centeredX = focusedEntry.left + TREE_CANVAS_PADDING + (nodeWidth / 2);
    const bottomAlignedY = focusedEntry.top + TREE_CANVAS_PADDING + nodeHeight;

    const targetX = Math.min(
      Math.max(centeredX - (viewport.width / 2), 0),
      Math.max(contentWidth - viewport.width, 0),
    );
    const targetY = Math.min(
      Math.max(bottomAlignedY - (viewport.height / 2), 0),
      Math.max(contentHeight - viewport.height, 0),
    );

    scrollTreeTo(targetX, targetY, true);
  }, [
    contentHeight,
    contentWidth,
    focusedCardIndex,
    maxHeight,
    maxWidth,
    maxScrollX,
    maxScrollY,
    nodeWidth,
    nodeHeight,
    positionedCards,
    treeViewport.width,
    treeViewport.height,
  ]);

  const paddedPositionedCards = positionedCards.map((entry) => ({
    ...entry,
    left: entry.left + TREE_CANVAS_PADDING,
    top: entry.top + TREE_CANVAS_PADDING,
    isCollapsedStacked: entry.isCollapsedStacked,
  }));

  return (
    <View
      {...treePanResponder.panHandlers}
      style={styles.treeViewport}
      onTouchEnd={handleCanvasTouchEnd}
      onTouchCancel={() => {
        cardTouchRef.current = false;
        didCanvasPanRef.current = false;
      }}
      onLayout={(event) => {
        const { height, width } = event.nativeEvent.layout;
        setTreeViewport({
          height,
          width,
        });
      }}
    >
      <ScrollView
        ref={treeHorizontalScrollRef}
        style={styles.treeScroll}
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.treeHorizontalContent}
      >
        <ScrollView
          ref={treeVerticalScrollRef}
          style={styles.treeScroll}
          contentContainerStyle={styles.treeContent}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.treeCanvas,
              {
                height: maxHeight + (TREE_CANVAS_PADDING * 2),
                width: maxWidth + (TREE_CANVAS_PADDING * 2),
              },
            ]}
          >
            {paddedPositionedCards.map((entry) => {
              const { card, left, top, depth, placementOrder, isCollapsedStacked } = entry;
              const isPreviewCard = card.id === PREVIEW_CARD_ID;
              const isRootCard = !Array.isArray(card.parentIds) || card.parentIds.length === 0;

              return (
                <StackCard
                  card={card}
                  collapsedNodeIds={collapsedNodeIds}
                  editingIndex={editingIndex}
                  editingValue={editingValue}
                  focusedCardId={focusedCardId}
                  focusedCardIndex={focusedCardIndex}
                  layout="tree"
                  key={`card-${card.id}`}
                  visibleIndex={0}
                  onPressIn={handleCardPressIn}
                  onFocusCard={onCardFocus}
                  hideControls={isPreviewCard || card.isTreasureCard}
                  isArchivedRoot={Boolean(card.isArchivedRoot)}
                  isPreviewCard={isPreviewCard}
                  isRootCard={isRootCard}
                  isTreasureCard={Boolean(card.isTreasureCard)}
                  treePosition={{
                    left,
                    top,
                    depth,
                    placementOrder,
                  }}
                  isCollapsedStacked={isCollapsedStacked}
                  isDeleteHoldActive={isDeleteHoldActive}
                  onPress={() => {
                    if (!isPreviewCard) {
                      onCardPress(card.index);
                    }
                  }}
                  onCreateEdit={onCreateEdit}
                  onToggleCollapse={onToggleCollapse}
                  onDeleteCard={onDeleteCard}
                  onDeleteHoldComplete={onDeleteHoldComplete}
                  onArchiveRootTree={onArchiveRootTree}
                  onRestoreRootTree={onRestoreRootTree}
                  onEditingValueChange={onEditingValueChange}
                  onCompleteEdit={onCompleteEdit}
                />
              );
            })}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}
