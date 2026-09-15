import {
  Animated, Easing, Text, View,
} from 'react-native';
import { Image as CachedImage } from 'expo-image';
import { useEffect, useRef } from 'react';
import { DoneStampArtwork } from './DoneStampArtwork';
import { getCardImageSource } from '../lib/cardImageCache';
import { styles } from '../styles/appStyles';

const HELD_CARD_FLIGHT_DURATION_MS = 460;

export function HeldCardFlight({ card, fromFrame, onComplete, toFrame }) {
  const progress = useRef(new Animated.Value(0)).current;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: HELD_CARD_FLIGHT_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });

    animation.start(({ finished }) => {
      if (finished) {
        onCompleteRef.current?.();
      }
    });

    return () => animation.stop();
  }, [progress]);

  if (!card || !fromFrame || !toFrame) {
    return null;
  }

  const interpolate = (fromValue, toValue) => progress.interpolate({
    inputRange: [0, 1],
    outputRange: [fromValue, toValue],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.heldCardFlight,
        {
          left: interpolate(fromFrame.x, toFrame.x),
          top: interpolate(fromFrame.y, toFrame.y),
          width: interpolate(fromFrame.width, toFrame.width),
          height: interpolate(fromFrame.height, toFrame.height),
          borderRadius: interpolate(8, 8),
          backgroundColor: card.backgroundColor || '#FFFFFF',
          opacity: progress.interpolate({
            inputRange: [0, 0.82, 1],
            outputRange: [1, 1, 0],
          }),
          transform: [{
            rotate: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', '45deg'],
            }),
          }],
        },
      ]}
    >
      {card.imageUri ? (
        <CachedImage
          cachePolicy="memory-disk"
          contentFit="cover"
          recyclingKey={card.imageUri}
          source={getCardImageSource(card.imageUri)}
          style={styles.heldCardFlightImage}
        />
      ) : (
        <View style={styles.heldCardFlightTextWrap}>
          <Text
            numberOfLines={8}
            style={[
              styles.heldCardFlightText,
              card.done && styles.heldCardFlightTextDone,
            ]}
          >
            {card.text}
          </Text>
        </View>
      )}
      {card.done ? (
        <DoneStampArtwork uri={card.doneStampUri} style={styles.heldCardFlightDoneStamp} />
      ) : null}
    </Animated.View>
  );
}
