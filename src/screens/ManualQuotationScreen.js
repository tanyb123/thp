import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import SearchInventoryModal from '../components/SearchInventoryModal';

const MATERIAL_OPTIONS = ['SUS304', 'SS400', 'SUS316', 'SUS304 2B', 'Khác'];

const UNIT_OPTIONS = ['Cái', 'Cây', 'Bộ', 'Kg', 'm'];

const ManualQuotationScreen = ({ route, navigation }) => {
  const {
    projectId,
    projectName,
    project,
    existingMaterials,
    isRequote,
    originalQuotationId,
  } = route.params;

  const [materials, setMaterials] = useState(() => {
    // Nếu là requote và có existingMaterials, sử dụng dữ liệu cũ
    if (isRequote && existingMaterials && Array.isArray(existingMaterials)) {
      return existingMaterials.map((item, index) => {
        const quantity = parseFloat(item.quantity) || 0;
        const unitPrice = parseFloat(item.unitPrice) || 0;
        const totalPrice = quantity * unitPrice; // Tính lại totalPrice

        return {
          stt: item.no || item.stt || '', // Lấy STT từ trường 'no' (được lưu trong Firestore) hoặc 'stt'
          name: item.name || '',
          material: item.material || MATERIAL_OPTIONS[0],
          unit: item.unit || UNIT_OPTIONS[0],
          quantity: item.quantity ? item.quantity.toString() : '',
          unitPrice: item.unitPrice ? item.unitPrice.toString() : '0',
          totalPrice: totalPrice, // Sử dụng totalPrice đã tính lại
          selected: false,
        };
      });
    }

    // Nếu không phải requote, sử dụng dữ liệu mặc định
    return [
      {
        stt: '', // Để trống STT như QuotationScreen
        name: '',
        material: MATERIAL_OPTIONS[0],
        unit: UNIT_OPTIONS[0],
        quantity: '',
        unitPrice: '0',
        totalPrice: 0,
        selected: false,
      },
    ];
  });

  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);

  // Add new states for bulk price update
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false);
  const [bulkPrice, setBulkPrice] = useState('');
  const [hasSelections, setHasSelections] = useState(false);

  const addMaterialRow = () => {
    setMaterials((prev) => [
      ...prev,
      {
        stt: '', // Để trống STT như QuotationScreen
        name: '',
        material: MATERIAL_OPTIONS[0],
        unit: UNIT_OPTIONS[0],
        quantity: '',
        unitPrice: '0',
        totalPrice: 0,
        selected: false,
      },
    ]);
  };

  const handleChange = (index, field, value) => {
    setMaterials((prev) => {
      const newArr = [...prev];
      newArr[index][field] = value;

      // Auto-recalculate total
      const qty = parseFloat(newArr[index].quantity) || 0;
      const unitP = parseFloat(newArr[index].unitPrice) || 0;
      newArr[index].totalPrice = qty * unitP;

      // Update hasSelections state if needed
      if (field === 'selected') {
        const anySelected = newArr.some((item) => item.selected);
        setHasSelections(anySelected);
      }

      return newArr;
    });
  };

  const handleSelectFromInventory = (item) => {
    if (activeSearchIndex === -1) return;

    handleChange(activeSearchIndex, 'name', item.name);
    handleChange(activeSearchIndex, 'material', item.material || '');
    handleChange(activeSearchIndex, 'unit', item.unit || 'cái');
    // Ensure unitPrice is set correctly
    const price = item.price || item.unitPrice || 0;
    handleChange(activeSearchIndex, 'unitPrice', price.toString());
    // You might want to also bring the item code and description
    handleChange(activeSearchIndex, 'code', item.code || '');
  };

  // Handle bulk price update
  const handleApplyBulkPrice = () => {
    if (!bulkPrice || isNaN(parseFloat(bulkPrice))) {
      Alert.alert('Lỗi', 'Vui lòng nhập giá hợp lệ');
      return;
    }

    const price = parseFloat(bulkPrice);

    setMaterials((prev) => {
      return prev.map((item) => {
        if (item.selected) {
          const qty = parseFloat(item.quantity) || 0;
          return {
            ...item,
            unitPrice: price.toString(),
            totalPrice: qty * price,
          };
        }
        return item;
      });
    });

    setShowBulkPriceModal(false);
    setBulkPrice('');
  };

  const toggleSelectAll = (value) => {
    setMaterials((prev) =>
      prev.map((item) => ({
        ...item,
        selected: value,
      }))
    );
    setHasSelections(value);
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined || num === '') return '0';
    return num.toString();
  };

  const computeSubTotal = () => {
    return materials.reduce((sum, m) => sum + (m.totalPrice || 0), 0);
  };

  const handleContinue = () => {
    // Validate
    if (materials.length === 0) {
      Alert.alert('Thông báo', 'Vui lòng nhập ít nhất 1 vật tư.');
      return;
    }

    const cleaned = materials.filter((m) => (m.name || '').trim() !== '');

    if (cleaned.length === 0) {
      Alert.alert('Thông báo', 'Tên vật tư không được bỏ trống.');
      return;
    }

    const subTotal = computeSubTotal();

    const customerData = {
      id: project.customerId || '',
      name: project.customerName || 'Khách hàng',
      address: project.customerAddress || '',
      phone: project.customerPhone || '',
      email: project.customerEmail || '',
      contactPerson: project.customerContactPerson || '',
      taxCode: project.customerTaxCode || '',
    };

    // Remove selected property before navigation
    const cleanedWithoutSelected = cleaned.map(({ selected, ...rest }) => rest);

    navigation.navigate('FinalizeQuotation', {
      materials: cleanedWithoutSelected,
      subTotal,
      projectId,
      projectName: project.name || projectName || 'Dự án',
      customerData,
      isRequote,
      originalQuotationId,
      isManualQuotation: true, // Đánh dấu đây là manual quotation
    });
  };

  const renderRow = ({ item, index }) => {
    return (
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => handleChange(index, 'selected', !item.selected)}
        >
          <Ionicons
            name={item.selected ? 'checkbox' : 'square-outline'}
            size={20}
            color={item.selected ? '#0066CC' : '#999'}
          />
        </TouchableOpacity>

        <View
          style={[
            styles.sttCol,
            {
              flex: 0.8,
              justifyContent: 'center',
              backgroundColor: '#f8f8f8',
              borderRightWidth: 1,
              borderRightColor: '#ddd',
              marginRight: 2,
            },
          ]}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: 'bold',
              color: '#333',
              textAlign: 'center',
            }}
          >
            {item.stt || ''}
          </Text>
        </View>

        <TextInput
          style={[styles.input, { flex: 2 }]}
          placeholder="Tên vật tư"
          value={item.name}
          onChangeText={(text) => handleChange(index, 'name', text)}
        />

        <TouchableOpacity
          style={[styles.pickerButton, { flex: 1.5 }]}
          onPress={() => {
            setActiveMaterialPicker(index);
            setShowMaterialModal(true);
          }}
        >
          <Text>{item.material || MATERIAL_OPTIONS[0]}</Text>
          <Ionicons name="chevron-down" size={16} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pickerButton, { flex: 0.9 }]}
          onPress={() => {
            setActiveUnitPicker(index);
            setShowUnitModal(true);
          }}
        >
          <Text>{item.unit || UNIT_OPTIONS[0]}</Text>
          <Ionicons name="chevron-down" size={16} color="#666" />
        </TouchableOpacity>

        <TextInput
          style={[styles.input, { flex: 0.8 }]}
          placeholder="SL"
          keyboardType="numeric"
          value={item.quantity || ''}
          onChangeText={(text) => handleChange(index, 'quantity', text)}
        />

        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="0"
          keyboardType="numeric"
          value={item.unitPrice || '0'}
          onChangeText={(text) => handleChange(index, 'unitPrice', text)}
        />

        <View style={[styles.totalCol, { flex: 1 }]}>
          <Text>
            {item.totalPrice ? item.totalPrice.toLocaleString('vi-VN') : ''}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            setActiveSearchIndex(index);
            setSearchModalVisible(true);
          }}
          style={styles.searchIcon}
        >
          <Ionicons name="search" size={20} color="#007AFF" />
        </TouchableOpacity>
      </View>
    );
  };

  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [activeMaterialPicker, setActiveMaterialPicker] = useState(-1);
  const [activeUnitPicker, setActiveUnitPicker] = useState(-1);

  const handleSelectMaterial = (value) => {
    if (activeMaterialPicker >= 0) {
      handleChange(activeMaterialPicker, 'material', value);
    }
    setShowMaterialModal(false);
  };

  const handleSelectUnit = (value) => {
    if (activeUnitPicker >= 0) {
      handleChange(activeUnitPicker, 'unit', value);
    }
    setShowUnitModal(false);
  };

  const subTotal = computeSubTotal();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.title}>
          {isRequote ? 'Báo Giá Lại Thủ Công' : 'Báo Giá Thủ Công'} –{' '}
          {projectName}
        </Text>

        <View style={styles.bulkActionContainer}>
          <View style={styles.selectAllContainer}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => toggleSelectAll(true)}
            >
              <Ionicons name="checkbox-outline" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Chọn tất cả</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.unselectButton]}
              onPress={() => toggleSelectAll(false)}
            >
              <Ionicons name="square-outline" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Bỏ chọn</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.priceButton,
                !hasSelections && styles.disabledButton,
              ]}
              disabled={!hasSelections}
              onPress={() => setShowBulkPriceModal(true)}
            >
              <Ionicons name="pricetag-outline" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Áp dụng giá</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.tableHeader}>
          <View style={{ width: 30 }}></View>
          <Text style={[styles.headerCell, { flex: 0.8 }]}>STT</Text>
          <Text style={[styles.headerCell, { flex: 2 }]}>Tên VT</Text>
          <Text style={[styles.headerCell, { flex: 1.5 }]}>Vật Liệu</Text>
          <Text style={[styles.headerCell, { flex: 0.9 }]}>ĐVT</Text>
          <Text style={[styles.headerCell, { flex: 0.8 }]}>SL</Text>
          <Text style={[styles.headerCell, { flex: 1 }]}>Đơn giá</Text>
          <Text style={[styles.headerCell, { flex: 1 }]}>Thành tiền</Text>
          <View style={{ width: 40 }} />
        </View>

        <FlatList
          data={materials}
          keyExtractor={(_, idx) => idx.toString()}
          renderItem={renderRow}
          scrollEnabled={false}
        />

        <TouchableOpacity style={styles.addBtn} onPress={addMaterialRow}>
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text style={{ color: '#fff', marginLeft: 6 }}>Thêm vật tư</Text>
        </TouchableOpacity>

        <View style={styles.subTotalRow}>
          <Text style={styles.subTotalLabel}>Tổng cộng:</Text>
          <Text style={styles.subTotalVal}>
            {subTotal.toLocaleString('vi-VN')} đ
          </Text>
        </View>

        <TouchableOpacity style={styles.continueBtn} onPress={handleContinue}>
          <Ionicons name="arrow-forward-circle" size={22} color="#fff" />
          <Text style={{ color: '#fff', marginLeft: 8 }}>Tiếp tục</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Material Selection Modal */}
      <Modal
        transparent={true}
        visible={showMaterialModal}
        animationType="slide"
        onRequestClose={() => setShowMaterialModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Chọn vật liệu</Text>
            {MATERIAL_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.modalItem}
                onPress={() => handleSelectMaterial(option)}
              >
                <Text style={styles.modalItemText}>{option}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowMaterialModal(false)}
            >
              <Text style={styles.modalCloseText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Unit Selection Modal */}
      <Modal
        transparent={true}
        visible={showUnitModal}
        animationType="slide"
        onRequestClose={() => setShowUnitModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Chọn đơn vị tính</Text>
            {UNIT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.modalItem}
                onPress={() => handleSelectUnit(option)}
              >
                <Text style={styles.modalItemText}>{option}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowUnitModal(false)}
            >
              <Text style={styles.modalCloseText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bulk Price Modal */}
      <Modal
        transparent={true}
        visible={showBulkPriceModal}
        animationType="slide"
        onRequestClose={() => setShowBulkPriceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Áp dụng giá cho mục đã chọn</Text>

            <TextInput
              style={styles.bulkPriceInput}
              placeholder="Nhập đơn giá áp dụng"
              keyboardType="numeric"
              value={bulkPrice}
              onChangeText={setBulkPrice}
              autoFocus
            />

            <View style={styles.bulkPriceActions}>
              <TouchableOpacity
                style={[styles.bulkPriceActionButton, styles.cancelButton]}
                onPress={() => setShowBulkPriceModal(false)}
              >
                <Text style={styles.cancelButtonText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.bulkPriceActionButton, styles.applyButton]}
                onPress={handleApplyBulkPrice}
              >
                <Text style={styles.applyButtonText}>Áp dụng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <SearchInventoryModal
        visible={searchModalVisible}
        onClose={() => setSearchModalVisible(false)}
        onSelect={handleSelectFromInventory}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingVertical: 6,
    alignItems: 'center',
  },
  headerCell: {
    fontWeight: '600',
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  checkbox: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 6,
    marginRight: 4,
    textAlign: 'center',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 4,
    height: 40,
  },
  totalCol: {
    alignItems: 'flex-end',
    paddingHorizontal: 4,
  },
  sttCol: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  sttText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  searchIcon: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  subTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  subTotalLabel: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  subTotalVal: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#d11a2a',
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#28a745',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 4,
    backgroundColor: '#fff',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    width: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalItemText: {
    fontSize: 16,
  },
  modalCloseButton: {
    marginTop: 15,
    backgroundColor: '#0066CC',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  bulkActionContainer: {
    marginBottom: 16,
  },
  selectAllContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#0066CC',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    minWidth: 110,
  },
  unselectButton: {
    backgroundColor: '#6c757d',
  },
  priceButton: {
    backgroundColor: '#28a745',
  },
  actionButtonText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: '500',
  },
  disabledButton: {
    backgroundColor: '#ccc',
    opacity: 0.7,
  },
  bulkPriceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0066CC',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  bulkPriceText: {
    color: '#fff',
    marginLeft: 5,
  },
  bulkPriceInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 12,
    fontSize: 16,
    marginTop: 10,
    marginBottom: 20,
  },
  bulkPriceActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bulkPriceActionButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 4,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  cancelButtonText: {
    color: '#333',
  },
  applyButton: {
    backgroundColor: '#28a745',
  },
  applyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default ManualQuotationScreen;
