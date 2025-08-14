import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Action types
const ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  ADD_MESSAGE: 'ADD_MESSAGE',
  SET_ERROR: 'SET_ERROR',
  CLEAR_CHAT: 'CLEAR_CHAT',
  LOAD_CHAT_HISTORY: 'LOAD_CHAT_HISTORY',
  SET_CURRENT_PROJECT: 'SET_CURRENT_PROJECT',
  UPDATE_MESSAGE_STATUS: 'UPDATE_MESSAGE_STATUS',
  SET_CHAT_MODE: 'SET_CHAT_MODE',
  ADD_SUGGESTED_QUESTION: 'ADD_SUGGESTED_QUESTION',
  MARK_MESSAGE_AS_READ: 'MARK_MESSAGE_AS_READ',
};

// Chat modes
export const CHAT_MODES = {
  GENERAL: 'general',
  PROJECT: 'project',
  EXPERT: 'expert',
};

// Initial state
const initialState = {
  messages: [],
  isLoading: false,
  error: null,
  currentProject: null,
  chatHistory: {}, // Lưu trữ theo projectId
  chatMode: CHAT_MODES.GENERAL,
  suggestedQuestions: [],
  unreadCount: 0,
};

// Reducer
const aiChatReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
        error: null,
      };

    case ACTIONS.ADD_MESSAGE:
      const { message, projectId } = action.payload;
      const projectKey = projectId || 'general';

      return {
        ...state,
        messages: [...state.messages, message],
        chatHistory: {
          ...state.chatHistory,
          [projectKey]: [...(state.chatHistory[projectKey] || []), message],
        },
        unreadCount:
          message.role === 'assistant'
            ? state.unreadCount + 1
            : state.unreadCount,
      };

    case ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case ACTIONS.CLEAR_CHAT:
      return {
        ...state,
        messages: [],
        error: null,
        unreadCount: 0,
      };

    case ACTIONS.LOAD_CHAT_HISTORY:
      return {
        ...state,
        chatHistory: action.payload,
      };

    case ACTIONS.SET_CURRENT_PROJECT:
      const project = action.payload;
      const projectKeyForProject = project?.id || 'general';

      return {
        ...state,
        currentProject: project,
        messages: project
          ? state.chatHistory[projectKeyForProject] || []
          : state.chatHistory['general'] || [],
        chatMode: project ? CHAT_MODES.PROJECT : CHAT_MODES.GENERAL,
        unreadCount: 0, // Reset unread count when switching projects
      };

    case ACTIONS.UPDATE_MESSAGE_STATUS:
      const { messageId, status, response } = action.payload;
      return {
        ...state,
        messages: state.messages.map((msg) =>
          msg.id === messageId
            ? { ...msg, status, response, timestamp: new Date().toISOString() }
            : msg
        ),
        chatHistory: Object.keys(state.chatHistory).reduce((acc, key) => {
          acc[key] = state.chatHistory[key].map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  status,
                  response,
                  timestamp: new Date().toISOString(),
                }
              : msg
          );
          return acc;
        }, {}),
      };

    case ACTIONS.SET_CHAT_MODE:
      return {
        ...state,
        chatMode: action.payload,
      };

    case ACTIONS.ADD_SUGGESTED_QUESTION:
      return {
        ...state,
        suggestedQuestions: [...state.suggestedQuestions, action.payload],
      };

    case ACTIONS.MARK_MESSAGE_AS_READ:
      return {
        ...state,
        unreadCount: Math.max(0, state.unreadCount - 1),
      };

    default:
      return state;
  }
};

// Context
const AIChatContext = createContext();

