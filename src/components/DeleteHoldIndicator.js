import { Animated, Easing, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useEffect, useRef, useState } from 'react';
import { styles } from '../styles/appStyles';

const DELETE_HOLD_MS = 500;
const WATER_WAVE_PERIOD = 160;
const WATER_WAVE_WIDTH = 32;
const WATER_WAVE_HEIGHT = 960;
const WATER_WAVE_PATH = [
  'M 12 0',
  ...Array.from({ length: 6 }, (_, index) => {
    const startY = index * WATER_WAVE_PERIOD;
    return [
      `C 2 ${startY + 27} 2 ${startY + 53} 12 ${startY + 80}`,
      `C 22 ${startY + 107} 22 ${startY + 133} 12 ${startY + 160}`,
    ].join(' ');
  }),
  `L 0 ${WATER_WAVE_HEIGHT}`,
  'L 0 0 Z',
].join(' ');

function WaterWave() {
  return (
    <Svg
      height={WATER_WAVE_HEIGHT}
      viewBox={`0 0 ${WATER_WAVE_WIDTH} ${WATER_WAVE_HEIGHT}`}
      width={WATER_WAVE_WIDTH}
    >
      <Path d={WATER_WAVE_PATH} fill="#2563EB" />
    </Svg>
  );
}

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
  const waveTranslateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -WATER_WAVE_PERIOD],
  });
  const backWaveTranslateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-WATER_WAVE_PERIOD, 0],
  });
  const backWaveTranslateX = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 3, 0],
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
        <Animated.View style={[
          styles.deleteProgressWaterWave,
          styles.deleteProgressWaterWaveBack,
          {
            transform: [
              { translateX: backWaveTranslateX },
              { translateY: backWaveTranslateY },
            ],
          },
        ]}
        >
          <WaterWave />
        </Animated.View>
        <Animated.View style={[
          styles.deleteProgressWaterWave,
          { transform: [{ translateY: waveTranslateY }] },
        ]}
        >
          <WaterWave />
        </Animated.View>
      </Animated.View>
    </View>
  );
}
