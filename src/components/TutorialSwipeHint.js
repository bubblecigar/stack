import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { styles } from '../styles/appStyles';

const SWIPE_DISTANCE = 64;
const SWIPES = [
  { x: SWIPE_DISTANCE, y: 0 },
  { x: 0, y: -SWIPE_DISTANCE },
  { x: -SWIPE_DISTANCE, y: 0 },
  { x: 0, y: SWIPE_DISTANCE },
];

export function TutorialSwipeHint({
  onGestureEnd,
  onGestureMove,
  onGestureStart,
  pageX,
  pageY,
  paused = false,
  startPageX,
  startPageY,
}) {
  const holdOpacity = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(0.82)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const rippleOpacity = useRef(new Animated.Value(0)).current;
  const rippleScale = useRef(new Animated.Value(0.55)).current;
  const gestureCallbacksRef = useRef({
    onGestureEnd,
    onGestureMove,
    onGestureStart,
  });

  gestureCallbacksRef.current = {
    onGestureEnd,
    onGestureMove,
    onGestureStart,
  };

  useEffect(() => {
    let isCancelled = false;
    let runningAnimation = null;
    let progressListenerId = null;

    const resetVisual = () => {
      holdOpacity.setValue(0);
      opacity.setValue(0);
      pressScale.setValue(0.82);
      progress.setValue(0);
      rippleOpacity.setValue(0);
      rippleScale.setValue(0.55);
    };

    if (paused) {
      resetVisual();
      return undefined;
    }

    const runAnimation = (animation) => new Promise((resolve) => {
      if (isCancelled) {
        resolve(false);
        return;
      }

      runningAnimation = animation;
      animation.start(({ finished }) => {
        runningAnimation = null;
        resolve(finished && !isCancelled);
      });
    });

    const runSwipe = async ({ x, y }) => {
      gestureCallbacksRef.current.onGestureStart?.();

      if (!await runAnimation(Animated.parallel([
        Animated.timing(opacity, {
          duration: 150,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(pressScale, {
          duration: 150,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
      ]))) return false;

      if (!await runAnimation(Animated.parallel([
        Animated.timing(pressScale, {
          duration: 180,
          easing: Easing.inOut(Easing.cubic),
          toValue: 0.66,
          useNativeDriver: true,
        }),
        Animated.timing(rippleOpacity, {
          duration: 180,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(holdOpacity, {
          duration: 180,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
      ]))) return false;

      if (!await runAnimation(Animated.parallel([
        Animated.timing(rippleScale, {
          duration: 240,
          easing: Easing.out(Easing.cubic),
          toValue: 1.65,
          useNativeDriver: true,
        }),
        Animated.timing(rippleOpacity, {
          duration: 240,
          easing: Easing.in(Easing.cubic),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]))) return false;

      progress.setValue(0);
      progressListenerId = progress.addListener(({ value }) => {
        const dx = x * value;
        const dy = y * value;
        gestureCallbacksRef.current.onGestureMove?.({
          dx,
          dy,
          pageX: startPageX + dx,
          pageY: startPageY + dy,
        });
      });
      const didFinishSwipe = await runAnimation(Animated.timing(progress, {
        duration: 460,
        easing: Easing.bezier(0.18, 0.72, 0.2, 1),
        toValue: 1,
        useNativeDriver: false,
      }));
      progress.removeListener(progressListenerId);
      progressListenerId = null;
      if (!didFinishSwipe) return false;

      if (!await runAnimation(Animated.delay(110))) return false;

      if (!await runAnimation(Animated.parallel([
        Animated.timing(pressScale, {
          duration: 110,
          easing: Easing.out(Easing.cubic),
          toValue: 0.84,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          duration: 140,
          easing: Easing.in(Easing.cubic),
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.timing(holdOpacity, {
          duration: 110,
          easing: Easing.out(Easing.cubic),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]))) return false;

      gestureCallbacksRef.current.onGestureEnd?.();
      resetVisual();
      return runAnimation(Animated.delay(180));
    };

    const runLoop = async () => {
      while (!isCancelled) {
        if (!await runAnimation(Animated.delay(280))) return;

        for (const swipe of SWIPES) {
          if (!await runSwipe(swipe)) return;
        }

        if (!await runAnimation(Animated.delay(420))) return;
      }
    };

    runLoop();
    return () => {
      isCancelled = true;
      runningAnimation?.stop();
      if (progressListenerId !== null) {
        progress.removeListener(progressListenerId);
      }
      progress.stopAnimation();
      holdOpacity.stopAnimation();
      opacity.stopAnimation();
      pressScale.stopAnimation();
      rippleOpacity.stopAnimation();
      rippleScale.stopAnimation();
      resetVisual();
    };
  }, [
    holdOpacity,
    opacity,
    paused,
    pressScale,
    progress,
    rippleOpacity,
    rippleScale,
    startPageX,
    startPageY,
  ]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.tutorialSwipeHint,
        {
          left: pageX - 18,
          opacity,
          top: pageY - 18,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.tutorialSwipeTouch,
          { transform: [{ scale: pressScale }] },
        ]}
      >
        <Animated.View
          style={[
            styles.tutorialSwipeHold,
            { opacity: holdOpacity },
          ]}
        />
        <Animated.View
          style={[
            styles.tutorialSwipeRipple,
            {
              opacity: rippleOpacity,
              transform: [{ scale: rippleScale }],
            },
          ]}
        />
      </Animated.View>
    </Animated.View>
  );
}
