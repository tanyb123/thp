// src/screens/ProjectCostScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getProjectById } from '../api/projectService';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import ExpenseService from '../api/expenseService';
import { PieChart } from 'react-native-chart-kit';

const ProjectCostScreen = ({ route, navigation }) => {
  const { projectId } = route.params || {};
  const { theme } = useTheme();
  const { user } = useAuth();

  const [project, setProject] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({
    total: 0,
    byType: {
      material: 0,
      labor: 0,
      other: 0,
    },
  });
  const screenWidth = Dimensions.get('window').width;

  // Load project data and expenses
  useEffect(() => {
    const loadProjectData = async () => {
      setLoading(true);
      try {
        if (!projectId) {
          console.error('No project ID provided');
          navigation.goBack();
          return;
        }

        // Load project details
        const projectData = await getProjectById(projectId);
        if (!projectData) {
          console.error('Project not found');
          navigation.goBack();
          return;
        }
        setProject(projectData);

        // Load project expenses
        const projectExpenses = await ExpenseService.getExpensesByProject(
          projectId
        );
        setExpenses(projectExpenses);

        // Calculate expense totals
        const expenseTotals = await ExpenseService.getProjectExpenseTotals(
          projectId
        );
        setTotals({
          total: expenseTotals.total,
          byType: {
            material: expenseTotals.byType.material || 0,
            labor: expenseTotals.byType.labor || 0,
            other: expenseTotals.byType.other || 0,
          },
        });
      } catch (error) {
        console.error('Error loading project data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProjectData();
  }, [projectId, navigation]);

  // Format currency for display
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Format date for display
  const formatDate = (timestamp) => {
    if (!timestamp) return '';

    const date = timestamp.seconds
      ? new Date(timestamp.seconds * 1000)
      : new Date(timestamp);

    return date.toLocaleDateString('vi-VN');
  };

  // Get type label for display
  const getTypeLabel = (type) => {
    switch (type) {
      case 'material':
        return 'Vật tư';
      case 'labor':
        return 'Nhân công';
      case 'other':
        return 'Chi phí khác';
      default:
        return type || 'Không xác định';
    }
  };

  // Get color for expense type
  const getTypeColor = (type) => {
    switch (type) {
      case 'material':
        return '#FF6384';
      case 'labor':
        return '#36A2EB';
      case 'other':
        return '#FFCE56';
      default:
        return '#4BC0C0';
    }
  };

  // Render pie chart data
  const chartData = [
    {
      name: 'Vật tư',
      amount: totals.byType.material,
      color: '#FF6384',
      legendFontColor: theme.text,
      legendFontSize: 12,
    },
    {
      name: 'Nhân công',
      amount: totals.byType.labor,
      color: '#36A2EB',
      legendFontColor: theme.text,
      legendFontSize: 12,
    },
    {
      name: 'Chi phí khác',
      amount: totals.byType.other,
      color: '#FFCE56',
      legendFontColor: theme.text,
      legendFontSize: 12,
    },
  ].filter((item) => item.amount > 0); // Only include non-zero values

  // Render each expense item
  const renderExpenseItem = ({ item }) => (
    <View
      style={[styles.expenseItem, { backgroundColor: theme.cardBackground }]}
    >
      <View style={styles.expenseHeader}>
        <View style={styles.expenseTypeContainer}>
          <View
            style={[
              styles.expenseTypeIndicator,
              { backgroundColor: getTypeColor(item.type) },
            ]}
          />
          <Text style={[styles.expenseType, { color: theme.textSecondary }]}>
            {getTypeLabel(item.type)}
          </Text>
        </View>
        <Text style={[styles.expenseDate, { color: theme.textSecondary }]}>
          {formatDate(item.date)}
        </Text>
      </View>

      <Text style={[styles.expenseDescription, { color: theme.text }]}>
        {item.description}
      </Text>

      <View style={styles.expenseFooter}>
        {item.quantity && (
          <Text
            style={[styles.expenseQuantity, { color: theme.textSecondary }]}
          >
            SL: {item.quantity} {item.unit || ''}
          </Text>
        )}
        <Text style={[styles.expenseAmount, { color: theme.primary }]}>
          {formatCurrency(item.amount)}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View
        style={[styles.loadingContainer, { backgroundColor: theme.background }]}
      >
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Đang tải dữ liệu...
        </Text>
      </View>
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
          Chi phí dự án
        </Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Project Info */}
        <View
          style={[
            styles.projectInfoCard,
            { backgroundColor: theme.cardBackground },
          ]}
        >
          <Text style={[styles.projectName, { color: theme.text }]}>
            {project?.name}
          </Text>
          <Text style={[styles.projectInfo, { color: theme.textSecondary }]}>
            Khách hàng: {project?.customerName || 'Không xác định'}
          </Text>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: theme.cardBackground },
            ]}
          >
            <Ionicons name="cash-outline" size={24} color={theme.primary} />
            <Text style={[styles.summaryTitle, { color: theme.textSecondary }]}>
              Tổng chi phí
            </Text>
            <Text style={[styles.summaryValue, { color: theme.text }]}>
              {formatCurrency(totals.total)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <View
              style={[
                styles.summaryCard,
                styles.smallCard,
                { backgroundColor: theme.cardBackground },
              ]}
            >
              <View style={[styles.cardIcon, { backgroundColor: '#FF6384' }]}>
                <Ionicons name="cube-outline" size={18} color="#FFF" />
              </View>
              <Text
                style={[styles.summaryTitle, { color: theme.textSecondary }]}
              >
                Vật tư
              </Text>
              <Text style={[styles.summaryValue, { color: theme.text }]}>
                {formatCurrency(totals.byType.material)}
              </Text>
            </View>

            <View
              style={[
                styles.summaryCard,
                styles.smallCard,
                { backgroundColor: theme.cardBackground },
              ]}
            >
              <View style={[styles.cardIcon, { backgroundColor: '#36A2EB' }]}>
                <Ionicons name="people-outline" size={18} color="#FFF" />
              </View>
              <Text
                style={[styles.summaryTitle, { color: theme.textSecondary }]}
              >
                Nhân công
              </Text>
              <Text style={[styles.summaryValue, { color: theme.text }]}>
                {formatCurrency(totals.byType.labor)}
              </Text>
            </View>

            <View
              style={[
                styles.summaryCard,
                styles.smallCard,
                { backgroundColor: theme.cardBackground },
              ]}
            >
              <View style={[styles.cardIcon, { backgroundColor: '#FFCE56' }]}>
                <Ionicons name="receipt-outline" size={18} color="#FFF" />
              </View>
              <Text
                style={[styles.summaryTitle, { color: theme.textSecondary }]}
              >
                Chi phí khác
              </Text>
              <Text style={[styles.summaryValue, { color: theme.text }]}>
                {formatCurrency(totals.byType.other)}
              </Text>
            </View>
          </View>
        </View>

        {/* Chart Section */}
        {chartData.length > 0 && (
          <View
            style={[
              styles.chartContainer,
              { backgroundColor: theme.cardBackground },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Phân bổ chi phí
            </Text>
            <PieChart
              data={chartData}
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

        {/* Expenses List */}
        <View style={styles.expensesContainer}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Chi tiết chi phí
          </Text>

          {expenses.length === 0 ? (
            <View
              style={[
                styles.emptyContainer,
                { backgroundColor: theme.cardBackground },
              ]}
            >
              <Ionicons
                name="receipt-outline"
                size={48}
                color={theme.textMuted}
              />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Chưa có chi phí nào cho dự án này
              </Text>
            </View>
          ) : (
            <FlatList
              data={expenses}
              renderItem={renderExpenseItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              style={styles.expensesList}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
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
    marginTop: 10,
    fontSize: 16,
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
  content: {
    flex: 1,
  },
  projectInfoCard: {
    margin: 16,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  projectName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  projectInfo: {
    fontSize: 14,
  },
  summaryContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  summaryCard: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  smallCard: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 4,
    textAlign: 'center',
  },
  chartContainer: {
    margin: 16,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  expensesContainer: {
    padding: 16,
    marginBottom: 32,
  },
  expensesList: {
    marginTop: 8,
  },
  expenseItem: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  expenseTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expenseTypeIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  expenseType: {
    fontSize: 12,
  },
  expenseDate: {
    fontSize: 12,
  },
  expenseDescription: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  expenseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expenseQuantity: {
    fontSize: 14,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    borderRadius: 8,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default ProjectCostScreen;
