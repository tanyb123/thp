// src/screens/MaterialPurchaseScreen.js
import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useProjectDetails } from '../hooks/useProjectDetails';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebaseConfig';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { getQuotationsByProject } from '../api/quotationService';
import {
  getProposalsByStatus,
  updateProposalMaterialPrices,
} from '../api/proposalService';

// Memoized row component for the materials list
const MaterialRow = memo(({ item, index, onTogglePurchased }) => {
  return (
    <View style={styles.tableRow}>
      <TouchableOpacity
        style={styles.checkbox}
        onPress={() => onTogglePurchased(index)}
      >
        <Ionicons
          name={item.purchased ? 'checkbox' : 'square-outline'}
          size={18}
          color={item.purchased ? '#4CAF50' : '#999'}
        />
      </TouchableOpacity>
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
      <Text style={[styles.tableCell, { flex: 0.8, textAlign: 'center' }]}>
        {item.unit}
      </Text>
    </View>
  );
});

// Helper functions
const formatNumber = (num) => {
  if (typeof num !== 'number' || isNaN(num)) return '0';
  const roundedNum = Math.round(num * 10) / 10;
  return roundedNum.toString().replace('.', ',');
};

const MaterialPurchaseScreen = ({ route, navigation }) => {
  const { projectId, projectName, project } = route.params;
  const { currentUser } = useAuth();
  const { project: projectDetails, loading: loadingProject } =
    useProjectDetails(projectId);

  const [materials, setMaterials] = useState([]);
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedForProposal, setSelectedForProposal] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [approvedProposals, setApprovedProposals] = useState([]);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [editableMaterials, setEditableMaterials] = useState([]);
  const [currentProposalId, setCurrentProposalId] = useState(null);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [purchasedMaterials, setPurchasedMaterials] = useState([]);
  const [showHistoryDetailModal, setShowHistoryDetailModal] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [historyMaterials, setHistoryMaterials] = useState([]);
  const [updatingHistory, setUpdatingHistory] = useState(false);

  const handleTogglePurchased = (index) => {
    setMaterials((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        purchased: !updated[index].purchased,
        selectedForProposal: !updated[index].purchased, // Đồng bộ với trạng thái purchased
      };
      return updated;
    });
  };

  const handleToggleSelectForProposal = (index) => {
    setMaterials((prev) => {
      const arr = [...prev];
      arr[index].selectedForProposal = !arr[index].selectedForProposal;
      return arr;
    });
  };

  const handleCreateProposal = () => {
    // Lọc theo thuộc tính purchased thay vì selectedForProposal
    const selected = materials.filter((m) => m.purchased);
    if (!selected.length)
      return Alert.alert(
        'Chưa chọn vật tư',
        'Vui lòng tick chọn các vật tư cần mua.'
      );
    navigation.navigate('CreateProposal', {
      projectId,
      projectName: projectDetails?.name || projectName,
      selectedItems: selected,
    });
  };

  // Modified function to show confirmation before saving
  const handleSavePurchaseList = () => {
    const selected = materials.filter((m) => m.purchased);

    if (selected.length === 0) {
      Alert.alert(
        'Chưa chọn vật tư',
        'Vui lòng tick chọn các vật tư đã mua trước khi lưu.'
      );
      return;
    }

    setPurchasedMaterials(selected);
    setShowConfirmModal(true);
  };

  // New function to actually save the purchase list after confirmation
  const confirmSavePurchaseList = async () => {
    setSaving(true);
    try {
      // Create a map of material names to purchase status
      const purchasedItems = {};
      materials.forEach((item) => {
        purchasedItems[item.name] = item.purchased === true;
      });

      // Save to purchase history collection
      const purchaseRef = collection(db, 'projects', projectId, 'purchases');
      await addDoc(purchaseRef, {
        projectId,
        purchasedItems,
        createdAt: serverTimestamp(),
        createdBy: currentUser?.uid || 'unknown',
        createdByName: currentUser?.displayName || 'Người dùng',
      });

      // Calculate if all items are purchased
      const allItems = Object.values(purchasedItems);
      const purchasedCount = allItems.filter((v) => v === true).length;
      const totalCount = allItems.length;

      // Update project task status based on purchase progress
      const projectRef = doc(db, 'projects', projectId);
      await updateDoc(projectRef, {
        'tasks.material_purchasing.status':
          purchasedCount === totalCount ? 'completed' : 'in_progress',
      });

      // Close modal and show success message
      setShowConfirmModal(false);
      Alert.alert(
        'Thành công',
        `Đã lưu danh sách ${purchasedCount} vật tư đã mua.`
      );

      // Reload purchase history
      const purchaseQuery = query(purchaseRef, orderBy('createdAt', 'desc'));
      const purchaseSnapshot = await getDocs(purchaseQuery);
      setPurchaseHistory(
        purchaseSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );
    } catch (error) {
      console.error('Lỗi khi lưu danh sách:', error);
      Alert.alert('Lỗi', 'Không thể lưu danh sách vật tư.');
    } finally {
      setSaving(false);
    }
  };

  // Handle loading quotation materials
  const handleRequote = useCallback(
    (quotation) => {
      if (quotation.materials && Array.isArray(quotation.materials)) {
        // Get purchase history to merge with quotation materials
        const loadPurchaseHistory = async () => {
          try {
            const purchaseRef = collection(
              db,
              'projects',
              projectId,
              'purchases'
            );
            const purchaseQuery = query(
              purchaseRef,
              orderBy('createdAt', 'desc')
            );
            const purchaseSnapshot = await getDocs(purchaseQuery);

            let purchasedItems = {};
            if (!purchaseSnapshot.empty) {
              const latestPurchase = purchaseSnapshot.docs[0].data();
              purchasedItems = latestPurchase.purchasedItems || {};
              setPurchaseHistory(
                purchaseSnapshot.docs.map((doc) => ({
                  id: doc.id,
                  ...doc.data(),
                }))
              );
            }

            // Merge purchased state with materials
            const materialsWithPurchaseState = quotation.materials.map(
              (item) => ({
                ...item,
                purchased: purchasedItems[item.name] === true,
              })
            );

            setMaterials(materialsWithPurchaseState);
          } catch (error) {
            console.error('Lỗi khi tải lịch sử mua hàng:', error);
          }
        };

        loadPurchaseHistory();
        Alert.alert(
          'Tải thành công',
          `Đã tải dữ liệu từ báo giá ${
            quotation.quotationNumber || 'mới nhất'
          }.`
        );
      } else {
        Alert.alert('Lỗi', 'Báo giá này không chứa dữ liệu vật tư để tải.');
      }
    },
    [projectId]
  );

  // Load approved proposals
  const loadApprovedProposals = useCallback(async () => {
    setLoadingProposals(true);
    try {
      // Get all approved proposals
      const allApproved = await getProposalsByStatus('approved');

      // Filter for this project if projectId is provided
      let projectProposals = allApproved;
      if (projectId) {
        projectProposals = allApproved.filter((p) => p.projectId === projectId);
      }

      setApprovedProposals(projectProposals);
    } catch (error) {
      console.error('Lỗi khi tải đề xuất đã duyệt:', error);
    } finally {
      setLoadingProposals(false);
    }
  }, [projectId]);

  // Handle price updates for a proposal
  const openPriceEditor = (proposal) => {
    // Create a deep copy of materials with price fields
    const materialsWithPrices = proposal.items
      ? JSON.parse(JSON.stringify(proposal.items))
      : [];

    // Ensure each material has price and totalPrice fields
    materialsWithPrices.forEach((item) => {
      if (!item.price) item.price = '';
      if (!item.totalPrice) item.totalPrice = '';
    });

    setEditableMaterials(materialsWithPrices);
    setCurrentProposalId(proposal.id);
    setShowPriceModal(true);
  };

  const handlePriceChange = (index, price) => {
    const updatedMaterials = [...editableMaterials];
    updatedMaterials[index].price = price;

    // Calculate total price if both price and quantity exist
    const quantity = parseFloat(updatedMaterials[index].quantity);
    const priceValue = parseFloat(price);

    if (!isNaN(quantity) && !isNaN(priceValue)) {
      updatedMaterials[index].totalPrice = (quantity * priceValue).toString();
    }

    setEditableMaterials(updatedMaterials);
  };

  const savePriceUpdates = async () => {
    if (!currentProposalId) return;

    try {
      await updateProposalMaterialPrices(currentProposalId, editableMaterials);
      Alert.alert('Thành công', 'Đã cập nhật giá vật tư');
      setShowPriceModal(false);
      loadApprovedProposals(); // Reload to get updated data
    } catch (error) {
      console.error('Error updating prices:', error);
      Alert.alert('Lỗi', 'Không thể cập nhật giá vật tư');
    }
  };

  // Load project materials and purchase history
  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        setLoading(true);
        try {
          // Load quotations to get materials
          const pastQuotations = await getQuotationsByProject(projectId);
          setQuotations(pastQuotations);

          if (pastQuotations.length > 0) {
            // Automatically load the latest quotation
            const latestQuotation = pastQuotations[0];
            handleRequote(latestQuotation);
          }

          // Load approved proposals
          await loadApprovedProposals();
        } catch (error) {
          console.error('Lỗi khi tải dữ liệu:', error);
          Alert.alert('Lỗi', 'Không thể tải dữ liệu vật tư.');
        } finally {
          setLoading(false);
        }
      };

      loadData();
    }, [projectId, handleRequote, loadApprovedProposals])
  );

  // Calculate purchase stats
  const calculateStats = () => {
    if (!materials.length)
      return { purchasedCount: 0, totalCount: 0, percentComplete: 0 };

    const purchasedCount = materials.filter((item) => item.purchased).length;
    const totalCount = materials.length;
    const percentComplete = Math.round((purchasedCount / totalCount) * 100);

    return { purchasedCount, totalCount, percentComplete };
  };

  const stats = calculateStats();

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Danh Sách Vật Tư Cần Mua</Text>
      <Text style={styles.projectName}>
        {projectDetails?.name || projectName}
      </Text>

      {materials.length > 0 && (
        <View style={styles.statsContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${stats.percentComplete}%` },
              ]}
            />
          </View>
          <Text style={styles.statsText}>
            {stats.purchasedCount}/{stats.totalCount} vật tư đã mua (
            {stats.percentComplete}%)
          </Text>
        </View>
      )}
    </View>
  );

  const renderMaterialsSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Danh sách vật tư</Text>
      {materials.length > 0 ? (
        <>
          <View style={styles.tableHeader}>
            <View style={{ width: 30 }}></View>
            <Text style={[styles.headerCell, { flex: 3 }]}>Tên vật tư</Text>
            <Text style={[styles.headerCell, { flex: 1, textAlign: 'center' }]}>
              SL
            </Text>
            <Text style={[styles.headerCell, { flex: 1, textAlign: 'center' }]}>
              KL
            </Text>
            <Text
              style={[styles.headerCell, { flex: 0.8, textAlign: 'center' }]}
            >
              ĐVT
            </Text>
          </View>
          <FlatList
            data={materials}
            keyExtractor={(item, index) => `material-row-${index}`}
            renderItem={({ item, index }) => (
              <MaterialRow
                item={item}
                index={index}
                onTogglePurchased={handleTogglePurchased}
              />
            )}
            nestedScrollEnabled={true}
            style={{ maxHeight: 300 }}
          />
        </>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="list-outline" size={48} color="#ccc" />
          <Text style={styles.emptyText}>
            Chưa có dữ liệu vật tư từ báo giá
          </Text>
          <TouchableOpacity
            style={styles.createQuotationButton}
            onPress={() =>
              navigation.navigate('Quotation', {
                projectId,
                projectName: projectDetails?.name || projectName,
                project: projectDetails,
              })
            }
          >
            <Text style={styles.createQuotationButtonText}>Tạo báo giá</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderPurchaseHistory = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Danh sách cần mua</Text>
      {purchaseHistory.length === 0 ? (
        <Text style={styles.emptyText}>
          Chưa có danh sách mua hàng nào được lưu.
        </Text>
      ) : (
        <FlatList
          data={purchaseHistory}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const purchasedCount = Object.values(item.purchasedItems).filter(
              (v) => v === true
            ).length;
            const totalCount = Object.values(item.purchasedItems).length;

            return (
              <TouchableOpacity
                style={styles.historyItem}
                onPress={() => viewHistoryDetails(item)}
              >
                <Text style={styles.historyDate}>
                  {item.createdAt
                    ? new Date(
                        item.createdAt.seconds * 1000
                      ).toLocaleDateString('vi-VN')
                    : 'Không rõ ngày'}
                </Text>
                <Text style={styles.historyCreator}>
                  Người lưu: {item.createdByName || 'Không xác định'}
                </Text>
                <View style={styles.historyStats}>
                  <Text style={styles.historyStatText}>
                    Đã mua: {purchasedCount} vật tư
                  </Text>
                  <Text style={styles.historyStatText}>
                    Chưa mua: {totalCount - purchasedCount} vật tư
                  </Text>
                </View>
                <View style={styles.viewDetailsButton}>
                  <Text style={styles.viewDetailsText}>Xem chi tiết</Text>
                  <Ionicons name="chevron-forward" size={16} color="#0066cc" />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );

  const renderQuotationsSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Lịch sử báo giá</Text>
      {quotations.length === 0 ? (
        <Text style={styles.emptyText}>Chưa có báo giá nào.</Text>
      ) : (
        <FlatList
          horizontal
          data={quotations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.quotationItem}
              onPress={() => handleRequote(item)}
            >
              <Text style={styles.quotationNumber}>
                {item.quotationNumber || `Báo giá #${item.id.substring(0, 5)}`}
              </Text>
              <Text style={styles.quotationDate}>
                {item.createdAt
                  ? new Date(item.createdAt.seconds * 1000).toLocaleDateString(
                      'vi-VN'
                    )
                  : 'Không rõ'}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );

  // Render approved proposals section
  const renderApprovedProposals = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Đề xuất đã được duyệt</Text>
      </View>

      {loadingProposals ? (
        <ActivityIndicator size="small" color="#0066cc" />
      ) : approvedProposals.length === 0 ? (
        <Text style={styles.emptyText}>Chưa có đề xuất nào được duyệt</Text>
      ) : (
        <FlatList
          data={approvedProposals}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.proposalCard}>
              <View style={styles.proposalHeader}>
                <Text style={styles.proposalCode}>
                  {item.proposalCode || `PO-${item.id.substring(0, 6)}`}
                </Text>
                {item.hasPrices && (
                  <View style={styles.priceBadge}>
                    <Text style={styles.priceBadgeText}>Đã có giá</Text>
                  </View>
                )}
              </View>

              <Text style={styles.proposalProject}>{item.projectName}</Text>

              <View style={styles.proposalDetails}>
                <View style={styles.proposalDetailRow}>
                  <Text style={styles.proposalDetailLabel}>Ngày yêu cầu:</Text>
                  <Text style={styles.proposalDetailValue}>
                    {item.requiredDate
                      ? new Date(
                          item.requiredDate.seconds * 1000
                        ).toLocaleDateString('vi-VN')
                      : 'N/A'}
                  </Text>
                </View>

                <View style={styles.proposalDetailRow}>
                  <Text style={styles.proposalDetailLabel}>
                    Số lượng vật tư:
                  </Text>
                  <Text style={styles.proposalDetailValue}>
                    {item.items?.length || 0}
                  </Text>
                </View>

                {item.totalValue && (
                  <View style={styles.proposalDetailRow}>
                    <Text style={styles.proposalDetailLabel}>
                      Tổng giá trị:
                    </Text>
                    <Text style={styles.proposalDetailValue}>
                      {item.totalValue.toLocaleString('vi-VN')} VNĐ
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.proposalActions}>
                <TouchableOpacity
                  style={[styles.proposalButton, styles.viewButton]}
                  onPress={() => navigation.navigate('ProposalList')}
                >
                  <Ionicons name="eye-outline" size={16} color="#0066cc" />
                  <Text style={styles.viewButtonText}>Xem chi tiết</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.proposalButton, styles.priceButton]}
                  onPress={() => openPriceEditor(item)}
                >
                  <Ionicons name="cash-outline" size={16} color="#28a745" />
                  <Text style={[styles.viewButtonText, { color: '#28a745' }]}>
                    {item.hasPrices ? 'Cập nhật giá' : 'Nhập giá'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          contentContainerStyle={styles.proposalList}
        />
      )}
    </View>
  );

  // New function to render the confirmation modal
  const renderConfirmationModal = () => (
    <Modal visible={showConfirmModal} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Xác nhận vật tư đã mua</Text>
            <TouchableOpacity onPress={() => setShowConfirmModal(false)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <Text style={styles.confirmText}>
            Bạn đang xác nhận đã mua {purchasedMaterials.length} vật tư sau:
          </Text>

          <ScrollView style={styles.confirmList}>
            {purchasedMaterials.map((item, index) => (
              <View key={index} style={styles.confirmItem}>
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color="#4CAF50"
                  style={styles.confirmIcon}
                />
                <View style={styles.confirmItemContent}>
                  <Text style={styles.confirmItemName}>
                    {index + 1}. {item.name}
                  </Text>
                  <Text style={styles.confirmItemDetails}>
                    {item.quantity} {item.unit || 'cái'}
                    {item.quyCach ? ` - ${item.quyCach}` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowConfirmModal(false)}
            >
              <Text style={styles.cancelButtonText}>Hủy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.confirmButton]}
              onPress={confirmSavePurchaseList}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.confirmButtonText}>Xác nhận</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Function to view history details
  const viewHistoryDetails = async (historyItem) => {
    setSelectedHistory(historyItem);

    try {
      // Get the full material list from the latest quotation
      let materialsList = [...materials];

      // Merge with purchase status from history
      if (historyItem.purchasedItems) {
        materialsList = materialsList.map((material) => ({
          ...material,
          purchased: historyItem.purchasedItems[material.name] === true,
        }));
      }

      setHistoryMaterials(materialsList);
      setShowHistoryDetailModal(true);
    } catch (error) {
      console.error('Lỗi khi tải chi tiết lịch sử:', error);
      Alert.alert('Lỗi', 'Không thể tải chi tiết lịch sử mua hàng.');
    }
  };

  // Function to toggle purchase status in history detail
  const toggleHistoryItemStatus = (index) => {
    setHistoryMaterials((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        purchased: !updated[index].purchased,
      };
      return updated;
    });
  };

  // Function to update purchase history
  const updatePurchaseHistory = async () => {
    if (!selectedHistory) return;

    setUpdatingHistory(true);
    try {
      // Create updated purchasedItems object
      const purchasedItems = {};
      historyMaterials.forEach((item) => {
        purchasedItems[item.name] = item.purchased === true;
      });

      // Update the history document
      const historyRef = doc(
        db,
        'projects',
        projectId,
        'purchases',
        selectedHistory.id
      );
      await updateDoc(historyRef, {
        purchasedItems,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.uid || 'unknown',
        updatedByName:
          currentUser?.displayName || currentUser?.email || 'Người dùng',
      });

      // Calculate if all items are purchased
      const purchasedCount = Object.values(purchasedItems).filter(
        (v) => v === true
      ).length;
      const totalCount = Object.values(purchasedItems).length;

      // Update project task status
      const projectRef = doc(db, 'projects', projectId);
      await updateDoc(projectRef, {
        'tasks.material_purchasing.status':
          purchasedCount === totalCount ? 'completed' : 'in_progress',
      });

      // Reload purchase history
      const purchaseRef = collection(db, 'projects', projectId, 'purchases');
      const purchaseQuery = query(purchaseRef, orderBy('createdAt', 'desc'));
      const purchaseSnapshot = await getDocs(purchaseQuery);
      setPurchaseHistory(
        purchaseSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );

      setShowHistoryDetailModal(false);
      Alert.alert('Thành công', 'Đã cập nhật trạng thái mua hàng.');
    } catch (error) {
      console.error('Lỗi khi cập nhật lịch sử:', error);
      Alert.alert('Lỗi', 'Không thể cập nhật lịch sử mua hàng.');
    } finally {
      setUpdatingHistory(false);
    }
  };

  // New function to render history detail modal
  const renderHistoryDetailModal = () => (
    <Modal visible={showHistoryDetailModal} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, styles.historyModalContainer]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Chi tiết mua hàng</Text>
            <TouchableOpacity onPress={() => setShowHistoryDetailModal(false)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {selectedHistory && (
            <View style={styles.historyDetailHeader}>
              <Text style={styles.historyDetailDate}>
                Ngày:{' '}
                {selectedHistory.createdAt
                  ? new Date(
                      selectedHistory.createdAt.seconds * 1000
                    ).toLocaleDateString('vi-VN')
                  : 'Không rõ'}
              </Text>
              <Text style={styles.historyDetailPerson}>
                Người lưu: {selectedHistory.createdByName || 'Không xác định'}
              </Text>
              {selectedHistory.updatedAt && (
                <Text style={styles.historyDetailUpdate}>
                  Cập nhật lần cuối:{' '}
                  {new Date(
                    selectedHistory.updatedAt.seconds * 1000
                  ).toLocaleDateString('vi-VN')}
                </Text>
              )}
            </View>
          )}

          <Text style={styles.historyDetailInstruction}>
            Nhấn vào ô vuông để thay đổi trạng thái đã mua/chưa mua
          </Text>

          <ScrollView style={styles.historyDetailList}>
            {historyMaterials.length > 0 ? (
              historyMaterials.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.historyDetailItem}
                  onPress={() => toggleHistoryItemStatus(index)}
                >
                  <View style={styles.historyCheckbox}>
                    <Ionicons
                      name={item.purchased ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={item.purchased ? '#4CAF50' : '#999'}
                    />
                  </View>
                  <View style={styles.historyItemContent}>
                    <Text style={styles.historyItemName}>{item.name}</Text>
                    <Text style={styles.historyItemDetails}>
                      {item.quantity} {item.unit || 'cái'}
                      {item.quyCach ? ` - ${item.quyCach}` : ''}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.historyItemStatus,
                      {
                        backgroundColor: item.purchased ? '#e8f5e9' : '#fff3e0',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.historyItemStatusText,
                        { color: item.purchased ? '#4CAF50' : '#FF9800' },
                      ]}
                    >
                      {item.purchased ? 'Đã mua' : 'Chưa mua'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.emptyText}>Không có dữ liệu vật tư</Text>
            )}
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowHistoryDetailModal(false)}
            >
              <Text style={styles.cancelButtonText}>Đóng</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.updateButton]}
              onPress={updatePurchaseHistory}
              disabled={updatingHistory}
            >
              {updatingHistory ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.updateButtonText}>Cập nhật</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}

      {loading || loadingProject ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView>
            {renderQuotationsSection()}
            {renderMaterialsSection()}
            {renderApprovedProposals()}
            {renderPurchaseHistory()}
          </ScrollView>

          {materials.length > 0 && (
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSavePurchaseList}
                disabled={saving}
              >
                <View style={styles.buttonContent}>
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="save-outline" size={20} color="#fff" />
                  )}
                  <Text style={styles.saveButtonText}>
                    Lưu danh sách mua hàng
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  { backgroundColor: '#0066cc', marginTop: 8 },
                ]}
                onPress={handleCreateProposal}
              >
                <View style={styles.buttonContent}>
                  <Ionicons name="send" size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>
                    Tạo Đề Xuất Mua Vật Tư
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Price Update Modal */}
      <Modal visible={showPriceModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cập nhật giá vật tư</Text>
              <TouchableOpacity onPress={() => setShowPriceModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.priceScrollView}>
              {editableMaterials && editableMaterials.length > 0 ? (
                editableMaterials.map((item, index) => (
                  <View key={index} style={styles.priceItem}>
                    <Text style={styles.materialName}>
                      {index + 1}. {item.name || 'Không có tên'}
                    </Text>
                    <View style={styles.materialDetails}>
                      {item.specification ? (
                        <Text style={styles.materialSpec}>
                          Quy cách: {item.specification}
                        </Text>
                      ) : null}
                      <Text style={styles.materialQuantity}>
                        Số lượng: {item.quantity || 0} {item.unit || ''}
                      </Text>

                      <View style={styles.priceInputContainer}>
                        <Text style={styles.priceLabel}>Đơn giá (VNĐ):</Text>
                        <TextInput
                          style={styles.priceInput}
                          value={item.price}
                          onChangeText={(text) =>
                            handlePriceChange(index, text)
                          }
                          keyboardType="numeric"
                          placeholder="Nhập đơn giá"
                        />
                      </View>

                      {item.totalPrice && (
                        <Text style={styles.materialTotalPrice}>
                          Thành tiền: {item.totalPrice} VNĐ
                        </Text>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>Không có vật tư nào.</Text>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowPriceModal(false)}
              >
                <Text style={styles.cancelButtonText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={savePriceUpdates}
              >
                <Text style={styles.saveButtonText}>Lưu giá</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirmation Modal */}
      {renderConfirmationModal()}

      {/* History Detail Modal */}
      {renderHistoryDetailModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  projectName: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 8,
    margin: 8,
    padding: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 8,
    marginBottom: 8,
  },
  headerCell: {
    fontWeight: '600',
    fontSize: 14,
    color: '#333',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 8,
    alignItems: 'center',
  },
  checkbox: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableCell: {
    paddingHorizontal: 4,
  },
  materialName: {
    fontSize: 14,
    fontWeight: '500',
  },
  materialType: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // This will center the content
    paddingVertical: 12,
    marginHorizontal: 8,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 15, // Slightly larger text
    textAlignVertical: 'center', // Align text vertically
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    color: '#999',
    marginTop: 8,
  },
  createQuotationButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#0066cc',
    borderRadius: 20,
  },
  createQuotationButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  historyItem: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  historyDate: {
    fontWeight: '600',
    fontSize: 14,
  },
  historyCreator: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  historyStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  historyStatText: {
    fontSize: 12,
  },
  statsContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 5,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  statsText: {
    fontSize: 14,
    color: '#666',
  },
  quotationItem: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 10,
    marginRight: 10,
    width: 150,
    backgroundColor: '#f9f9f9',
  },
  quotationNumber: {
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 4,
  },
  quotationDate: {
    fontSize: 12,
    color: '#666',
  },
  buttonContainer: {
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%', // Ensure the content takes the full width
  },

  // Proposal card styles
  proposalCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  proposalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  proposalCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  priceBadge: {
    backgroundColor: '#28a745',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  priceBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  proposalProject: {
    fontSize: 14,
    color: '#444',
    marginBottom: 8,
  },
  proposalDetails: {
    marginBottom: 10,
  },
  proposalDetailRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  proposalDetailLabel: {
    fontSize: 13,
    color: '#666',
    width: 100,
  },
  proposalDetailValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  proposalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
  },
  proposalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginLeft: 8,
  },
  viewButton: {
    backgroundColor: '#f0f7ff',
  },
  priceButton: {
    backgroundColor: '#e8f5e9',
  },
  viewButtonText: {
    color: '#0066cc',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    padding: 16,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  priceScrollView: {
    maxHeight: '70%',
  },
  priceItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  materialName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  materialSpec: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  materialQuantity: {
    fontSize: 13,
    color: '#333',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  priceLabel: {
    fontSize: 13,
    color: '#555',
    width: 100,
  },
  priceInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
  },
  materialTotalPrice: {
    fontSize: 13,
    color: '#28a745',
    fontWeight: '500',
    marginTop: 2,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  modalButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    color: '#333',
  },
  saveButton: {
    backgroundColor: '#28a745',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  // New styles for confirmation modal
  confirmText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
  },
  confirmList: {
    maxHeight: 300,
    marginBottom: 12,
  },
  confirmItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  confirmIcon: {
    marginRight: 8,
  },
  confirmItemContent: {
    flex: 1,
  },
  confirmItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  confirmItemDetails: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    minWidth: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
  },

  // History detail modal styles
  historyModalContainer: {
    maxHeight: '80%',
    width: '90%',
  },
  historyDetailHeader: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 4,
    marginBottom: 16,
  },
  historyDetailDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  historyDetailPerson: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  historyDetailUpdate: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  historyDetailInstruction: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  historyDetailList: {
    maxHeight: '60%',
  },
  historyDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  historyCheckbox: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyItemContent: {
    flex: 1,
    paddingHorizontal: 8,
  },
  historyItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  historyItemDetails: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  historyItemStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  historyItemStatusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  updateButton: {
    backgroundColor: '#0066cc',
    minWidth: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateButtonText: {
    color: '#fff',
    fontWeight: '600',
  },

  // ... other existing styles ...
});

export default MaterialPurchaseScreen;
