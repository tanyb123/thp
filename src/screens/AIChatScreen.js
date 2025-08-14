import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import AIChatComponent from '../components/AIChatComponent';
import { useAIChat } from '../contexts/AIChatContext';

const AIChatScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { currentProject, setCurrentProject, chatMode, CHAT_MODES } =
    useAIChat();

  // Get project and initial question from route params if available
  const projectFromRoute = route.params?.project;
  const initialQuestion = route.params?.initialQuestion;

  useEffect(() => {
    if (projectFromRoute) {
      setCurrentProject(projectFromRoute);
    }
  }, [projectFromRoute]);

  // Handle initial question if provided
  useEffect(() => {
    if (initialQuestion) {
      // Add the initial question to chat after a short delay
      setTimeout(() => {
        // This will be handled by the AIChatComponent
        console.log('Initial question received:', initialQuestion);
      }, 1000);
    }
  }, [initialQuestion]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  };

  const handleProjectInfo = () => {
    if (currentProject) {
      Alert.alert(
        'Thông tin dự án',
        `Tên: ${currentProject.name || 'Không có tên'}
Mô tả: ${currentProject.description || 'Không có mô tả'}
Trạng thái: ${currentProject.status || 'Không xác định'}
Khách hàng: ${currentProject.customerName || 'Không có thông tin'}
Ngày bắt đầu: ${currentProject.startDate || 'Không xác định'}
Ngày kết thúc dự kiến: ${currentProject.endDate || 'Không xác định'}`,
        [{ text: 'Đóng', style: 'default' }]
      );
    } else {
      Alert.alert(
        'Thông tin',
        'Bạn đang chat với AI Assistant chung. Hãy chọn một image.png để có context tốt hơn.',
        [{ text: 'Đóng', style: 'default' }]
      );
    }
  };

  const handleExportChat = () => {
    Alert.alert(
      'Xuất lịch sử chat',
      'Tính năng này sẽ được phát triển trong phiên bản tiếp theo.',
      [{ text: 'Đóng', style: 'default' }]
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={handleBack} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color="#007AFF" />
      </TouchableOpacity>

      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle}>
          {currentProject ? `Trợ lý AI` : 'Trợ lý AI'}
        </Text>
      </View>

      <View style={styles.headerActions}>
        <TouchableOpacity onPress={handleProjectInfo} style={styles.infoButton}>
          <Ionicons
            name="information-circle-outline"
            size={24}
            color="#007AFF"
          />
        </TouchableOpacity>
        {currentProject && (
          <TouchableOpacity
            onPress={handleExportChat}
            style={styles.exportButton}
          >
            <Ionicons name="download-outline" size={24} color="#34C759" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}

      <View style={styles.chatContainer}>
        <AIChatComponent
          project={currentProject}
          initialQuestion={initialQuestion}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },

  backButton: {
    padding: 8,
    marginRight: 8,
  },

  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  infoButton: {
    padding: 8,
    marginRight: 8,
  },

  exportButton: {
    padding: 8,
  },

  chatContainer: {
    flex: 1,
  },
});

export default AIChatScreen;
