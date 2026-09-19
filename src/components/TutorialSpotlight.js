import { Pressable, Text, View } from 'react-native';
import { styles } from '../styles/appStyles';

export function TutorialSpotlight({ onDismiss }) {
  return (
    <Pressable
      accessibilityHint="Dismisses this tutorial hint"
      accessibilityLabel="Floating control tutorial. Tap to continue."
      accessibilityRole="button"
      accessibilityViewIsModal
      onPress={onDismiss}
      style={styles.settingsPanelBackdrop}
    >
      <View pointerEvents="none" style={styles.tutorialSpotlightMessage}>
        <Text style={styles.tutorialSpotlightTitle}>Meet your floating control</Text>
        <Text style={styles.tutorialSpotlightBody}>
          Its actions change with the card you focus.
        </Text>
        <Text style={styles.tutorialSpotlightDismissHint}>
          Tap the shaded area to continue
        </Text>
      </View>
    </Pressable>
  );
}
