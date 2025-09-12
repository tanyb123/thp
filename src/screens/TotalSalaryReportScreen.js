import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import salaryService from '../api/salaryService';

const TotalSalaryReportScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [date, setDate] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });

  useEffect(() => {
    // Tự động tải (ưu tiên cache) khi mở màn hình
    handleGenerateReport(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerateReport = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const data = await salaryService.getTotalSalaryReport(
        date.month,
        date.year,
        { forceRefresh }
      );
      setReportData(data);
    } catch (error) {
      console.error('Error generating salary report:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  const renderSalarySlipItem = ({ item }) => (
    <View style={[styles.slipItem, { backgroundColor: theme.card }]}>
      <View style={styles.employeeInfo}>
        <Text style={[styles.employeeName, { color: theme.text }]}>
          {item.employeeName}
        </Text>
        <Text style={[styles.employeePosition, { color: theme.textSecondary }]}>
          {item.position}
        </Text>
      </View>
      <Text style={[styles.netSalary, { color: theme.primary }]}>
        {formatCurrency(item.calculatedSalary.netSalary)}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Báo cáo tổng lương</Text>
        <View style={{ width: 20 }} />
      </View>

      <View style={styles.content}>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            Chọn tháng và năm
          </Text>
          {/* Simple month/year selectors for now */}
          <View style={styles.dateSelector}>
            <TouchableOpacity
              onPress={() => setDate({ ...date, month: date.month - 1 })}
            >
              <Ionicons name="chevron-back" size={24} color={theme.primary} />
            </TouchableOpacity>
            <Text style={[styles.dateText, { color: theme.text }]}>
              {date.month} / {date.year}
            </Text>
            <TouchableOpacity
              onPress={() => setDate({ ...date, month: date.month + 1 })}
            >
              <Ionicons
                name="chevron-forward"
                size={24}
                color={theme.primary}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.primary }]}
              onPress={() => handleGenerateReport(false)}
            >
              <Text style={styles.buttonText}>Xem báo cáo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.buttonOutline, { borderColor: theme.primary }]}
              onPress={() => handleGenerateReport(true)}
            >
              <Text
                style={[styles.buttonTextOutline, { color: theme.primary }]}
              >
                Làm mới
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading && (
          <ActivityIndicator
            size="large"
            color={theme.primary}
            style={{ marginTop: 20 }}
          />
        )}

        {reportData && (
          <View
            style={[
              styles.card,
              { backgroundColor: theme.card, marginTop: 20 },
            ]}
          >
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Kết quả báo cáo tháng {reportData.month}/{reportData.year}
            </Text>

            {/* Thống kê tổng quan */}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text
                  style={[styles.statLabel, { color: theme.textSecondary }]}
                >
                  Số nhân viên
                </Text>
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {reportData.totalSalarySlips}
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text
                  style={[styles.statLabel, { color: theme.textSecondary }]}
                >
                  Tổng lương gross
                </Text>
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {formatCurrency(reportData.totalGrossSalary)}
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text
                  style={[styles.statLabel, { color: theme.textSecondary }]}
                >
                  Tổng khấu trừ
                </Text>
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {formatCurrency(reportData.totalDeductions)}
                </Text>
              </View>
            </View>

            {/* Tổng lương phải trả */}
            <View style={styles.summaryContainer}>
              <Text
                style={[styles.summaryText, { color: theme.textSecondary }]}
              >
                Tổng lương phải trả (thực lĩnh)
              </Text>
              <Text style={[styles.totalAmount, { color: theme.primary }]}>
                {formatCurrency(reportData.totalNetSalary)}
              </Text>
            </View>

            <Text style={[styles.listHeader, { color: theme.text }]}>
              Chi tiết phiếu lương
            </Text>
            <FlatList
              data={reportData.salarySlips}
              renderItem={renderSalarySlipItem}
              keyExtractor={(item, index) =>
                item.employeeId || `employee-${index}`
              }
              style={{ maxHeight: 400 }}
            />
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    paddingTop: 20,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  content: { padding: 16 },
  card: { padding: 16, borderRadius: 8, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  dateSelector: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateText: { fontSize: 18, fontWeight: 'bold' },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  buttonOutline: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 8,
  },
  buttonTextOutline: { fontSize: 16, fontWeight: 'bold' },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  summaryContainer: { alignItems: 'center', marginVertical: 16 },
  summaryText: { fontSize: 16, marginBottom: 6 },
  totalAmount: { fontSize: 24, fontWeight: 'bold' },
  listHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  slipItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  employeePosition: {
    fontSize: 14,
  },
  netSalary: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'right',
  },
});

export default TotalSalaryReportScreen;