// Provider component
export const AIChatProvider = ({ children }) => {
  const [state, dispatch] = useReducer(aiChatReducer, initialState);

  // Load chat history from storage on mount
  useEffect(() => {
    loadChatHistoryFromStorage();
  }, []);

  // Save chat history to storage whenever it changes
  useEffect(() => {
    saveChatHistoryToStorage();
  }, [state.chatHistory]);

  // Load chat history from AsyncStorage
  const loadChatHistoryFromStorage = async () => {
    try {
      const storedHistory = await AsyncStorage.getItem('ai_chat_history');
      if (storedHistory) {
        const parsedHistory = JSON.parse(storedHistory);
        dispatch({ type: ACTIONS.LOAD_CHAT_HISTORY, payload: parsedHistory });
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  // Save chat history to AsyncStorage
  const saveChatHistoryToStorage = async () => {
    try {
      await AsyncStorage.setItem(
        'ai_chat_history',
        JSON.stringify(state.chatHistory)
      );
    } catch (error) {
      console.error('Error saving chat history:', error);
    }
  };

  // Add a new message
  const addMessage = (message, projectId = null) => {
    const messageWithId = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      status: 'sent',
      isRead: false,
    };

    dispatch({
      type: ACTIONS.ADD_MESSAGE,
      payload: { message: messageWithId, projectId },
    });

    return messageWithId;
  };

  // Update message status (e.g., when AI responds)
  const updateMessageStatus = (messageId, status, response = null) => {
    dispatch({
      type: ACTIONS.UPDATE_MESSAGE_STATUS,
      payload: { messageId, status, response },
    });
  };

  // Set current project for context
  const setCurrentProject = (project) => {
    dispatch({ type: ACTIONS.SET_CURRENT_PROJECT, payload: project });
  };

  // Clear current chat
  const clearChat = () => {
    dispatch({ type: ACTIONS.CLEAR_CHAT });
  };

  // Set chat mode
  const setChatMode = (mode) => {
    dispatch({ type: ACTIONS.SET_CHAT_MODE, payload: mode });
  };

  // Mark message as read
  const markMessageAsRead = () => {
    dispatch({ type: ACTIONS.MARK_MESSAGE_AS_READ });
  };

  // Get chat history for a specific project
  const getChatHistory = (projectId = null) => {
    const key = projectId || 'general';
    return state.chatHistory[key] || [];
  };

  // Get current project context
  const getCurrentProject = () => state.currentProject;

  // Check if currently loading
  const isLoading = () => state.isLoading;

  // Get current error
  const getError = () => state.error;

  // Get chat mode
  const getChatMode = () => state.chatMode;

  // Get unread count
  const getUnreadCount = () => state.unreadCount;

  // Get suggested questions
  const getSuggestedQuestions = () => state.suggestedQuestions;

  // Export chat history
  const exportChatHistory = async (projectId = null) => {
    try {
      const history = getChatHistory(projectId);
      const exportData = {
        project: projectId ? getCurrentProject() : null,
        timestamp: new Date().toISOString(),
        messages: history,
      };

      // Save to file or share
      return exportData;
    } catch (error) {
      console.error('Error exporting chat history:', error);
      return null;
    }
  };

  // Search in chat history
  const searchInChatHistory = (query, projectId = null) => {
    const history = getChatHistory(projectId);
    if (!query.trim()) return history;

    const searchTerm = query.toLowerCase();
    return history.filter((message) =>
      message.content.toLowerCase().includes(searchTerm)
    );
  };

  const value = {
    // State
    messages: state.messages,
    isLoading: state.isLoading,
    error: state.error,
    currentProject: state.currentProject,
    chatMode: state.chatMode,
    unreadCount: state.unreadCount,
    suggestedQuestions: state.suggestedQuestions,

    // Actions
    addMessage,
    updateMessageStatus,
    setCurrentProject,
    clearChat,
    setChatMode,
    markMessageAsRead,
    getChatHistory,
    getCurrentProject,
    isLoading,
    getError,
    getChatMode,
    getUnreadCount,
    getSuggestedQuestions,
    exportChatHistory,
    searchInChatHistory,

    // Constants
    CHAT_MODES,

    // Dispatch for custom actions
    dispatch,
  };

  return (
    <AIChatContext.Provider value={value}>{children}</AIChatContext.Provider>
  );
};

// Custom hook to use the context
export const useAIChat = () => {
  const context = useContext(AIChatContext);
  if (!context) {
    throw new Error('useAIChat must be used within an AIChatProvider');
  }
  return context;
};
