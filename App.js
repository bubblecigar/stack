import { StatusBar } from 'expo-status-bar';
import { useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  getSnapshot,
  push,
  removeAt,
  subscribe,
  updateAt,
} from './stackStore';

export default function App() {
  const [draftValue, setDraftValue] = useState('');
  const [isDraftActive, setIsDraftActive] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const stack = useSyncExternalStore(subscribe, getSnapshot);
  const visibleCards = stack
    .map((value, index) => ({ index, value }))
    .slice(-4)
    .reverse();

  function handleCreateCard() {
    setDraftValue('');
    setEditingIndex(null);
    setIsDraftActive(true);
  }

  function handleConfirmDraft() {
    push(draftValue);
    setDraftValue('');
    setIsDraftActive(false);
  }

  function handleEditCard(index, value) {
    setIsDraftActive(false);
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
    }

    removeAt(index);
  }

  function renderCard({
    controls,
    index,
    isEditing = false,
    key,
    onChangeText,
    pileIndex,
    value,
  }) {
    return (
      <View
        key={key}
        style={[
          styles.card,
          isEditing && styles.editingCard,
          {
            top: pileIndex * 12,
            transform: [
              { scale: 1 - pileIndex * 0.035 },
              { rotate: `${pileIndex % 2 === 0 ? 0 : -2}deg` },
            ],
            zIndex: visibleCards.length + 1 - pileIndex,
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

  return (
    <View style={styles.container}>
      <View style={styles.deck}>
        {isDraftActive && renderCard({
          controls: (
            <>
              <Pressable
                accessibilityLabel="Confirm new card"
                accessibilityRole="button"
                onPress={handleConfirmDraft}
                style={({ pressed }) => [
                  styles.iconButton,
                  pressed && styles.iconButtonPressed,
                ]}
              >
                <Text style={styles.iconButtonText}>✓</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Delete new card"
                accessibilityRole="button"
                onPress={() => {
                  setDraftValue('');
                  setIsDraftActive(false);
                }}
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
          isEditing: true,
          key: 'draft-card',
          onChangeText: setDraftValue,
          pileIndex: 0,
          value: draftValue,
        })}

        {visibleCards.map(({ index, value }, visibleIndex) => {
          const pileIndex = isDraftActive ? visibleIndex + 1 : visibleIndex;
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
            index,
            isEditing,
            key: `card-${index}-${value}`,
            onChangeText: setEditingValue,
            pileIndex,
            value: isEditing ? editingValue : value,
          });
        })}
      </View>

      <Pressable
        accessibilityLabel="Add card"
        accessibilityRole="button"
        onPress={handleCreateCard}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 40,
  },
  deck: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
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
    position: 'absolute',
    right: 24,
    bottom: 28,
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
  fabIcon: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '500',
    lineHeight: 42,
    marginTop: -2,
  },
});
