// src/screens/QuotationScreen.js

import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Modal,
  TextInput,
  TouchableOpacity,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useMaterialsProcessor } from '../hooks/useMaterialsProcessor';
import { getQuotationsByProject } from '../api/quotationService';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

// --- Các Component và Hàm Helper được chuyển từ ProjectDetailScreen ---

// Memoized row component for the materials list
const MaterialRow = memo(({ item, index, onPriceChange, formatNumber }) => {
  return (
    <View style={styles.tableRow}>
      <View style={[styles.tableCell, { flex: 3 }]}>
        <Text style={styles.materialName}>{item.name}</Text>
        {item.material ? (
          <Text style={styles.materialType}>{item.material}</Text>
        ) : null}
        {item.quyCach ? (
          <Text style={styles.materialType}>Quy cách: {item.quyCach}</Text>
        ) : null}
      </View>
      <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}>
        {formatNumber(item.quantity)}
      </Text>
      <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}>
        {formatNumber(item.weight)}
      </Text>
      <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}>
        {item.unit}
      </Text>
      <View style={[styles.tableCell, { flex: 2 }]}>
        <TextInput
          style={styles.priceInput}
          value={item.unitPrice > 0 ? item.unitPrice.toString() : ''}
          onChangeText={(text) => onPriceChange(text, index)}
          placeholder="Nhập..."
          keyboardType="numeric"
          selectTextOnFocus
        />
      </View>
      <Text style={[styles.tableCell, styles.totalPrice, { flex: 2 }]}>
        {item.totalPrice > 0 ? item.totalPrice.toLocaleString('vi-VN') : ''}
      </Text>
    </View>
  );
});

// Hàm format tiền
const formatCurrency = (amount) => {
  if (!amount) return '0 VNĐ';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
  }).format(amount);
};

const formatAppNumber = (num) => {
  if (typeof num !== 'number' || isNaN(num)) return '0';
  const roundedNum = Math.round(num * 10) / 10;
  return roundedNum.toString().replace('.', ',');
};
// --------------------------------------------------------------------

