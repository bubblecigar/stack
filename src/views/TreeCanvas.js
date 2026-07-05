import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { styles } from '../styles/appStyles';
import { buildTreeLayout, TREE_CANVAS_PADDING } from '../lib/treeLayout';
import { StackCard } from '../components/StackCard';

export function TreeCanvas({
  cards,
  collapsedNodeIds,
  focusedCardIndex,
  editingIndex,
  editingValue,
  onCardPress,
  onCardFocus,
  onCreateEdit,
  onToggleCollapse,
  onDeleteCard,
  onEditingValueChange,
  onCanvasBlur,
}) {
  const treeHorizontalScrollRef = useRef(null);
  const treeVerticalScrollRef = useRef(null);
  const cardTouchRef = useRef(false);
  const [treeViewport, setTreeViewport] = useState({
    width: 0,
    height: 0,
  });

  function handleCardPressIn() {
    cardTouchRef.current = true;
  }

  function handleCanvasTouchEnd() {
    const wasCardTouch = cardTouchRef.current;
    cardTouchRef.current = false;

    if (wasCardTouch) {
      return;
    }

    onCanvasBlur?.();
  }

  const {
    maxHeight,
    maxWidth,
    nodeWidth,
    nodeHeight,
    positionedCards,
  } = buildTreeLayout(cards, collapsedNodeIds);

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

    const contentWidth = maxWidth + (TREE_CANVAS_PADDING * 2);
    const contentHeight = maxHeight + (TREE_CANVAS_PADDING * 2);
    const centeredX = focusedEntry.left + TREE_CANVAS_PADDING + (nodeWidth / 2);
    const centeredY = focusedEntry.top + TREE_CANVAS_PADDING + (nodeHeight / 2);

    const targetX = Math.min(
      Math.max(centeredX - (viewport.width / 2), 0),
      Math.max(contentWidth - viewport.width, 0),
    );
    const targetY = Math.min(
      Math.max(centeredY - (viewport.height / 2), 0),
      Math.max(contentHeight - viewport.height, 0),
    );

    treeHorizontalScrollRef.current?.scrollTo({ x: targetX, animated: true });
    treeVerticalScrollRef.current?.scrollTo({ y: targetY, animated: true });
  }, [
    focusedCardIndex,
    maxHeight,
    maxWidth,
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
      style={styles.treeViewport}
      onTouchEnd={handleCanvasTouchEnd}
      onTouchCancel={() => {
        cardTouchRef.current = false;
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
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.treeHorizontalContent}
      >
        <ScrollView
          ref={treeVerticalScrollRef}
          style={styles.treeScroll}
          contentContainerStyle={styles.treeContent}
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

              return (
                <StackCard
                  card={card}
                  collapsedNodeIds={collapsedNodeIds}
                  editingIndex={editingIndex}
                  editingValue={editingValue}
                  focusedCardIndex={focusedCardIndex}
                  layout="tree"
                  key={`card-${card.id}`}
                  visibleIndex={0}
                  onPressIn={handleCardPressIn}
                  onFocusCard={onCardFocus}
                  treePosition={{
                    left,
                    top,
                    depth,
                    placementOrder,
                  }}
                  isCollapsedStacked={isCollapsedStacked}
                  onPress={() => onCardPress(card.index)}
                  onCreateEdit={onCreateEdit}
                  onToggleCollapse={onToggleCollapse}
                  onDeleteCard={onDeleteCard}
                  onEditingValueChange={onEditingValueChange}
                />
              );
            })}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}
