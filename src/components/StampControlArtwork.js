import { Animated, Easing, View } from 'react-native';
import { useEffect, useRef } from 'react';
import { STAMP_ASSETS } from '../config/stampAssets';
import { styles } from '../styles/appStyles';

const CAT_ENTER_DURATION_MS = 420;
const CAT_EXIT_DURATION_MS = 300;
const CIRCLE_COLOR_DURATION_MS = 300;
const CAT_HIDDEN_OFFSET_Y = 42;

export const STAMP_CONTROL_STATE_BLUE_CAT = 'blue-cat';
export const STAMP_CONTROL_STATE_BLUE_CIRCLE = 'blue-circle';
export const STAMP_CONTROL_STATE_GRAY_CAT = 'gray-cat';
export const STAMP_CONTROL_STATE_GRAY_CIRCLE = 'gray-circle';

function getStampProgress(stampState) {
  const isGray = (
    stampState === STAMP_CONTROL_STATE_GRAY_CAT
    || stampState === STAMP_CONTROL_STATE_GRAY_CIRCLE
  );

  return {
    blueCat: stampState === STAMP_CONTROL_STATE_BLUE_CAT ? 1 : 0,
    grayCat: stampState === STAMP_CONTROL_STATE_GRAY_CAT ? 1 : 0,
    grayCircle: isGray ? 1 : 0,
  };
}

function createCatAnimation(progress, visible) {
  return Animated.timing(progress, {
    toValue: visible ? 1 : 0,
    duration: visible ? CAT_ENTER_DURATION_MS : CAT_EXIT_DURATION_MS,
    easing: visible
      ? Easing.bezier(0.22, 1, 0.36, 1)
      : Easing.in(Easing.cubic),
    useNativeDriver: true,
  });
}

export function StampControlArtwork({ stampState, style }) {
  const initialProgress = getStampProgress(stampState);
  const blueCatProgress = useRef(new Animated.Value(initialProgress.blueCat)).current;
  const grayCatProgress = useRef(new Animated.Value(initialProgress.grayCat)).current;
  const grayCircleProgress = useRef(new Animated.Value(initialProgress.grayCircle)).current;
  const previousStampStateRef = useRef(stampState);

  useEffect(() => {
    const previousStampState = previousStampStateRef.current;
    previousStampStateRef.current = stampState;

    blueCatProgress.stopAnimation();
    grayCatProgress.stopAnimation();
    grayCircleProgress.stopAnimation();

    const isBlueCatTransition = (
      (previousStampState === STAMP_CONTROL_STATE_BLUE_CAT
        && stampState === STAMP_CONTROL_STATE_BLUE_CIRCLE)
      || (previousStampState === STAMP_CONTROL_STATE_BLUE_CIRCLE
        && stampState === STAMP_CONTROL_STATE_BLUE_CAT)
    );
    const isGrayCatTransition = (
      (previousStampState === STAMP_CONTROL_STATE_GRAY_CAT
        && stampState === STAMP_CONTROL_STATE_GRAY_CIRCLE)
      || (previousStampState === STAMP_CONTROL_STATE_GRAY_CIRCLE
        && stampState === STAMP_CONTROL_STATE_GRAY_CAT)
    );
    const isBlueCircleGrayCatTransition = (
      (previousStampState === STAMP_CONTROL_STATE_BLUE_CIRCLE
        && stampState === STAMP_CONTROL_STATE_GRAY_CAT)
      || (previousStampState === STAMP_CONTROL_STATE_GRAY_CAT
        && stampState === STAMP_CONTROL_STATE_BLUE_CIRCLE)
    );

    if (isBlueCatTransition) {
      grayCatProgress.setValue(0);
      grayCircleProgress.setValue(0);
      const animation = createCatAnimation(
        blueCatProgress,
        stampState === STAMP_CONTROL_STATE_BLUE_CAT,
      );
      animation.start();
      return () => animation.stop();
    }

    if (isGrayCatTransition) {
      blueCatProgress.setValue(0);
      grayCircleProgress.setValue(1);
      const animation = createCatAnimation(
        grayCatProgress,
        stampState === STAMP_CONTROL_STATE_GRAY_CAT,
      );
      animation.start();
      return () => animation.stop();
    }

    if (isBlueCircleGrayCatTransition) {
      blueCatProgress.setValue(0);
      const showGrayStamp = stampState === STAMP_CONTROL_STATE_GRAY_CAT;
      const animation = Animated.parallel([
        createCatAnimation(grayCatProgress, showGrayStamp),
        Animated.timing(grayCircleProgress, {
          toValue: showGrayStamp ? 1 : 0,
          duration: CIRCLE_COLOR_DURATION_MS,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);
      animation.start();
      return () => animation.stop();
    }

    const targetProgress = getStampProgress(stampState);
    blueCatProgress.setValue(targetProgress.blueCat);
    grayCatProgress.setValue(targetProgress.grayCat);
    grayCircleProgress.setValue(targetProgress.grayCircle);
    return undefined;
  }, [blueCatProgress, grayCatProgress, grayCircleProgress, stampState]);

  const blueCatTranslateY = blueCatProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [CAT_HIDDEN_OFFSET_Y, 0],
    extrapolate: 'clamp',
  });
  const grayCatTranslateY = grayCatProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [CAT_HIDDEN_OFFSET_Y, 0],
    extrapolate: 'clamp',
  });
  const blueCircleOpacity = grayCircleProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View pointerEvents="none" style={style}>
      <Animated.Image
        source={STAMP_ASSETS.control.blue.circle}
        style={[
          styles.voidStampCircleArtwork,
          { opacity: blueCircleOpacity },
        ]}
      />
      <Animated.Image
        source={STAMP_ASSETS.control.gray.circle}
        style={[
          styles.voidStampCircleArtwork,
          { opacity: grayCircleProgress },
        ]}
      />
      <View style={styles.voidStampCatClip}>
        <Animated.Image
          source={STAMP_ASSETS.control.blue.cat}
          style={[
            styles.voidStampCatArtwork,
            { transform: [{ translateY: blueCatTranslateY }] },
          ]}
        />
        <Animated.Image
          source={STAMP_ASSETS.control.gray.cat}
          style={[
            styles.voidStampCatArtwork,
            { transform: [{ translateY: grayCatTranslateY }] },
          ]}
        />
      </View>
    </Animated.View>
  );
}
