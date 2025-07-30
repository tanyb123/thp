import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { BarChart } from 'react-native-chart-kit';
import { getFunctions, httpsCallable } from 'firebase/functions';

// ID thư mục Google Drive chứa file Excel công nợ
const DEBT_FOLDER_ID = '1Ci_BHZx0-Uhv2xg5IzwLPn05yPAUXOOU';

const screenWidth = Dimensions.get('window').width;

const DebtDashboard = ({ navigation }) => {
  const { theme } = useTheme();
  const { currentUser } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [processingExcel, setProcessingExcel] = useState(false);

  // Hàm lấy dữ liệu tổng quan từ Firestore
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const dashboardRef = doc(db, 'summaries', 'directorDashboard');
      const dashboardSnap = await getDoc(dashboardRef);

      if (dashboardSnap.exists()) {
        const data = dashboardSnap.data();
        setDashboardData(data);
      } else {
        // Nếu không có dữ liệu, thử gọi cloud function để xử lý
        await fetchLatestExcelData();
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Lỗi khi tải dữ liệu tổng quan.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Hàm gọi Cloud Function để xử lý file Excel mới nhất
  const fetchLatestExcelData = async () => {
    try {
      setProcessingExcel(true);
      setError(null);

      // Gọi cloud function triggerExcelProcessing
      const functions = getFunctions(undefined, 'asia-southeast1');
      const triggerExcel = httpsCallable(functions, 'triggerExcelProcessing');

      const result = await triggerExcel();
      console.log('Kết quả xử lý Excel:', result.data);

      if (result.data && result.data.success) {
        // Lấy dữ liệu mới từ Firestore
        const dashboardRef = doc(db, 'summaries', 'directorDashboard');
        const dashboardSnap = await getDoc(dashboardRef);

        if (dashboardSnap.exists()) {
          const data = dashboardSnap.data();
          setDashboardData(data);
        }

        Alert.alert(
          'Cập nhật thành công',
          `Đã cập nhật dữ liệu từ file: ${result.data.fileName}`
        );
      } else {
        throw new Error('Không nhận được dữ liệu từ cloud function');
      }
    } catch (err) {
      console.error('Lỗi khi xử lý file Excel:', err);
      setError(`Lỗi khi xử lý file Excel: ${err.message}`);
      Alert.alert('Lỗi', `Không thể xử lý file Excel: ${err.message}`);
    } finally {
      setProcessingExcel(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLatestExcelData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [fetchDashboardData])
  );

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Không có dữ liệu';

    const date = timestamp.toDate ? timestamp.toDate() : timestamp;
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '0 ₫';

    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>
            Đang tải dữ liệu công nợ...
          </Text>
        </View>
      </View>
    );
  }

  const chartConfig = {
    backgroundGradientFrom: theme.card,
    backgroundGradientTo: theme.card,
    color: (opacity = 1) => `rgba(26, 255, 146, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.7,
    useShadowColorFromDataset: false,
    decimalPlaces: 1,
  };

  const getPayableChartData = () => {
    // Dữ liệu mới không có top5Payable, nên trả về dữ liệu mẫu
    return {
      labels: ['Không có dữ liệu chi tiết'],
      datasets: [
        {
          data: [
            dashboardData?.totalPayable
              ? dashboardData.totalPayable / 1000000
              : 0,
          ],
        },
      ],
    };
  };

  const getReceivableChartData = () => {
    // Dữ liệu mới không có top5Receivable, nên trả về dữ liệu mẫu
    return {
      labels: ['Không có dữ liệu chi tiết'],
      datasets: [
        {
          data: [
            dashboardData?.totalReceivable
              ? dashboardData.totalReceivable / 1000000
              : 0,
          ],
        },
      ],
    };
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Báo Cáo Công Nợ
        </Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={fetchLatestExcelData}
          disabled={processingExcel || refreshing}
        >
          {processingExcel ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Ionicons name="refresh-outline" size={24} color={theme.text} />
          )}
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.error} />
          <Text style={[styles.errorText, { color: theme.error }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            onPress={fetchLatestExcelData}
          >
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.kpiContainer}>
            <View
              style={[
                styles.kpiCard,
                { backgroundColor: '#d9534f' }, // Red for payables
              ]}
            >
              <Text style={styles.kpiLabel}>Tổng Nợ Phải Trả</Text>
              <Text style={styles.kpiValue}>
                {dashboardData?.formattedTotals?.totalPayable ||
                  formatCurrency(dashboardData?.totalPayable)}
              </Text>
            </View>

            <View
              style={[
                styles.kpiCard,
                { backgroundColor: '#5cb85c' }, // Green for receivables
              ]}
            >
              <Text style={styles.kpiLabel}>Tổng Nợ Phải Thu</Text>
              <Text style={styles.kpiValue}>
                {dashboardData?.formattedTotals?.totalReceivable ||
                  formatCurrency(dashboardData?.totalReceivable)}
              </Text>
            </View>

            <View
              style={[
                styles.kpiCard,
                {
                  backgroundColor:
                    (dashboardData?.netPosition || 0) >= 0
                      ? '#5cb85c' // Green for positive
                      : '#d9534f', // Red for negative
                },
              ]}
            >
              <Text style={styles.kpiLabel}>Vị Thế Công Nợ Ròng</Text>
              <Text style={styles.kpiValue}>
                {dashboardData?.formattedTotals?.netPosition ||
                  formatCurrency(dashboardData?.netPosition)}
              </Text>
            </View>

            <View style={[styles.kpiCard, { backgroundColor: theme.card }]}>
              <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
                Cập nhật lần cuối
              </Text>
              <Text style={[styles.lastUpdatedValue, { color: theme.text }]}>
                {dashboardData?.lastUpdated
                  ? formatDate(dashboardData.lastUpdated)
                  : 'Chưa có dữ liệu'}
              </Text>
              {dashboardData?.fileName && (
                <Text style={[styles.fileNameText, { color: theme.textMuted }]}>
                  {dashboardData.fileName}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.chartSection}>
            <Text style={[styles.chartTitle, { color: theme.text }]}>
              Top 5 Công Nợ Phải Trả (Triệu VNĐ)
            </Text>
            <View style={styles.chartContainer}>
              <BarChart
                data={getPayableChartData()}
                width={screenWidth - 32}
                height={220}
                chartConfig={chartConfig}
                verticalLabelRotation={30}
                showValuesOnTopOfBars={true}
                fromZero={true}
                style={styles.chart}
              />
            </View>
          </View>

          <View style={styles.chartSection}>
            <Text style={[styles.chartTitle, { color: theme.text }]}>
              Top 5 Khách Hàng Nợ Nhiều Nhất (Triệu VNĐ)
            </Text>
            <View style={styles.chartContainer}>
              <BarChart
                data={getReceivableChartData()}
                width={screenWidth - 32}
                height={220}
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => `rgba(54, 162, 235, ${opacity})`,
                }}
                verticalLabelRotation={30}
                showValuesOnTopOfBars={true}
                fromZero={true}
                style={styles.chart}
              />
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    padding: 8,
  },
  refreshButton: {
    padding: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 50,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 20,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  kpiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  kpiCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLabel: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  kpiValue: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  lastUpdatedValue: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  chartSection: {
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  chartContainer: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 8,
  },
  chart: {
    borderRadius: 12,
    marginVertical: 8,
  },
  fileNameText: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
});

export default DebtDashboard;
