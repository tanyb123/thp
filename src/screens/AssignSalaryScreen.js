// src/screens/AssignSalaryScreen.js
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
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

const AssignSalaryScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editData, setEditData] = useState({
    displayName: '',
    dailySalary: '',
    monthlySalary: '',
    salaryType: 'daily', // 'daily' or 'monthly'
  });
  const [savingUser, setSavingUser] = useState(false);

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

  // Handle user selection for editing salary
  const handleEditSalary = (user) => {
    setSelectedUser(user);

    // Determine salary type based on existing data
    let salaryType = 'daily';
    if (user.monthlySalary && (!user.dailySalary || user.monthlySalary > 0)) {
      salaryType = 'monthly';
    }

    setEditData({
      displayName: user.displayName || '',
      dailySalary: user.dailySalary ? String(user.dailySalary) : '',
      monthlySalary: user.monthlySalary ? String(user.monthlySalary) : '',
      salaryType: salaryType,
    });
    setEditModalVisible(true);
  };

  // Save salary changes
  const saveSalaryChanges = async () => {
    if (!selectedUser) return;

    try {
      // Validate salary inputs
      if (editData.salaryType === 'daily' && !editData.dailySalary) {
        Alert.alert('Lỗi', 'Vui lòng nhập lương theo ngày');
        return;
      }

      if (editData.salaryType === 'monthly' && !editData.monthlySalary) {
        Alert.alert('Lỗi', 'Vui lòng nhập lương cố định theo tháng');
        return;
      }

      setSavingUser(true);

      // Set salary data based on selected type
      const salaryData = {
        dailySalary:
          editData.salaryType === 'daily'
            ? parseFloat(editData.dailySalary)
            : null,
        monthlySalary:
          editData.salaryType === 'monthly'
            ? parseFloat(editData.monthlySalary)
            : null,
      };

      // Update user in Firestore
      const userRef = doc(db, 'users', selectedUser.id);
      await updateDoc(userRef, salaryData);

      // Update local state
      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u.id === selectedUser.id ? { ...u, ...salaryData } : u
        )
      );

      // Close modal
      setEditModalVisible(false);
      setSelectedUser(null);
      Alert.alert('Thành công', 'Đã cập nhật lương cho nhân viên');
    } catch (error) {
      console.error('Error updating salary:', error);
      Alert.alert('Lỗi', 'Không thể cập nhật lương');
    } finally {
      setSavingUser(false);
    }
  };

  // Toggle salary type
  const toggleSalaryType = () => {
    setEditData((prev) => ({
      ...prev,
      salaryType: prev.salaryType === 'daily' ? 'monthly' : 'daily',
    }));
  };

  // Render user item in list
  const renderUserItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.userCard, { backgroundColor: theme.card }]}
      onPress={() => handleEditSalary(item)}
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
              {(item.displayName || '?')[0].toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.userCardMiddle}>
        <Text style={[styles.userName, { color: theme.text }]}>
          {item.displayName || 'Không có tên'}
        </Text>
        {item.dailySalary && (
          <Text style={[styles.userSalary, { color: theme.textMuted }]}>
            Lương ngày: {formatCurrency(item.dailySalary)} VND
          </Text>
        )}
        {item.monthlySalary && (
          <Text style={[styles.userSalary, { color: theme.textMuted }]}>
            Lương tháng: {formatCurrency(item.monthlySalary)} VND
          </Text>
        )}
      </View>
      <View style={styles.userCardRight}>
        <Ionicons name="cash-outline" size={20} color={theme.textMuted} />
      </View>
    </TouchableOpacity>
  );

  const formatCurrency = (value) =>
    new Intl.NumberFormat('vi-VN').format(value);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={[styles.header, { backgroundColor: theme.card }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Gán Lương Nhân Viên
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUserItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}

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
                Cập nhật lương cho {editData.displayName}
              </Text>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView}>
              <View style={styles.salaryTypeSelector}>
                <Text style={[styles.label, { color: theme.text }]}>
                  Loại lương:
                </Text>
                <View style={styles.salaryTypeOptions}>
                  <TouchableOpacity
                    style={[
                      styles.salaryTypeOption,
                      editData.salaryType === 'daily' &&
                        styles.salaryTypeOptionActive,
                      { borderColor: theme.border },
                    ]}
                    onPress={() =>
                      setEditData((prev) => ({ ...prev, salaryType: 'daily' }))
                    }
                  >
                    <Text
                      style={[
                        styles.salaryTypeText,
                        editData.salaryType === 'daily' && {
                          color: theme.primary,
                          fontWeight: 'bold',
                        },
                      ]}
                    >
                      Lương theo ngày
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.salaryTypeOption,
                      editData.salaryType === 'monthly' &&
                        styles.salaryTypeOptionActive,
                      { borderColor: theme.border },
                    ]}
                    onPress={() =>
                      setEditData((prev) => ({
                        ...prev,
                        salaryType: 'monthly',
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.salaryTypeText,
                        editData.salaryType === 'monthly' && {
                          color: theme.primary,
                          fontWeight: 'bold',
                        },
                      ]}
                    >
                      Lương cố định tháng
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {editData.salaryType === 'daily' && (
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: theme.text }]}>
                    Lương theo ngày (VND)
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      { borderColor: theme.border, color: theme.text },
                    ]}
                    value={editData.dailySalary}
                    onChangeText={(text) =>
                      setEditData((prev) => ({
                        ...prev,
                        dailySalary: text.replace(/[^0-9]/g, ''),
                      }))
                    }
                    placeholder="Nhập lương theo ngày"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="numeric"
                  />
                  {editData.dailySalary && (
                    <Text style={styles.formattedSalary}>
                      {formatCurrency(editData.dailySalary)} VND
                    </Text>
                  )}
                </View>
              )}

              {editData.salaryType === 'monthly' && (
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
                    onChangeText={(text) =>
                      setEditData((prev) => ({
                        ...prev,
                        monthlySalary: text.replace(/[^0-9]/g, ''),
                      }))
                    }
                    placeholder="Nhập lương cố định"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="numeric"
                  />
                  {editData.monthlySalary && (
                    <Text style={styles.formattedSalary}>
                      {formatCurrency(editData.monthlySalary)} VND
                    </Text>
                  )}
                </View>
              )}
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
                onPress={saveSalaryChanges}
                disabled={savingUser}
              >
                {savingUser ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Lưu</Text>
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
  container: { flex: 1 },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  backButton: { padding: 4 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 12 },
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
  userCardLeft: { marginRight: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: 'bold' },
  userCardMiddle: { flex: 1, justifyContent: 'center' },
  userName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  userSalary: { fontSize: 12 },
  userCardRight: { justifyContent: 'center', paddingHorizontal: 8 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '70%',
    borderRadius: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', flex: 1 },
  closeButton: { padding: 4 },
  modalScrollView: { padding: 16 },
  formGroup: { marginBottom: 16 },
  label: { marginBottom: 6, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
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
  saveButtonText: { color: '#fff', fontWeight: '600' },
  salaryTypeSelector: {
    marginBottom: 20,
  },
  salaryTypeOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  salaryTypeOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  salaryTypeOptionActive: {
    borderWidth: 2,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  salaryTypeText: {
    fontSize: 14,
  },
  formattedSalary: {
    marginTop: 4,
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
});

export default AssignSalaryScreen;
