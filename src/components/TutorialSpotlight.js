import { View } from 'react-native';
import { styles } from '../styles/appStyles';

export function TutorialSpotlight({
  accessibilityHint = 'Press the floating card and swipe in any insertion direction to continue.',
  accessibilityLabel = 'Card insertion tutorial. This step must be completed.',
}) {
  return (
    <View
      accessible
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityViewIsModal
      onStartShouldSetResponder={() => true}
      style={styles.settingsPanelBackdrop}
    />
  );
}
