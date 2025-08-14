import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AIChatComponent from './AIChatComponent';

const AIChatTestComponent = () => {
  const [testMode, setTestMode] = useState('basic');

  const testProject = {
    id: 'test-project-001',
    name: 'Dự án Test Sản Xuất',
    description: 'Dự án test để kiểm tra chức năng AI Chat với file đính kèm',
    status: 'Đang thực hiện',
    customerName: 'Khách hàng Test',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    budget: '100,000,000 VND',
    workflowStages: [
      { name: 'Thiết kế', status: 'Hoàn thành' },
      { name: 'Sản xuất', status: 'Đang thực hiện' },
      { name: 'Kiểm tra chất lượng', status: 'Chưa bắt đầu' },
    ],
    workers: [
      { name: 'Nguyễn Văn A', role: 'Kỹ sư trưởng' },
      { name: 'Trần Thị B', role: 'Công nhân sản xuất' },
    ],
  };

  const runBasicTest = () => {
    Alert.alert(
      'Test Cơ Bản',
      'Kiểm tra chức năng chat AI cơ bản:\n\n' +
        '1. Gửi tin nhắn văn bản\n' +
        '2. Nhận phản hồi từ AI\n' +
        '3. Hiển thị lịch sử chat\n' +
        '4. Xử lý lỗi kết nối',
      [{ text: 'OK' }]
    );
  };

  const runAttachmentTest = () => {
    Alert.alert(
      'Test File Đính Kèm',
      'Kiểm tra chức năng file đính kèm:\n\n' +
        '1. Chọn ảnh từ thư viện\n' +
        '2. Chọn tài liệu từ thiết bị\n' +
        '3. Hiển thị preview file\n' +
        '4. Gửi tin nhắn với file đính kèm\n' +
        '5. AI xử lý và trả lời về file',
      [{ text: 'OK' }]
    );
  };

  const runProjectContextTest = () => {
    Alert.alert(
      'Test Context Dự Án',
      'Kiểm tra AI hiểu context dự án:\n\n' +
        '1. Hỏi về tiến độ dự án\n' +
        '2. Hỏi về các công đoạn\n' +
        '3. Hỏi về nhân viên\n' +
        '4. Hỏi về ngân sách',
      [{ text: 'OK' }]
    );
  };

  const runErrorHandlingTest = () => {
    Alert.alert(
      'Test Xử Lý Lỗi',
      'Kiểm tra xử lý lỗi:\n\n' +
        '1. Lỗi kết nối mạng\n' +
        '2. Lỗi API\n' +
        '3. File không hợp lệ\n' +
        '4. Quyền truy cập',
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🧪 AI Chat Test Component</Text>
        <Text style={styles.subtitle}>
          Kiểm tra chức năng AI Chat với file đính kèm
        </Text>
      </View>

      <ScrollView style={styles.testButtonsContainer}>
        <TouchableOpacity
          style={[
            styles.testButton,
            testMode === 'basic' && styles.activeButton,
          ]}
          onPress={() => setTestMode('basic')}
        >
          <Ionicons name="chatbubble-outline" size={24} color="#007AFF" />
          <Text style={styles.testButtonText}>Test Cơ Bản</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.testButton,
            testMode === 'attachments' && styles.activeButton,
          ]}
          onPress={() => setTestMode('attachments')}
        >
          <Ionicons name="attach-outline" size={24} color="#007AFF" />
          <Text style={styles.testButtonText}>Test File Đính Kèm</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.testButton,
            testMode === 'project' && styles.activeButton,
          ]}
          onPress={() => setTestMode('project')}
        >
          <Ionicons name="business-outline" size={24} color="#007AFF" />
          <Text style={styles.testButtonText}>Test Context Dự Án</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.testButton,
            testMode === 'error' && styles.activeButton,
          ]}
          onPress={() => setTestMode('error')}
        >
          <Ionicons name="warning-outline" size={24} color="#007AFF" />
          <Text style={styles.testButtonText}>Test Xử Lý Lỗi</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.testInfo}>
        <Text style={styles.testInfoTitle}>Hướng Dẫn Test:</Text>

        {testMode === 'basic' && (
          <View style={styles.testInfoContent}>
            <Text style={styles.testInfoText}>
              • Gửi tin nhắn văn bản đơn giản{'\n'}• Kiểm tra phản hồi từ AI
              {'\n'}• Xem lịch sử chat{'\n'}• Test giao diện cơ bản
            </Text>
            <TouchableOpacity
              style={styles.runTestButton}
              onPress={runBasicTest}
            >
              <Text style={styles.runTestButtonText}>Chạy Test</Text>
            </TouchableOpacity>
          </View>
        )}

        {testMode === 'attachments' && (
          <View style={styles.testInfoContent}>
            <Text style={styles.testInfoText}>
              • Chọn ảnh từ thư viện{'\n'}• Chọn tài liệu từ thiết bị{'\n'}• Xem
              preview file đính kèm{'\n'}• Gửi tin nhắn với file{'\n'}• Kiểm tra
              AI xử lý file
            </Text>
            <TouchableOpacity
              style={styles.runTestButton}
              onPress={runAttachmentTest}
            >
              <Text style={styles.runTestButtonText}>Chạy Test</Text>
            </TouchableOpacity>
          </View>
        )}

        {testMode === 'project' && (
          <View style={styles.testInfoContent}>
            <Text style={styles.testInfoText}>
              • Hỏi về tiến độ dự án{'\n'}• Hỏi về các công đoạn{'\n'}• Hỏi về
              nhân viên{'\n'}• Hỏi về ngân sách{'\n'}• Kiểm tra AI hiểu context
            </Text>
            <TouchableOpacity
              style={styles.runTestButton}
              onPress={runProjectContextTest}
            >
              <Text style={styles.runTestButtonText}>Chạy Test</Text>
            </TouchableOpacity>
          </View>
        )}

        {testMode === 'error' && (
          <View style={styles.testInfoContent}>
            <Text style={styles.testInfoText}>
              • Test lỗi kết nối mạng{'\n'}• Test lỗi API{'\n'}• Test file không
              hợp lệ{'\n'}• Test quyền truy cập{'\n'}• Kiểm tra xử lý lỗi
            </Text>
            <TouchableOpacity
              style={styles.runTestButton}
              onPress={runErrorHandlingTest}
            >
              <Text style={styles.runTestButtonText}>Chạy Test</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.chatContainer}>
        <Text style={styles.chatTitle}>
          {testMode === 'basic' && '💬 Chat AI Cơ Bản'}
          {testMode === 'attachments' && '📎 Chat AI với File Đính Kèm'}
          {testMode === 'project' && '🏗️ Chat AI về Dự Án'}
          {testMode === 'error' && '⚠️ Test Xử Lý Lỗi'}
        </Text>

        <AIChatComponent
          project={testMode === 'project' ? testProject : null}
          style={styles.chatComponent}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  testButtonsContainer: {
    padding: 16,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E5EA',
  },
  activeButton: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 12,
  },
  testInfo: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  testInfoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  testInfoContent: {
    alignItems: 'center',
  },
  testInfoText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  runTestButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  runTestButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  chatContainer: {
    flex: 1,
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  chatComponent: {
    flex: 1,
  },
});

export default AIChatTestComponent;
