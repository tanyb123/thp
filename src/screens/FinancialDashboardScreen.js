// src/screens/FinancialDashboardScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  getFirestore,
} from 'firebase/firestore';
import { LineChart, PieChart } from 'react-native-chart-kit';

const FinancialDashboardScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [monthlySummaries, setMonthlySummaries] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const screenWidth = Dimensions.get('window').width;

  useEffect(() => {
    // Only directors can access this screen
    if (!['giam_doc', 'director'].includes(user?.role)) {
      alert('Bạn không có quyền truy cập chức năng này');
      navigation.goBack();
      return;
    }

    loadData();
  }, [navigation, user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const db = getFirestore();
      const q = query(
        collection(db, 'monthly_summaries'),
        orderBy('year', 'desc'),
        orderBy('month', 'desc'),
        limit(12)
      );

      const querySnapshot = await getDocs(q);
      const summaries = [];

      querySnapshot.forEach((doc) => {
        summaries.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      setMonthlySummaries(summaries);
      if (summaries.length > 0) {
        setSelectedMonth(summaries[0]);
      }
    } catch (error) {
      console.error('Error loading financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getMonthLabel = (monthNum) => {
    const months = [
      'Tháng 1',
      'Tháng 2',
      'Tháng 3',
      'Tháng 4',
      'Tháng 5',
      'Tháng 6',
      'Tháng 7',
      'Tháng 8',
      'Tháng 9',
      'Tháng 10',
      'Tháng 11',
      'Tháng 12',
    ];
    return months[monthNum - 1] || 'Không xác định';
  };

  // Prepare chart data
  const revenueData = {
    labels: monthlySummaries
      .slice()
      .reverse()
      .map((s) => `T${s.month}`),
    datasets: [
      {
        data: monthlySummaries
          .slice()
          .reverse()
          .map((s) => s.totalRevenue / 1000000),
        color: (opacity = 1) => `rgba(54, 162, 235, ${opacity})`,
        strokeWidth: 2,
      },
    ],
    legend: ['Doanh thu (triệu VND)'],
  };

  const expenseData = {
    labels: monthlySummaries
      .slice()
      .reverse()
      .map((s) => `T${s.month}`),
    datasets: [
      {
        data: monthlySummaries
          .slice()
          .reverse()
          .map((s) => s.totalExpenses / 1000000),
        color: (opacity = 1) => `rgba(255, 99, 132, ${opacity})`,
        strokeWidth: 2,
      },
    ],
    legend: ['Chi phí (triệu VND)'],
  };

  const combinedData = {
    labels: monthlySummaries
      .slice()
      .reverse()
      .map((s) => `T${s.month}`),
    datasets: [
      {
        data: monthlySummaries
          .slice()
          .reverse()
          .map((s) => s.totalRevenue / 1000000),
        color: (opacity = 1) => `rgba(54, 162, 235, ${opacity})`,
        strokeWidth: 2,
      },
      {
        data: monthlySummaries
          .slice()
          .reverse()
          .map((s) => s.totalExpenses / 1000000),
        color: (opacity = 1) => `rgba(255, 99, 132, ${opacity})`,
        strokeWidth: 2,
      },
    ],
    legend: ['Doanh thu', 'Chi phí'],
  };

  // Prepare pie chart data
  const expenseBreakdownData = selectedMonth
    ? [
        {
          name: 'Vật tư',
          amount: selectedMonth.expenseBreakdown?.material || 0,
          color: '#FF6384',
          legendFontColor: theme.text,
          legendFontSize: 12,
        },
        {
          name: 'Nhân công',
          amount: selectedMonth.expenseBreakdown?.labor || 0,
          color: '#36A2EB',
          legendFontColor: theme.text,
          legendFontSize: 12,
        },
        {
          name: 'Chi phí gián tiếp',
          amount: selectedMonth.expenseBreakdown?.overhead || 0,
          color: '#FFCE56',
          legendFontColor: theme.text,
          legendFontSize: 12,
        },
      ].filter((item) => item.amount > 0)
    : [];

  const renderKPICard = (title, value, icon, color) => (
    <View style={[styles.kpiCard, { backgroundColor: theme.cardBackground }]}>
      <View style={[styles.kpiIconContainer, { backgroundColor: color }]}>
        <Ionicons name={icon} size={24} color="#FFFFFF" />
      </View>
      <View style={styles.kpiContent}>
        <Text style={[styles.kpiTitle, { color: theme.textSecondary }]}>
          {title}
        </Text>
        <Text style={[styles.kpiValue, { color: theme.text }]}>{value}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Báo cáo Tài chính
          </Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Đang tải dữ liệu...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (monthlySummaries.length === 0) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Báo cáo Tài chính
          </Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons
            name="document-text-outline"
            size={60}
            color={theme.textMuted}
          />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Chưa có dữ liệu báo cáo tài chính.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Báo cáo Tài chính
        </Text>
      </View>

      <ScrollView style={styles.scrollContent}>
        {selectedMonth && (
          <View style={styles.selectedMonthContainer}>
            <Text style={[styles.selectedMonthTitle, { color: theme.text }]}>
              {getMonthLabel(selectedMonth.month)}/{selectedMonth.year}
            </Text>
          </View>
        )}

        {selectedMonth && (
          <View style={styles.kpiContainer}>
            {renderKPICard(
              'Doanh thu',
              formatCurrency(selectedMonth.totalRevenue),
              'cash-outline',
              '#1E88E5'
            )}

            {renderKPICard(
              'Chi phí',
              formatCurrency(selectedMonth.totalExpenses),
              'wallet-outline',
              '#F44336'
            )}

            {renderKPICard(
              'Lợi nhuận',
              formatCurrency(selectedMonth.profit),
              'trending-up-outline',
              '#4CAF50'
            )}

            {renderKPICard(
              'Tỷ suất LN',
              `${Math.round(
                (selectedMonth.profit / selectedMonth.totalRevenue) * 100
              )}%`,
              'analytics-outline',
              '#FF9800'
            )}
          </View>
        )}

        <View
          style={[
            styles.chartContainer,
            { backgroundColor: theme.cardBackground },
          ]}
        >
          <Text style={[styles.chartTitle, { color: theme.text }]}>
            Doanh thu và Chi phí 12 tháng gần nhất
          </Text>
          {monthlySummaries.length > 0 && (
            <LineChart
              data={combinedData}
              width={screenWidth - 32}
              height={220}
              chartConfig={{
                backgroundColor: theme.cardBackground,
                backgroundGradientFrom: theme.cardBackground,
                backgroundGradientTo: theme.cardBackground,
                decimalPlaces: 0,
                color: (opacity = 1) => theme.text,
                labelColor: (opacity = 1) => theme.textSecondary,
                style: {
                  borderRadius: 16,
                },
                propsForDots: {
                  r: '6',
                  strokeWidth: '2',
                },
              }}
              bezier
              style={styles.chart}
            />
          )}
        </View>

        {selectedMonth && expenseBreakdownData.length > 0 && (
          <View
            style={[
              styles.chartContainer,
              { backgroundColor: theme.cardBackground },
            ]}
          >
            <Text style={[styles.chartTitle, { color: theme.text }]}>
              Cơ cấu chi phí
            </Text>
            <PieChart
              data={expenseBreakdownData}
              width={screenWidth - 32}
              height={220}
              chartConfig={{
                backgroundColor: theme.cardBackground,
                backgroundGradientFrom: theme.cardBackground,
                backgroundGradientTo: theme.cardBackground,
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                labelColor: (opacity = 1) => theme.text,
                style: {
                  borderRadius: 16,
                },
              }}
              accessor="amount"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute
            />
          </View>
        )}

        <View
          style={[
            styles.monthListContainer,
            { backgroundColor: theme.cardBackground },
          ]}
        >
          <Text style={[styles.monthListTitle, { color: theme.text }]}>
            Lịch sử báo cáo tháng
          </Text>
          <View style={styles.monthList}>
            {monthlySummaries.map((summary) => (
              <TouchableOpacity
                key={summary.id}
                style={[
                  styles.monthItem,
                  selectedMonth?.id === summary.id && {
                    backgroundColor: `${theme.primary}20`,
                  },
                ]}
                onPress={() => setSelectedMonth(summary)}
              >
                <Text
                  style={[
                    styles.monthItemText,
                    { color: theme.text },
                    selectedMonth?.id === summary.id && {
                      fontWeight: 'bold',
                      color: theme.primary,
                    },
                  ]}
                >
                  {getMonthLabel(summary.month)}/{summary.year}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
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
  scrollContent: {
    flex: 1,
    padding: 16,
  },
  selectedMonthContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  selectedMonthTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  kpiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  kpiCard: {
    width: '48%',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  kpiIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  kpiContent: {
    flex: 1,
  },
  kpiTitle: {
    fontSize: 12,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  chartContainer: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  monthListContainer: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  monthListTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  monthList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    margin: 4,
  },
  monthItemText: {
    fontSize: 14,
  },
});

export default FinancialDashboardScreen;
