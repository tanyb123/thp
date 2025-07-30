import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import SupplierPickerModal from '../components/SupplierPickerModal';
import usePurchaseOrderGenerator from '../hooks/usePurchaseOrderGenerator';

/**
 * CreatePOScreen
 * This is a simplified screen that pre-populates the material list coming
 * from route.params (passed from ProposalListScreen → navigate('CreatePO', params)).
 * For now we only allow editing quantity / price; supplier info can be added later.
 */
const CreatePOScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();

  // Supplier state & modal visibility
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplier, setSupplier] = useState(null);

  // New state for PO info
  const [poNumber, setPoNumber] = useState('');
  const [proposalNumber, setProposalNumber] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');

  // VAT percentage
  const [vatPercentage, setVatPercentage] = useState(10);

  // Purchase order generator hook
  const { generatePurchaseOrder, loading } = usePurchaseOrderGenerator();

  const {
    projectName = '',
    projectId = '',
    materials: initMaterials = [],
  } = route.params || {};

  const [materials, setMaterials] = useState(
    initMaterials.length > 0
      ? initMaterials.map((m) => ({
          ...m,
          quantity: m.quantity?.toString() || '',
          unitPrice: m.unitPrice?.toString() || '',
        }))
      : [
          {
            name: '',
            specs: '',
            unit: '',
            quantity: '',
            unitPrice: '',
          },
        ]
  );

  const handleMaterialChange = (index, field, value) => {
    const updated = [...materials];
    updated[index] = { ...updated[index], [field]: value };
    setMaterials(updated);
  };

  const handleAddMaterial = () => {
    setMaterials([
      ...materials,
      { name: '', specs: '', unit: '', quantity: '', unitPrice: '' },
    ]);
  };

  const handleRemoveMaterial = (index) => {
    if (materials.length === 1) return;
    const updated = [...materials];
    updated.splice(index, 1);
    setMaterials(updated);
  };

  const subtotal = materials.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  const vatAmount = (subtotal * vatPercentage) / 100;
  const grandTotal = subtotal + vatAmount;

  const handleGeneratePO = async () => {
    if (!supplier) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn Nhà cung cấp');
      return;
    }

    console.log('Starting PO generation for project ID:', projectId);

    const poData = {
      projectName,
      supplierName: supplier.name,
      supplierAddress: supplier.address || '',
      supplierPhone: supplier.phone || '',
      supplierEmail: supplier.email || '',
      supplierTaxCode: supplier.taxCode || '',
      materials,
      vatPercentage,
      // Add new fields
      poNumber,
      proposalNumber,
      deliveryTime,
    };

    try {
      console.log(
        'Calling generatePurchaseOrder with data:',
        JSON.stringify({
          projectId,
          supplierName: supplier.name,
          materialsCount: materials.length,
        })
      );

      const result = await generatePurchaseOrder(poData, projectId);
      console.log('PO generation successful, result:', result);
      Alert.alert('Thành công', 'Đã tạo đơn đặt hàng');
      navigation.goBack();
    } catch (err) {
      console.error('Error in handleGeneratePO:', err);
      // error is already handled in the hook
    }
  };

  return (
    <ScrollView style={styles.container}>
      <SupplierPickerModal
        visible={showSupplierModal}
        onClose={() => setShowSupplierModal(false)}
        onSelect={(sup) => {
          setSupplier(sup);
        }}
      />
      <Text style={styles.title}>Tạo PO cho dự án: {projectName}</Text>

      {/* Supplier selection */}
      <View style={styles.supplierGroup}>
        <Text style={styles.label}>Nhà cung cấp</Text>
        <TouchableOpacity
          style={styles.selectButton}
          onPress={() => setShowSupplierModal(true)}
        >
          <Text style={styles.selectText}>
            {supplier ? supplier.name : 'Chọn nhà cung cấp'}
          </Text>
        </TouchableOpacity>
        {supplier && (
          <View style={{ marginTop: 4 }}>
            {supplier.address ? (
              <Text style={styles.supplierInfo}>{supplier.address}</Text>
            ) : null}
            {supplier.phone ? (
              <Text style={styles.supplierInfo}>ĐT: {supplier.phone}</Text>
            ) : null}
          </View>
        )}
      </View>

      {/* PO Info Inputs */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Số đơn đặt hàng</Text>
        <TextInput
          style={styles.inputField}
          placeholder="Nhập số ĐĐH (ví dụ: PO-001)"
          value={poNumber}
          onChangeText={setPoNumber}
        />
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Số đề xuất</Text>
        <TextInput
          style={styles.inputField}
          placeholder="Nhập số đề xuất được duyệt"
          value={proposalNumber}
          onChangeText={setProposalNumber}
        />
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Thời gian giao hàng</Text>
        <TextInput
          style={styles.inputField}
          placeholder="Nhập thời gian giao hàng (ví dụ: 3-5 ngày)"
          value={deliveryTime}
          onChangeText={setDeliveryTime}
        />
      </View>

      {/* Materials list */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>Danh sách vật tư</Text>
        <TouchableOpacity onPress={handleAddMaterial} style={styles.addBtn}>
          <Ionicons name="add-circle" size={22} color="#4CAF50" />
        </TouchableOpacity>
      </View>

      {materials.map((mat, idx) => {
        const total = (
          (parseFloat(mat.quantity) || 0) * (parseFloat(mat.unitPrice) || 0)
        ).toLocaleString('vi-VN');
        return (
          <View key={idx} style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 3 }]}
              placeholder="Tên vật tư"
              value={mat.name}
              onChangeText={(t) => handleMaterialChange(idx, 'name', t)}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="SL"
              keyboardType="numeric"
              value={mat.quantity}
              onChangeText={(t) => handleMaterialChange(idx, 'quantity', t)}
            />
            <TextInput
              style={[styles.input, { flex: 2 }]}
              placeholder="Đơn giá"
              keyboardType="numeric"
              value={mat.unitPrice}
              onChangeText={(t) => handleMaterialChange(idx, 'unitPrice', t)}
            />
            <Text style={[styles.total, { flex: 2 }]}>{total}</Text>
            <TouchableOpacity onPress={() => handleRemoveMaterial(idx)}>
              <Ionicons name="trash-outline" size={18} color="red" />
            </TouchableOpacity>
          </View>
        );
      })}

      {/* Summary */}
      <View style={{ marginTop: 12 }}>
        <Text style={styles.summary}>
          Tạm tính: {subtotal.toLocaleString('vi-VN')} VND
        </Text>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}
        >
          <Text style={styles.summary}>VAT (%) :</Text>
          <TextInput
            style={[styles.input, { width: 60, marginLeft: 6 }]}
            keyboardType="numeric"
            value={vatPercentage.toString()}
            onChangeText={(v) => setVatPercentage(parseFloat(v) || 0)}
          />
          <Text style={[styles.summary, { marginLeft: 6 }]}>
            {' '}
            = {vatAmount.toLocaleString('vi-VN')} VND
          </Text>
        </View>
        <Text style={styles.summary}>
          Tổng cộng: {grandTotal.toLocaleString('vi-VN')} VND
        </Text>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={handleGeneratePO}
        disabled={loading}
      >
        <Ionicons name="document-text-outline" size={20} color="#fff" />
        <Text style={styles.buttonText}>Tạo đơn đặt hàng</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 16,
  },
  sectionHeaderText: { fontSize: 16, fontWeight: '600', flex: 1 },
  addBtn: { padding: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingVertical: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 6,
    borderRadius: 4,
    marginHorizontal: 2,
  },
  total: {
    textAlign: 'right',
    paddingHorizontal: 4,
    fontWeight: '500',
  },
  summary: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  button: {
    marginTop: 20,
    backgroundColor: '#4CAF50',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    color: '#444',
  },
  supplierGroup: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  selectButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 4,
  },
  selectText: { fontSize: 16 },
  supplierInfo: { fontSize: 13, color: '#666' },
  inputGroup: {
    marginBottom: 12,
  },
  inputField: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 4,
    fontSize: 16,
  },
});

export default CreatePOScreen;
