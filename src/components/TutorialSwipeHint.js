import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { styles } from '../styles/appStyles';

export function TutorialSwipeHint() {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.82)).current;
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.delay(280),
      Animated.parallel([
        Animated.timing(opacity, {
          duration: 180,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          duration: 180,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(scale, {
        duration: 190,
        easing: Easing.inOut(Easing.cubic),
        toValue: 0.68,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        duration: 150,
        easing: Easing.out(Easing.cubic),
        toValue: 0.84,
        useNativeDriver: true,
      }),
      Animated.delay(120),
      Animated.timing(translateX, {
        duration: 680,
        easing: Easing.inOut(Easing.cubic),
        toValue: 88,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        duration: 180,
        easing: Easing.in(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(translateX, {
          duration: 0,
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          duration: 0,
          toValue: 0.82,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(420),
    ]));

    animation.start();
    return () => animation.stop();
  }, [opacity, scale, translateX]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.tutorialSwipeHint,
        {
          opacity,
          transform: [{ translateX }, { scale }],
        },
      ]}
    >
      <MaterialCommunityIcons color="#2563EB" name="paw" size={19} />
    </Animated.View>
  );
}
