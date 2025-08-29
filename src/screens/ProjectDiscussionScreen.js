import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  getProjectDiscussions,
  addDiscussionMessage,
  updateDiscussionMessage,
  recallDiscussionMessage,
  subscribeToProjectDiscussions,
  uploadFileToStorage,
} from '../api/projectDiscussionService';

const ProjectDiscussionScreen = ({ route, navigation }) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { projectId, projectName } = route.params;

  const [discussions, setDiscussions] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const flatListRef = useRef(null);
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    // Set up real-time listener
    unsubscribeRef.current = subscribeToProjectDiscussions(
      projectId,
      (discussions) => {
        setDiscussions(discussions);
        setLoading(false);
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [projectId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      setSending(true);
      await addDiscussionMessage(
        projectId,
        newMessage.trim(),
        user.uid,
        user.displayName || user.email,
        user.photoURL || null
      );
      setNewMessage('');
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể gửi tin nhắn. Vui lòng thử lại.');
    } finally {
      setSending(false);
    }
  };

  const handleEditMessage = (message) => {
    setEditingMessage(message.id);
    setEditText(message.message);
  };

  const handleSaveEdit = async () => {
    if (!editText.trim()) return;

    try {
      await updateDiscussionMessage(editingMessage, editText.trim());
      setEditingMessage(null);
      setEditText('');
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể cập nhật tin nhắn. Vui lòng thử lại.');
    }
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditText('');
  };

  const handleRecallMessage = (messageId) => {
    Alert.alert(
      'Xác nhận thu hồi',
      'Bạn có chắc chắn muốn thu hồi tin nhắn này?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Thu hồi',
          style: 'destructive',
          onPress: async () => {
            try {
              await recallDiscussionMessage(messageId);
            } catch (error) {
              Alert.alert(
                'Lỗi',
                'Không thể thu hồi tin nhắn. Vui lòng thử lại.'
              );
            }
          },
        },
      ]
    );
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await handleUploadFile(
          {
            uri: result.assets[0].uri,
            name: `image_${Date.now()}.jpg`,
            type: 'image/jpeg',
            size: result.assets[0].fileSize || 0,
          },
          'image'
        );
      }
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể chọn ảnh. Vui lòng thử lại.');
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        await handleUploadFile(
          {
            uri: result.assets[0].uri,
            name: result.assets[0].name,
            type: result.assets[0].mimeType,
            size: result.assets[0].size,
          },
          'pdf'
        );
      }
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể chọn tài liệu. Vui lòng thử lại.');
    }
  };

  const handleUploadFile = async (file, messageType) => {
    try {
      setUploadingFile(true);

      // Upload file to Firebase Storage instead of Google Drive
      const uploadedFile = await uploadFileToStorage(file, projectId);

      // Add message with attachment
      await addDiscussionMessage(
        projectId,
        messageType === 'image' ? '' : '📄 Tài liệu',
        user.uid,
        user.displayName || user.email,
        user.photoURL || null,
        messageType,
        [uploadedFile]
      );

      setShowAttachmentMenu(false);
      // Bỏ notification thành công
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Lỗi', `Không thể upload file: ${error.message}`);
    } finally {
      setUploadingFile(false);
    }
  };

  // Hàm test notification
  const handleTestNotification = async () => {
    try {
      // Gửi tin nhắn test để trigger notification
      await addDiscussionMessage(
        projectId,
        '🔔 TEST NOTIFICATION - Kiểm tra push notification!',
        user.uid,
        user.displayName || user.email,
        user.photoURL || null
      );

      Alert.alert(
        'Test Notification',
        'Đã gửi tin nhắn test! Bây giờ hãy:\n\n1. Nhấn Home để đưa app về background\n2. Hoặc tắt app hoàn toàn\n3. Chờ notification xuất hiện',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể gửi tin nhắn test. Vui lòng thử lại.');
    }
  };

  const renderMessage = ({ item }) => {
    const isOwnMessage = item.userId === user.uid;
    const isEditing = editingMessage === item.id;
    // Kiểm tra xem tin nhắn có phải chỉ là hình ảnh không
    const isImageOnly =
      !item.message &&
      item.attachments &&
      item.attachments.length > 0 &&
      item.attachments[0].type?.startsWith('image/');

    if (item.isRecalled) {
      return (
        <View
          style={[styles.messageContainer, isOwnMessage && styles.ownMessage]}
        >
          <Text style={styles.recalledText}>Tin nhắn đã được thu hồi</Text>
        </View>
      );
    }

    return (
      <View
        style={[styles.messageContainer, isOwnMessage && styles.ownMessage]}
      >
        {!isOwnMessage && (
          <View style={styles.userInfo}>
            {item.userPhotoURL ? (
              <Image
                source={{ uri: item.userPhotoURL }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={20} color={theme.text} />
              </View>
            )}
            <Text style={styles.userName}>{item.userName}</Text>
          </View>
        )}

        {isEditing ? (
          <View style={styles.editContainer}>
            <TextInput
              style={styles.editInput}
              value={editText}
              onChangeText={setEditText}
              multiline
              placeholder="Chỉnh sửa tin nhắn..."
            />
            <View style={styles.editActions}>
              <TouchableOpacity
                onPress={handleSaveEdit}
                style={styles.editButton}
              >
                <Text style={styles.editButtonText}>Lưu</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCancelEdit}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Hủy</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View
            style={[
              isOwnMessage ? styles.ownMessageContent : styles.messageContent,
              // Ghi đè style nếu chỉ có hình ảnh
              isImageOnly && {
                padding: 0,
                backgroundColor: 'transparent',
                borderWidth: 0,
                shadowOpacity: 0,
                elevation: 0,
                borderRadius: 15,
              },
            ]}
          >
            {/* Timestamp ở trên đầu */}
            <Text style={styles.timestamp}>
              {item.createdAt?.toDate?.()?.toLocaleString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
              }) || 'Vừa xong'}
            </Text>

            {item.message && (
              <Text
                style={[
                  styles.messageText,
                  isOwnMessage && styles.ownMessageText,
                ]}
              >
                {item.message}
              </Text>
            )}

            {/* Render attachments */}
            {item.attachments && item.attachments.length > 0 && (
              <View style={isImageOnly ? {} : styles.attachmentsContainer}>
                {item.attachments.map((attachment, index) => (
                  <View key={index} style={styles.attachment}>
                    {attachment.type?.startsWith('image/') ? (
                      <TouchableOpacity
                        onPress={() => setSelectedImage(attachment.url)}
                        style={styles.imageTouchable}
                      >
                        <Image
                          source={{ uri: attachment.url }}
                          style={[
                            styles.attachmentImage,
                            isImageOnly && { borderRadius: 15 },
                          ]}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.documentAttachment}
                        onPress={() => {
                          // Handle document opening
                          Alert.alert('Mở tài liệu', `Mở ${attachment.name}?`);
                        }}
                      >
                        <Ionicons
                          name="document"
                          size={24}
                          color={theme.primary}
                        />
                        <Text style={styles.documentName}>
                          {attachment.name}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {!isEditing && (
          <View style={styles.messageActions}>
            {isOwnMessage && (
              <>
                <TouchableOpacity
                  onPress={() => handleEditMessage(item)}
                  style={styles.actionButton}
                >
                  <Ionicons
                    name="create-outline"
                    size={16}
                    color={theme.text}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleRecallMessage(item.id)}
                  style={styles.actionButton}
                >
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color={theme.danger}
                  />
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>
            Đang tải thảo luận...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Thảo luận dự án: {projectName}
        </Text>
        <TouchableOpacity
          onPress={handleTestNotification}
          style={styles.testNotificationButton}
        >
          <Ionicons name="notifications" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={discussions}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        inverted
        showsVerticalScrollIndicator={false}
      />

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}
      >
        <View style={styles.inputRow}>
          <TouchableOpacity
            onPress={() => setShowAttachmentMenu(true)}
            style={styles.attachmentButton}
          >
            <Ionicons
              name="add-circle-outline"
              size={24}
              color={theme.primary}
            />
          </TouchableOpacity>

          <TextInput
            style={[
              styles.textInput,
              { color: theme.text, borderColor: theme.border },
            ]}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Nhập tin nhắn..."
            placeholderTextColor={theme.textSecondary}
            multiline
            maxLength={1000}
          />

          <TouchableOpacity
            onPress={handleSendMessage}
            disabled={sending || !newMessage.trim()}
            style={[
              styles.sendButton,
              (!newMessage.trim() || sending) && styles.sendButtonDisabled,
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color={theme.background} />
            ) : (
              <Ionicons name="send" size={20} color={theme.background} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Attachment Menu Modal */}
      <Modal
        visible={showAttachmentMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAttachmentMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAttachmentMenu(false)}
        >
          <View
            style={[styles.attachmentMenu, { backgroundColor: theme.card }]}
          >
            <TouchableOpacity
              style={styles.attachmentOption}
              onPress={() => {
                setShowAttachmentMenu(false);
                handlePickImage();
              }}
            >
              <Ionicons name="image" size={24} color={theme.primary} />
              <Text
                style={[styles.attachmentOptionText, { color: theme.text }]}
              >
                Chọn ảnh
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.attachmentOption}
              onPress={() => {
                setShowAttachmentMenu(false);
                handlePickDocument();
              }}
            >
              <Ionicons name="document" size={24} color={theme.primary} />
              <Text
                style={[styles.attachmentOptionText, { color: theme.text }]}
              >
                Chọn tài liệu
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Image Preview Modal */}
      <Modal
        visible={!!selectedImage}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <TouchableOpacity
          style={styles.imagePreviewOverlay}
          activeOpacity={1}
          onPress={() => setSelectedImage(null)}
        >
          <Image
            source={{ uri: selectedImage }}
            style={styles.imagePreview}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </Modal>

      {/* Upload Progress */}
      {uploadingFile && (
        <View style={styles.uploadProgress}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={[styles.uploadText, { color: theme.text }]}>
            Đang upload file...
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
    flex: 1,
  },
  testNotificationButton: {
    marginLeft: 16,
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messageContainer: {
    marginVertical: 8,
    maxWidth: '80%',
    alignSelf: 'flex-start',
  },
  ownMessage: {
    alignSelf: 'flex-end',
  },
  ownMessageContent: {
    backgroundColor: '#7C1FFD',
    padding: 16,
    borderRadius: 20,
    borderBottomRightRadius: 6,
    borderWidth: 1,
    borderColor: '#6B1FD1',
    shadowColor: '#7C1FFD',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  avatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  userName: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  messageContent: {
    backgroundColor: '#F1F0F1',
    padding: 16,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  ownMessageText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
    fontWeight: '400',
  },
  attachmentsContainer: {
    marginTop: 8, // Thêm một chút khoảng cách nếu có cả text và ảnh
  },
  attachment: {
    // Để trống
  },
  attachmentImage: {
    width: 200,
    height: 150,
    // borderRadius nên được áp dụng ở đây nếu bạn muốn ảnh có góc bo tròn
  },
  imageTouchable: {
    // Để trống
  },
  documentAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  documentName: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
  },
  timestamp: {
    fontSize: 11,
    color: '#666666',
    marginBottom: 8,
    alignSelf: 'flex-start',
    fontWeight: '400',
  },
  messageActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  actionButton: {
    marginLeft: 8,
    padding: 4,
  },
  editContainer: {
    backgroundColor: '#F1F0F1',
    padding: 16,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  editInput: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 8,
    color: '#000000',
    fontWeight: '400',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  editButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  recalledText: {
    fontSize: 14,
    color: '#666666',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  inputContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  attachmentButton: {
    padding: 8,
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxHeight: 100,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    color: '#1F2937',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  attachmentMenu: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    borderRadius: 16,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  attachmentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  attachmentOptionText: {
    fontSize: 16,
    marginLeft: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  imagePreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePreview: {
    width: '90%',
    height: '80%',
  },
  uploadProgress: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 14,
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
});

export default ProjectDiscussionScreen;
