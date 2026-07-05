import { View } from 'react-native';
import { StackCard } from '../components/StackCard';
import { styles } from '../styles/appStyles';

export function LeafDeck({
  cards,
  editingIndex,
  editingValue,
  focusedCardIndex,
  collapsedNodeIds,
  linkingIndex,
  onCreateEdit,
  onToggleLinking,
  onDeleteCard,
  onEditingValueChange,
}) {
  return (
    <View style={styles.deck}>
      {cards.map((card, visibleIndex) => (
        <StackCard
          card={card}
          collapsedNodeIds={collapsedNodeIds}
          editingIndex={editingIndex}
          editingValue={editingValue}
          focusedCardIndex={focusedCardIndex}
          linkingIndex={linkingIndex}
          layout="leaf"
          key={`card-${card.id}`}
          visibleIndex={visibleIndex}
          onPress={() => {}}
          onCreateEdit={onCreateEdit}
          onToggleLinking={onToggleLinking}
          onDeleteCard={onDeleteCard}
          onEditingValueChange={onEditingValueChange}
          onTreeTouch={() => {}}
          onToggleCollapse={() => {}}
        />
      ))}
    </View>
  );
}

