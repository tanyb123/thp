import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useAIChat } from '../contexts/AIChatContext';
import { askAboutProject, askGeneralQuestion } from '../api/aiChatService';

const AIChatComponent = ({
  project = null,
  style = {},
  initialQuestion = null,
  navigation = null,
}) => {
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingText, setTypingText] = useState('');
  const [typingSpeed, setTypingSpeed] = useState(30); // Tốc độ typing (ms)
  const typingIntervalRef = useRef(null);
  const [attachments, setAttachments] = useState([]);
  const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);
  const flatListRef = useRef(null);

  const {
    messages,
    addMessage,
    updateMessageStatus,
    setCurrentProject,
    clearChat,
    isLoading,
    error,
    chatMode,
    markMessageAsRead,
  } = useAIChat();

  // Set current project when component mounts or project changes
  useEffect(() => {
    if (project) {
      setCurrentProject(project);
    }
  }, [project]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Mark messages as read when user views them
  useEffect(() => {
    if (messages.length > 0) {
      markMessageAsRead();
    }
  }, [messages]);

  // Handle initial question if provided
  useEffect(() => {
    if (initialQuestion && messages.length === 0) {
      // Auto-send initial question after a short delay
      setTimeout(() => {
        handleSendInitialQuestion(initialQuestion);
      }, 500);
    }
  }, [initialQuestion, messages.length]);

  // Cleanup typing interval on unmount
  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
    };
  }, []);

  // Request permissions for image picker
  useEffect(() => {
    (async () => {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Quyền truy cập',
          'Cần quyền truy cập thư viện ảnh để chọn ảnh'
        );
      }
    })();
  }, []);

  const handleSendInitialQuestion = async (question) => {
    if (!question.trim() || isTyping) return;

    const userMessage = {
      role: 'user',
      content: question.trim(),
      type: 'user',
    };

    // Add user message to chat
    const addedMessage = addMessage(userMessage, project?.id);

    try {
      let response;

      if (project) {
        // Ask about specific project
        response = await askAboutProject(question.trim(), project, messages);
      } else {
        // Ask general question
        response = await askGeneralQuestion(question.trim(), messages);
      }

      if (response.success) {
        // Start typing effect - message will be added automatically when typing completes
        startTypingEffect(response.message);
        updateMessageStatus(addedMessage.id, 'delivered');
      } else {
        // Handle error
        updateMessageStatus(addedMessage.id, 'error');
        Alert.alert(
          'Lỗi',
          response.message || 'Có lỗi xảy ra khi gửi tin nhắn'
        );
      }
    } catch (error) {
      console.error('Error sending initial question:', error);
      updateMessageStatus(addedMessage.id, 'error');
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi gửi tin nhắn');
    }
  };

  // Handle image selection
  const handleImagePicker = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const newAttachment = {
          id: Date.now().toString(),
          type: 'image',
          uri: result.assets[0].uri,
          name: `image_${Date.now()}.jpg`,
          size: result.assets[0].fileSize || 0,
        };
        setAttachments([...attachments, newAttachment]);
        setShowAttachmentOptions(false);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Lỗi', 'Không thể chọn ảnh');
    }
  };

  // Handle document selection
  const handleDocumentPicker = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const newAttachment = {
          id: Date.now().toString(),
          type: 'document',
          uri: result.assets[0].uri,
          name: result.assets[0].name,
          size: result.assets[0].size || 0,
        };
        setAttachments([...attachments, newAttachment]);
        setShowAttachmentOptions(false);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Lỗi', 'Không thể chọn tài liệu');
    }
  };

  // Remove attachment
  const removeAttachment = (attachmentId) => {
    setAttachments(attachments.filter((att) => att.id !== attachmentId));
  };

  // Clear all attachments
  const clearAttachments = () => {
    setAttachments([]);
  };

  const handleSendMessage = async () => {
    if ((!inputText.trim() && attachments.length === 0) || isTyping) return;

    const userMessage = {
      role: 'user',
      content: inputText.trim() || 'Đã gửi file đính kèm',
      type: 'user',
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    };

    // Add user message to chat
    const addedMessage = addMessage(userMessage, project?.id);
    setInputText('');
    clearAttachments(); // Clear attachments after sending

    try {
      let response;

      if (project) {
        // Ask about specific project
        response = await askAboutProject(
          inputText.trim(),
          project,
          messages,
          attachments
        );
      } else {
        // Ask general question
        response = await askGeneralQuestion(
          inputText.trim(),
          messages,
          attachments
        );
      }

      if (response.success) {
        // Start typing effect - message will be added automatically when typing completes
        startTypingEffect(response.message);
        updateMessageStatus(addedMessage.id, 'delivered');
      } else {
        // Handle error
        const errorMessage = {
          role: 'assistant',
          content: `❌ ${response.message}`,
          type: 'error',
        };

        addMessage(errorMessage, project?.id);
        updateMessageStatus(addedMessage.id, 'error');
      }
    } catch (error) {
      console.error('Error sending message:', error);

      const errorMessage = {
        role: 'assistant',
        content: '❌ Có lỗi xảy ra khi gửi tin nhắn. Vui lòng thử lại.',
        type: 'error',
      };

      addMessage(errorMessage, project?.id);
      updateMessageStatus(addedMessage.id, 'error');
    }
  };

  const renderSuggestedQuestions = () => {
    // Bỏ câu hỏi gợi ý tự động
    return null;
  };

  // Hàm xử lý text markdown
  const renderMarkdownText = (text) => {
    if (!text) return null;

    // Xử lý bold text với **
    const parts = text.split(/(\*\*.*?\*\*)/g);

    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        // Text bold
        const boldText = part.slice(2, -2);
        return (
          <Text key={index} style={[styles.messageText, styles.boldText]}>
            {boldText}
          </Text>
        );
      } else if (part.trim()) {
        // Text thường
        return (
          <Text key={index} style={styles.messageText}>
            {part}
          </Text>
        );
      }
      return null;
    });
  };

  // Hàm tạo typing effect
  const startTypingEffect = (fullText) => {
    setTypingText('');
    setIsTyping(true);

    let currentIndex = 0;
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
    }
    const interval = setInterval(() => {
      if (currentIndex < fullText.length) {
        setTypingText(fullText.substring(0, currentIndex + 1));
        currentIndex++;

        // Auto-scroll to bottom when typing
        if (flatListRef.current) {
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 50);
        }
      } else {
        clearInterval(interval);
        typingIntervalRef.current = null;

        // Add AI message to chat after typing is complete
        const aiMessage = {
          role: 'assistant',
          content: fullText,
          type: 'ai',
        };
        addMessage(aiMessage, project?.id);

        // Reset typing state
        setIsTyping(false);
        setTypingText('');
      }
    }, typingSpeed);
    typingIntervalRef.current = interval;
  };

  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    const isError = item.type === 'error';

    return (
      <View
        style={[
          styles.messageContainer,
          isUser ? styles.userMessage : styles.aiMessage,
          isError && styles.errorMessage,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.aiBubble,
            isError && styles.errorBubble,
          ]}
        >
          {isUser ? (
            <Text
              style={[
                styles.messageText,
                styles.userText,
                isError && styles.errorText,
              ]}
            >
              {item.content}
            </Text>
          ) : (
            <View style={styles.aiMessageContent}>
              {renderMarkdownText(item.content)}
            </View>
          )}

          {/* Render attachments if any */}
          {item.attachments && item.attachments.length > 0 && (
            <View style={styles.attachmentsInMessage}>
              {item.attachments.map((attachment) => (
                <View key={attachment.id} style={styles.attachmentInMessage}>
                  {attachment.type === 'image' ? (
                    <Image
                      source={{ uri: attachment.uri }}
                      style={styles.attachmentInMessageImage}
                    />
                  ) : (
                    <View style={styles.documentAttachment}>
                      <Ionicons
                        name="document-outline"
                        size={24}
                        color="#4F46E5"
                      />
                      <Text
                        style={styles.documentAttachmentName}
                        numberOfLines={1}
                      >
                        {attachment.name}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          <View style={styles.messageFooter}>
            <Text style={styles.timestamp}>
              {new Date(item.timestamp).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            {item.status && (
              <View style={styles.statusContainer}>
                {item.status === 'sent' && (
                  <Ionicons name="checkmark" size={12} color="#6B7280" />
                )}
                {item.status === 'delivered' && (
                  <Ionicons name="checkmark-done" size={12} color="#4F46E5" />
                )}
                {item.status === 'error' && (
                  <Ionicons name="alert-circle" size={12} color="#DC2626" />
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const handleClearChat = () => {
    Alert.alert(
      'Xóa lịch sử chat',
      'Bạn có chắc chắn muốn xóa toàn bộ lịch sử chat này?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => {
            clearChat();
          },
        },
      ]
    );
  };

  const renderTypingIndicator = () => {
    if (!isTyping) return null;

    return (
      <View style={[styles.messageContainer, styles.aiMessage]}>
        <View style={[styles.messageBubble, styles.aiBubble]}>
          {typingText ? (
            <ScrollView style={styles.typingScroll} nestedScrollEnabled>
              <View style={styles.aiMessageContent}>
                {renderMarkdownText(typingText)}
              </View>
            </ScrollView>
          ) : (
            <View style={styles.typingIndicator}>
              <Text style={styles.typingText}>AI đang trả lời</Text>
              <View style={styles.dots}>
                <View style={[styles.dot, styles.dot1]} />
                <View style={[styles.dot, styles.dot2]} />
                <View style={[styles.dot, styles.dot3]} />
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      {renderSuggestedQuestions()}

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={isTyping ? renderTypingIndicator() : null}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="sparkles-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyStateTitle}>Chào bạn! 👋</Text>
            <Text style={styles.emptyStateText}>
              Tôi có thể giúp bạn với các câu hỏi về quản lý dự án sản xuất, quy
              trình làm việc, và các vấn đề liên quan đến sản xuất công nghiệp.
            </Text>
          </View>
        }
      />

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>❌ {error}</Text>
        </View>
      )}

      {/* Attachment Preview */}
      {attachments.length > 0 && (
        <View style={styles.attachmentsContainer}>
          <Text style={styles.attachmentsTitle}>File đính kèm:</Text>
          {attachments.map((attachment) => (
            <View key={attachment.id} style={styles.attachmentItem}>
              {attachment.type === 'image' ? (
                <Image
                  source={{ uri: attachment.uri }}
                  style={styles.attachmentImage}
                />
              ) : (
                <Ionicons name="document-outline" size={24} color="#4F46E5" />
              )}
              <View style={styles.attachmentInfo}>
                <Text style={styles.attachmentName} numberOfLines={1}>
                  {attachment.name}
                </Text>
                <Text style={styles.attachmentSize}>
                  {(attachment.size / 1024).toFixed(1)} KB
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => removeAttachment(attachment.id)}
                style={styles.removeAttachmentButton}
              >
                <Ionicons name="close-circle" size={20} color="#DC2626" />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            onPress={clearAttachments}
            style={styles.clearAttachmentsButton}
          >
            <Text style={styles.clearAttachmentsText}>Xóa tất cả</Text>
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}
      >
        {/* Attachment Options */}
        <TouchableOpacity
          style={styles.attachmentButton}
          onPress={() => setShowAttachmentOptions(!showAttachmentOptions)}
        >
          <Ionicons name="attach" size={22} color="#4F46E5" />
        </TouchableOpacity>

        {showAttachmentOptions && (
          <View style={styles.attachmentOptions}>
            <TouchableOpacity
              style={styles.attachmentOption}
              onPress={handleImagePicker}
            >
              <Ionicons name="image" size={20} color="#4F46E5" />
              <Text style={styles.attachmentOptionText}>Chọn ảnh</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.attachmentOption}
              onPress={handleDocumentPicker}
            >
              <Ionicons name="document" size={20} color="#4F46E5" />
              <Text style={styles.attachmentOptionText}>Chọn tài liệu</Text>
            </TouchableOpacity>
          </View>
        )}

        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Hỏi gì đó về quản lý dự án..."
          placeholderTextColor="#6B7280"
          multiline
          maxLength={1000}
          editable={!isTyping}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            ((!inputText.trim() && attachments.length === 0) || isTyping) &&
              styles.sendButtonDisabled,
          ]}
          onPress={handleSendMessage}
          disabled={(!inputText.trim() && attachments.length === 0) || isTyping}
        >
          <Ionicons
            name="send"
            size={20}
            color={
              (!inputText.trim() && attachments.length === 0) || isTyping
                ? '#D1D5DB'
                : '#FFFFFF'
            }
          />
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  suggestionsContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },

  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },

  suggestionButton: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },

  suggestionText: {
    fontSize: 14,
    color: '#007AFF',
    textAlign: 'center',
  },

  messagesList: {
    flex: 1,
    paddingHorizontal: 20,
  },

  messageContainer: {
    marginVertical: 8,
    flexDirection: 'row',
  },

  userMessage: {
    justifyContent: 'flex-end',
  },

  aiMessage: {
    justifyContent: 'flex-start',
  },

  messageBubble: {
    maxWidth: '80%',
    padding: 16,
    borderRadius: 20,
  },

  userBubble: {
    backgroundColor: '#4F46E5',
    borderBottomRightRadius: 6,
    shadowColor: '#4F46E5',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },

  aiBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },

  errorBubble: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
    borderWidth: 1,
  },

  messageText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },

  userText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },

  aiText: {
    color: '#1F2937',
    fontWeight: '400',
  },

  boldText: {
    fontWeight: '700',
    color: '#1F2937',
  },

  aiMessageContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },

  errorText: {
    color: '#DC2626',
    fontWeight: '500',
  },

  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },

  timestamp: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '400',
  },

  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },

  typingText: {
    fontSize: 16,
    color: '#6B7280',
    marginRight: 8,
    fontWeight: '500',
  },

  dots: {
    flexDirection: 'row',
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6B7280',
    marginHorizontal: 2,
  },

  dot1: {
    opacity: 0.4,
  },

  dot2: {
    opacity: 0.6,
  },

  dot3: {
    opacity: 0.8,
  },

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },

  emptyStateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },

  emptyStateText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 24,
  },

  errorContainer: {
    backgroundColor: '#FEF2F2',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 8,
  },

  textInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    color: '#1F2937',
  },

  sendButton: {
    backgroundColor: '#4F46E5',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },

  sendButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },

  // Styles cho file đính kèm
  attachmentsContainer: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },

  attachmentsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },

  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },

  attachmentImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },

  attachmentInfo: {
    flex: 1,
    marginRight: 8,
  },

  attachmentName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2,
  },

  attachmentSize: {
    fontSize: 12,
    color: '#6B7280',
  },

  removeAttachmentButton: {
    padding: 4,
  },

  clearAttachmentsButton: {
    alignSelf: 'flex-end',
    padding: 8,
  },

  clearAttachmentsText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '500',
  },

  attachmentButton: {
    padding: 10,
    marginRight: 12,
  },

  attachmentOptions: {
    position: 'absolute',
    bottom: 60,
    left: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  attachmentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },

  attachmentOptionText: {
    fontSize: 14,
    color: '#1F2937',
    marginLeft: 8,
    fontWeight: '500',
  },

  // Styles cho file đính kèm trong tin nhắn
  attachmentsInMessage: {
    marginTop: 12,
  },

  attachmentInMessage: {
    marginBottom: 6,
  },

  attachmentInMessageImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  documentAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  documentAttachmentName: {
    fontSize: 12,
    color: '#4F46E5',
    marginLeft: 8,
    flex: 1,
    fontWeight: '500',
  },
});

export default AIChatComponent;
