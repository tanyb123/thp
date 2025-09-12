import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Component hiển thị menu chức năng cho công nhân, kỹ sư, kế toán
 * Bao gồm: Xem chấm công, Xin nghỉ phép, Xin ứng lương
 */
const WorkerFeaturesMenu = ({ userRole, onNavigate, style = {} }) => {
  const { theme } = useTheme();

  // Xác định role và tiêu đề
  const isWorker = userRole?.toLowerCase() === 'cong_nhan';
  const isEngineer = userRole?.toLowerCase() === 'ky_su';
  const isAccountant = userRole?.toLowerCase() === 'ke_toan';

  const getRoleTitle = () => {
    if (isWorker) return 'Chức năng công nhân';
    if (isEngineer) return 'Chức năng kỹ sư';
    if (isAccountant) return 'Chức năng kế toán';
    return 'Chức năng nhân viên';
  };

  const getRoleIcon = () => {
    if (isWorker) return 'construct-outline';
    if (isEngineer) return 'school-outline';
    if (isAccountant) return 'calculator-outline';
    return 'person-outline';
  };

  const getRoleColor = () => {
    if (isWorker) return '#4CAF50'; // Green
    if (isEngineer) return '#2196F3'; // Blue
    if (isAccountant) return '#FF9800'; // Orange
    return '#9C27B0'; // Purple
  };

  const menuItems = [
    {
      id: 'attendance',
      title: 'Xem chấm công',
      description: 'Xem lịch sử và thống kê',
      icon: 'time-outline',
      iconColor: '#4CAF50',
      screen: 'WorkerAttendance',
    },
    {
      id: 'leave',
      title: 'Xin nghỉ phép',
      description: 'Đăng ký và theo dõi',
      icon: 'calendar-outline',
      iconColor: '#FF9800',
      screen: 'LeaveRequest',
    },
    {
      id: 'advance',
      title: 'Xin ứng lương',
      description: 'Yêu cầu và theo dõi',
      icon: 'cash-outline',
      iconColor: '#2196F3',
      screen: 'AdvanceSalary',
    },
  ];

  const handleMenuPress = (screen) => {
    if (onNavigate && typeof onNavigate === 'function') {
      onNavigate(screen);
    }
  };

  return (
    <View style={[styles.container, style]}>
      {/* Header với icon và tiêu đề */}
      <View style={styles.header}>
        <View style={[styles.roleIcon, { backgroundColor: getRoleColor() }]}>
          <Ionicons name={getRoleIcon()} size={24} color="#fff" />
        </View>
        <Text style={[styles.roleTitle, { color: theme.text }]}>
          {getRoleTitle()}
        </Text>
      </View>

      {/* Grid menu items */}
      <View style={styles.menuGrid}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.menuCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
            onPress={() => handleMenuPress(item.screen)}
            activeOpacity={0.7}
          >
            <View
              style={[styles.menuIcon, { backgroundColor: item.iconColor }]}
            >
              <Ionicons name={item.icon} size={24} color="#fff" />
            </View>
            <Text style={[styles.menuText, { color: theme.text }]}>
              {item.title}
            </Text>
            <Text style={[styles.menuDesc, { color: theme.textSecondary }]}>
              {item.description}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Thông tin bổ sung cho từng role */}
      <View
        style={[
          styles.infoCard,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Ionicons
          name="information-circle-outline"
          size={20}
          color={theme.primary}
        />
        <Text style={[styles.infoText, { color: theme.textSecondary }]}>
          {isWorker && 'Bạn có thể xem chấm công, xin nghỉ phép và ứng lương'}
          {isEngineer && 'Bạn có thể xem chấm công, xin nghỉ phép và ứng lương'}
          {isAccountant &&
            'Bạn có thể xem chấm công, xin nghỉ phép và ứng lương'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  roleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  menuCard: {
    width: '31%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 12,
    minHeight: 120,
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  menuText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  menuDesc: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  infoText: {
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
});

export default WorkerFeaturesMenu;




















































