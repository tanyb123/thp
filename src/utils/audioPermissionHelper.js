import { Audio } from 'expo-av';
import { Alert, Platform, Linking } from 'react-native';

export const requestAudioPermission = async () => {
  try {
    const { status } = await Audio.requestPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Quyền ghi âm',
        'Ứng dụng cần quyền truy cập microphone để ghi âm hướng dẫn. Vui lòng cấp quyền trong Cài đặt.',
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Cài đặt',
            onPress: () => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openURL('package:com.tanhoaphat.thpapp');
              }
            },
          },
        ]
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error requesting audio permission:', error);
    Alert.alert('Lỗi', 'Không thể xin quyền ghi âm');
    return false;
  }
};

export const checkAudioPermission = async () => {
  try {
    const { status } = await Audio.getPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error checking audio permission:', error);
    return false;
  }
};

export const setupAudioMode = async () => {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    return true;
  } catch (error) {
    console.error('Error setting up audio mode:', error);
    return false;
  }
};