const QuotationScreen = ({ route, navigation }) => {
  const { projectId, projectName, project } = route.params;

  const {
    materials,
    showMaterialsTable,
    driveFiles,
    isPickerVisible,
    isLoadingFiles,
    isGoogleDriveLoading,
    handleImportFromGoogleDrive,
    handleFileSelect,
    handlePriceChange,
    handleRequote,
    setIsPickerVisible,
  } = useMaterialsProcessor();

  const [quotations, setQuotations] = useState([]);
  const [isLoadingQuotations, setIsLoadingQuotations] = useState(true);

  // Lấy lịch sử báo giá
  useFocusEffect(
    useCallback(() => {
      const loadQuotations = async () => {
        setIsLoadingQuotations(true);
        try {
          const pastQuotations = await getQuotationsByProject(projectId);
          setQuotations(pastQuotations);
        } catch (error) {
          console.error('Lỗi khi tải lịch sử báo giá:', error);
        } finally {
          setIsLoadingQuotations(false);
        }
      };
      if (projectId) {
        loadQuotations();
      }
    }, [projectId])
  );

  const handleViewPdf = async (pdfUrl, quotationNumber) => {
    if (!pdfUrl) {
      Alert.alert('Lỗi', 'Không tìm thấy đường dẫn PDF cho báo giá này.');
      return;
    }
    Alert.alert('Đang xử lý', 'Đang tải file PDF để xem...');
    try {
      const fileUri =
        FileSystem.documentDirectory + `${quotationNumber || 'quotation'}.pdf`;
      const { uri } = await FileSystem.downloadAsync(pdfUrl, fileUri);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { dialogTitle: 'Mở hoặc chia sẻ PDF' });
      } else {
        Alert.alert(
          'Không thể chia sẻ',
          'Thiết bị của bạn không hỗ trợ chức năng này.'
        );
      }
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể mở file PDF. Vui lòng thử lại.');
    }
  };

  const handleNavigateToFinalize = () => {
    const subTotal = materials.reduce(
      (sum, item) => sum + (item.totalPrice || 0),
      0
    );
    const customerData = {
      id: project.customerId || '',
      name: project.customerName || 'Khách hàng',
      address: project.customerAddress || '',
      phone: project.customerPhone || '',
      email: project.customerEmail || '',
      contact: project.customerContact || '',
    };
    navigation.navigate('FinalizeQuotation', {
      materials,
      subTotal,
      projectId,
      projectName: project.name || 'Dự án mới',
      customerData,
    });
  };

  const renderHeader = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>1. Nhập Vật Tư</Text>
      <TouchableOpacity
        style={[
          styles.importButton,
          isGoogleDriveLoading && styles.importButtonDisabled,
        ]}
        onPress={handleImportFromGoogleDrive}
        disabled={isGoogleDriveLoading}
      >
        {isGoogleDriveLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="cloud-download-outline" size={24} color="#fff" />
        )}
        <Text style={styles.importButtonText}>Nhập từ Google Drive</Text>
      </TouchableOpacity>
    </View>
  );

  const renderMaterialsSection = () =>
    showMaterialsTable && (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Bảng Tính Vật Tư</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.headerCell, { flex: 3 }]}>Tên vật tư</Text>
          <Text style={[styles.headerCell, { flex: 1, textAlign: 'center' }]}>
            SL
          </Text>
          <Text style={[styles.headerCell, { flex: 1, textAlign: 'center' }]}>
            KL
          </Text>
          <Text style={[styles.headerCell, { flex: 1, textAlign: 'center' }]}>
            ĐVT
          </Text>
          <Text style={[styles.headerCell, { flex: 2, textAlign: 'right' }]}>
            Đơn giá
          </Text>
          <Text style={[styles.headerCell, { flex: 2, textAlign: 'right' }]}>
            Thành tiền
          </Text>
        </View>
        <FlatList
          data={materials}
          keyExtractor={(item, index) => `material-row-${index}`}
          renderItem={({ item, index }) => (
            <MaterialRow
              item={item}
              index={index}
              onPriceChange={handlePriceChange}
              formatNumber={formatAppNumber}
            />
          )}
        />
      </View>
    );

  const renderFooter = () => (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. Lịch sử báo giá</Text>
        {isLoadingQuotations ? (
          <ActivityIndicator />
        ) : quotations.length === 0 ? (
          <Text style={styles.emptyText}>Chưa có báo giá nào.</Text>
        ) : (
          <View style={styles.historyContainer}>
            {quotations.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.historyItem,
                  index > 0 && styles.historyItemBorder,
                ]}
              >
                <View style={styles.historyInfo}>
                  <Text style={styles.historyNumber}>
                    {item.quotationNumber ||
                      `Báo giá #${item.id.substring(0, 5)}`}
                  </Text>
                  <Text style={styles.historyDate}>
                    Ngày tạo:{' '}
                    {item.createdAt
                      ? new Date(
                          item.createdAt.seconds * 1000
                        ).toLocaleDateString('vi-VN')
                      : 'Không rõ'}
                  </Text>
                  <Text style={styles.historyTotal}>
                    Tổng cộng: {formatCurrency(item.grandTotal)}
                  </Text>
                </View>
                <View style={styles.historyActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() =>
                      handleViewPdf(item.pdfUrl, item.quotationNumber)
                    }
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={20}
                      color="#0066cc"
                    />
                    <Text style={styles.actionButtonText}>Xem PDF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.requoteButton]}
                    onPress={() => handleRequote(item)}
                  >
                    <Ionicons name="copy-outline" size={20} color="#4CAF50" />
                    <Text
                      style={[styles.actionButtonText, { color: '#4CAF50' }]}
                    >
                      Báo giá lại
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Báo giá: {projectName}</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={[{ key: 'main' }]}
        renderItem={() => <>{renderMaterialsSection()}</>}
        keyExtractor={(item) => item.key}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        contentContainerStyle={{ padding: 12 }}
        ListEmptyComponent={
          !showMaterialsTable ? (
            <View>
              <Text style={styles.emptyText}>
                Vui lòng nhập vật tư để bắt đầu.
              </Text>
            </View>
          ) : null
        }
      />

      {showMaterialsTable && materials.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryLabel}>Tổng cộng:</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(
                materials.reduce((sum, item) => sum + (item.totalPrice || 0), 0)
              )}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleNavigateToFinalize}
          >
            <Text style={styles.continueButtonText}>
              Tiếp tục hoàn thiện báo giá
            </Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={isPickerVisible}
        onRequestClose={() => setIsPickerVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Chọn file Excel từ Google Drive
            </Text>
            {isLoadingFiles ? (
              <ActivityIndicator size="large" />
            ) : (
              <FlatList
                data={driveFiles}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.fileItem}
                    onPress={() => handleFileSelect(item)}
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={24}
                      color="#4F8EF7"
                    />
                    <Text style={styles.fileName}>{item.name}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text>Không tìm thấy file nào.</Text>}
              />
            )}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsPickerVisible(false)}
            >
              <Text style={styles.closeButtonText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  emptyText: { textAlign: 'center', color: '#666', marginTop: 20 },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0066cc',
    padding: 12,
    borderRadius: 8,
  },
  importButtonDisabled: { backgroundColor: '#a0a0a0' },
  importButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 8,
    marginBottom: 4,
  },
  headerCell: { fontWeight: 'bold', color: '#333' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 8,
  },
  tableCell: { fontSize: 12, color: '#333' },
  materialName: { fontWeight: '500', fontSize: 13 },
  materialType: { fontSize: 11, color: '#666' },
  priceInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 6,
    textAlign: 'right',
    fontSize: 12,
  },
  totalPrice: { fontWeight: '500', textAlign: 'right', fontSize: 13 },
  footer: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingBottom: 30,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: { fontSize: 16, fontWeight: '500' },
  summaryValue: { fontSize: 18, fontWeight: 'bold', color: '#d9534f' },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    padding: 14,
    borderRadius: 8,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  fileName: { marginLeft: 10, fontSize: 16 },
  closeButton: {
    marginTop: 20,
    backgroundColor: '#d9534f',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  closeButtonText: { color: 'white', fontWeight: 'bold' },
  historyContainer: { marginTop: 8 },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    alignItems: 'center',
  },
  historyItemBorder: { borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  historyInfo: { flex: 1 },
  historyNumber: { fontSize: 14, fontWeight: '500', color: '#333' },
  historyDate: { fontSize: 12, color: '#666', marginVertical: 2 },
  historyTotal: { fontSize: 13, fontWeight: 'bold', color: '#d9534f' },
  historyActions: { flexDirection: 'row' },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    marginLeft: 8,
  },
  requoteButton: { backgroundColor: '#e8f5e9' },
  actionButtonText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#0066cc',
    fontWeight: '500',
  },
});

export default QuotationScreen;
