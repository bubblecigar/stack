import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import { styles } from '../styles/appStyles';

const SPOTLIGHT_PADDING = 14;
const SCREEN_EDGE_PADDING = 8;

function getSpotlightFrame(targetFrame, screenWidth, screenHeight) {
  const left = Math.max(SCREEN_EDGE_PADDING, targetFrame.x - SPOTLIGHT_PADDING);
  const top = Math.max(SCREEN_EDGE_PADDING, targetFrame.y - SPOTLIGHT_PADDING);
  const right = Math.min(
    screenWidth - SCREEN_EDGE_PADDING,
    targetFrame.x + targetFrame.width + SPOTLIGHT_PADDING,
  );
  const bottom = Math.min(
    screenHeight - SCREEN_EDGE_PADDING,
    targetFrame.y + targetFrame.height + SPOTLIGHT_PADDING,
  );

  return {
    height: Math.max(bottom - top, 0),
    left,
    top,
    width: Math.max(right - left, 0),
  };
}

export function TutorialSpotlight({ onDismiss, targetFrame }) {
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const fadeProgress = useRef(new Animated.Value(0)).current;
  const pulseProgress = useRef(new Animated.Value(0)).current;
  const [isDismissing, setIsDismissing] = useState(false);
  const spotlightFrame = getSpotlightFrame(targetFrame, screenWidth, screenHeight);
  const messageBottom = Math.max(screenHeight - spotlightFrame.top + 24, 126);

  useEffect(() => {
    Animated.timing(fadeProgress, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start();

    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(pulseProgress, {
        duration: 850,
        easing: Easing.inOut(Easing.sin),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(pulseProgress, {
        duration: 850,
        easing: Easing.inOut(Easing.sin),
        toValue: 0,
        useNativeDriver: true,
      }),
    ]));
    pulse.start();

    return () => {
      fadeProgress.stopAnimation();
      pulse.stop();
    };
  }, [fadeProgress, pulseProgress]);

  function handleDismiss() {
    if (isDismissing) {
      return;
    }

    setIsDismissing(true);
    Animated.timing(fadeProgress, {
      duration: 140,
      easing: Easing.in(Easing.cubic),
      toValue: 0,
      useNativeDriver: true,
    }).start(() => onDismiss?.());
  }

  const pulseOpacity = pulseProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.86, 0.28],
  });
  const pulseScale = pulseProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.035],
  });

  return (
    <Animated.View
      accessibilityViewIsModal
      style={[styles.tutorialSpotlightOverlay, { opacity: fadeProgress }]}
    >
      <Pressable
        accessibilityHint="Dismisses this tutorial hint"
        accessibilityLabel="Floating control tutorial. Tap to continue."
        accessibilityRole="button"
        disabled={isDismissing}
        onPress={handleDismiss}
        style={styles.tutorialSpotlightDismissTarget}
      >
        <Svg
          height={screenHeight}
          pointerEvents="none"
          style={styles.tutorialSpotlightMask}
          width={screenWidth}
        >
          <Defs>
            <Mask id="tutorialSpotlightMask">
              <Rect fill="#FFFFFF" height={screenHeight} width={screenWidth} x={0} y={0} />
              <Rect
                fill="#000000"
                height={spotlightFrame.height}
                rx={18}
                width={spotlightFrame.width}
                x={spotlightFrame.left}
                y={spotlightFrame.top}
              />
            </Mask>
          </Defs>
          <Rect
            fill="rgba(31, 41, 55, 0.68)"
            height={screenHeight}
            mask="url(#tutorialSpotlightMask)"
            width={screenWidth}
            x={0}
            y={0}
          />
        </Svg>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.tutorialSpotlightPulse,
            {
              height: spotlightFrame.height,
              left: spotlightFrame.left,
              opacity: pulseOpacity,
              top: spotlightFrame.top,
              transform: [{ scale: pulseScale }],
              width: spotlightFrame.width,
            },
          ]}
        />

        <View
          pointerEvents="none"
          style={[styles.tutorialSpotlightMessage, { bottom: messageBottom }]}
        >
          <Text style={styles.tutorialSpotlightTitle}>Meet your floating control</Text>
          <Text style={styles.tutorialSpotlightBody}>
            Its actions change with the card you focus.
          </Text>
          <Text style={styles.tutorialSpotlightDismissHint}>Tap anywhere to continue</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
