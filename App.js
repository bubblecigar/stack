import { StatusBar } from 'expo-status-bar';
import { useState, useSyncExternalStore } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  getSnapshot,
  push,
  removeAt,
  subscribe,
  updateAt,
} from './stackStore';

export default function App() {
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [layoutMode, setLayoutMode] = useState('leaf');
  const stack = useSyncExternalStore(subscribe, getSnapshot);
  const cards = stack.map((value, index) => ({ index, value }));
  const visibleCards = stack
    .map((value, index) => ({ index, value }))
    .slice(-4)
    .reverse();
  const treeCards = [...cards].reverse();

  function handleCreateCard() {
    const nextIndex = push('');
    setEditingIndex(nextIndex);
    setEditingValue('');
  }

  function handleEditCard(index, value) {
    setEditingIndex(index);
    setEditingValue(value);
  }

  function handleConfirmEdit() {
    if (editingIndex === null) {
      return;
    }

    updateAt(editingIndex, editingValue);
    setEditingIndex(null);
    setEditingValue('');
  }

  function handleToggleEdit(index, value) {
    if (editingIndex === index) {
      handleConfirmEdit();
      return;
    }

    handleEditCard(index, value);
  }

  function handleDeleteCard(index) {
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditingValue('');
    } else if (editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }

    removeAt(index);
  }

  function renderCard({
    controls,
    isEditing = false,
    key,
    layout = 'leaf',
    onChangeText,
    pileIndex,
    value,
  }) {
    const isLeafCard = layout === 'leaf';

    return (
      <View
        key={key}
        style={[
          styles.card,
          isLeafCard && styles.leafCard,
          !isLeafCard && styles.treeCard,
          isEditing && styles.editingCard,
          isLeafCard && {
            top: pileIndex * 12,
            transform: [
              { scale: 1 - pileIndex * 0.035 },
              { rotate: `${pileIndex % 2 === 0 ? 0 : -2}deg` },
            ],
            zIndex: isEditing
              ? visibleCards.length + 2
              : visibleCards.length + 1 - pileIndex,
          },
          !isLeafCard && {
            transform: [{ rotate: `${pileIndex % 2 === 0 ? -1.5 : 1.5}deg` }],
          },
        ]}
      >
        <View style={styles.cardControls}>{controls}</View>

        {isEditing ? (
          <TextInput
            autoCapitalize="sentences"
            autoCorrect
            autoFocus
            multiline
            onChangeText={onChangeText}
            placeholder="Write card text"
            placeholderTextColor="#94A3B8"
            style={styles.cardInput}
            value={value}
          />
        ) : (
          <Text style={styles.cardText}>{value}</Text>
        )}
      </View>
    );
  }

  function renderStackCard({ index, value }, visibleIndex, layout = 'leaf') {
    const pileIndex = visibleIndex;
    const isEditing = editingIndex === index;

    return renderCard({
      controls: (
        <>
          <Pressable
            accessibilityLabel={isEditing ? 'Confirm card' : 'Edit card'}
            accessibilityRole="button"
            onPress={() => handleToggleEdit(index, value)}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.iconButtonPressed,
            ]}
          >
            <Text style={styles.iconButtonText}>
              {isEditing ? '✓' : '✎'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Delete card"
            accessibilityRole="button"
            onPress={() => handleDeleteCard(index)}
            style={({ pressed }) => [
              styles.iconButton,
              styles.dangerButton,
              pressed && styles.dangerButtonPressed,
            ]}
          >
            <Text style={styles.iconButtonText}>⌫</Text>
          </Pressable>
        </>
      ),
      isEditing,
      key: `card-${index}-${value}`,
      layout,
      onChangeText: setEditingValue,
      pileIndex,
      value: isEditing ? editingValue : value,
    });
  }

  function renderLeafView() {
    return (
      <View style={styles.deck}>
        {visibleCards.map((card, visibleIndex) => (
          renderStackCard(card, visibleIndex, 'leaf')
        ))}
      </View>
    );
  }

  function renderTreeView() {
    return (
      <ScrollView
        contentContainerStyle={styles.treeContent}
        showsVerticalScrollIndicator={false}
        style={styles.treeScroll}
      >
        {treeCards.map((card, visibleIndex) => (
          renderStackCard(card, visibleIndex, 'tree')
        ))}
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      {layoutMode === 'leaf' ? renderLeafView() : renderTreeView()}

      <View style={styles.floatingControls}>
        <Pressable
          accessibilityLabel="Toggle stack layout"
          accessibilityRole="button"
          onPress={() => {
            setLayoutMode((currentMode) => (
              currentMode === 'leaf' ? 'tree' : 'leaf'
            ));
          }}
          style={({ pressed }) => [
            styles.fab,
            styles.modeFab,
            pressed && styles.modeFabPressed,
          ]}
        >
          <Text style={styles.modeFabText}>
            {layoutMode === 'leaf' ? 'L' : 'T'}
          </Text>
        </Pressable>

        <Pressable
          accessibilityLabel="Add card"
          accessibilityRole="button"
          onPress={handleCreateCard}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        >
          <Text style={styles.fabIcon}>+</Text>
        </Pressable>
      </View>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  floatingControls: {
    position: 'absolute',
    right: 24,
    bottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deck: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  treeScroll: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  treeContent: {
    alignItems: 'stretch',
    gap: 18,
    paddingTop: 8,
    paddingBottom: 108,
  },
  card: {
    minHeight: 360,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    shadowColor: '#0F172A',
    shadowOffset: {
      width: 0,
      height: 14,
    },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 12,
  },
  leafCard: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  treeCard: {
    position: 'relative',
    minHeight: 260,
  },
  editingCard: {
    zIndex: 20,
    borderColor: '#2563EB',
    borderWidth: 2,
  },
  cardControls: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    gap: 8,
    zIndex: 2,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPressed: {
    backgroundColor: '#2563EB',
  },
  dangerButton: {
    backgroundColor: '#DC2626',
  },
  dangerButtonPressed: {
    backgroundColor: '#B91C1C',
  },
  iconButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
  },
  cardText: {
    color: '#0F172A',
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 40,
    textAlign: 'center',
  },
  cardInput: {
    width: '100%',
    minHeight: 180,
    color: '#0F172A',
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 40,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 12,
  },
  fabPressed: {
    backgroundColor: '#1D4ED8',
    transform: [{ scale: 0.96 }],
  },
  modeFab: {
    backgroundColor: '#0F172A',
  },
  modeFabPressed: {
    backgroundColor: '#334155',
    transform: [{ scale: 0.96 }],
  },
  modeFabText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 26,
  },
  fabIcon: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '500',
    lineHeight: 42,
    marginTop: -2,
  },
});
