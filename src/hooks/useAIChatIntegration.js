import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAIChat } from '../contexts/AIChatContext';
import { askAboutProject, askGeneralQuestion } from '../api/aiChatService';

/**
 * Hook để tích hợp AI Chat với các màn hình khác
 * Cung cấp các hàm tiện ích để tương tác với AI từ bất kỳ đâu trong app
 * Phiên bản đơn giản không phụ thuộc vào AIChatContext
 */
export const useAIChatIntegration = () => {
  const navigation = useNavigation();
  const {
    addMessage,
    updateMessageStatus,
    setCurrentProject,
    getChatHistory,
    clearChat,
    chatMode,
    CHAT_MODES,
  } = useAIChat();

  /**
   * Mở màn hình AI Chat với context dự án cụ thể
   * @param {Object} project - Thông tin dự án
   * @param {string} initialQuestion - Câu hỏi ban đầu (tùy chọn)
   */
  const openAIChatWithProject = useCallback(
    (project, initialQuestion = null) => {
      if (!project) {
        console.warn('Project is required for openAIChatWithProject');
        return;
      }

      // Set current project in context
      setCurrentProject(project);

      // Navigate to AI Chat screen with project data
      navigation.navigate('AIChat', {
        project,
        initialQuestion,
      });

      // If there's an initial question, add it to chat after navigation
      if (initialQuestion) {
        setTimeout(() => {
          addMessage(
            {
              role: 'user',
              content: initialQuestion,
              type: 'user',
            },
            project.id
          );
        }, 500);
      }
    },
    [navigation, setCurrentProject, addMessage]
  );

  /**
   * Mở màn hình AI Chat chung (không có dự án cụ thể)
   * @param {string} initialQuestion - Câu hỏi ban đầu (tùy chọn)
   */
  const openGeneralAIChat = useCallback(
    (initialQuestion = null) => {
      // Clear current project
      setCurrentProject(null);

      // Navigate to AI Chat screen
      navigation.navigate('AIChat', {
        initialQuestion,
      });

      // If there's an initial question, add it to chat after navigation
      if (initialQuestion) {
        setTimeout(() => {
          addMessage({
            role: 'user',
            content: initialQuestion,
            type: 'user',
          });
        }, 500);
      }
    },
    [navigation, setCurrentProject, addMessage]
  );

  /**
   * Gửi câu hỏi nhanh đến AI (không mở màn hình chat)
   * @param {string} question - Câu hỏi
   * @param {Object} project - Dự án (tùy chọn)
   * @returns {Promise<Object>} Phản hồi từ AI
   */
  const askQuickQuestion = useCallback(
    async (question, project = null) => {
      try {
        let response;

        if (project) {
          const chatHistory = getChatHistory(project.id);
          response = await askAboutProject(question, project, chatHistory);
        } else {
          const chatHistory = getChatHistory();
          response = await askGeneralQuestion(question, chatHistory);
        }

        return response;
      } catch (error) {
        console.error('Error asking quick question:', error);
        return {
          success: false,
          error: error.message,
          message: 'Có lỗi xảy ra khi gửi câu hỏi',
        };
      }
    },
    [getChatHistory]
  );

  /**
   * Tạo câu hỏi gợi ý dựa trên context hiện tại
   * @param {Object} project - Dự án (tùy chọn)
   * @param {string} context - Context cụ thể (tùy chọn)
   * @returns {Array} Danh sách câu hỏi gợi ý
   */
  const getContextualSuggestions = useCallback(
    (project = null, context = null) => {
      const baseSuggestions = [];

      if (project) {
        baseSuggestions.push(
          `Dự án "${project.name}" đang ở giai đoạn nào?`,
          'Cần làm gì để đẩy nhanh tiến độ dự án?',
          'Có vấn đề gì cần lưu ý trong dự án này?'
        );

        if (context === 'production') {
          baseSuggestions.push(
            'Làm thế nào để tối ưu hóa quy trình sản xuất?',
            'Cần chuẩn bị gì cho giai đoạn tiếp theo?',
            'Có thể cải thiện hiệu suất sản xuất như thế nào?'
          );
        } else if (context === 'financial') {
          baseSuggestions.push(
            'Làm thế nào để kiểm soát chi phí dự án?',
            'Có thể tối ưu hóa ngân sách không?',
            'Cần lưu ý gì về tài chính dự án?'
          );
        }
      } else {
        baseSuggestions.push(
          'Làm thế nào để quản lý dự án hiệu quả?',
          'Các bước lập kế hoạch dự án sản xuất?',
          'Làm sao để theo dõi tiến độ dự án?'
        );
      }

      return baseSuggestions;
    },
    []
  );

  /**
   * Kiểm tra xem có tin nhắn chưa đọc không
   * @returns {boolean} Có tin nhắn chưa đọc hay không
   */
  const hasUnreadMessages = useCallback(() => {
    const currentHistory = getChatHistory();
    return currentHistory.some(
      (msg) => msg.role === 'assistant' && !msg.isRead
    );
  }, [getChatHistory]);

  /**
   * Lấy số tin nhắn chưa đọc
   * @returns {number} Số tin nhắn chưa đọc
   */
  const getUnreadCount = useCallback(() => {
    const currentHistory = getChatHistory();
    return currentHistory.filter(
      (msg) => msg.role === 'assistant' && !msg.isRead
    ).length;
  }, [getChatHistory]);

  /**
   * Tạo báo cáo tóm tắt từ lịch sử chat
   * @param {string} projectId - ID dự án (tùy chọn)
   * @returns {Object} Báo cáo tóm tắt
   */
  const generateChatSummary = useCallback(
    (projectId = null) => {
      const history = getChatHistory(projectId);

      if (history.length === 0) {
        return {
          totalMessages: 0,
          userMessages: 0,
          aiMessages: 0,
          lastActivity: null,
          summary: 'Chưa có tin nhắn nào',
        };
      }

      const userMessages = history.filter((msg) => msg.role === 'user');
      const aiMessages = history.filter((msg) => msg.role === 'assistant');
      const lastMessage = history[history.length - 1];

      return {
        totalMessages: history.length,
        userMessages: userMessages.length,
        aiMessages: aiMessages.length,
        lastActivity: lastMessage?.timestamp,
        summary: `Tổng cộng ${history.length} tin nhắn, ${userMessages.length} từ người dùng, ${aiMessages.length} từ AI`,
      };
    },
    [getChatHistory]
  );

  return {
    // Navigation functions
    openAIChatWithProject,
    openGeneralAIChat,

    // Quick question functions
    askQuickQuestion,

    // Utility functions
    getContextualSuggestions,
    hasUnreadMessages,
    getUnreadCount,
    generateChatSummary,

    // Context information
    chatMode,
    CHAT_MODES,

    // Direct context access
    setCurrentProject,
    clearChat,
    getChatHistory,
  };
};
