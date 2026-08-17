import { Image as CachedImage } from 'expo-image';
import { Text, View } from 'react-native';
import { getCardImageSource } from '../lib/cardImageCache';
import { styles } from '../styles/appStyles';

export function TreasureInventoryContent({ monsters = [] }) {
  const rowCount = Math.max(6, Math.ceil(monsters.length / 7));
  const cellCount = rowCount * 7;
  const cellHeight = `${91.2 / rowCount}%`;

  return (
    <View style={styles.treasureInventoryContent}>
      <View style={styles.treasureInventoryBinding} />
      <View style={styles.treasureInventoryRingRow}>
        <View style={styles.treasureInventoryRing} />
        <View style={styles.treasureInventoryRing} />
      </View>
      <View style={styles.treasureInventoryHeading}>
        <Text style={styles.treasureInventoryHeadingText}>
          Collections
        </Text>
      </View>
      <View style={styles.treasureInventoryGrid}>
        {Array.from({ length: cellCount }, (_, index) => {
          const monster = monsters[index];

          return (
            <View
              key={monster?.id || `treasure-inventory-empty-${index}`}
              style={[
                styles.treasureInventoryCell,
                !monster && styles.treasureInventoryCellEmpty,
                { height: cellHeight },
              ]}
            >
              {monster ? (
                <CachedImage
                  accessibilityLabel={`Collected monster ${index + 1}`}
                  cachePolicy="memory-disk"
                  contentFit="contain"
                  source={getCardImageSource(monster.imageUri)}
                  style={styles.treasureInventoryMonster}
                />
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}
