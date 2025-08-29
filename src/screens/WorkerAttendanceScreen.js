import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { getAttendance, getAttendanceHistory } from '../api/attendanceService';

const WorkerAttendanceScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const [attendance, setAttendance] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadAttendanceData();
  }, [selectedMonth, selectedYear]);

  const loadAttendanceData = async () => {
    try {
      setLoading(true);

      // Lấy thông tin chấm công hiện tại
      if (user?.uid) {
        const currentAttendance = await getAttendance(user.uid);
        setAttendance(currentAttendance);

        // Lấy lịch sử chấm công theo tháng
        const history = await getAttendanceHistory(
          user.uid,
          selectedYear,
          selectedMonth + 1
        );

        // Log để debug
        console.log('Attendance history loaded:', history);
        console.log('User ID:', user.uid);
        console.log('Year:', selectedYear, 'Month:', selectedMonth + 1);

        // Debug từng record
        history.forEach((record, index) => {
          console.log(`Record ${index}:`, {
            id: record.id,
            date: record.date,
            clockIn: record.clockIn,
            clockOut: record.clockOut,
            userId: record.userId,
          });
        });

        setAttendanceHistory(history);
      }
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu chấm công:', error);
      Alert.alert('Lỗi', 'Không thể tải dữ liệu chấm công');
    } finally {
      setLoading(false);
    }
  };

  const getMonthName = (month) => {
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
    return months[month];
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('vi-VN');
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateWorkHours = (clockIn, clockOut) => {
    if (!clockIn || !clockOut) return 0;
    const start = clockIn.toDate ? clockIn.toDate() : new Date(clockIn);
    const end = clockOut.toDate ? clockOut.toDate() : new Date(clockOut);
    const diffMs = end - start;
    const diffHours = diffMs / (1000 * 60 * 60);
    return Math.round(diffHours * 100) / 100;
  };

  const getTotalWorkHours = () => {
    return attendanceHistory.reduce((total, record) => {
      return total + calculateWorkHours(record.clockIn, record.clockOut);
    }, 0);
  };

  const getTotalOvertime = () => {
    return attendanceHistory.reduce((total, record) => {
      return total + (record.overtime || 0);
    }, 0);
  };

  const changeMonth = (direction) => {
    if (direction === 'prev') {
      if (selectedMonth === 0) {
        setSelectedMonth(11);
        setSelectedYear(selectedYear - 1);
      } else {
        setSelectedMonth(selectedMonth - 1);
      }
    } else {
      if (selectedMonth === 11) {
        setSelectedMonth(0);
        setSelectedYear(selectedYear + 1);
      } else {
        setSelectedMonth(selectedMonth + 1);
      }
    }
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={theme.background}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Đang tải dữ liệu...
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
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Bảng Chấm Công
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Thông tin tổng quan */}
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.summaryTitle, { color: theme.text }]}>
            Tổng quan tháng {getMonthName(selectedMonth)}/{selectedYear}
          </Text>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: theme.primary }]}>
                {attendanceHistory.length}
              </Text>
              <Text
                style={[styles.summaryLabel, { color: theme.textSecondary }]}
              >
                Ngày làm việc
              </Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: theme.primary }]}>
                {attendanceHistory.filter((r) => (r.overtime || 0) > 0).length}
              </Text>
              <Text
                style={[styles.summaryLabel, { color: theme.textSecondary }]}
              >
                Ngày tăng ca
              </Text>
            </View>
          </View>
        </View>

        {/* Chọn tháng */}
        <View
          style={[
            styles.monthSelector,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <TouchableOpacity
            style={styles.monthButton}
            onPress={() => changeMonth('prev')}
          >
            <Ionicons name="chevron-back" size={24} color={theme.primary} />
          </TouchableOpacity>

          <Text style={[styles.monthText, { color: theme.text }]}>
            {getMonthName(selectedMonth)} {selectedYear}
          </Text>

          <TouchableOpacity
            style={styles.monthButton}
            onPress={() => changeMonth('next')}
          >
            <Ionicons name="chevron-forward" size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>

        {/* Lịch sử chấm công */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Lịch sử chấm công
          </Text>

          {attendanceHistory.length > 0 ? (
            attendanceHistory.map((record, index) => {
              // Debug: log record data
              console.log('Record data:', record);
              console.log('Record date:', record.date);
              console.log('Record clockIn:', record.clockIn);

              return (
                <View
                  key={index}
                  style={[
                    styles.attendanceCard,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                >
                  <View style={styles.attendanceHeader}>
                    <Text
                      style={[styles.attendanceDate, { color: theme.text }]}
                    >
                      {formatDate(record.clockIn)}
                    </Text>
                  </View>

                  <View style={styles.attendanceDetails}>
                    <View style={styles.dateRow}>
                      <Ionicons
                        name="calendar-outline"
                        size={16}
                        color={theme.textSecondary}
                      />
                      <Text
                        style={[
                          styles.dateLabel,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Đã đi làm ngày {record.date || 'Không xác định'}
                      </Text>
                    </View>
                    <View style={styles.timeRow}>
                      <Ionicons
                        name="time-outline"
                        size={16}
                        color={theme.textSecondary}
                      />
                      <Text
                        style={[
                          styles.timeLabel,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Công: 8h
                        {record.overtime > 0
                          ? `  •  Tăng ca: ${record.overtime}h`
                          : ''}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Ionicons
                name="calendar-outline"
                size={48}
                color={theme.textMuted}
              />
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                Không có dữ liệu chấm công
              </Text>
              <Text style={[styles.emptySubText, { color: theme.textMuted }]}>
                Tháng {getMonthName(selectedMonth)}/{selectedYear}
              </Text>
            </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  summaryCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
  },
  monthButton: {
    padding: 8,
  },
  monthText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  attendanceCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  attendanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  attendanceDate: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  attendanceDetails: {
    gap: 8,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateLabel: {
    fontSize: 14,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeLabel: {
    fontSize: 14,
  },
  emptyCard: {
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
});

export default WorkerAttendanceScreen;


