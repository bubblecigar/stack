import { Animated, Easing, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { styles } from '../styles/appStyles';

const DELETE_HOLD_MS = 500;
const DELETE_RING_SEGMENTS = 48;

function TrashCanIcon() {
  return (
    <View style={styles.leafTrashIcon}>
      <View style={styles.leafTrashIconLid} />
      <View style={styles.leafTrashIconHandle} />
      <View style={styles.leafTrashIconBody}>
        <View style={styles.leafTrashIconLine} />
        <View style={styles.leafTrashIconLine} />
      </View>
    </View>
  );
}

export function DeleteHoldIndicator({ active, onComplete }) {
  const progress = useRef(new Animated.Value(0)).current;
  const animationRef = useRef(null);
  const completedRef = useRef(false);
  const [progressSnapshot, setProgressSnapshot] = useState(0);
  const [isVisualActive, setIsVisualActive] = useState(false);

  useEffect(() => {
    const listenerId = progress.addListener(({ value }) => {
      setProgressSnapshot(value);
    });

    return () => {
      progress.removeListener(listenerId);
    };
  }, [
    progress,
  ]);

  useEffect(() => () => {
    if (animationRef.current) {
      animationRef.current.stop();
      animationRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!active) {
      completedRef.current = false;
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
      progress.setValue(0);
      setIsVisualActive(false);
      return;
    }

    if (completedRef.current) {
      return;
    }

    progress.setValue(0);
    setIsVisualActive(true);
    animationRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: DELETE_HOLD_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    });

    animationRef.current.start(({ finished }) => {
      animationRef.current = null;

      if (finished) {
        completedRef.current = true;
        setIsVisualActive(false);
        onComplete?.();
      }
    });
  }, [
    active,
    onComplete,
    progress,
  ]);

  if (!isVisualActive) {
    return null;
  }

  const completedSegments = Math.min(
    DELETE_RING_SEGMENTS,
    Math.floor(progressSnapshot * DELETE_RING_SEGMENTS),
  );

  return (
    <View pointerEvents="none" style={styles.leafDeleteProgressOverlay}>
      <View style={styles.leafDeleteProgressRing}>
        {Array.from({ length: DELETE_RING_SEGMENTS }, (_, segmentIndex) => (
          <View
            key={`delete-progress-segment-${segmentIndex}`}
            style={[
              styles.leafDeleteProgressTickSlot,
              {
                transform: [{ rotate: `${(360 / DELETE_RING_SEGMENTS) * segmentIndex}deg` }],
              },
            ]}
          >
            <View
              style={[
                styles.leafDeleteProgressTick,
                segmentIndex < completedSegments && styles.leafDeleteProgressTickActive,
              ]}
            />
          </View>
        ))}
        <View style={styles.leafDeleteProgressCenter}>
          <TrashCanIcon />
        </View>
      </View>
    </View>
  );
}
