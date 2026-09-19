import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { styles } from '../styles/appStyles';

export function TutorialHoldHint() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          duration: 720,
          easing: Easing.inOut(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.delay(220),
        Animated.timing(pulse, {
          duration: 260,
          easing: Easing.out(Easing.cubic),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View pointerEvents="none" style={styles.tutorialHoldHint}>
      <View style={styles.tutorialHoldCutout} />
      <Animated.View
        style={[
          styles.tutorialHoldHalo,
          {
            opacity: pulse.interpolate({
              inputRange: [0, 0.35, 1],
              outputRange: [0.25, 0.9, 0.2],
            }),
            transform: [{
              scale: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [1.32, 0.94],
              }),
            }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.tutorialHoldCore,
          {
            opacity: pulse.interpolate({
              inputRange: [0, 0.55, 1],
              outputRange: [0, 0.18, 0.42],
            }),
            transform: [{
              scale: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0.82],
              }),
            }],
          },
        ]}
      />
    </View>
  );
}
