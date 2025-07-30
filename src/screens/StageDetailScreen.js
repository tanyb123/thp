import React, { useState, useLayoutEffect, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  Modal,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebaseConfig';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { updateStageDetails } from '../api/projectService';
import uuid from 'react-native-uuid';
import * as FileSystem from 'expo-file-system';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Chờ xử lý', color: '#9E9E9E' },
  { value: 'in_progress', label: 'Đang làm', color: '#FFD54F' },
  { value: 'completed', label: 'Hoàn thành', color: '#4CAF50' },
  { value: 'failed', label: 'Không đạt', color: '#F44336' },
];

const StageDetailScreen = ({ route, navigation }) => {
  const { projectId, stage } = route.params; // stage object passed in

  const [status, setStatus] = useState(stage.status);
  const [notes, setNotes] = useState(stage.notes || '');

  const computePreview = (f) => {
    if (f.preview) return f.preview;
    if (f.mimeType && f.mimeType.startsWith('image/')) {
      return `https://drive.google.com/uc?export=download&id=${f.id}`;
    }
    return undefined;
  };

  const initialFiles = (stage.files || []).map((f) => ({
    ...f,
    preview: computePreview(f),
  }));

  const [files, setFiles] = useState(initialFiles);
  const [imagePreviewUri, setImagePreviewUri] = useState(null);
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ headerTitle: stage.processName });
  }, [navigation]);

  const pickFile = async () => {
    const { status: perm } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm !== 'granted') {
      Alert.alert('Lỗi', 'Cần quyền truy cập thư viện ảnh.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.7,
    });
    if (!result.canceled) {
      uploadPickedFile(result.assets[0]);
    }
  };

  const takePhoto = async () => {
    const { status: perm } = await ImagePicker.requestCameraPermissionsAsync();
    if (perm !== 'granted') {
      Alert.alert('Lỗi', 'Cần quyền truy cập camera.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) {
      uploadPickedFile(result.assets[0]);
    }
  };

  const uploadPickedFile = async (asset) => {
    try {
      setSaving(true);

      if (!asset || !asset.uri) {
        Alert.alert('Lỗi', 'Tập tin không hợp lệ.');
        return;
      }

      const ext = (asset.fileName || asset.uri).split('.').pop();
      const filename = `${uuid.v4()}.${ext}`;

      console.log('Starting upload for:', asset.uri);

      try {
        // Get file info using FileSystem from expo
        const fileInfo = await FileSystem.getInfoAsync(asset.uri);
        console.log('File info:', fileInfo);

        if (!fileInfo.exists || fileInfo.size === 0) {
          throw new Error('File rỗng hoặc không tồn tại');
        }

        console.log('File size:', fileInfo.size, 'bytes');

        // Đọc file base64 bằng expo-file-system
        const base64Data = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        // Lấy accessToken Google của người dùng
        const tokens = await GoogleSignin.getTokens();
        const accessToken = tokens.accessToken;

        if (!accessToken) {
          throw new Error(
            'Phiên đăng nhập Google đã hết. Vui lòng đăng nhập lại.'
          );
        }

        // Gọi Cloud Function uploadFileToDriveUser
        const uploadFn = httpsCallable(functions, 'uploadFileToDriveUser');
        const result = await uploadFn({
          accessToken,
          projectId,
          fileName: filename,
          mimeType: asset.mimeType || asset.type || 'image/jpeg',
          base64Data,
        });

        const {
          fileId,
          webViewLink,
          thumbnailLink,
          mimeType: returnedMime,
        } = result.data;
        const preview =
          returnedMime && returnedMime.startsWith('image/')
            ? thumbnailLink ||
              `https://drive.google.com/uc?export=download&id=${fileId}`
            : webViewLink;
        setFiles((prev) => [
          ...prev,
          { name: filename, id: fileId, url: webViewLink, preview },
        ]);
      } catch (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Lỗi khi tải lên: ${uploadError.message}`);
      }
    } catch (err) {
      console.error('Error uploading file:', err);
      Alert.alert(
        'Lỗi',
        `Không thể tải tệp: ${err.message || 'Lỗi không xác định'}`
      );
    } finally {
      setSaving(false);
    }
  };

  const removeFile = (file) => {
    Alert.alert('Xác nhận', 'Xóa tệp đính kèm này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            // Cập nhật đường dẫn để khớp với khi tải lên
            const delFn = httpsCallable(functions, 'deleteFileFromDrive');
            await delFn({ fileId: file.id });
          } catch (e) {
            console.log('Cannot delete from storage, maybe already removed');
          }
          setFiles((prev) => prev.filter((f) => f.name !== file.name));
        },
      },
    ]);
  };

  const viewFile = (file) => {
    if (file.preview && file.preview.startsWith('http')) {
      setImagePreviewUri(file.preview);
    } else if (file.url) {
      Linking.openURL(file.url).catch(() =>
        Alert.alert('Lỗi', 'Không thể mở tệp.')
      );
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      // Chỉ lưu các trường cần thiết để Firestore gọn nhẹ
      const filesToSave = files.map(({ name, id, url, mimeType }) => {
        const obj = { name, id, url };
        if (mimeType) obj.mimeType = mimeType;
        return obj;
      });

      await updateStageDetails(projectId, stage.stageId, {
        status,
        notes,
        files: filesToSave,
      });
      Alert.alert('Thành công', 'Đã lưu thay đổi', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      console.error(err);
      Alert.alert('Lỗi', 'Không thể lưu.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
    >
      <Text style={styles.label}>Trạng thái</Text>
      <View style={styles.statusRow}>
        {STATUS_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.statusBtn,
              status === opt.value && { backgroundColor: opt.color },
            ]}
            onPress={() => setStatus(opt.value)}
          >
            <Text
              style={[
                styles.statusBtnText,
                status === opt.value && { color: '#fff' },
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Ghi chú / Mô tả kết quả</Text>
      <TextInput
        style={styles.textArea}
        multiline
        value={notes}
        onChangeText={setNotes}
        placeholder="Nhập ghi chú ..."
      />

      <Text style={styles.label}>Tệp đính kèm</Text>
      {files.map((f) => (
        <View key={f.name} style={styles.fileRow}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
            onPress={() => viewFile(f)}
          >
            {f.preview && f.preview.startsWith('http') ? (
              <Image source={{ uri: f.preview }} style={styles.thumb} />
            ) : (
              <Ionicons name="document-outline" size={24} color="#666" />
            )}
            <Text style={styles.fileName}>{f.name}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => removeFile(f)}
            style={{ padding: 4 }}
          >
            <Ionicons name="trash-outline" size={20} color="#d11a2a" />
          </TouchableOpacity>
        </View>
      ))}

      <View style={styles.attachActions}>
        <TouchableOpacity style={styles.attachBtn} onPress={pickFile}>
          <Ionicons name="images-outline" size={20} color="#fff" />
          <Text style={styles.attachBtnText}>Chọn từ thư viện</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.attachBtn} onPress={takePhoto}>
          <Ionicons name="camera-outline" size={20} color="#fff" />
          <Text style={styles.attachBtnText}>Chụp ảnh</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.saveBtn}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>Lưu</Text>
        )}
      </TouchableOpacity>

      {/* Image preview modal */}
      <Modal
        visible={!!imagePreviewUri}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalCloseArea}
            onPress={() => setImagePreviewUri(null)}
          />
          <Image
            source={{ uri: imagePreviewUri }}
            style={styles.modalImage}
            resizeMode="contain"
          />
          <TouchableOpacity
            style={styles.modalCloseBtn}
            onPress={() => setImagePreviewUri(null)}
          >
            <Ionicons name="close-circle" size={36} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  label: { fontWeight: '600', marginBottom: 6, fontSize: 14, color: '#333' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  statusBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f1f1',
    marginRight: 8,
    marginBottom: 8,
  },
  statusBtnText: { color: '#333', fontSize: 14 },
  textArea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  thumb: { width: 40, height: 40, borderRadius: 4, marginRight: 8 },
  fileName: { flex: 1, color: '#333' },
  attachActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 16,
  },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0066cc',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  attachBtnText: { color: '#fff', marginLeft: 6, fontWeight: '500' },
  saveBtn: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '90%',
    height: '80%',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
  },
  modalCloseArea: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default StageDetailScreen;
