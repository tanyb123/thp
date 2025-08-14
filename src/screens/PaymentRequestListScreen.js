// src/screens/PaymentRequestListScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { getProjectById } from '../api/projectService';
import { getPaymentRequestsByProject } from '../api/paymentService';
import { getQuotationsByProject } from '../api/quotationService';

const PaymentRequestListScreen = ({ route, navigation }) => {
  const { projectId } = route.params;
  const { theme } = useTheme();
  const [project, setProject] = useState(null);
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [latestQuotation, setLatestQuotation] = useState(null);
  const [totalPaidAmount, setTotalPaidAmount] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Load project details
        const projectData = await getProjectById(projectId);
        if (!projectData) {
          Alert.alert('Lỗi', 'Không tìm thấy thông tin dự án');
          navigation.goBack();
          return;
        }
        setProject(projectData);

        // Load payment requests
        const requests = await getPaymentRequestsByProject(projectId);
        setPaymentRequests(requests);

        // Calculate total paid amount
        const totalPaid = requests.reduce((sum, request) => {
          return sum + (request.totalPaid || 0);
        }, 0);
        setTotalPaidAmount(totalPaid);

        // Load latest quotation
        const quotations = await getQuotationsByProject(projectId);
        if (quotations && quotations.length > 0) {
          setLatestQuotation(quotations[0]);
        }
      } catch (error) {
        console.error('Error loading payment requests:', error);
        Alert.alert('Lỗi', 'Không thể tải danh sách yêu cầu thanh toán');
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Refresh data when screen is focused
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });

    return unsubscribe;
  }, [projectId, navigation]);

  // Helper function to get quotation total amount
  const getQuotationTotalAmount = (quotation) => {
    if (!quotation) return 0;

    // Check multiple possible field names for total amount
    return (
      quotation.grandTotal ||
      quotation.totalAmount ||
      quotation.amount ||
      quotation.total ||
      quotation.quotationAmount ||
      quotation.finalAmount ||
      quotation.afterDiscountTotal ||
      quotation.subTotal ||
      0
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Chưa xác định';

    try {
      const date = timestamp.seconds
        ? new Date(timestamp.seconds * 1000)
        : new Date(timestamp);

      return date.toLocaleDateString('vi-VN');
    } catch (error) {
      return 'Ngày không hợp lệ';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return '#4CAF50'; // Green
      case 'partially_paid':
        return '#FF9800'; // Orange
      case 'overdue':
        return '#F44336'; // Red
      case 'pending':
      default:
        return '#2196F3'; // Blue
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'paid':
        return 'Đã thanh toán';
      case 'partially_paid':
        return 'Thanh toán một phần';
      case 'overdue':
        return 'Quá hạn';
      case 'pending':
      default:
        return 'Chờ thanh toán';
    }
  };

  const renderPaymentRequest = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.paymentRequestCard,
        { backgroundColor: theme.cardBackground },
      ]}
      onPress={() =>
        navigation.navigate('PaymentRequestDetail', { requestId: item.id })
      }
    >
      <View style={styles.cardHeader}>
        <View style={styles.requestInfo}>
          <Text style={[styles.requestNumber, { color: theme.text }]}>
            {item.requestNumber}
          </Text>
          {item.isManualPayment && (
            <View style={styles.manualPaymentBadge}>
              <Ionicons name="hand-left-outline" size={12} color="#FF9800" />
              <Text style={styles.manualPaymentText}>Thủ công</Text>
            </View>
          )}
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) },
          ]}
        >
          <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
        </View>
      </View>

      <Text style={[styles.description, { color: theme.textSecondary }]}>
        {item.description}
      </Text>

      <View style={styles.amountRow}>
        <View style={styles.amountInfo}>
          <Text style={[styles.amountLabel, { color: theme.textSecondary }]}>
            Số tiền:
          </Text>
          <Text style={[styles.amountValue, { color: theme.text }]}>
            {formatCurrency(item.amount)}
          </Text>
        </View>
        <View style={styles.amountInfo}>
          <Text style={[styles.amountLabel, { color: theme.textSecondary }]}>
            Đã thanh toán:
          </Text>
          <Text
            style={[
              styles.amountValue,
              {
                color:
                  item.totalPaid >= item.amount ? '#4CAF50' : theme.primary,
              },
            ]}
          >
            {formatCurrency(item.totalPaid || 0)}
          </Text>
        </View>
      </View>

      <View style={styles.dateRow}>
        <View style={styles.dateInfo}>
          <Ionicons
            name="calendar-outline"
            size={16}
            color={theme.textSecondary}
          />
          <Text style={[styles.dateText, { color: theme.textSecondary }]}>
            {formatDate(item.issueDate)}
          </Text>
        </View>
        <View style={styles.dateInfo}>
          <Ionicons name="time-outline" size={16} color={theme.textSecondary} />
          <Text style={[styles.dateText, { color: theme.textSecondary }]}>
            Hạn: {formatDate(item.dueDate)}
          </Text>
        </View>
      </View>

      {item.isManualPayment && (
        <View style={styles.manualPaymentInfo}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color="#FF9800"
          />
          <Text style={styles.manualPaymentInfoText}>
            Thanh toán thủ công - đã hoàn thành
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Quản lý Thanh toán
        </Text>
      </View>

      <View
        style={[styles.projectInfo, { backgroundColor: theme.cardBackground }]}
      >
        <Text style={[styles.projectName, { color: theme.text }]}>
          {project?.name || 'Đang tải...'}
        </Text>
        <Text style={[styles.customerName, { color: theme.textSecondary }]}>
          {project?.customerName || ''}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Đang tải dữ liệu...
          </Text>
        </View>
      ) : (
        <>
          {/* Payment Progress Summary */}
          {latestQuotation && (
            <View
              style={[
                styles.paymentProgressCard,
                { backgroundColor: theme.cardBackground },
              ]}
            >
              <Text style={[styles.progressTitle, { color: theme.text }]}>
                Tổng quan thanh toán
              </Text>
              <View style={styles.progressInfo}>
                <View style={styles.progressRow}>
                  <Text
                    style={[
                      styles.progressLabel,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Báo giá gần nhất:
                  </Text>
                  <Text style={[styles.progressValue, { color: theme.text }]}>
                    {formatCurrency(getQuotationTotalAmount(latestQuotation))}
                  </Text>
                </View>
                <View style={styles.progressRow}>
                  <Text
                    style={[
                      styles.progressLabel,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Đã thanh toán:
                  </Text>
                  <Text style={[styles.progressValue, { color: '#4CAF50' }]}>
                    {formatCurrency(totalPaidAmount)}
                  </Text>
                </View>
                <View style={styles.progressRow}>
                  <Text
                    style={[
                      styles.progressLabel,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Còn lại:
                  </Text>
                  <Text style={[styles.progressValue, { color: '#FF9800' }]}>
                    {formatCurrency(
                      getQuotationTotalAmount(latestQuotation) - totalPaidAmount
                    )}
                  </Text>
                </View>
              </View>
              <View style={styles.progressBarContainer}>
                <Text
                  style={[styles.progressText, { color: theme.textSecondary }]}
                >
                  Tiến độ: {formatCurrency(totalPaidAmount)} /{' '}
                  {formatCurrency(getQuotationTotalAmount(latestQuotation))}
                </Text>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(
                          100,
                          (totalPaidAmount /
                            (getQuotationTotalAmount(latestQuotation) || 1)) *
                            100
                        )}%`,
                        backgroundColor:
                          totalPaidAmount >=
                          getQuotationTotalAmount(latestQuotation)
                            ? '#4CAF50'
                            : theme.primary,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          )}

          {/* Payment Requests List */}
          {paymentRequests.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="cash-outline" size={60} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Chưa có yêu cầu thanh toán nào
              </Text>
            </View>
          ) : (
            <FlatList
              data={paymentRequests}
              renderItem={renderPaymentRequest}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() =>
          navigation.navigate('CreatePaymentRequest', { projectId })
        }
      >
        <Ionicons name="add" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  projectInfo: {
    padding: 16,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  projectName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  listContainer: {
    padding: 16,
  },
  paymentRequestCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requestNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  manualPaymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  manualPaymentText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FF9800',
    marginLeft: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  description: {
    fontSize: 14,
    marginBottom: 12,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  amountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 14,
    marginRight: 8,
  },
  amountValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 14,
    marginLeft: 8,
  },
  manualPaymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 8,
  },
  manualPaymentInfoText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FF9800',
    marginLeft: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  paymentProgressCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  progressInfo: {
    marginBottom: 12,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 14,
  },
  progressValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressBarContainer: {
    marginTop: 12,
  },
  progressText: {
    fontSize: 14,
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
});

export default PaymentRequestListScreen;
