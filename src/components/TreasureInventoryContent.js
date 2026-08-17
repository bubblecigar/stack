import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image as CachedImage } from 'expo-image';
import { View } from 'react-native';
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
      <View
        accessibilityLabel="Treasure collection"
        accessible
        style={styles.treasureInventoryHeading}
      >
        <View style={styles.treasureCardIconWrap}>
          <MaterialCommunityIcons
            color="#F8FAFC"
            name="treasure-chest-outline"
            size={30}
            style={styles.treasureCardIconHighlight}
          />
          <MaterialCommunityIcons
            color="#6B7280"
            name="treasure-chest-outline"
            size={30}
            style={styles.treasureCardIconShadow}
          />
          <MaterialCommunityIcons
            color="#9CA3AF"
            name="treasure-chest-outline"
            size={30}
          />
        </View>
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
