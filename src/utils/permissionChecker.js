import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';

export const checkAllPermissions = async () => {
  const permissions = {
    camera: false,
    mediaLibrary: false,
    microphone: false,
  };

  try {
    // Kiểm tra quyền camera
    const cameraStatus = await ImagePicker.getCameraPermissionsAsync();
    permissions.camera = cameraStatus.status === 'granted';

    // Kiểm tra quyền thư viện media
    const mediaStatus = await ImagePicker.getMediaLibraryPermissionsAsync();
    permissions.mediaLibrary = mediaStatus.status === 'granted';

    // Kiểm tra quyền microphone
    const audioStatus = await Audio.getPermissionsAsync();
    permissions.microphone = audioStatus.status === 'granted';

    console.log('Permission Status:', permissions);

    // Hiển thị kết quả
    let message = 'Trạng thái quyền:\n';
    message += `📷 Camera: ${permissions.camera ? '✅' : '❌'}\n`;
    message += `📁 Media Library: ${permissions.mediaLibrary ? '✅' : '❌'}\n`;
    message += `🎤 Microphone: ${permissions.microphone ? '✅' : '❌'}\n`;

    if (!permissions.microphone) {
      message += '\n⚠️ Quyền microphone chưa được cấp!\n';
      message += 'Cần build lại ứng dụng để áp dụng quyền mới.';
    }

    Alert.alert('Kiểm tra quyền', message);

    return permissions;
  } catch (error) {
    console.error('Error checking permissions:', error);
    Alert.alert('Lỗi', 'Không thể kiểm tra quyền');
    return permissions;
  }
};

export const requestMicrophonePermission = async () => {
  try {
    const { status } = await Audio.requestPermissionsAsync();
    const granted = status === 'granted';

    Alert.alert(
      'Quyền Microphone',
      granted ? '✅ Đã cấp quyền microphone' : '❌ Chưa cấp quyền microphone'
    );

    return granted;
  } catch (error) {
    console.error('Error requesting microphone permission:', error);
    Alert.alert('Lỗi', 'Không thể xin quyền microphone');
    return false;
  }
};
