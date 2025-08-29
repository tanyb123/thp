// src/screens/CreateProposalScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { createProposal, canCreateProposal } from '../api/proposalService';
import { useAuth } from '../contexts/AuthContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

const CreateProposalScreen = ({ route, navigation }) => {
  const params = route?.params || {};
  const projectId = params.projectId;
  const projectName = params.projectName;
  const selectedItems = Array.isArray(params.selectedItems)
    ? params.selectedItems
    : [];
  const { currentUser } = useAuth();
  const [saving, setSaving] = useState(false);

  // Các trường mới
  const [proposalNumber, setProposalNumber] = useState('');
  const [requiredDate, setRequiredDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [priority, setPriority] = useState('normal'); // 'normal' hoặc 'urgent'
  const [purpose, setPurpose] = useState('');

  // Kiểm tra quyền tạo đề xuất
  if (!canCreateProposal(currentUser?.role)) {
    Alert.alert('Không có quyền', 'Bạn không có quyền tạo đề xuất mua vật tư');
    navigation.goBack();
  }

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setRequiredDate(selectedDate);
    }
  };

  const handleSubmit = async () => {
    // Validate
    if (!proposalNumber.trim()) {
      return Alert.alert('Thiếu thông tin', 'Vui lòng nhập số đề xuất');
    }

    if (!purpose.trim()) {
      return Alert.alert('Thiếu thông tin', 'Vui lòng nhập mục đích sử dụng');
    }

    const proposalCode = `THP/KT/25/${proposalNumber}`;

    setSaving(true);
    try {
      await createProposal({
        projectId,
        projectName,
        items: selectedItems,
        createdBy: currentUser.uid,
        createdByName: currentUser.displayName || currentUser.email,
        proposalCode,
        requiredDate,
        priority,
        purpose,
      });
      Alert.alert('Thành công', 'Đã gửi đề xuất.');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Lỗi', err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.row}>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.qty}>{item.quantity}</Text>
      <Text style={styles.unit}>{item.unit}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Đề xuất mua vật tư - {projectName}</Text>

      {/* Form thông tin đề xuất */}
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Thông tin đề xuất</Text>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Mã đề xuất</Text>
          <View style={styles.codeInputContainer}>
            <Text style={styles.codePrefix}>THP/KT/25/</Text>
            <TextInput
              style={styles.codeInput}
              value={proposalNumber}
              onChangeText={setProposalNumber}
              placeholder="Nhập số"
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Ngày cần cung cấp</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateText}>
              {requiredDate.toLocaleDateString('vi-VN')}
            </Text>
            <Ionicons name="calendar-outline" size={20} color="#666" />
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={requiredDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              minimumDate={new Date()}
            />
          )}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Mức độ ưu tiên</Text>
          <View style={styles.priorityContainer}>
            <TouchableOpacity
              style={[
                styles.priorityButton,
                priority === 'normal' && styles.priorityButtonActive,
              ]}
              onPress={() => setPriority('normal')}
            >
              <Text
                style={[
                  styles.priorityText,
                  priority === 'normal' && styles.priorityTextActive,
                ]}
              >
                Bình thường
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.priorityButton,
                priority === 'urgent' && styles.priorityButtonActive,
                priority === 'urgent' && { backgroundColor: '#ffebee' },
              ]}
              onPress={() => setPriority('urgent')}
            >
              <Text
                style={[
                  styles.priorityText,
                  priority === 'urgent' && styles.priorityTextActive,
                  priority === 'urgent' && { color: '#d32f2f' },
                ]}
              >
                Gấp
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Mục đích sử dụng</Text>
          <TextInput
            style={styles.purposeInput}
            value={purpose}
            onChangeText={setPurpose}
            placeholder="Nhập mục đích sử dụng vật tư"
            multiline
            numberOfLines={3}
          />
        </View>
      </View>

      {/* Danh sách vật tư */}
      <View style={styles.materialsSection}>
        <Text style={styles.sectionTitle}>
          Danh sách vật tư ({selectedItems ? selectedItems.length : 0})
        </Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.headerText, { flex: 3 }]}>Tên vật tư</Text>
          <Text style={[styles.headerText, { flex: 1, textAlign: 'center' }]}>
            SL
          </Text>
          <Text style={[styles.headerText, { flex: 1, textAlign: 'center' }]}>
            ĐVT
          </Text>
        </View>
        <FlatList
          data={selectedItems}
          keyExtractor={(i, idx) => idx.toString()}
          renderItem={renderItem}
          nestedScrollEnabled
          style={{ maxHeight: 300 }}
        />
      </View>

      <TouchableOpacity
        style={styles.submitBtn}
        onPress={handleSubmit}
        disabled={saving}
      >
        <Text style={styles.btnText}>
          {saving ? 'Đang gửi...' : 'Gửi Duyệt'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  formSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  materialsSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    color: '#555',
  },
  codeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    overflow: 'hidden',
  },
  codePrefix: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 10,
    fontSize: 14,
  },
  codeInput: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 14,
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 10,
  },
  dateText: {
    fontSize: 14,
  },
  priorityContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  priorityButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
  },
  priorityButtonActive: {
    borderColor: '#0066cc',
    backgroundColor: '#e6f2ff',
  },
  priorityText: {
    color: '#666',
  },
  priorityTextActive: {
    color: '#0066cc',
    fontWeight: '500',
  },
  purposeInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 10,
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 4,
  },
  headerText: {
    fontWeight: '600',
    fontSize: 14,
    color: '#555',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  name: { flex: 3 },
  qty: { flex: 1, textAlign: 'center' },
  unit: { flex: 1, textAlign: 'center' },
  submitBtn: {
    backgroundColor: '#0066cc',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default CreateProposalScreen;
