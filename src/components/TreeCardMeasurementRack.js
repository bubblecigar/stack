import { useCallback, useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { styles } from '../styles/appStyles';
import { StackCard } from './StackCard';

function MeasurementPass({ cards, onMeasurements }) {
  const pendingMeasurementsRef = useRef(new Map());
  const commitFrameRef = useRef(null);
  const expectedCardIds = useMemo(
    () => new Set(cards.map((card) => card.id)),
    [cards],
  );

  useEffect(() => () => {
    if (commitFrameRef.current !== null) {
      cancelAnimationFrame(commitFrameRef.current);
    }
  }, []);

  const handleCardLayout = useCallback((cardId, height) => {
    pendingMeasurementsRef.current.set(cardId, height);

    if (pendingMeasurementsRef.current.size < expectedCardIds.size) {
      return;
    }

    if (commitFrameRef.current !== null) {
      cancelAnimationFrame(commitFrameRef.current);
    }

    commitFrameRef.current = requestAnimationFrame(() => {
      commitFrameRef.current = null;
      onMeasurements(new Map(pendingMeasurementsRef.current));
    });
  }, [expectedCardIds, onMeasurements]);

  return cards.map((card) => (
    <StackCard
      card={card}
      focusedCardIndex={null}
      hideControls
      isMissionCard={Boolean(card.isMissionCard)}
      isTreasureCard={Boolean(card.isTreasureCard)}
      key={`measurement-${card.id}`}
      layout="tree"
      onTreeCardLayout={handleCardLayout}
      visibleIndex={0}
    />
  ));
}

export function TreeCardMeasurementRack({ cards, onMeasurements }) {
  const measurementKey = useMemo(() => JSON.stringify(
    cards.map((card) => [
      card.id,
      card.text,
      card.imageUri,
      card.collectionImageUri,
      card.isImageUploading,
      card.systemType,
    ]),
  ), [cards]);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.treeMeasurementRack}
    >
      <MeasurementPass
        cards={cards}
        key={measurementKey}
        onMeasurements={onMeasurements}
      />
    </View>
  );
}
