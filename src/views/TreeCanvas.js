import {
  forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState,
} from 'react';
import {
  Animated, PanResponder, ScrollView, View,
} from 'react-native';
import { styles } from '../styles/appStyles';
import { buildTreeLayout, TREE_CANVAS_PADDING } from '../lib/treeLayout';
import {
  buildHeldTreePreviewCards,
  buildPreviewCards,
  PREVIEW_CARD_ID,
} from '../lib/previewCards';
import { getRubberBandDistance } from '../lib/rubberBand';
import { StackCard } from '../components/StackCard';

const OVERSCROLL_SPRING = {
  damping: 22,
  mass: 0.72,
  stiffness: 240,
  useNativeDriver: true,
};

export const TreeCanvas = forwardRef(function TreeCanvas({
  cards,
  collapsedNodeIds,
  focusedCardIndex,
  focusedCardId,
  doneCleanupPreviewCardIds = new Set(),
  editingIndex,
  editingValue,
  onCardPress,
  onCardFocus,
  onCreateEdit,
  onToggleCollapse,
  onDeleteCard,
  onDeleteHoldComplete,
  onAdoptMissionRoot,
  onEditingValueChange,
  onCompleteEdit,
  onDoneCard,
  onCanvasBlur,
  isDeleteHoldActive = false,
  addPreviewRelation = null,
  heldTreeCards = [],
  newCardBackgroundColor,
}, forwardedRef) {
  const treeHorizontalScrollRef = useRef(null);
  const treeVerticalScrollRef = useRef(null);
  const treeCanvasRef = useRef(null);
  const treeOverscrollX = useRef(new Animated.Value(0)).current;
  const treeOverscrollY = useRef(new Animated.Value(0)).current;
  const positionedCardsRef = useRef([]);
  const treeNodeSizeRef = useRef({ height: 0, width: 0 });
  const onDoneCardRef = useRef(onDoneCard);
  const cardTouchRef = useRef(false);
  const didCanvasPanRef = useRef(false);
  const lastAutoCenteredCardIdRef = useRef(null);
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
      const targetPosition = localFocusedPosition >= 0 ? localFocusedPosition : null;
      return heldTreeCards.length > 0
        ? buildHeldTreePreviewCards(
          cards,
          heldTreeCards,
          targetPosition,
          addPreviewRelation,
        )
        : buildPreviewCards(
          cards,
          targetPosition,
          addPreviewRelation,
          newCardBackgroundColor,
        );
    },
    [addPreviewRelation, cards, focusedCardIndex, heldTreeCards, newCardBackgroundColor],
  );

  const heldPreviewCardIds = useMemo(
    () => new Set(
      addPreviewRelation ? heldTreeCards.map((card) => card.id) : [],
    ),
    [addPreviewRelation, heldTreeCards],
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

  function settleTreeOverscroll() {
    Animated.parallel([
      Animated.spring(treeOverscrollX, {
        ...OVERSCROLL_SPRING,
        toValue: 0,
      }),
      Animated.spring(treeOverscrollY, {
        ...OVERSCROLL_SPRING,
        toValue: 0,
      }),
    ]).start();
  }

  const treePanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gestureState) => (
      Math.hypot(gestureState.dx, gestureState.dy) > 6
    ),
    onPanResponderGrant: () => {
      didCanvasPanRef.current = false;
      const currentOffset = treeScrollOffsetRef.current;
      scrollTreeTo(currentOffset.x, currentOffset.y);
      treePanStartOffsetRef.current = { ...treeScrollOffsetRef.current };
      treeOverscrollX.stopAnimation();
      treeOverscrollY.stopAnimation();
      treeOverscrollX.setValue(0);
      treeOverscrollY.setValue(0);
    },
    onPanResponderMove: (_, gestureState) => {
      didCanvasPanRef.current = true;
      const requestedX = treePanStartOffsetRef.current.x - gestureState.dx;
      const requestedY = treePanStartOffsetRef.current.y - gestureState.dy;
      const clampedX = Math.min(Math.max(requestedX, 0), maxScrollX);
      const clampedY = Math.min(Math.max(requestedY, 0), maxScrollY);

      scrollTreeTo(clampedX, clampedY);
      treeOverscrollX.setValue(-getRubberBandDistance(requestedX - clampedX));
      treeOverscrollY.setValue(-getRubberBandDistance(requestedY - clampedY));
    },
    onPanResponderRelease: settleTreeOverscroll,
    onPanResponderTerminate: settleTreeOverscroll,
  }), [
    maxScrollX,
    maxScrollY,
    treeOverscrollX,
    treeOverscrollY,
  ]);

  useEffect(() => {
    const currentOffset = treeScrollOffsetRef.current;
    const clampedX = Math.min(Math.max(currentOffset.x, 0), maxScrollX);
    const clampedY = Math.min(Math.max(currentOffset.y, 0), maxScrollY);

    treeScrollOffsetRef.current = {
      x: clampedX,
      y: clampedY,
    };
    treeHorizontalScrollRef.current?.scrollTo({ x: clampedX, animated: false });
    treeVerticalScrollRef.current?.scrollTo({ y: clampedY, animated: false });
  }, [maxScrollX, maxScrollY]);

  useEffect(() => {
    if (focusedCardIndex === null) {
      lastAutoCenteredCardIdRef.current = null;
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

    if (lastAutoCenteredCardIdRef.current === focusedEntry.card.id) {
      return;
    }

    lastAutoCenteredCardIdRef.current = focusedEntry.card.id;

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
  positionedCardsRef.current = paddedPositionedCards;
  treeNodeSizeRef.current = { height: nodeHeight, width: nodeWidth };
  onDoneCardRef.current = onDoneCard;

  function stampCardAtPagePoint(pageX, pageY) {
    treeCanvasRef.current?.measureInWindow?.((canvasX, canvasY) => {
      const localX = pageX - canvasX;
      const localY = pageY - canvasY;
      const targetEntry = positionedCardsRef.current.find((entry) => {
        const { card, left, top, isCollapsedStacked } = entry;
        const isSystemCard = Boolean(
          card.isMissionCard || card.isTreasureCard || card.isCollectionCard,
        );

        return (
          !isCollapsedStacked
          && card.id !== PREVIEW_CARD_ID
          && card.index >= 0
          && !isSystemCard
          && localX >= left
          && localX <= left + treeNodeSizeRef.current.width
          && localY >= top
          && localY <= top + treeNodeSizeRef.current.height
        );
      });

      if (targetEntry) {
        onDoneCardRef.current?.(targetEntry.card.index);
      }
    });
  }

  function measureCard(cardId) {
    return new Promise((resolve) => {
      const targetEntry = positionedCardsRef.current.find(
        (entry) => entry.card.id === cardId && !entry.isCollapsedStacked,
      );

      if (!targetEntry) {
        resolve(null);
        return;
      }

      if (!treeCanvasRef.current?.measureInWindow) {
        resolve(null);
        return;
      }

      treeCanvasRef.current.measureInWindow((canvasX, canvasY) => {
        resolve({
          x: canvasX + targetEntry.left,
          y: canvasY + targetEntry.top,
          width: treeNodeSizeRef.current.width,
          height: treeNodeSizeRef.current.height,
        });
      });
    });
  }

  useImperativeHandle(forwardedRef, () => ({
    measureCard,
    stampCardAtPagePoint,
  }), []);

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
        onScroll={(event) => {
          treeScrollOffsetRef.current = {
            ...treeScrollOffsetRef.current,
            x: event.nativeEvent.contentOffset.x,
          };
        }}
        scrollEventThrottle={16}
      >
        <ScrollView
          ref={treeVerticalScrollRef}
          style={styles.treeScroll}
          contentContainerStyle={styles.treeContent}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          onScroll={(event) => {
            treeScrollOffsetRef.current = {
              ...treeScrollOffsetRef.current,
              y: event.nativeEvent.contentOffset.y,
            };
          }}
          scrollEventThrottle={16}
        >
          <Animated.View
            ref={treeCanvasRef}
            style={[
              styles.treeCanvas,
              {
                height: maxHeight + (TREE_CANVAS_PADDING * 2),
                transform: [
                  { translateX: treeOverscrollX },
                  { translateY: treeOverscrollY },
                ],
                width: maxWidth + (TREE_CANVAS_PADDING * 2),
              },
            ]}
          >
            {paddedPositionedCards.map((entry) => {
              const { card, left, top, depth, placementOrder, isCollapsedStacked } = entry;
              const isPreviewCard = (
                card.id === PREVIEW_CARD_ID || heldPreviewCardIds.has(card.id)
              );
              const isSystemCard = Boolean(
                card.isMissionCard || card.isTreasureCard || card.isCollectionCard,
              );

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
                  hideControls={isPreviewCard || isSystemCard}
                  isMissionRoot={Boolean(card.isMissionRoot)}
                  isPreviewCard={isPreviewCard}
                  isMissionCard={Boolean(card.isMissionCard)}
                  isTreasureCard={Boolean(card.isTreasureCard)}
                  treePosition={{
                    left,
                    top,
                    depth,
                    placementOrder,
                  }}
                  isCollapsedStacked={isCollapsedStacked}
                  isDeleteHoldActive={isDeleteHoldActive}
                  doneCleanupPreviewCardIds={doneCleanupPreviewCardIds}
                  onPress={() => {
                    if (!isPreviewCard) {
                      onCardPress(card.index);
                    }
                  }}
                  onCreateEdit={onCreateEdit}
                  onToggleCollapse={onToggleCollapse}
                  onDeleteCard={onDeleteCard}
                  onDeleteHoldComplete={onDeleteHoldComplete}
                  onAdoptMissionRoot={onAdoptMissionRoot}
                  onEditingValueChange={onEditingValueChange}
                  onCompleteEdit={onCompleteEdit}
                />
              );
            })}
          </Animated.View>
        </ScrollView>
      </ScrollView>
    </View>
  );
});
