const mockSecureStore = {
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
};

jest.mock('expo-secure-store', () => mockSecureStore);

const {
  getStoredUiState,
  normalizeUiState,
  setStoredUiState,
} = require('./uiStateStore');

beforeEach(() => {
  jest.clearAllMocks();
});

test('normalizes mixed card IDs and collapsed nodes', () => {
  expect(normalizeUiState({
    archivedRootIds: [1, '2', 'treasure-card'],
    collapsedNodeIds: [3, 'mission-card', '3', null, {}],
    focusedCardId: 'treasure-card',
    layoutMode: 'tree',
    leafFocusedCardId: '4',
  })).toEqual({
    archivedRootIds: [1, 2, 'treasure-card'],
    collapsedNodeIds: [3, 'mission-card'],
    focusedCardId: 'treasure-card',
    layoutMode: 'tree',
    leafFocusedCardId: 4,
    newCardBackgroundColor: '#FFFFFF',
  });
});

test('normalizes legacy UI state without collapsed nodes', () => {
  expect(normalizeUiState({ layoutMode: 'leaf' })).toEqual({
    archivedRootIds: [],
    collapsedNodeIds: [],
    focusedCardId: null,
    layoutMode: 'leaf',
    leafFocusedCardId: null,
    newCardBackgroundColor: '#FFFFFF',
  });
});

test('reads and writes per-user UI state through SecureStore', async () => {
  mockSecureStore.getItemAsync.mockResolvedValue(JSON.stringify({
    collapsedNodeIds: ['treasure-card', 7],
    layoutMode: 'tree',
    newCardBackgroundColor: '#dbeafe',
  }));
  mockSecureStore.setItemAsync.mockResolvedValue();

  await expect(getStoredUiState(42)).resolves.toMatchObject({
    collapsedNodeIds: ['treasure-card', 7],
    layoutMode: 'tree',
    newCardBackgroundColor: '#DBEAFE',
  });

  await setStoredUiState(42, {
    collapsedNodeIds: [1, 'treasure-card'],
    layoutMode: 'tree',
    newCardBackgroundColor: '#fce7f3',
  });

  expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('stack.uiState.42');
  expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
    'stack.uiState.42',
    JSON.stringify({
      archivedRootIds: [],
      collapsedNodeIds: [1, 'treasure-card'],
      focusedCardId: null,
      layoutMode: 'tree',
      leafFocusedCardId: null,
      newCardBackgroundColor: '#FCE7F3',
    }),
  );
});

test('does not hide SecureStore read failures', async () => {
  mockSecureStore.getItemAsync.mockRejectedValue(new Error('storage unavailable'));

  await expect(getStoredUiState(42)).rejects.toThrow('storage unavailable');
});
