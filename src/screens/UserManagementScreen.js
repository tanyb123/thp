// src/screens/UserManagementScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy,
  getDoc,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const UserManagementScreen = () => {
  const { theme } = useTheme();
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editData, setEditData] = useState({
    displayName: '',
    email: '',
    role: '',
    photoURL: '',
    dailySalary: '',
    monthlySalary: '', // Added monthlySalary
    phoneNumber: '',
    address: '',
    notes: '',
  });
  const [savingUser, setSavingUser] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Role options for dropdown
  const roleOptions = [
    { value: 'giam_doc', label: 'Giám đốc' },
    { value: 'pho_giam_doc', label: 'Phó Giám đốc' },
    { value: 'ke_toan', label: 'Kế toán' },
    { value: 'ky_su', label: 'Kỹ sư' },
    { value: 'thuong_mai', label: 'Thương mại' },
    { value: 'cong_nhan', label: 'Công nhân' },
    { value: 'user', label: 'Người dùng' },
  ];

  // Load users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const usersRef = collection(db, 'users');
        const q = query(usersRef, orderBy('displayName'));
        const snapshot = await getDocs(q);
        const usersList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setUsers(usersList);
      } catch (error) {
        console.error('Error loading users:', error);
        Alert.alert('Lỗi', 'Không thể tải danh sách người dùng');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Handle user selection for editing
  const handleEditUser = (user) => {
    setSelectedUser(user);
    setEditData({
      displayName: user.displayName || '',
      email: user.email || '',
      role: user.role || 'user',
      photoURL: user.photoURL || '',
      dailySalary: user.dailySalary ? String(user.dailySalary) : '',
      monthlySalary: user.monthlySalary ? String(user.monthlySalary) : '', // Added monthlySalary
      phoneNumber: user.phoneNumber || '',
      address: user.address || '',
      notes: user.notes || '',
    });
    setEditModalVisible(true);
  };

  // Save user changes
  const saveUserChanges = async () => {
    if (!selectedUser) return;

    try {
      setSavingUser(true);

      // Validate required fields
      if (!editData.displayName.trim()) {
        Alert.alert('Lỗi', 'Tên người dùng không được để trống');
        return;
      }

      // Convert salary to number if provided
      const userData = {
        ...editData,
        dailySalary: editData.dailySalary
          ? parseFloat(editData.dailySalary)
          : null,
        monthlySalary: editData.monthlySalary // Added monthlySalary
          ? parseFloat(editData.monthlySalary)
          : null,
      };

      // Update user in Firestore
      const userRef = doc(db, 'users', selectedUser.id);
      await updateDoc(userRef, userData);

      // Update local state
      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u.id === selectedUser.id ? { ...u, ...userData } : u
        )
      );

      // Close modal
      setEditModalVisible(false);
      setSelectedUser(null);
      Alert.alert('Thành công', 'Đã cập nhật thông tin người dùng');
    } catch (error) {
      console.error('Error updating user:', error);
      Alert.alert('Lỗi', 'Không thể cập nhật thông tin người dùng');
    } finally {
      setSavingUser(false);
    }
  };

  // Pick and upload profile image
  const pickImage = async () => {
    try {
      // Request permissions first
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Lỗi', 'Cần quyền truy cập thư viện ảnh để upload ảnh');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5, // Giảm quality để tránh file quá lớn
        base64: false, // Không cần base64
      });

      console.log('ImagePicker result:', result);

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        console.log('Selected image:', {
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          fileSize: asset.fileSize,
        });

        uploadImage(asset.uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Lỗi', 'Không thể chọn ảnh: ' + error.message);
    }
  };

  // Upload image to Firebase Storage
  const uploadImage = async (uri) => {
    try {
      setUploadingImage(true);
      console.log('Starting image upload for URI:', uri);

      // Validate URI
      if (!uri) {
        throw new Error('Invalid image URI');
      }

      // Convert image to blob with better error handling
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      const blob = await response.blob();
      console.log('Blob created successfully, size:', blob.size);

      // Validate blob
      if (!blob || blob.size === 0) {
        throw new Error('Invalid image data');
      }

      // Try Firebase Storage upload with timeout
      const storage = getStorage();
      const fileExtension = uri.split('.').pop() || 'jpg';
      const fileName = `profile_${
        selectedUser.id
      }_${Date.now()}.${fileExtension}`;
      const storageRef = ref(storage, `profiles/${fileName}`);

      console.log('Uploading to Firebase Storage:', fileName);
      console.log('Storage bucket:', storage.app.options.storageBucket);

      // Upload with metadata and timeout
      const metadata = {
        contentType: `image/${fileExtension}`,
        customMetadata: {
          uploadedBy: currentUser?.uid || 'unknown',
          uploadedAt: new Date().toISOString(),
        },
      };

      // Add timeout to upload
      const uploadPromise = uploadBytes(storageRef, blob, metadata);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Upload timeout after 30s')), 30000)
      );

      await Promise.race([uploadPromise, timeoutPromise]);
      console.log('Upload successful, getting download URL...');

      const downloadURL = await getDownloadURL(storageRef);
      console.log('Download URL obtained:', downloadURL);

      // Update edit data with new image URL
      setEditData((prev) => ({
        ...prev,
        photoURL: downloadURL,
      }));

      Alert.alert('Thành công', 'Đã tải lên ảnh thành công!');
    } catch (error) {
      console.error('Error uploading image:', error);

      // Try fallback method with base64
      try {
        console.log('Trying fallback method with base64...');
        await uploadImageFallback(uri);
        return;
      } catch (fallbackError) {
        console.error('Fallback method also failed:', fallbackError);
      }

      // More specific error messages
      let errorMessage = 'Không thể tải lên ảnh';
      if (error.code === 'storage/unauthorized') {
        errorMessage = 'Không có quyền truy cập Firebase Storage';
      } else if (error.code === 'storage/canceled') {
        errorMessage = 'Upload bị hủy';
      } else if (error.code === 'storage/unknown') {
        errorMessage =
          'Lỗi không xác định từ Firebase Storage. Có thể do mạng hoặc cấu hình.';
      } else if (error.message.includes('fetch')) {
        errorMessage = 'Không thể đọc file ảnh';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Upload quá lâu, vui lòng thử lại';
      }

      Alert.alert(
        'Lỗi Upload',
        errorMessage +
          '\n\nChi tiết: ' +
          error.message +
          '\n\nGợi ý: Kiểm tra kết nối mạng và thử lại'
      );
    } finally {
      setUploadingImage(false);
    }
  };

  // Fallback method: Save image as base64 directly to Firestore
  const uploadImageFallback = async (uri) => {
    try {
      console.log('Using fallback method: base64 storage');

      // Convert image to base64
      const response = await fetch(uri);
      const blob = await response.blob();

      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const base64Data = await base64Promise;
      console.log('Base64 conversion successful, length:', base64Data.length);

      // Update edit data with base64 image
      setEditData((prev) => ({
        ...prev,
        photoURL: base64Data,
      }));

      Alert.alert('Thành công', 'Đã lưu ảnh thành công (phương án dự phòng)!');
    } catch (error) {
      console.error('Fallback method failed:', error);
      throw error;
    }
  };

  // Render user item in list
  const renderUserItem = ({ item }) => {
    const isCurrentUser = item.id === currentUser?.uid;

    return (
      <TouchableOpacity
        style={[styles.userCard, { backgroundColor: theme.card }]}
        onPress={() => handleEditUser(item)}
      >
        <View style={styles.userCardLeft}>
          {item.photoURL ? (
            <Image source={{ uri: item.photoURL }} style={styles.avatar} />
          ) : (
            <View
              style={[
                styles.avatarPlaceholder,
                { backgroundColor: theme.primaryLight },
              ]}
            >
              <Text style={[styles.avatarText, { color: theme.primary }]}>
                {(item.displayName || item.email || '?')[0].toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.userCardMiddle}>
          <Text style={[styles.userName, { color: theme.text }]}>
            {item.displayName || item.email || 'Không có tên'}
            {isCurrentUser && ' (Bạn)'}
          </Text>
          <Text style={[styles.userRole, { color: theme.textSecondary }]}>
            {getRoleLabel(item.role)}
          </Text>
          {item.dailySalary && (
            <Text style={[styles.userSalary, { color: theme.textMuted }]}>
              Lương ngày: {formatCurrency(item.dailySalary)} VND
            </Text>
          )}
          {item.monthlySalary && ( // Added monthlySalary display
            <Text style={[styles.userSalary, { color: theme.textMuted }]}>
              Lương tháng: {formatCurrency(item.monthlySalary)} VND
            </Text>
          )}
        </View>

        <View style={styles.userCardRight}>
          <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
        </View>
      </TouchableOpacity>
    );
  };

  // Helper function to get role label
  const getRoleLabel = (role) => {
    const option = roleOptions.find((o) => o.value === role);
    return option ? option.label : 'Người dùng';
  };

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('vi-VN').format(value);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Quản lý Nhân viên
        </Text>
      </View>

      {/* User list */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Đang tải danh sách người dùng...
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUserItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people" size={40} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                Không có người dùng nào
              </Text>
            </View>
          }
        />
      )}

      {/* Edit user modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Chỉnh sửa thông tin
              </Text>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView}>
              {/* Profile image */}
              <View style={styles.profileImageContainer}>
                {uploadingImage ? (
                  <ActivityIndicator size="large" color={theme.primary} />
                ) : editData.photoURL ? (
                  <Image
                    source={{ uri: editData.photoURL }}
                    style={styles.profileImage}
                  />
                ) : (
                  <View
                    style={[
                      styles.profileImagePlaceholder,
                      { backgroundColor: theme.primaryLight },
                    ]}
                  >
                    <Text
                      style={[
                        styles.profileImageText,
                        { color: theme.primary },
                      ]}
                    >
                      {(editData.displayName || '?')[0].toUpperCase()}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.changePhotoButton,
                    { backgroundColor: theme.primary },
                  ]}
                  onPress={pickImage}
                >
                  <Ionicons name="camera" size={18} color="#fff" />
                  <Text style={styles.changePhotoText}>Đổi ảnh</Text>
                </TouchableOpacity>
              </View>

              {/* Form fields */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Tên</Text>
                <TextInput
                  style={[
                    styles.input,
                    { borderColor: theme.border, color: theme.text },
                  ]}
                  value={editData.displayName}
                  onChangeText={(text) =>
                    setEditData((prev) => ({ ...prev, displayName: text }))
                  }
                  placeholder="Tên người dùng"
                  placeholderTextColor={theme.textMuted}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Email</Text>
                <TextInput
                  style={[
                    styles.input,
                    { borderColor: theme.border, color: theme.text },
                  ]}
                  value={editData.email}
                  onChangeText={(text) =>
                    setEditData((prev) => ({ ...prev, email: text }))
                  }
                  placeholder="Email"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.text }]}>
                  Vai trò
                </Text>
                <View
                  style={[
                    styles.pickerContainer,
                    { borderColor: theme.border },
                  ]}
                >
                  {roleOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.roleOption,
                        editData.role === option.value && [
                          styles.selectedRole,
                          { backgroundColor: theme.primary + '20' },
                        ],
                      ]}
                      onPress={() =>
                        setEditData((prev) => ({ ...prev, role: option.value }))
                      }
                    >
                      <Text
                        style={[
                          styles.roleOptionText,
                          { color: theme.text },
                          editData.role === option.value && {
                            color: theme.primary,
                            fontWeight: '600',
                          },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.text }]}>
                  Lương theo ngày (VND)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    { borderColor: theme.border, color: theme.text },
                  ]}
                  value={editData.dailySalary} // Changed from monthlySalary
                  onChangeText={(text) => {
                    // Only allow numbers
                    const filtered = text.replace(/[^0-9]/g, '');
                    setEditData((prev) => ({
                      ...prev,
                      dailySalary: filtered, // Changed from monthlySalary
                    }));
                  }}
                  placeholder="Lương theo ngày"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.text }]}>
                  Lương cố định (tháng, VND)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    { borderColor: theme.border, color: theme.text },
                  ]}
                  value={editData.monthlySalary}
                  onChangeText={(text) => {
                    const filtered = text.replace(/[^0-9]/g, '');
                    setEditData((prev) => ({
                      ...prev,
                      monthlySalary: filtered,
                    }));
                  }}
                  placeholder="Lương cố định nguyên tháng"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.text }]}>
                  Số điện thoại
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    { borderColor: theme.border, color: theme.text },
                  ]}
                  value={editData.phoneNumber}
                  onChangeText={(text) =>
                    setEditData((prev) => ({ ...prev, phoneNumber: text }))
                  }
                  placeholder="Số điện thoại"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.text }]}>
                  Địa chỉ
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    { borderColor: theme.border, color: theme.text },
                  ]}
                  value={editData.address}
                  onChangeText={(text) =>
                    setEditData((prev) => ({ ...prev, address: text }))
                  }
                  placeholder="Địa chỉ"
                  placeholderTextColor={theme.textMuted}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.text }]}>
                  Ghi chú
                </Text>
                <TextInput
                  style={[
                    styles.textArea,
                    { borderColor: theme.border, color: theme.text },
                  ]}
                  value={editData.notes}
                  onChangeText={(text) =>
                    setEditData((prev) => ({ ...prev, notes: text }))
                  }
                  placeholder="Ghi chú"
                  placeholderTextColor={theme.textMuted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: theme.border }]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={{ color: theme.text }}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.primary }]}
                onPress={saveUserChanges}
                disabled={savingUser}
              >
                {savingUser ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Lưu thay đổi</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    elevation: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
  },
  listContent: {
    padding: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
  },
  userCard: {
    flexDirection: 'row',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  userCardLeft: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  userCardMiddle: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 14,
    marginBottom: 2,
  },
  userSalary: {
    fontSize: 12,
  },
  userCardRight: {
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '90%',
    borderRadius: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  modalScrollView: {
    padding: 16,
  },
  profileImageContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  profileImageText: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  changePhotoText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: '500',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    height: 100,
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 6,
  },
  roleOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginBottom: 2,
  },
  selectedRole: {
    fontWeight: 'bold',
  },
  roleOptionText: {
    fontSize: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  cancelButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 12,
  },
  saveButton: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default UserManagementScreen;
