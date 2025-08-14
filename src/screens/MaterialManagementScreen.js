import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  getMaterials,
  addMaterial,
  updateMaterial,
  deleteMaterial,
} from '../api/materialService';
import {
  getFixedCosts,
  addFixedCost,
  updateFixedCost,
  deleteFixedCost,
} from '../api/fixedCostService';

const MaterialManagementScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { user: currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState('materials'); // 'materials' or 'fixedCosts'
  const [materials, setMaterials] = useState([]);
  const [fixedCosts, setFixedCosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    pricePerKg: '',
    monthlyCost: '',
    description: '',
  });

  // Kiểm tra quyền truy cập
  const hasAccess = ['thuong_mai', 'giam_doc', 'ke_toan', 'ky_su'].includes(
    currentUser?.role
  );

  useEffect(() => {
    if (hasAccess) {
      loadData();
    }
  }, [hasAccess, activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'materials') {
        const materialsData = await getMaterials();
        setMaterials(materialsData);
      } else {
        const fixedCostsData = await getFixedCosts();
        setFixedCosts(fixedCostsData);
      }
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu:', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      pricePerKg: '',
      monthlyCost: '',
      description: '',
    });
    setEditingItem(null);
  };

  const openAddModal = () => {
    setEditingItem(null);
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name || '',
      pricePerKg: item.pricePerKg?.toString() || '',
      monthlyCost: item.monthlyCost?.toString() || '',
      description: item.description || '',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên');
      return;
    }

    if (activeTab === 'materials') {
      if (!formData.pricePerKg || Number(formData.pricePerKg) <= 0) {
        Alert.alert('Lỗi', 'Vui lòng nhập giá hợp lệ');
        return;
      }
    } else {
      if (!formData.monthlyCost || Number(formData.monthlyCost) <= 0) {
        Alert.alert('Lỗi', 'Vui lòng nhập chi phí hàng tháng hợp lệ');
        return;
      }
    }

    try {
      if (activeTab === 'materials') {
        const materialData = {
          name: formData.name.trim(),
          pricePerKg: Number(formData.pricePerKg),
          description: formData.description.trim(),
        };

        if (editingItem) {
          await updateMaterial(editingItem.id, materialData, currentUser.uid);
          Alert.alert('Thành công', 'Cập nhật vật liệu thành công');
        } else {
          await addMaterial(materialData, currentUser.uid);
          Alert.alert('Thành công', 'Thêm vật liệu thành công');
        }
      } else {
        const fixedCostData = {
          name: formData.name.trim(),
          monthlyCost: Number(formData.monthlyCost),
          description: formData.description.trim(),
        };

        if (editingItem) {
          await updateFixedCost(editingItem.id, fixedCostData, currentUser.uid);
          Alert.alert('Thành công', 'Cập nhật chi phí cố định thành công');
        } else {
          await addFixedCost(fixedCostData, currentUser.uid);
          Alert.alert('Thành công', 'Thêm chi phí cố định thành công');
        }
      }

      setModalVisible(false);
      loadData();
    } catch (error) {
      console.error('Lỗi khi lưu dữ liệu:', error);
      Alert.alert('Lỗi', 'Không thể lưu dữ liệu. Vui lòng thử lại.');
    }
  };

  const handleDelete = (item) => {
    const itemType = activeTab === 'materials' ? 'vật liệu' : 'chi phí cố định';
    Alert.alert(
      'Xác nhận xóa',
      `Bạn có chắc chắn muốn xóa ${itemType} "${item.name}"?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              if (activeTab === 'materials') {
                await deleteMaterial(item.id);
                Alert.alert('Thành công', 'Xóa vật liệu thành công');
              } else {
                await deleteFixedCost(item.id);
                Alert.alert('Thành công', 'Xóa chi phí cố định thành công');
              }
              loadData();
            } catch (error) {
              console.error('Lỗi khi xóa dữ liệu:', error);
              Alert.alert('Lỗi', 'Không thể xóa dữ liệu. Vui lòng thử lại.');
            }
          },
        },
      ]
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const renderMaterialItem = ({ item }) => (
    <View
      style={[
        styles.materialCard,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <View style={styles.materialInfo}>
        <Text style={[styles.materialName, { color: theme.text }]}>
          {item.name}
        </Text>
        {item.description && (
          <Text
            style={[styles.materialDescription, { color: theme.textSecondary }]}
          >
            {item.description}
          </Text>
        )}
        <Text style={[styles.materialPrice, { color: theme.primary }]}>
          {formatCurrency(item.pricePerKg)}/kg
        </Text>
      </View>
      <View style={styles.materialActions}>
        <TouchableOpacity
          onPress={() => openEditModal(item)}
          style={[styles.actionButton, { backgroundColor: theme.primary }]}
        >
          <Ionicons name="pencil" size={16} color="white" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDelete(item)}
          style={[styles.actionButton, { backgroundColor: '#ff4444' }]}
        >
          <Ionicons name="trash" size={16} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFixedCostItem = ({ item }) => (
    <View
      style={[
        styles.materialCard,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <View style={styles.materialInfo}>
        <Text style={[styles.materialName, { color: theme.text }]}>
          {item.name}
        </Text>
        {item.description && (
          <Text
            style={[styles.materialDescription, { color: theme.textSecondary }]}
          >
            {item.description}
          </Text>
        )}
        <Text style={[styles.materialPrice, { color: theme.primary }]}>
          {formatCurrency(item.monthlyCost)}/tháng
        </Text>
      </View>
      <View style={styles.materialActions}>
        <TouchableOpacity
          onPress={() => openEditModal(item)}
          style={[styles.actionButton, { backgroundColor: theme.primary }]}
        >
          <Ionicons name="pencil" size={16} color="white" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDelete(item)}
          style={[styles.actionButton, { backgroundColor: '#ff4444' }]}
        >
          <Ionicons name="trash" size={16} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!hasAccess) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <StatusBar
          barStyle={theme.dark ? 'light-content' : 'dark-content'}
          backgroundColor={theme.background}
        />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Quản lý vật liệu
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.accessDenied}>
          <Ionicons name="lock-closed" size={60} color={theme.textMuted} />
          <Text
            style={[styles.accessDeniedText, { color: theme.textSecondary }]}
          >
            Bạn không có quyền truy cập tính năng này
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <StatusBar
        barStyle={theme.dark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Quản lý chi phí cố định
        </Text>
        <TouchableOpacity onPress={openAddModal}>
          <Ionicons name="add" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabContainer, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'materials' && { borderBottomColor: theme.primary },
          ]}
          onPress={() => setActiveTab('materials')}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === 'materials'
                    ? theme.primary
                    : theme.textSecondary,
              },
            ]}
          >
            Vật liệu
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'fixedCosts' && { borderBottomColor: theme.primary },
          ]}
          onPress={() => setActiveTab('fixedCosts')}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === 'fixedCosts'
                    ? theme.primary
                    : theme.textSecondary,
              },
            ]}
          >
            Chi phí cố định
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Đang tải...
          </Text>
        </View>
      ) : (
        <FlatList
          data={activeTab === 'materials' ? materials : fixedCosts}
          renderItem={
            activeTab === 'materials' ? renderMaterialItem : renderFixedCostItem
          }
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name={
                  activeTab === 'materials'
                    ? 'cube-outline'
                    : 'calculator-outline'
                }
                size={60}
                color={theme.textMuted}
              />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {activeTab === 'materials'
                  ? 'Chưa có vật liệu nào'
                  : 'Chưa có chi phí cố định nào'}
              </Text>
              <TouchableOpacity
                onPress={openAddModal}
                style={[styles.addButton, { backgroundColor: theme.primary }]}
              >
                <Text style={styles.addButtonText}>
                  {activeTab === 'materials'
                    ? 'Thêm vật liệu đầu tiên'
                    : 'Thêm chi phí cố định đầu tiên'}
                </Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Modal thêm/sửa vật liệu */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {editingItem
                  ? activeTab === 'materials'
                    ? 'Sửa vật liệu'
                    : 'Sửa chi phí cố định'
                  : activeTab === 'materials'
                  ? 'Thêm vật liệu mới'
                  : 'Thêm chi phí cố định mới'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.text }]}>
                {activeTab === 'materials'
                  ? 'Tên vật liệu *'
                  : 'Tên chi phí cố định *'}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.background,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={formData.name}
                onChangeText={(text) =>
                  setFormData({ ...formData, name: text })
                }
                placeholder={
                  activeTab === 'materials'
                    ? 'Ví dụ: SUS304, SS400'
                    : 'Ví dụ: Điện, Nước, Mặt bằng'
                }
                placeholderTextColor={theme.textMuted}
              />
            </View>

            {activeTab === 'materials' ? (
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.text }]}>
                  Giá/kg (VNĐ) *
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.background,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  value={formData.pricePerKg}
                  onChangeText={(text) =>
                    setFormData({
                      ...formData,
                      pricePerKg: text.replace(/[^0-9]/g, ''),
                    })
                  }
                  placeholder="Nhập giá/kg"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="numeric"
                />
              </View>
            ) : (
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.text }]}>
                  Chi phí hàng tháng (VNĐ) *
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.background,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  value={formData.monthlyCost}
                  onChangeText={(text) =>
                    setFormData({
                      ...formData,
                      monthlyCost: text.replace(/[^0-9]/g, ''),
                    })
                  }
                  placeholder="Nhập chi phí hàng tháng"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="numeric"
                />
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Mô tả</Text>
              <TextInput
                style={[
                  styles.textArea,
                  {
                    backgroundColor: theme.background,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={formData.description}
                onChangeText={(text) =>
                  setFormData({ ...formData, description: text })
                }
                placeholder={
                  activeTab === 'materials'
                    ? 'Mô tả thêm về vật liệu...'
                    : 'Mô tả thêm về chi phí cố định...'
                }
                placeholderTextColor={theme.textMuted}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={[styles.modalButton, { borderColor: theme.border }]}
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>
                  Hủy
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                style={[styles.modalButton, { backgroundColor: theme.primary }]}
              >
                <Text style={[styles.modalButtonText, { color: 'white' }]}>
                  {editingItem ? 'Cập nhật' : 'Thêm'}
                </Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  listContainer: {
    padding: 16,
  },
  materialCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  materialInfo: {
    flex: 1,
  },
  materialName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  materialDescription: {
    fontSize: 14,
    marginBottom: 4,
  },
  materialPrice: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  materialActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
    marginBottom: 20,
    textAlign: 'center',
  },
  addButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  accessDeniedText: {
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MaterialManagementScreen;
