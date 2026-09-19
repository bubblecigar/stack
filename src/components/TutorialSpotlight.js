import { View } from 'react-native';
import { styles } from '../styles/appStyles';

export function TutorialSpotlight() {
  return (
    <View
      accessible
      accessibilityHint="Press the floating card and swipe in any insertion direction to continue."
      accessibilityLabel="Card insertion tutorial. This step must be completed."
      accessibilityViewIsModal
      onStartShouldSetResponder={() => true}
      style={styles.settingsPanelBackdrop}
    />
  );
}
