// src/screens/ProposalListScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import {
  getProposalsByStatus,
  updateProposalStatus,
  canApproveProposal,
  updateProposalMaterialPrices,
} from '../api/proposalService';

const ProposalListScreen = ({ navigation }) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState([]);
  const [selectedTab, setSelectedTab] = useState('pending');
  const [refreshing, setRefreshing] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [comment, setComment] = useState('');
  const [showMaterialsModal, setShowMaterialsModal] = useState(false);
  const [selectedMaterials, setSelectedMaterials] = useState([]);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [editableMaterials, setEditableMaterials] = useState([]);
  const [currentProposalId, setCurrentProposalId] = useState(null);

  const canApprove = canApproveProposal(currentUser?.role);

  useEffect(() => {
    loadProposals();
  }, [selectedTab]);

  const loadProposals = async () => {
    setLoading(true);
    try {
      const data = await getProposalsByStatus(selectedTab);
      console.log(`Loaded ${selectedTab} proposals:`, data.length);
      setProposals(data);
    } catch (error) {
      console.error('Error loading proposals:', error);
      Alert.alert(
        'Lỗi',
        'Không thể tải danh sách đề xuất. Vui lòng tạo chỉ mục theo hướng dẫn trong Firebase Console.'
      );
      setProposals([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadProposals();
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      if (timestamp.toDate) {
        return timestamp.toDate().toLocaleDateString('vi-VN');
      } else if (timestamp instanceof Date) {
        return timestamp.toLocaleDateString('vi-VN');
      }
      return 'N/A';
    } catch (e) {
      return 'N/A';
    }
  };

  const handleApprove = (proposal) => {
    setSelectedProposal(proposal);
    setComment('');
    setShowApproveModal(true);
  };

  const handleReject = (proposal) => {
    setSelectedProposal(proposal);
    setComment('');
    setShowRejectModal(true);
  };

  const confirmApprove = async () => {
    if (!selectedProposal) return;

    try {
      await updateProposalStatus(
        selectedProposal.id,
        'approved',
        currentUser.uid,
        currentUser.displayName || currentUser.email,
        comment
      );
      setShowApproveModal(false);
      Alert.alert('Thành công', 'Đã phê duyệt đề xuất');
      loadProposals();
    } catch (error) {
      console.error('Error approving proposal:', error);
      Alert.alert('Lỗi', 'Không thể phê duyệt đề xuất');
    }
  };

  const confirmReject = async () => {
    if (!selectedProposal) return;

    if (!comment.trim()) {
      return Alert.alert('Thiếu thông tin', 'Vui lòng nhập lý do từ chối');
    }

    try {
      await updateProposalStatus(
        selectedProposal.id,
        'rejected',
        currentUser.uid,
        currentUser.displayName || currentUser.email,
        comment
      );
      setShowRejectModal(false);
      Alert.alert('Thành công', 'Đã từ chối đề xuất');
      loadProposals();
    } catch (error) {
      console.error('Error rejecting proposal:', error);
      Alert.alert('Lỗi', 'Không thể từ chối đề xuất');
    }
  };

  const showMaterialDetails = (materials) => {
    setSelectedMaterials(materials || []);
    setShowMaterialsModal(true);
  };

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
      loadProposals(); // Reload to get updated data
    } catch (error) {
      console.error('Error updating prices:', error);
      Alert.alert('Lỗi', 'Không thể cập nhật giá vật tư');
    }
  };

  const navigateToProject = (projectId) => {
    if (projectId) {
      navigation.navigate('ProjectDetail', { projectId });
    } else {
      Alert.alert('Thông báo', 'Không tìm thấy thông tin dự án.');
    }
  };

  // Add function to navigate to CreatePO screen
  const navigateToCreatePO = (proposal) => {
    if (!proposal.projectId) {
      Alert.alert('Thông báo', 'Cần có thông tin dự án để tạo đơn đặt hàng.');
      return;
    }

    // Check if materials have prices
    const missingPrices = proposal.items?.some(
      (item) => !item.price || item.price === '0' || item.price === ''
    );
    if (missingPrices) {
      Alert.alert(
        'Cần cập nhật giá',
        'Một số vật tư chưa có giá. Vui lòng cập nhật giá trước khi tạo đơn đặt hàng.',
        [
          { text: 'Đóng', style: 'cancel' },
          { text: 'Cập nhật giá', onPress: () => openPriceEditor(proposal) },
        ]
      );
      return;
    }

    // Prepare data for PO creation
    const poData = {
      projectId: proposal.projectId,
      projectName: proposal.projectName,
      materials:
        proposal.items?.map((item) => ({
          name: item.name,
          specs: item.specification || '',
          unit: item.unit || '',
          quantity: item.quantity || '0',
          unitPrice: item.price || '0',
        })) || [],
      vatPercentage: 10,
      proposalId: proposal.id,
      proposalCode: proposal.proposalCode,
    };

    navigation.navigate('CreatePO', poData);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return '#FF3B30';
      case 'normal':
        return '#007AFF';
      default:
        return '#007AFF';
    }
  };

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'Gấp';
      case 'normal':
        return 'Bình thường';
      default:
        return priority || 'Bình thường';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return '#4CAF50';
      case 'rejected':
        return '#FF3B30';
      case 'pending':
        return '#FF9500';
      default:
        return '#999';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'approved':
        return 'Đã duyệt';
      case 'rejected':
        return 'Từ chối';
      case 'pending':
        return 'Chờ duyệt';
      default:
        return status || 'Không xác định';
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.proposalCode}>{item.proposalCode}</Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) },
          ]}
        >
          <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
        </View>
      </View>

      <Text style={styles.projectName}>{item.projectName}</Text>

      <View style={styles.infoRow}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Người đề xuất:</Text>
          <Text style={styles.infoValue}>{item.createdByName || 'N/A'}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Ngày tạo:</Text>
          <Text style={styles.infoValue}>{formatDate(item.createdAt)}</Text>
        </View>
      </View>

      <View style={styles.infoRow}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Ngày cần cung cấp:</Text>
          <Text style={styles.infoValue}>{formatDate(item.requiredDate)}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Mức độ:</Text>
          {item.priority === 'normal' ? (
            <Text style={styles.infoValue}>
              {getPriorityLabel(item.priority)}
            </Text>
          ) : (
            <View
              style={[
                styles.priorityBadge,
                { backgroundColor: getPriorityColor(item.priority) },
              ]}
            >
              <Text style={styles.priorityText}>
                {getPriorityLabel(item.priority)}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.purposeContainer}>
        <Text style={styles.purposeLabel}>Mục đích:</Text>
        <Text style={styles.purposeText}>
          {item.purpose || 'Không có mô tả'}
        </Text>
      </View>

      <View style={styles.cardActions}>
        <Text style={styles.itemsCount}>
          Số lượng vật tư: {item.items?.length || 0}
        </Text>
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={styles.viewButton}
            onPress={() => showMaterialDetails(item.items)}
          >
            <Ionicons name="list" size={16} color="#0066cc" />
            <Text style={styles.viewButtonText}>Xem vật tư</Text>
          </TouchableOpacity>

          {item.projectId && (
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => navigateToProject(item.projectId)}
            >
              <Ionicons name="open-outline" size={16} color="#0066cc" />
              <Text style={styles.viewButtonText}>Xem dự án</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.viewButton, styles.priceButton]}
            onPress={() => openPriceEditor(item)}
          >
            <Ionicons name="cash-outline" size={16} color="#28a745" />
            <Text style={[styles.viewButtonText, { color: '#28a745' }]}>
              Cập nhật giá
            </Text>
          </TouchableOpacity>

          {/* Add PO list button for approved proposals */}
          {item.status === 'approved' && (
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() =>
                navigation.navigate('POList', { projectId: item.projectId })
              }
            >
              <Ionicons
                name="document-text-outline"
                size={16}
                color="#0066cc"
              />
              <Text style={styles.viewButtonText}>PO</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {item.status === 'pending' && canApprove && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => handleApprove(item)}
          >
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Phê duyệt</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleReject(item)}
          >
            <Ionicons name="close-circle" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Từ chối</Text>
          </TouchableOpacity>
        </View>
      )}

      {item.status !== 'pending' && item.comment && (
        <View style={styles.commentContainer}>
          <Text style={styles.commentLabel}>Ghi chú:</Text>
          <Text style={styles.commentText}>{item.comment}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Danh sách đề xuất mua vật tư</Text>

      {/* Tab navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'pending' && styles.activeTab]}
          onPress={() => setSelectedTab('pending')}
        >
          <Text
            style={[
              styles.tabText,
              selectedTab === 'pending' && styles.activeTabText,
            ]}
          >
            Chờ duyệt
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, selectedTab === 'approved' && styles.activeTab]}
          onPress={() => setSelectedTab('approved')}
        >
          <Text
            style={[
              styles.tabText,
              selectedTab === 'approved' && styles.activeTabText,
            ]}
          >
            Đã duyệt
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, selectedTab === 'rejected' && styles.activeTab]}
          onPress={() => setSelectedTab('rejected')}
        >
          <Text
            style={[
              styles.tabText,
              selectedTab === 'rejected' && styles.activeTabText,
            ]}
          >
            Từ chối
          </Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
        </View>
      ) : (
        <FlatList
          data={proposals}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>
                {selectedTab === 'pending'
                  ? 'Không có đề xuất nào đang chờ duyệt'
                  : selectedTab === 'approved'
                  ? 'Không có đề xuất nào đã được duyệt'
                  : 'Không có đề xuất nào bị từ chối'}
              </Text>
            </View>
          }
        />
      )}

      {/* Approve Modal */}
      <Modal visible={showApproveModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Phê duyệt đề xuất</Text>
            <Text style={styles.modalSubtitle}>
              {selectedProposal?.proposalCode} - {selectedProposal?.projectName}
            </Text>

            <TextInput
              style={styles.commentInput}
              placeholder="Ghi chú (không bắt buộc)"
              value={comment}
              onChangeText={setComment}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowApproveModal(false)}
              >
                <Text style={styles.cancelButtonText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={confirmApprove}
              >
                <Text style={styles.confirmButtonText}>Xác nhận</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reject Modal */}
      <Modal visible={showRejectModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Từ chối đề xuất</Text>
            <Text style={styles.modalSubtitle}>
              {selectedProposal?.proposalCode} - {selectedProposal?.projectName}
            </Text>

            <TextInput
              style={styles.commentInput}
              placeholder="Lý do từ chối (bắt buộc)"
              value={comment}
              onChangeText={setComment}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowRejectModal(false)}
              >
                <Text style={styles.cancelButtonText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.rejectConfirmButton]}
                onPress={confirmReject}
              >
                <Text style={styles.confirmButtonText}>Xác nhận</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Materials Modal */}
      <Modal visible={showMaterialsModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.materialsModalContainer]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết vật tư</Text>
              <TouchableOpacity onPress={() => setShowMaterialsModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.materialsScrollView}>
              {selectedMaterials && selectedMaterials.length > 0 ? (
                selectedMaterials.map((item, index) => (
                  <View key={index} style={styles.materialItem}>
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
                      {item.price && (
                        <Text style={styles.materialPrice}>
                          Đơn giá: {item.price} VNĐ
                        </Text>
                      )}
                      {item.totalPrice && (
                        <Text style={styles.materialTotalPrice}>
                          Thành tiền: {item.totalPrice} VNĐ
                        </Text>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyMaterialsText}>
                  Không có vật tư nào.
                </Text>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowMaterialsModal(false)}
            >
              <Text style={styles.closeButtonText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Price Update Modal */}
      <Modal visible={showPriceModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContainer, styles.priceModalContainer]}>
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
                <Text style={styles.emptyMaterialsText}>
                  Không có vật tư nào.
                </Text>
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
                <Text style={styles.confirmButtonText}>Lưu giá</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#0066cc',
  },
  tabText: {
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#0066cc',
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  proposalCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  projectName: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 12,
    color: '#444',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start', // Align items to the top
  },
  infoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap', // Allow content to wrap
  },
  infoLabel: {
    fontSize: 13,
    color: '#666',
    marginRight: 4,
  },
  infoValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  priorityText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  purposeContainer: {
    marginTop: 4,
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
  },
  purposeLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#555',
    marginBottom: 4,
  },
  purposeText: {
    fontSize: 13,
    color: '#333',
  },
  cardActions: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 8,
  },
  itemsCount: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#f0f7ff',
    borderRadius: 20,
    marginRight: 8,
  },
  viewButtonText: {
    color: '#0066cc',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    flex: 1,
    marginHorizontal: 4,
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#E74C3C', // Softer red color
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 4,
  },
  commentContainer: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#ccc',
  },
  commentLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
    marginBottom: 2,
  },
  commentText: {
    fontSize: 13,
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 8,
    color: '#666',
    textAlign: 'center',
  },
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
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 10,
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
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
  confirmButton: {
    backgroundColor: '#4CAF50',
  },
  rejectConfirmButton: {
    backgroundColor: '#E74C3C', // Softer red color
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  materialsModalContainer: {
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
  materialsScrollView: {
    maxHeight: '80%', // Limit height to allow button to be visible
  },
  materialItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  materialName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  materialDetails: {
    marginLeft: 16,
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
  emptyMaterialsText: {
    textAlign: 'center',
    padding: 20,
    color: '#666',
  },
  closeButton: {
    backgroundColor: '#0066cc',
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 16,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  priceModalContainer: {
    maxHeight: '85%',
    width: '92%',
  },
  priceScrollView: {
    maxHeight: '75%',
  },
  priceItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
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
  materialPrice: {
    fontSize: 13,
    color: '#28a745',
    marginTop: 2,
  },
  materialTotalPrice: {
    fontSize: 13,
    color: '#28a745',
    fontWeight: '500',
    marginTop: 2,
  },
  saveButton: {
    backgroundColor: '#28a745',
  },
  poButton: {
    backgroundColor: '#fff5e6',
    marginLeft: 8,
    borderColor: '#FF9500',
    borderWidth: 1,
  },
});

export default ProposalListScreen;
