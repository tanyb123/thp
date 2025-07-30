import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Image,
  Linking,
  ScrollView,
} from 'react-native';
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getPOsByProject, getAllPOs } from '../api/purchaseOrderService';
import { getProposalsByProject } from '../api/proposalService';

const POListScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { projectId, projectName: routeProjectName } = route.params || {};

  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  // Handler to create PO with materials pre-filled from approved proposal
  const handleCreatePO = async () => {
    if (!projectId) {
      navigation.navigate('CreatePO');
      return;
    }

    try {
      // Fetch proposals for this project
      const proposals = await getProposalsByProject(projectId);
      // Find first approved proposal (could enhance to choose latest or prompt user)
      const approved = proposals.find((p) => p.status === 'approved');

      if (!approved) {
        navigation.navigate('CreatePO', { projectId });
        return;
      }

      const poData = {
        projectId,
        projectName: approved.projectName,
        materials:
          approved.items?.map((item) => ({
            name: item.name,
            specs: item.specification || '',
            unit: item.unit || '',
            quantity: item.quantity?.toString() || '',
            unitPrice: item.price?.toString() || '',
          })) || [],
        vatPercentage: 10,
        proposalId: approved.id,
        proposalCode: approved.proposalCode,
      };

      navigation.navigate('CreatePO', poData);
    } catch (e) {
      console.error('Failed to fetch proposals for PO creation', e);
      navigation.navigate('CreatePO', { projectId });
    }
  };

  // Header button to create new PO
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleCreatePO} style={{ marginRight: 15 }}>
          <Ionicons name="add" size={24} color="#007AFF" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, projectId]);

  const loadPOs = async () => {
    try {
      setLoading(true);
      const data = projectId
        ? await getPOsByProject(projectId)
        : await getAllPOs();
      setPos(data);
    } catch (e) {
      console.error('Failed to load POs', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadPOs();
    }, [projectId])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPOs();
    setRefreshing(false);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.seconds
      ? new Date(timestamp.seconds * 1000)
      : new Date(timestamp);
    return date.toLocaleDateString('vi-VN');
  };

  const renderMaterials = (materials = []) => (
    <View style={styles.materialsContainer}>
      {materials.map((m, index) => (
        <View key={index.toString()} style={styles.materialRow}>
          <Text style={styles.materialName}>
            {index + 1}. {m.name} {m.specs ? `(${m.specs})` : ''}
          </Text>
          <Text style={styles.materialInfo}>
            {m.quantity} {m.unit} x {m.unitPrice}
          </Text>
        </View>
      ))}
    </View>
  );

  const renderItem = ({ item }) => {
    const expanded = expandedId === item.id;
    const isReceived = item.status === 'received';

    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => setExpandedId(expanded ? null : item.id)}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.poNumber}>{item.poNumber || item.id}</Text>
            <Text style={styles.supplierName}>{item.supplierName}</Text>
            <Text style={styles.createdAt}>{formatDate(item.createdAt)}</Text>
          </View>
          <View style={styles.headerRight}>
            {isReceived && (
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>Đã nhận</Text>
              </View>
            )}
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#555"
            />
          </View>
        </TouchableOpacity>

        {expanded && (
          <View style={styles.cardBody}>
            {item.projectName || routeProjectName ? (
              <Text style={styles.label}>
                Dự án: {item.projectName || routeProjectName}
              </Text>
            ) : null}
            {item.proposalNumber ? (
              <Text style={styles.label}>
                Số đề xuất: {item.proposalNumber}
              </Text>
            ) : null}
            {item.deliveryTime ? (
              <Text style={styles.label}>Giao hàng: {item.deliveryTime}</Text>
            ) : null}
            <Text style={styles.sectionTitle}>Vật tư</Text>
            {renderMaterials(item.materials)}

            {isReceived ? (
              <View>
                <View style={styles.receivedInfo}>
                  <Ionicons name="checkmark-circle" size={18} color="#28a745" />
                  <Text style={styles.receivedText}>
                    Đã xác nhận nhận hàng ngày {formatDate(item.receivedAt)}
                  </Text>
                </View>

                {/* Hiển thị ghi chú nếu có */}
                {item.receiptRemarks ? (
                  <Text style={styles.remarksLabel}>Ghi chú:</Text>
                ) : null}
                {item.receiptRemarks ? (
                  <Text style={styles.remarksText}>{item.receiptRemarks}</Text>
                ) : null}

                {/* Hiển thị ảnh nếu có */}
                {item.receiptPhotos && item.receiptPhotos.length > 0 && (
                  <ScrollView
                    horizontal
                    style={styles.photosContainer}
                    contentContainerStyle={{ paddingVertical: 4 }}
                  >
                    {item.receiptPhotos.map((photo, idx) => (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => photo.url && Linking.openURL(photo.url)}
                      >
                        <Image
                          source={{ uri: photo.preview || photo.url }}
                          style={styles.photoThumb}
                        />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            ) : (
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() =>
                  navigation.navigate('ConfirmPOReceipt', { po: item })
                }
              >
                <Ionicons name="checkbox-outline" size={18} color="#fff" />
                <Text style={styles.confirmBtnText}>
                  Xác nhận đã nhận và thêm vào kho
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={{ marginTop: 8 }}>Đang tải...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={pos}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Chưa có đơn đặt hàng</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    marginTop: 8,
    color: '#666',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    backgroundColor: '#28a745',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  poNumber: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  supplierName: {
    fontSize: 14,
    color: '#555',
  },
  createdAt: {
    color: '#888',
    fontSize: 12,
  },
  cardBody: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  label: {
    fontSize: 14,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 8,
  },
  materialsContainer: {
    marginTop: 4,
  },
  materialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  materialName: {
    fontSize: 13,
    flex: 1,
  },
  materialInfo: {
    fontSize: 13,
    color: '#555',
  },
  confirmBtn: {
    marginTop: 12,
    backgroundColor: '#28a745',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
  },
  confirmBtnText: {
    color: '#fff',
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
  },
  receivedInfo: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    padding: 8,
    borderRadius: 6,
  },
  receivedText: {
    marginLeft: 8,
    color: '#2e7d32',
    fontSize: 14,
  },
  remarksLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
  },
  remarksText: {
    fontSize: 13,
    color: '#555',
    marginTop: 4,
  },
  photosContainer: {
    marginTop: 8,
    paddingVertical: 4,
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: 4,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#eee',
  },
});

export default POListScreen;
