import { Animated, Image } from 'react-native';
import { Image as CachedImage } from 'expo-image';
import { useState } from 'react';
import { STAMP_ASSETS, STAMP_RENDER_SCALE } from '../config/stampAssets';
import { getCardImageSource } from '../lib/cardImageCache';
import { styles } from '../styles/appStyles';

export function DoneStampArtwork({
  defaultArtworkStyle,
  overrideSource,
  uri,
  style,
}) {
  const [failedUri, setFailedUri] = useState(null);
  const canShowMonster = Boolean(uri && failedUri !== uri);

  if (overrideSource) {
    return (
      <Animated.View pointerEvents="none" style={style}>
        <Image
          source={overrideSource}
          style={[
            styles.doneStampFullArtwork,
            { transform: [{ scale: STAMP_RENDER_SCALE }] },
          ]}
        />
      </Animated.View>
    );
  }

  if (!canShowMonster) {
    return (
      <Animated.View pointerEvents="none" style={style}>
        <Image
          source={STAMP_ASSETS.done}
          style={[
            styles.doneStampFullArtwork,
            styles.doneStampDefaultArtwork,
            defaultArtworkStyle,
            { transform: [{ scale: STAMP_RENDER_SCALE }] },
          ]}
        />
      </Animated.View>
    );
  }

  return (
    <Animated.View pointerEvents="none" style={style}>
      <Image source={STAMP_ASSETS.doneRings} style={styles.doneStampMonsterBackgroundArtwork} />
      <CachedImage
        cachePolicy="memory-disk"
        contentFit="contain"
        onError={() => setFailedUri(uri)}
        source={getCardImageSource(uri)}
        style={styles.doneStampMonsterArtwork}
      />
    </Animated.View>
  );
}
