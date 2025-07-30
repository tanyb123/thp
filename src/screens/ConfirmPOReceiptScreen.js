import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  TextInput,
  ActivityIndicator,
  ScrollView,
  ProgressBarAndroid,
  Platform,
  ProgressViewIOS,
  Linking,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import usePOReceipt from '../hooks/usePOReceipt';
import uuid from 'react-native-uuid';

const ConfirmPOReceiptScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { po } = route.params || {};

  const { confirmReceipt, loading, uploadProgress } = usePOReceipt();

  const [files, setFiles] = useState([]);
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  if (!po) {
    return (
      <View style={styles.centered}>
        <Text>Không tìm thấy thông tin PO.</Text>
      </View>
    );
  }

  // Hàm đơn giản để thêm file vào state
  const addFileToState = (asset) => {
    if (!asset || !asset.uri) {
      Alert.alert('Lỗi', 'Tập tin không hợp lệ.');
      return;
    }

    const tempId = uuid.v4();
    const fileInfo = {
      id: tempId, // ID tạm thời
      uri: asset.uri,
      name: asset.fileName || `image_${tempId}.jpg`,
      mimeType: asset.mimeType || 'image/jpeg',
    };

    setFiles((prev) => [...prev, fileInfo]);
  };

  const pickFile = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Lỗi', 'Cần quyền truy cập thư viện ảnh.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsMultipleSelection: true,
    });

    if (!result.canceled && result.assets) {
      result.assets.forEach(addFileToState);
    }
  };

  // Capture photo directly using camera
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Lỗi', 'Cần quyền truy cập camera.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });

    if (!result.canceled) {
      addFileToState(result.assets[0]);
    }
  };

  const removeFile = (file) => {
    Alert.alert('Xác nhận', 'Xóa ảnh này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          setFiles((prev) => prev.filter((f) => f.uri !== file.uri));
        },
      },
    ]);
  };

  const viewFile = (file) => {
    if (file.url) {
      Linking.openURL(file.url).catch(() =>
        Alert.alert('Lỗi', 'Không thể mở tệp.')
      );
    }
  };

  const handleConfirm = async () => {
    if (files.length === 0) {
      Alert.alert('Thiếu ảnh', 'Vui lòng chọn ít nhất một ảnh để xác nhận.');
      return;
    }

    setSaving(true);
    try {
      console.log('[ConfirmPOScreen] Starting confirmation process');
      console.log('[ConfirmPOScreen] Files count:', files.length);
      // Chuẩn bị mảng file để upload
      const filesToUpload = await Promise.all(
        files.map(async (file, index) => {
          console.log(
            `[ConfirmPOScreen] Processing file ${index + 1}/${files.length}: ${
              file.name
            }`
          );
          // Đọc base64 cho mỗi file
          const base64Data = await FileSystem.readAsStringAsync(file.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          console.log(
            `[ConfirmPOScreen] File ${index + 1} base64 data length: ${
              base64Data.length
            }`
          );
          return {
            base64Data,
            fileName: file.name,
            mimeType: file.mimeType || 'image/jpeg',
          };
        })
      );

      console.log(
        '[ConfirmPOScreen] All files prepared, calling confirmReceipt'
      );
      console.log('[ConfirmPOScreen] PO ID:', po.id);
      console.log('[ConfirmPOScreen] Project ID:', po.projectId);

      const result = await confirmReceipt({
        poId: po.id,
        projectId: po.projectId,
        files: filesToUpload,
        remarks,
      });

      console.log('[ConfirmPOScreen] Confirmation successful');

      // Show success message with inventory update info
      Alert.alert(
        'Thành công',
        'Đã xác nhận nhận hàng thành công. Vật tư đã được tự động thêm vào kho.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (e) {
      console.error('[ConfirmPOScreen] Confirmation error:', e);
      // Lỗi đã được xử lý và hiển thị bởi hook, không cần làm gì thêm ở đây.
      console.log(
        'Handle confirm caught an error, but it should have been handled by the hook.'
      );
    } finally {
      setSaving(false);
    }
  };

  const renderMaterial = ({ item, index }) => (
    <View style={styles.materialRow}>
      <Text style={{ flex: 1 }}>
        {index + 1}. {item.name}
      </Text>
      <Text style={{ width: 80, textAlign: 'right' }}>
        {item.quantity} {item.unit}
      </Text>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>PO: {po.poNumber || po.id}</Text>
      <Text style={styles.label}>Nhà cung cấp: {po.supplierName}</Text>
      <Text style={styles.label}>
        Ngày tạo:{' '}
        {po.createdAt?.seconds
          ? new Date(po.createdAt.seconds * 1000).toLocaleDateString('vi-VN')
          : ''}
      </Text>

      <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Vật tư</Text>
      <FlatList
        data={po.materials || []}
        keyExtractor={(_, idx) => idx.toString()}
        renderItem={renderMaterial}
        scrollEnabled={false}
      />

      {/* Thêm thông báo về tự động cập nhật kho */}
      <View style={styles.autoUpdateNote}>
        <Ionicons name="information-circle-outline" size={20} color="#0066cc" />
        <Text style={styles.autoUpdateText}>
          Vật tư sẽ được tự động thêm vào kho khi xác nhận nhận hàng
        </Text>
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Ảnh xác nhận</Text>

      {loading && uploadProgress > 0 && (
        <View style={styles.progressContainer}>
          {Platform.OS === 'android' ? (
            <ProgressBarAndroid
              styleAttr="Horizontal"
              indeterminate={false}
              progress={uploadProgress / 100}
              style={styles.progressBar}
            />
          ) : (
            <ProgressViewIOS
              progress={uploadProgress / 100}
              style={styles.progressBar}
            />
          )}
          <Text style={styles.progressText}>
            Đang tải lên... {Math.round(uploadProgress)}%
          </Text>
        </View>
      )}

      <View style={styles.imagesContainer}>
        {files.map((file, idx) => (
          <View key={idx} style={styles.fileContainer}>
            <TouchableOpacity
              style={styles.fileThumb}
              onPress={() => viewFile(file)}
            >
              <Image source={{ uri: file.uri }} style={styles.imageThumb} />
              {file.isUploading && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator color="#fff" size="small" />
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => removeFile(file)}
            >
              <Ionicons name="close-circle" size={20} color="#ff4444" />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addImage} onPress={pickFile}>
          <Ionicons name="add" size={28} color="#777" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.addImage} onPress={takePhoto}>
          <Ionicons name="camera" size={26} color="#777" />
        </TouchableOpacity>
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Ghi chú</Text>
      <TextInput
        style={styles.remarksInput}
        placeholder="Ghi chú thêm..."
        value={remarks}
        onChangeText={setRemarks}
        multiline
      />

      <TouchableOpacity
        style={[styles.confirmBtn, (loading || saving) && { opacity: 0.7 }]}
        onPress={handleConfirm}
        disabled={loading || saving}
      >
        {loading || saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
        )}
        <Text style={styles.confirmText}>Xác nhận và cập nhật kho</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: 'bold' },
  label: { fontSize: 14, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  materialRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 6,
  },
  autoUpdateNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    padding: 10,
    borderRadius: 6,
    marginTop: 10,
  },
  autoUpdateText: {
    color: '#0066cc',
    fontSize: 14,
    marginLeft: 8,
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  fileContainer: {
    position: 'relative',
    marginRight: 8,
    marginBottom: 8,
  },
  fileThumb: {
    width: 80,
    height: 80,
    borderRadius: 4,
    overflow: 'hidden',
  },
  imageThumb: {
    width: 80,
    height: 80,
    borderRadius: 4,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  addImage: {
    width: 80,
    height: 80,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    marginRight: 8,
  },
  remarksInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 8,
    minHeight: 80,
    textAlignVertical: 'top',
    marginTop: 4,
  },
  progressContainer: {
    marginVertical: 10,
  },
  progressBar: {
    height: 6,
    marginBottom: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28a745',
    paddingVertical: 12,
    borderRadius: 6,
    marginTop: 20,
  },
  confirmText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,
    fontWeight: '600',
  },
});

export default ConfirmPOReceiptScreen;
