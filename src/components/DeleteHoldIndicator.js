import { Animated, Easing, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { styles } from '../styles/appStyles';

const DELETE_HOLD_MS = 500;

export function DeleteHoldIndicator({
  active,
  onComplete,
  progressValue,
  tone = 'delete',
  variant = 'cardFill',
}) {
  const internalProgress = useRef(new Animated.Value(0)).current;
  const progress = progressValue ?? internalProgress;
  const animationRef = useRef(null);
  const completedRef = useRef(false);
  const [isVisualActive, setIsVisualActive] = useState(false);

  useEffect(() => () => {
    if (animationRef.current) {
      animationRef.current.stop();
      animationRef.current = null;
    }
  }, [progress]);

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

  const fillTranslateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['-100%', '0%'],
  });

  return (
    <View
      pointerEvents="none"
      style={[
        styles.deleteProgressCardFillOverlay,
        variant === 'treeCardFill' && styles.deleteProgressTreeCardFillOverlay,
      ]}
    >
      <Animated.View
        style={[
          styles.deleteProgressCardFill,
          {
            transform: [{ translateX: fillTranslateX }],
          },
        ]}
      >
        <View
          style={[
            styles.deleteProgressCardFillSurface,
            tone === 'done' && styles.doneProgressCardFillSurface,
          ]}
        />
      </Animated.View>
    </View>
  );
}
