//src/screens/AddProjectScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { createProject } from '../api/projectService';
import { getCustomers } from '../api/customerService';
import { useAuth } from '../contexts/AuthContext';
import { functions } from '../config/firebaseConfig';
import { httpsCallable } from 'firebase/functions';

const AddProjectScreen = ({ navigation }) => {
  const { currentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState([]);

  // Thêm state cho date picker
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    customerId: '',
    customerName: '',
    status: 'pending',
    startDate: null,
    endDate: null,
    durationInDays: '',
    location: 'workshop', // 'workshop' (tại xưởng) hoặc 'site' (tại công trình)
    budget: '',
    notes: '',
  });

  // Lấy danh sách khách hàng khi màn hình được tải
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoadingCustomers(true);
        const data = await getCustomers();
        setCustomers(data);
        setFilteredCustomers(data);
      } catch (error) {
        console.error('Lỗi khi lấy danh sách khách hàng:', error);
        Alert.alert('Lỗi', 'Không thể tải danh sách khách hàng');
      } finally {
        setLoadingCustomers(false);
      }
    };

    fetchCustomers();
  }, []);

  // Lọc danh sách khách hàng khi từ khóa tìm kiếm thay đổi
  useEffect(() => {
    if (!customerSearchQuery.trim()) {
      setFilteredCustomers(customers);
      return;
    }

    const query = customerSearchQuery.toLowerCase().trim();
    const filtered = customers.filter((customer) => {
      const name = (customer.name || '').toLowerCase();
      const contact = (customer.contactPerson || '').toLowerCase();
      const email = (customer.email || '').toLowerCase();

      return (
        name.includes(query) || contact.includes(query) || email.includes(query)
      );
    });

    setFilteredCustomers(filtered);
  }, [customerSearchQuery, customers]);

  // Cập nhật giá trị form
  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Xử lý khi chọn ngày bắt đầu
  const handleStartDateChange = (event, selectedDate) => {
    setShowStartDatePicker(false);
    if (selectedDate) {
      handleChange('startDate', selectedDate);

      // Tự động tính ngày kết thúc nếu có số ngày thi công
      if (formData.durationInDays) {
        const endDate = new Date(selectedDate);
        endDate.setDate(endDate.getDate() + Number(formData.durationInDays));
        handleChange('endDate', endDate);
      }
    }
  };

  // Xử lý khi nhập số ngày thi công
  const handleDurationChange = (text) => {
    handleChange('durationInDays', text);

    // Tự động tính ngày kết thúc nếu có ngày bắt đầu
    if (formData.startDate && text) {
      const endDate = new Date(formData.startDate);
      endDate.setDate(endDate.getDate() + Number(text));
      handleChange('endDate', endDate);
    }
  };

  // Xử lý khi chọn vị trí
  const handleLocationChange = (location) => {
    handleChange('location', location);
  };

  // Định dạng ngày để hiển thị
  const formatDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString('vi-VN');
  };

  // Kiểm tra form hợp lệ
  const validateForm = () => {
    if (!formData.name.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên dự án');
      return false;
    }

    return true;
  };

  // Xử lý lưu dự án
  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // Chuẩn bị dữ liệu để lưu
      const projectData = {
        ...formData,
        budget: formData.budget ? Number(formData.budget) : null,
        durationInDays: formData.durationInDays
          ? Number(formData.durationInDays)
          : null,
      };

      // Gọi API tạo dự án mới
      const projectId = await createProject(projectData, currentUser?.uid);

      // Sau khi tạo dự án thành công, gọi hàm tạo folder
      if (projectId) {
        try {
          const createFoldersFn = httpsCallable(
            functions,
            'createProjectFolders'
          );
          await createFoldersFn({ projectId });
        } catch (folderError) {
          // Log lỗi nhưng không chặn người dùng
          console.error('Lỗi khi tạo thư mục dự án trên Drive:', folderError);
          Alert.alert(
            'Tạo dự án thành công',
            'Dự án đã được tạo, nhưng có lỗi xảy ra khi tạo thư mục trên Google Drive. Bạn có thể thử lại sau.'
          );
        }
      }

      Alert.alert(
        'Thành công',
        'Đã thêm dự án mới và tạo thư mục thành công!',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      if (error.code === 'permission-denied') {
        Alert.alert(
          'Lỗi quyền',
          'Bạn không có đủ quyền để thực hiện hành động này.'
        );
      } else {
        console.error('Lỗi khi thêm dự án:', error);
        Alert.alert('Lỗi', 'Không thể thêm dự án. Vui lòng thử lại sau.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Xử lý thay đổi trạng thái dự án
  const handleSelectStatus = (status) => {
    handleChange('status', status);
  };

  // Xử lý mở modal chọn khách hàng
  const handleOpenCustomerModal = () => {
    setCustomerModalVisible(true);
  };

  // Xử lý đóng modal chọn khách hàng
  const handleCloseCustomerModal = () => {
    setCustomerModalVisible(false);
    setCustomerSearchQuery('');
  };

  // Xử lý khi chọn khách hàng
  const handleSelectCustomer = (customer) => {
    setFormData((prev) => ({
      ...prev,
      customerId: customer.id,
      customerName: customer.name,
    }));
    handleCloseCustomerModal();
  };

  // Xử lý khi tìm kiếm khách hàng
  const handleSearchCustomer = (text) => {
    setCustomerSearchQuery(text);
  };

  // Xử lý khi xóa khách hàng đã chọn
  const handleClearCustomer = () => {
    setFormData((prev) => ({
      ...prev,
      customerId: '',
      customerName: '',
    }));
  };

  // Render một item trong danh sách khách hàng
  const renderCustomerItem = ({ item }) => (
    <TouchableOpacity
      style={styles.customerItem}
      onPress={() => handleSelectCustomer(item)}
    >
      <View>
        <Text style={styles.customerName}>{item.name}</Text>
        {item.contactPerson && (
          <Text style={styles.customerDetail}>
            Người liên hệ: {item.contactPerson}
          </Text>
        )}
        {item.email && (
          <Text style={styles.customerDetail}>Email: {item.email}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#999" />
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thêm dự án mới</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.formContainer}
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Tên dự án <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={formData.name}
            onChangeText={(text) => handleChange('name', text)}
            placeholder="Nhập tên dự án"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Mô tả</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.description}
            onChangeText={(text) => handleChange('description', text)}
            placeholder="Nhập mô tả dự án"
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Khách hàng</Text>
          {formData.customerName ? (
            <View style={styles.selectedCustomerContainer}>
              <View style={styles.selectedCustomer}>
                <Ionicons name="business-outline" size={20} color="#0066cc" />
                <Text style={styles.selectedCustomerText}>
                  {formData.customerName}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.clearCustomerButton}
                onPress={handleClearCustomer}
              >
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.customerSelectButton}
              onPress={handleOpenCustomerModal}
            >
              <Ionicons name="add-circle-outline" size={20} color="#0066cc" />
              <Text style={styles.customerSelectButtonText}>
                Chọn khách hàng
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Trạng thái</Text>
          <View style={styles.statusButtonsContainer}>
            <TouchableOpacity
              style={[
                styles.statusButton,
                formData.status === 'pending' && styles.selectedStatusButton,
              ]}
              onPress={() => handleSelectStatus('pending')}
            >
              <Text
                style={[
                  styles.statusButtonText,
                  formData.status === 'pending' &&
                    styles.selectedStatusButtonText,
                ]}
              >
                Chờ xử lý
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.statusButton,
                formData.status === 'in-progress' &&
                  styles.selectedStatusButton,
              ]}
              onPress={() => handleSelectStatus('in-progress')}
            >
              <Text
                style={[
                  styles.statusButtonText,
                  formData.status === 'in-progress' &&
                    styles.selectedStatusButtonText,
                ]}
              >
                Đang thực hiện
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.statusButton,
                formData.status === 'completed' && styles.selectedStatusButton,
              ]}
              onPress={() => handleSelectStatus('completed')}
            >
              <Text
                style={[
                  styles.statusButtonText,
                  formData.status === 'completed' &&
                    styles.selectedStatusButtonText,
                ]}
              >
                Hoàn thành
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.statusButtonsContainer, { marginTop: 8 }]}>
            <TouchableOpacity
              style={[
                styles.statusButton,
                formData.status === 'cancelled' && styles.selectedStatusButton,
              ]}
              onPress={() => handleSelectStatus('cancelled')}
            >
              <Text
                style={[
                  styles.statusButtonText,
                  formData.status === 'cancelled' &&
                    styles.selectedStatusButtonText,
                ]}
              >
                Đã hủy
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Thêm trường ngày bắt đầu */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Ngày bắt đầu</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowStartDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color="#0066cc" />
            <Text style={styles.dateButtonText}>
              {formData.startDate
                ? formatDate(formData.startDate)
                : 'Chọn ngày bắt đầu'}
            </Text>
          </TouchableOpacity>
          {showStartDatePicker && (
            <DateTimePicker
              value={formData.startDate || new Date()}
              mode="date"
              display="default"
              onChange={handleStartDateChange}
            />
          )}
        </View>

        {/* Thêm trường số ngày thi công */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Số ngày thi công</Text>
          <TextInput
            style={styles.input}
            value={formData.durationInDays}
            onChangeText={handleDurationChange}
            placeholder="Nhập số ngày thi công"
            keyboardType="numeric"
          />
        </View>

        {/* Hiển thị ngày kết thúc (chỉ đọc) */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Ngày kết thúc (tự động tính)</Text>
          <View style={styles.readOnlyField}>
            <Ionicons name="calendar-outline" size={20} color="#666" />
            <Text style={styles.readOnlyText}>
              {formData.endDate
                ? formatDate(formData.endDate)
                : 'Chưa xác định'}
            </Text>
          </View>
        </View>

        {/* Thêm trường vị trí */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Vị trí thi công</Text>
          <View style={styles.locationButtonsContainer}>
            <TouchableOpacity
              style={[
                styles.locationButton,
                formData.location === 'workshop' &&
                  styles.selectedLocationButton,
              ]}
              onPress={() => handleLocationChange('workshop')}
            >
              <Text
                style={[
                  styles.locationButtonText,
                  formData.location === 'workshop' &&
                    styles.selectedLocationButtonText,
                ]}
              >
                Tại xưởng
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.locationButton,
                formData.location === 'site' && styles.selectedLocationButton,
              ]}
              onPress={() => handleLocationChange('site')}
            >
              <Text
                style={[
                  styles.locationButtonText,
                  formData.location === 'site' &&
                    styles.selectedLocationButtonText,
                ]}
              >
                Tại công trình
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Ngân sách</Text>
          <TextInput
            style={styles.input}
            value={formData.budget}
            onChangeText={(text) => handleChange('budget', text)}
            placeholder="Nhập ngân sách dự án"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Ghi chú</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.notes}
            onChangeText={(text) => handleChange('notes', text)}
            placeholder="Nhập ghi chú"
            multiline
            numberOfLines={3}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Lưu dự án</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Modal chọn khách hàng */}
      <Modal
        visible={customerModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseCustomerModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn khách hàng</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleCloseCustomerModal}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <Ionicons
                name="search"
                size={20}
                color="#999"
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Tìm kiếm khách hàng..."
                value={customerSearchQuery}
                onChangeText={handleSearchCustomer}
              />
              {customerSearchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setCustomerSearchQuery('')}
                  style={styles.clearSearchButton}
                >
                  <Ionicons name="close-circle" size={18} color="#999" />
                </TouchableOpacity>
              )}
            </View>

            {loadingCustomers ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0066cc" />
                <Text style={styles.loadingText}>
                  Đang tải danh sách khách hàng...
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredCustomers}
                keyExtractor={(item) => item.id}
                renderItem={renderCustomerItem}
                contentContainerStyle={styles.customersList}
                ListEmptyComponent={() => (
                  <View style={styles.emptyListContainer}>
                    <Ionicons name="search-outline" size={40} color="#ccc" />
                    <Text style={styles.emptyListText}>
                      Không tìm thấy khách hàng phù hợp
                    </Text>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 24,
  },
  formContainer: {
    flex: 1,
  },
  formContent: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
    color: '#333',
  },
  required: {
    color: '#e74c3c',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  statusButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusButton: {
    flex: 1,
    backgroundColor: '#f1f1f1',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  selectedStatusButton: {
    backgroundColor: '#0066cc',
  },
  statusButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  selectedStatusButtonText: {
    color: '#fff',
  },
  // Thêm style cho các trường mới
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f1f1',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  locationButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  locationButton: {
    flex: 1,
    backgroundColor: '#f1f1f1',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  selectedLocationButton: {
    backgroundColor: '#0066cc',
  },
  locationButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  selectedLocationButtonText: {
    color: '#fff',
  },
  customerSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f1f1',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  customerSelectButtonText: {
    fontSize: 16,
    color: '#0066cc',
    marginLeft: 8,
  },
  selectedCustomerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f1f1f1',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  selectedCustomer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedCustomerText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  clearCustomerButton: {
    padding: 4,
  },
  footer: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  saveButton: {
    backgroundColor: '#0066cc',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    height: '80%',
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
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f1f1',
    margin: 16,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  clearSearchButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  customersList: {
    padding: 16,
    paddingTop: 0,
  },
  customerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  customerDetail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  emptyListContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyListText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  readOnlyField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f1f1',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  readOnlyText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
});

export default AddProjectScreen;
