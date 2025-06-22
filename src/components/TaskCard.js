import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ThemeContext } from '../contexts/ThemeContext';

const TaskCard = ({ task, onPress }) => {
  const { theme } = useContext(ThemeContext);
  const styles = getStyles(theme);

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return { bg: 'rgba(46, 204, 113, 0.2)', text: '#27AE60' };
      case 'in_progress':
        return { bg: 'rgba(52, 152, 219, 0.2)', text: '#2980B9' };
      case 'pending':
        return { bg: 'rgba(241, 196, 15, 0.2)', text: '#F39C12' };
      default:
        return { bg: theme.border, text: theme.textSecondary };
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'completed':
        return 'Hoàn thành';
      case 'in_progress':
        return 'Đang thực hiện';
      case 'pending':
        return 'Chờ xử lý';
      default:
        return 'Không xác định';
    }
  };

  const statusStyle = getStatusColor(task.status);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.taskLabel}>{task.taskLabel}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
          <Text style={[styles.statusText, { color: statusStyle.text }]}>
            {getStatusLabel(task.status)}
          </Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.projectName}>Dự án: {task.projectName}</Text>
        <Text style={styles.assignedTo}>Phụ trách: {task.assignedToName}</Text>
      </View>
    </TouchableOpacity>
  );
};

const getStyles = (theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.card,
      padding: 16,
      borderRadius: 12,
      marginVertical: 8,
      borderWidth: 1,
      borderColor: theme.border,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    taskLabel: {
      fontSize: 17,
      fontWeight: 'bold',
      color: theme.text,
      flex: 1, // Allow text to wrap if long
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      marginLeft: 8,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
    },
    cardBody: {
      marginTop: 8,
    },
    projectName: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 4,
    },
    assignedTo: {
      fontSize: 14,
      color: theme.textSecondary,
    },
  });

export default TaskCard;
