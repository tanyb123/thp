import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { generateMonthlyCostReport } from '../api/monthlyCostReportService';
import DateTimePicker from '@react-native-community/datetimepicker';

const MonthlyCostReportScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { user: currentUser } = useAuth();

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Kiểm tra quyền truy cập
  const hasAccess = ['giam_doc', 'pho_giam_doc', 'ke_toan', 'ky_su'].includes(
    currentUser?.role
  );

  useEffect(() => {
    if (hasAccess) {
      loadReport();
    }
  }, [hasAccess, selectedDate]);

  const loadReport = async () => {
    try {
      setLoading(true);
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth() + 1; // getMonth() trả về 0-11

      console.log('📅 Tải báo cáo cho:', { year, month });

      const report = await generateMonthlyCostReport(year, month);
      console.log('📊 Kết quả báo cáo:', report);
      setReportData(report);
    } catch (error) {
      console.error('❌ Lỗi khi tải báo cáo:', error);
      Alert.alert('Lỗi', 'Không thể tải báo cáo chi phí hàng tháng');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: 'long',
    }).format(date);
  };

  const handleDateChange = (event, date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
    }
  };

  const renderProjectItem = ({ item }) => (
    <View
      style={[
        styles.projectCard,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <View style={styles.projectHeader}>
        <Text style={[styles.projectName, { color: theme.text }]}>
          {item.project.name}
        </Text>
        <Text style={[styles.projectTotal, { color: theme.primary }]}>
          {formatCurrency(item.costBreakdown.totalCost)}
        </Text>
      </View>

      <View style={styles.costBreakdown}>
        <View style={styles.costItem}>
          <Text style={[styles.costLabel, { color: theme.textSecondary }]}>
            Vật liệu:
          </Text>
          <Text style={[styles.costValue, { color: theme.text }]}>
            {formatCurrency(item.costBreakdown.materialCost)}
          </Text>
        </View>

        <View style={styles.costItem}>
          <Text style={[styles.costLabel, { color: theme.textSecondary }]}>
            Phụ kiện:
          </Text>
          <Text style={[styles.costValue, { color: theme.text }]}>
            {formatCurrency(item.costBreakdown.accessoryCost)}
          </Text>
        </View>
      </View>
    </View>
  );

  if (!hasAccess) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <StatusBar
          barStyle={theme.dark ? 'light-content' : 'dark-content'}
          backgroundColor={theme.background}
        />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Báo cáo chi phí hàng tháng
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.accessDenied}>
          <Ionicons name="lock-closed" size={60} color={theme.textMuted} />
          <Text
            style={[styles.accessDeniedText, { color: theme.textSecondary }]}
          >
            Bạn không có quyền truy cập tính năng này
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <StatusBar
        barStyle={theme.dark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Báo cáo chi phí hàng tháng
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Date Picker */}
      <View style={[styles.dateContainer, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.dateButton, { borderColor: theme.border }]}
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons name="calendar-outline" size={20} color={theme.primary} />
          <Text style={[styles.dateText, { color: theme.text }]}>
            {formatDate(selectedDate)}
          </Text>
          <Ionicons name="chevron-down" size={16} color={theme.textSecondary} />
        </TouchableOpacity>

        {null}

        {null}
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Đang tải báo cáo...
          </Text>
        </View>
      ) : reportData ? (
        <ScrollView style={styles.content}>
          {/* Summary Cards */}
          <View style={styles.summaryContainer}>
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Text
                style={[styles.summaryTitle, { color: theme.textSecondary }]}
              >
                Dự án hoàn thành
              </Text>
              <Text style={[styles.summaryValue, { color: theme.text }]}>
                {reportData.projectCount}
              </Text>
            </View>

            <View
              style={[
                styles.summaryCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Text
                style={[styles.summaryTitle, { color: theme.textSecondary }]}
              >
                Chi phí dự án
              </Text>
              <Text style={[styles.summaryValue, { color: theme.primary }]}>
                {formatCurrency(reportData.totalProjectCost)}
              </Text>
            </View>

            <View
              style={[
                styles.summaryCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Text
                style={[styles.summaryTitle, { color: theme.textSecondary }]}
              >
                Chi phí cố định
              </Text>
              <Text style={[styles.summaryValue, { color: '#FF9800' }]}>
                {formatCurrency(reportData.fixedCosts)}
              </Text>
            </View>

            <View
              style={[
                styles.summaryCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Text
                style={[styles.summaryTitle, { color: theme.textSecondary }]}
              >
                Lương nhân viên
              </Text>
              <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>
                {formatCurrency(reportData.totalSalary)}
              </Text>
            </View>
          </View>

          {/* Total Cost */}
          <View
            style={[
              styles.totalCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.totalTitle, { color: theme.text }]}>
              Tổng cộng
            </Text>
            <Text style={[styles.totalValue, { color: theme.primary }]}>
              {formatCurrency(reportData.totalMonthlyCost)}
            </Text>
          </View>

          {/* Projects List */}
          <View style={styles.projectsSection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Chi tiết dự án ({reportData.projectCount})
            </Text>

            {reportData.completedProjects.length > 0 ? (
              <FlatList
                data={reportData.completedProjects}
                renderItem={renderProjectItem}
                keyExtractor={(item, index) =>
                  item?.project?.id
                    ? `${item.project.id}-${index}`
                    : String(index)
                }
                scrollEnabled={false}
                contentContainerStyle={styles.projectsList}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="document-outline"
                  size={60}
                  color={theme.textMuted}
                />
                <Text
                  style={[styles.emptyText, { color: theme.textSecondary }]}
                >
                  Không có dự án nào hoàn thành trong tháng này
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="analytics-outline"
            size={60}
            color={theme.textMuted}
          />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Không có dữ liệu báo cáo
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  dateContainer: {
    padding: 16,
    borderBottomWidth: 1,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '500',
  },
  debugButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderWidth: 1,
    borderRadius: 6,
    marginTop: 8,
  },
  debugText: {
    fontSize: 12,
    marginLeft: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  summaryContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  summaryTitle: {
    fontSize: 12,
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalCard: {
    margin: 16,
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  totalTitle: {
    fontSize: 16,
    marginBottom: 8,
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  projectsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  projectsList: {
    gap: 12,
  },
  projectCard: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  projectTotal: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  costBreakdown: {
    gap: 8,
  },
  costItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  costLabel: {
    fontSize: 14,
  },
  costValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  accessDeniedText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default MonthlyCostReportScreen;
