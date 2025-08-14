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
import { db } from '../config/firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';

// --- Các Component và Hàm Helper được chuyển từ ProjectDetailScreen ---

// Memoized row component for the materials list
const MaterialRow = memo(
  ({
    item,
    index,
    onPriceChange,
    formatNumber,
    onToggleSelect,
    inventoryStatus,
  }) => {
    // Debug log rõ ràng hơn để kiểm tra dữ liệu STT
    console.log(`Rendering row ${index}:`, {
      stt: item.stt,
      sttType: typeof item.stt,
      sttEmpty: !item.stt,
      name: item.name?.substring(0, 20) + '...',
    });

    // Check if the STT is a Roman numeral to apply special styling
    const isRoman = item.stt && /^[IVXLCDM]+$/i.test(item.stt.trim());

    // If the item is a note, render it differently
    if (item.isNote) {
      return (
        <View style={[styles.tableRow, styles.noteRow]}>
          <View style={styles.noteCell}>
            <Text style={styles.noteText}>{item.name}</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.tableRow}>
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => onToggleSelect(index)}
        >
          <Ionicons
            name={item.selected ? 'checkbox' : 'square-outline'}
            size={18}
            color={item.selected ? '#0066CC' : '#999'}
          />
        </TouchableOpacity>
        <View style={[styles.tableCell, { flex: 0.5, alignItems: 'center' }]}>
          {inventoryStatus === 'found' && (
            <Ionicons name="checkmark-circle" size={18} color="green" />
          )}
          {inventoryStatus === 'notFound' && (
            <Ionicons name="close-circle" size={18} color="red" />
          )}
        </View>
        <View
          style={[
            styles.tableCell,
            styles.sttCell,
            {
              flex: 0.8,
              justifyContent: 'center',
              backgroundColor: isRoman ? '#E8D5F7' : '#f8f8f8', // Light purple background for Roman numerals
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
              color: '#333', // Keep text color consistent
              textAlign: 'center',
            }}
          >
            {item.stt || ''}
          </Text>
        </View>
        <View style={[styles.tableCell, { flex: 2.2 }]}>
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
        <Text style={[styles.tableCell, { flex: 0.8, textAlign: 'center' }]}>
          {item.unit}
        </Text>
        <View style={[styles.tableCell, { flex: 1.2 }]}>
          <TextInput
            style={styles.priceInput}
            value={item.unitPrice > 0 ? item.unitPrice.toString() : ''}
            onChangeText={(text) => onPriceChange(text, index)}
            placeholder="Nhập..."
            keyboardType="numeric"
            selectTextOnFocus
          />
        </View>
        <Text style={[styles.tableCell, styles.totalPrice, { flex: 1.5 }]}>
          {item.totalPrice > 0 ? item.totalPrice.toLocaleString('vi-VN') : ''}
        </Text>
      </View>
    );
  }
);

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
    setMaterials,
  } = useMaterialsProcessor(project);

  const [quotations, setQuotations] = useState([]);
  const [isLoadingQuotations, setIsLoadingQuotations] = useState(true);
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false);
  const [bulkPrice, setBulkPrice] = useState('');
  const [hasSelections, setHasSelections] = useState(false);
  const [isCheckingInventory, setIsCheckingInventory] = useState(false);

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

  const handleCheckInventory = async () => {
    const selectedMaterials = materials.filter((m) => m.selected);
    if (selectedMaterials.length === 0) {
      Alert.alert('Thông báo', 'Vui lòng chọn ít nhất một vật tư để kiểm tra.');
      return;
    }

    setIsCheckingInventory(true);

    try {
      const inventoryRef = collection(db, 'inventory');
      const updatedMaterials = [...materials];

      for (let i = 0; i < updatedMaterials.length; i++) {
        const material = updatedMaterials[i];
        if (!material.selected) continue;

        const name = (material.name || '').trim();
        const code = (material.code || '').trim();

        if (!name && !code) {
          material.inventoryStatus = 'notFound';
          continue;
        }

        let q;
        if (code) {
          q = query(inventoryRef, where('code', '==', code));
        } else {
          q = query(inventoryRef, where('name', '==', name));
        }

        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          material.inventoryStatus = 'found';
        } else {
          material.inventoryStatus = 'notFound';
        }
      }
      setMaterials(updatedMaterials);
    } catch (error) {
      console.error('Lỗi khi kiểm tra kho:', error);
      Alert.alert('Lỗi', 'Không thể kiểm tra kho. Vui lòng thử lại.');
    } finally {
      setIsCheckingInventory(false);
    }
  };

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
      contactPerson: project.customerContactPerson || '',
      taxCode: project.customerTaxCode || '',
    };
    navigation.navigate('FinalizeQuotation', {
      materials,
      subTotal,
      projectId,
      projectName: project.name || 'Dự án mới',
      customerData,
    });
  };

  const handleToggleSelect = (index) => {
    setMaterials((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        selected: !updated[index].selected,
      };

      // Update hasSelections state
      const anySelected = updated.some((item) => item.selected);
      setHasSelections(anySelected);

      return updated;
    });
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

  const handleApplyBulkPrice = () => {
    if (!bulkPrice || isNaN(parseFloat(bulkPrice))) {
      Alert.alert('Lỗi', 'Vui lòng nhập giá hợp lệ');
      return;
    }

    const price = parseFloat(bulkPrice);

    setMaterials((prev) => {
      return prev.map((item) => {
        if (item.selected) {
          const weight = parseFloat(item.weight || 0);
          const quantity = parseFloat(item.quantity || 0);

          let totalPrice;
          if (weight > 0) {
            // Nếu có trọng lượng: thành tiền = số lượng × trọng lượng × đơn giá
            totalPrice = quantity * weight * price;
          } else {
            // Nếu không có trọng lượng: thành tiền = số lượng × đơn giá
            totalPrice = quantity * price;
          }

          return {
            ...item,
            unitPrice: price,
            totalPrice: totalPrice,
          };
        }
        return item;
      });
    });

    setShowBulkPriceModal(false);
    setBulkPrice('');
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

      <TouchableOpacity
        style={[styles.manualButton]}
        onPress={() =>
          navigation.navigate('ManualQuotation', {
            projectId,
            projectName,
            project,
          })
        }
      >
        <Ionicons name="create-outline" size={24} color="#fff" />
        <Text style={styles.importButtonText}>Nhập thủ công</Text>
      </TouchableOpacity>
    </View>
  );

  const renderMaterialsSection = () =>
    showMaterialsTable && (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Bảng Tính Vật Tư</Text>

        {materials.length > 0 && (
          <View style={styles.bulkActionContainer}>
            <TouchableOpacity
              style={styles.bulkActionButton}
              onPress={() => toggleSelectAll(true)}
            >
              <Ionicons name="checkbox-outline" size={18} color="#fff" />
              <Text style={styles.bulkActionButtonText}>Chọn tất cả</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bulkActionButton, styles.unselectButton]}
              onPress={() => toggleSelectAll(false)}
            >
              <Ionicons name="square-outline" size={18} color="#fff" />
              <Text style={styles.bulkActionButtonText}>Bỏ chọn</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.bulkActionButton,
                styles.priceButton,
                !hasSelections && styles.disabledButton,
              ]}
              disabled={!hasSelections}
              onPress={() => setShowBulkPriceModal(true)}
            >
              <Ionicons name="pricetag-outline" size={18} color="#fff" />
              <Text style={styles.bulkActionButtonText}>Áp dụng giá</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.bulkActionButton,
                styles.checkInventoryButton,
                !hasSelections && styles.disabledButton,
              ]}
              disabled={!hasSelections || isCheckingInventory}
              onPress={handleCheckInventory}
            >
              {isCheckingInventory ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="storefront-outline" size={18} color="#fff" />
              )}
              <Text style={styles.bulkActionButtonText}>Kiểm tra kho</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.tableHeader}>
          <View style={{ width: 30 }}></View>
          <View style={{ width: 25 }} />
          <View
            style={[
              styles.headerCell,
              {
                flex: 0.8,
                justifyContent: 'center',
                backgroundColor: '#f0f0f0',
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
              STT
            </Text>
          </View>
          <Text style={[styles.headerCell, { flex: 2.2 }]}>Tên vật tư</Text>
          <Text style={[styles.headerCell, { flex: 1, textAlign: 'center' }]}>
            SL
          </Text>
          <Text style={[styles.headerCell, { flex: 1, textAlign: 'center' }]}>
            KL
          </Text>
          <Text style={[styles.headerCell, { flex: 0.8, textAlign: 'center' }]}>
            ĐVT
          </Text>
          <Text style={[styles.headerCell, { flex: 1.2, textAlign: 'right' }]}>
            Đơn giá
          </Text>
          <Text style={[styles.headerCell, { flex: 1.5, textAlign: 'right' }]}>
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
              onToggleSelect={handleToggleSelect}
              inventoryStatus={item.inventoryStatus}
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
                    style={styles.historyActionButton}
                    onPress={() =>
                      handleViewPdf(item.pdfUrl, item.quotationNumber)
                    }
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.historyActionButtonText}>Xem PDF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.historyActionButton, styles.requoteButton]}
                    onPress={() =>
                      handleRequote(
                        item,
                        navigation,
                        projectId,
                        projectName,
                        project
                      )
                    }
                  >
                    <Ionicons name="copy-outline" size={20} color="#fff" />
                    <Text style={styles.historyActionButtonText}>
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
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    backgroundColor: '#f8f8f8',
    alignItems: 'center',
  },
  headerCell: { fontWeight: 'bold', color: '#333' },
  sttHeaderCell: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#eee',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 8,
  },
  noteRow: {
    backgroundColor: '#f5f5f5', // Light gray background
    opacity: 0.8, // Slightly faded
  },
  tableCell: { fontSize: 12, color: '#333' },
  noteCell: {
    flex: 1,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  noteText: {
    fontStyle: 'italic',
    color: '#555',
    fontSize: 13,
  },
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
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 2,
  },
  historyItemBorder: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  historyInfo: {
    flex: 1,
    paddingRight: 12,
  },
  historyNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  historyDate: {
    color: '#666',
    fontSize: 12,
    marginBottom: 3,
  },
  historyTotal: {
    color: '#d9534f',
    fontWeight: '600',
    fontSize: 13,
  },
  historyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#0066CC',
  },
  historyActionButtonText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: '500',
    fontSize: 14,
  },
  requoteButton: {
    backgroundColor: '#4CAF50',
  },
  checkbox: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 4,
  },

  bulkActionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 10,
  },
  bulkActionRow: {
    flexDirection: 'row',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  bulkActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  unselectButton: {
    backgroundColor: '#555',
  },
  priceButton: {
    backgroundColor: '#4CAF50',
  },
  checkInventoryButton: {
    backgroundColor: '#9B59B6',
  },
  disabledButton: {
    backgroundColor: '#a0a0a0',
  },
  bulkActionButtonText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: '500',
    fontSize: 14,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
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

  sttCell: {
    paddingLeft: 10,
    paddingRight: 10,
    borderRightWidth: 1,
    borderRightColor: '#eee',
    fontWeight: '500',
  },
  sttText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
  },
});

export default QuotationScreen;
