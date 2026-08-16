import { Animated, Image } from 'react-native';
import { Image as CachedImage } from 'expo-image';
import { useState } from 'react';
import { getCardImageSource } from '../lib/cardImageCache';
import { styles } from '../styles/appStyles';

const doneStampImage = require('../../assets/card/done_stamp_gray.png');
const doneStampRingsImage = require('../../assets/card/done_stamp_rings_gray.png');

export function DoneStampArtwork({ defaultArtworkStyle, uri, style }) {
  const [failedUri, setFailedUri] = useState(null);
  const canShowMonster = Boolean(uri && failedUri !== uri);

  if (!canShowMonster) {
    return (
      <Animated.View pointerEvents="none" style={style}>
        <Image
          source={doneStampImage}
          style={[
            styles.doneStampFullArtwork,
            styles.doneStampDefaultArtwork,
            defaultArtworkStyle,
          ]}
        />
      </Animated.View>
    );
  }

  return (
    <Animated.View pointerEvents="none" style={style}>
      <Image source={doneStampRingsImage} style={styles.doneStampMonsterBackgroundArtwork} />
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
