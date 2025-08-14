import React, { useState, useLayoutEffect, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  Modal,
  Linking,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebaseConfig';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { updateStageDetails, getProjectById } from '../api/projectService';
import uuid from 'react-native-uuid';
import * as FileSystem from 'expo-file-system';
import {
  getTaskDisplayLabel,
  getStatusColor,
  getStatusDisplayLabel,
} from '../utils/taskHelpers';
import {
  requestAudioPermission,
  checkAudioPermission,
  setupAudioMode,
} from '../utils/audioPermissionHelper';
import { checkAllPermissions } from '../utils/permissionChecker';
import { useTheme } from '../contexts/ThemeContext';
import { listFiles, createFolder } from '../api/googleDriveService';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Chờ xử lý', color: '#9E9E9E' },
  { value: 'in_progress', label: 'Đang làm', color: '#FFD54F' },
  { value: 'completed', label: 'Hoàn thành', color: '#4CAF50' },
  { value: 'failed', label: 'Không đạt', color: '#F44336' },
];

const StageDetailScreen = ({ route, navigation }) => {
  const { theme } = useTheme(); // 🆕 Add theme context

  console.log('🎯 StageDetailScreen mounted with params:', {
    projectId: route.params?.projectId,
    stage: route.params?.stage,
  });

  const { projectId, stage } = route.params; // stage object passed in

  // Add error boundary for stage data
  if (!stage) {
    console.error('❌ No stage data provided to StageDetailScreen');
    Alert.alert('Lỗi', 'Không có dữ liệu công đoạn');
    navigation.goBack();
    return null;
  }

  const [status, setStatus] = useState(stage.status);
  const [notes, setNotes] = useState(stage.notes || '');
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(false);

  const computePreview = (f) => {
    if (f.preview) return f.preview;
    if (f.mimeType && f.mimeType.startsWith('image/')) {
      return `https://drive.google.com/uc?export=download&id=${f.id}`;
    }
    return undefined;
  };

  const initialFiles = (stage.files || []).map((f) => ({
    ...f,
    preview: computePreview(f),
  }));

  const [files, setFiles] = useState(initialFiles);
  const [imagePreviewUri, setImagePreviewUri] = useState(null);
  const [saving, setSaving] = useState(false);

  // Media Instructions States
  const [instructionImages, setInstructionImages] = useState(
    stage.instructionImages || []
  );
  const [instructionNotes, setInstructionNotes] = useState(
    stage.instructionNotes || ''
  );
  const [instructionAudio, setInstructionAudio] = useState(
    stage.instructionAudio || null
  );
  const [instructionFiles, setInstructionFiles] = useState(
    stage.instructionFiles || []
  );
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ headerTitle: stage.processName });
  }, [navigation]);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        setLoading(true);
        console.log('🔄 Fetching project data for:', projectId);
        const projectData = await getProjectById(projectId);
        console.log('✅ Project data loaded:', {
          id: projectData?.id,
          name: projectData?.name,
          workflowStagesCount: projectData?.workflowStages?.length,
        });
        setProject(projectData);
      } catch (error) {
        console.error('❌ Error fetching project details:', error);
        Alert.alert('Lỗi', `Không thể tải dữ liệu dự án: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      fetchProject();
    } else {
      console.error('❌ No projectId provided');
      Alert.alert('Lỗi', 'Không có ID dự án');
      navigation.goBack();
    }
  }, [projectId]);

  // Kiểm tra quyền ghi âm khi component mount
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const hasPermission = await checkAudioPermission();
        if (!hasPermission) {
          console.log('Audio permission not granted');
        }
      } catch (error) {
        console.error('Error checking audio permission:', error);
      }
    };

    checkPermission();
  }, []);

  const pickFile = async () => {
    const { status: perm } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm !== 'granted') {
      Alert.alert('Lỗi', 'Cần quyền truy cập thư viện ảnh.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.7,
    });
    if (!result.canceled) {
      uploadPickedFile(result.assets[0]);
    }
  };

  const takePhoto = async () => {
    const { status: perm } = await ImagePicker.requestCameraPermissionsAsync();
    if (perm !== 'granted') {
      Alert.alert('Lỗi', 'Cần quyền truy cập camera.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) {
      uploadPickedFile(result.assets[0]);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain',
          'image/*',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        uploadPickedFile(result.assets[0]);
      }
    } catch (err) {
      console.error('Error picking document:', err);
      Alert.alert('Lỗi', 'Không thể chọn tài liệu.');
    }
  };

  const pickInstructionDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain',
          'image/*',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        uploadInstructionFile(result.assets[0]);
      }
    } catch (err) {
      console.error('Error picking instruction document:', err);
      Alert.alert('Lỗi', 'Không thể chọn tài liệu hướng dẫn.');
    }
  };

  const uploadInstructionFile = async (asset) => {
    try {
      setSaving(true);

      if (!asset || !asset.uri) {
        Alert.alert('Lỗi', 'Tập tin không hợp lệ.');
        return;
      }

      const ext = (asset.fileName || asset.uri).split('.').pop();
      const filename = `${uuid.v4()}.${ext}`;

      console.log('Starting upload for instruction file:', asset.uri);

      try {
        // Get file info using FileSystem from expo
        const fileInfo = await FileSystem.getInfoAsync(asset.uri);
        console.log('File info:', fileInfo);

        if (!fileInfo.exists || fileInfo.size === 0) {
          throw new Error('File rỗng hoặc không tồn tại');
        }

        console.log('File size:', fileInfo.size, 'bytes');

        // Đọc file base64 bằng expo-file-system
        const base64Data = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Lấy accessToken Google của người dùng
        const accessToken = await getGoogleAccessToken();
        if (!accessToken) {
          return; // User cancelled or error occurred
        }

        // Gọi Cloud Function uploadFileToDriveUser
        const uploadFn = httpsCallable(functions, 'uploadInstructionFile');
        const result = await uploadFn({
          accessToken,
          projectId,
          fileName: filename,
          mimeType: asset.mimeType || asset.type || 'application/octet-stream',
          base64Data,
        });

        const {
          fileId,
          webViewLink,
          thumbnailLink,
          mimeType: returnedMime,
        } = result.data;

        const preview = webViewLink;

        setInstructionFiles((prev) => [
          ...prev,
          { name: filename, id: fileId, url: webViewLink, preview },
        ]);
      } catch (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Lỗi khi tải lên: ${uploadError.message}`);
      }
    } catch (err) {
      console.error('Error uploading instruction file:', err);
      Alert.alert('Lỗi', `Không thể tải lên tài liệu: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const removeInstructionFile = (index) => {
    setInstructionFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const viewInstructionFile = (file) => {
    if (file.url) {
      Linking.openURL(file.url);
    } else {
      Alert.alert('Lỗi', 'Không thể mở tài liệu này.');
    }
  };

  const uploadPickedFile = async (asset) => {
    try {
      setSaving(true);

      if (!asset || !asset.uri) {
        Alert.alert('Lỗi', 'Tập tin không hợp lệ.');
        return;
      }

      const ext = (asset.fileName || asset.uri).split('.').pop();
      const filename = `${uuid.v4()}.${ext}`;

      console.log('Starting upload for:', asset.uri);

      try {
        // Get file info using FileSystem from expo
        const fileInfo = await FileSystem.getInfoAsync(asset.uri);
        console.log('File info:', fileInfo);

        if (!fileInfo.exists || fileInfo.size === 0) {
          throw new Error('File rỗng hoặc không tồn tại');
        }

        console.log('File size:', fileInfo.size, 'bytes');

        // Đọc file base64 bằng expo-file-system
        const base64Data = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Lấy accessToken Google của người dùng
        const accessToken = await getGoogleAccessToken();
        if (!accessToken) {
          return; // User cancelled or error occurred
        }

        // Gọi Cloud Function uploadFileToDriveUser
        const uploadFn = httpsCallable(functions, 'uploadFileToDriveUser');
        const result = await uploadFn({
          accessToken,
          projectId,
          fileName: filename,
          mimeType: asset.mimeType || asset.type || 'image/jpeg',
          base64Data,
        });

        const {
          fileId,
          webViewLink,
          thumbnailLink,
          mimeType: returnedMime,
        } = result.data;
        const preview =
          returnedMime && returnedMime.startsWith('image/')
            ? thumbnailLink ||
              `https://drive.google.com/uc?export=download&id=${fileId}`
            : webViewLink;
        setFiles((prev) => [
          ...prev,
          { name: filename, id: fileId, url: webViewLink, preview },
        ]);
      } catch (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Lỗi khi tải lên: ${uploadError.message}`);
      }
    } catch (err) {
      console.error('Error uploading file:', err);
      Alert.alert(
        'Lỗi',
        `Không thể tải tệp: ${err.message || 'Lỗi không xác định'}`
      );
    } finally {
      setSaving(false);
    }
  };

  const removeFile = (file) => {
    Alert.alert('Xác nhận', 'Xóa tệp đính kèm này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            // Cập nhật đường dẫn để khớp với khi tải lên
            const delFn = httpsCallable(functions, 'deleteFileFromDrive');
            await delFn({ fileId: file.id });
          } catch (e) {
            console.log('Cannot delete from storage, maybe already removed');
          }
          setFiles((prev) => prev.filter((f) => f.name !== file.name));
        },
      },
    ]);
  };

  const viewFile = (file) => {
    if (file.preview && file.preview.startsWith('http')) {
      setImagePreviewUri(file.preview);
    } else if (file.url) {
      Linking.openURL(file.url).catch(() =>
        Alert.alert('Lỗi', 'Không thể mở tệp.')
      );
    }
  };

  // Get Google access token using GoogleSignin - same approach as other screens
  const getGoogleAccessToken = async () => {
    try {
      const isSignedIn = await GoogleSignin.isSignedIn();
      if (!isSignedIn) {
        Alert.alert(
          'Chưa đăng nhập Google',
          'Vui lòng đăng nhập với Google để upload ảnh.',
          [
            { text: 'Đóng', style: 'cancel' },
            {
              text: 'Đăng nhập',
              onPress: async () => {
                try {
                  await GoogleSignin.hasPlayServices();
                  await GoogleSignin.signIn();
                  Alert.alert(
                    'Thành công',
                    'Đã đăng nhập Google. Vui lòng thử lại.'
                  );
                } catch (error) {
                  console.error('Google Sign In Error:', error);
                  Alert.alert('Lỗi', 'Không thể đăng nhập với Google.');
                }
              },
            },
          ]
        );
        return null;
      }

      // User is signed in, get token
      const tokens = await GoogleSignin.getTokens();
      if (!tokens || !tokens.accessToken) {
        throw new Error('Không lấy được token Google');
      }

      console.log('Đã lấy Google access token thành công');
      return tokens.accessToken;
    } catch (error) {
      console.error('Google token error:', error);
      Alert.alert(
        'Lỗi xác thực',
        'Không lấy được token Google: ' + error.message
      );
      return null;
    }
  };

  // Upload media to Google Drive
  const uploadMediaToDrive = async (mediaItem, folder) => {
    try {
      console.log('Uploading media to Google Drive:', mediaItem.name);

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(mediaItem.uri);
      if (!fileInfo.exists || fileInfo.size === 0) {
        throw new Error('File rỗng hoặc không tồn tại');
      }

      // Read file as base64
      const base64Data = await FileSystem.readAsStringAsync(mediaItem.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Get Google access token
      const accessToken = await getGoogleAccessToken();
      if (!accessToken) {
        return; // User cancelled or error occurred
      }

      // Call Cloud Function to upload to Google Drive
      const uploadFn = httpsCallable(functions, 'uploadInstructionMedia');
      const result = await uploadFn({
        accessToken,
        projectId,
        fileName: mediaItem.name,
        mimeType: mediaItem.type || 'application/octet-stream',
        base64Data,
      });

      const { fileId, publicUrl, webViewLink, thumbnailLink } = result.data;

      return {
        id: fileId,
        name: mediaItem.name,
        url: publicUrl,
        webViewLink,
        thumbnailLink,
        type: mediaItem.type,
      };
    } catch (error) {
      console.error('Error uploading media to Google Drive:', error);
      throw error;
    }
  };

  // Ensure project has Drive root; create if missing
  const ensureProjectDriveFolder = async () => {
    if (project?.driveFolderId) return project;
    const tokens = await GoogleSignin.getTokens();
    const accessToken = tokens?.accessToken;
    if (!accessToken) {
      Alert.alert('Lỗi', 'Không thể lấy access token Google.');
      return null;
    }
    try {
      const createFn = httpsCallable(functions, 'createProjectFolders');
      const res = await createFn({ projectId });
      const updated = {
        ...(project || {}),
        driveFolderId: res?.data?.driveFolderId,
        driveFolderUrl: res?.data?.driveFolderUrl,
      };
      setProject(updated);
      return updated;
    } catch (e) {
      console.error('createProjectFolders error:', e);
      Alert.alert('Lỗi', 'Không thể tạo thư mục Drive cho dự án.');
      return null;
    }
  };

  // Find or create QC_Reports folder inside project root and return its ID
  const getQcReportsFolderId = async (accessToken, projectDriveFolderId) => {
    try {
      const children = await listFiles(accessToken, projectDriveFolderId);
      const qcFolder = (children || []).find(
        (f) =>
          f.mimeType === 'application/vnd.google-apps.folder' &&
          (f.name === 'QC_Reports' || f.name.toLowerCase() === 'qc-reports')
      );
      if (qcFolder) return qcFolder.id;
      const created = await createFolder(
        accessToken,
        'QC_Reports',
        projectDriveFolderId
      );
      return created?.id;
    } catch (err) {
      console.error('Error ensuring QC_Reports folder:', err);
      Alert.alert('Lỗi', 'Không thể truy cập thư mục QC_Reports trên Drive.');
      return null;
    }
  };

  // Open QC_Reports folder in Google Drive for the user to upload manually
  const openQcReportsFolder = async () => {
    try {
      // Ensure Google token
      const isSignedIn = await GoogleSignin.isSignedIn();
      if (!isSignedIn) {
        await GoogleSignin.hasPlayServices();
        await GoogleSignin.signIn();
      }
      const tokens = await GoogleSignin.getTokens();
      const accessToken = tokens?.accessToken;
      if (!accessToken) {
        Alert.alert('Lỗi', 'Không thể lấy access token Google.');
        return;
      }

      // Ensure project Drive root
      const ensuredProject = await ensureProjectDriveFolder();
      if (!ensuredProject?.driveFolderId) return;

      // Ensure QC_Reports folder and open it
      const qcId = await getQcReportsFolderId(
        accessToken,
        ensuredProject.driveFolderId
      );
      if (!qcId) return;
      const folderUrl = `https://drive.google.com/drive/folders/${qcId}`;
      Linking.openURL(folderUrl).catch(() =>
        Alert.alert('Lỗi', 'Không thể mở Google Drive.')
      );
    } catch (err) {
      console.error('openQcReportsFolder error:', err);
      Alert.alert('Lỗi', 'Không thể mở thư mục QC_Reports trên Drive.');
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Chỉ lưu các trường cần thiết để Firestore gọn nhẹ
      const filesToSave = files.map(({ name, id, url, mimeType }) => {
        const obj = { name, id, url };
        if (mimeType) obj.mimeType = mimeType;
        return obj;
      });

      // Upload instruction images to Google Drive
      const uploadedImages = [];
      for (const image of instructionImages) {
        if (image.uri && !image.url) {
          const uploadedImage = await uploadMediaToDrive(
            image,
            'instruction_images'
          );
          uploadedImages.push(uploadedImage);
        } else {
          uploadedImages.push(image);
        }
      }

      // Upload instruction audio to Google Drive
      let uploadedAudio = null;
      if (instructionAudio && instructionAudio.uri && !instructionAudio.url) {
        uploadedAudio = await uploadMediaToDrive(
          instructionAudio,
          'instruction_audio'
        );
      } else if (instructionAudio) {
        uploadedAudio = instructionAudio;
      }

      await updateStageDetails(projectId, stage.stageId, {
        status,
        notes,
        files: filesToSave,
        instructionImages: uploadedImages,
        instructionNotes,
        instructionAudio: uploadedAudio,
      });

      Alert.alert('Thành công', 'Đã lưu thay đổi', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      console.error(err);
      Alert.alert('Lỗi', 'Không thể lưu.');
    } finally {
      setSaving(false);
    }
  };

  // Media Instructions Functions
  const pickInstructionImage = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Lỗi', 'Cần quyền truy cập thư viện ảnh');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadInstructionImage(result.assets[0]);
      }
    } catch (error) {
      console.error('Error picking instruction image:', error);
      Alert.alert('Lỗi', 'Không thể chọn ảnh');
    }
  };

  const takeInstructionPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Lỗi', 'Cần quyền truy cập camera');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadInstructionImage(result.assets[0]);
      }
    } catch (error) {
      console.error('Error taking instruction photo:', error);
      Alert.alert('Lỗi', 'Không thể chụp ảnh');
    }
  };

  // Upload instruction image to Google Drive
  const uploadInstructionImage = async (asset) => {
    try {
      setSaving(true);

      if (!asset || !asset.uri) {
        Alert.alert('Lỗi', 'Tập tin không hợp lệ.');
        return;
      }

      const ext = (asset.fileName || asset.uri).split('.').pop();
      const filename = `instruction_${Date.now()}.${ext}`;

      console.log('Starting instruction image upload:', asset.uri);

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(asset.uri);
      console.log('File info:', fileInfo);

      if (!fileInfo.exists || fileInfo.size === 0) {
        throw new Error('File rỗng hoặc không tồn tại');
      }

      // Read file as base64
      const base64Data = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Get Google access token
      const accessToken = await getGoogleAccessToken();
      if (!accessToken) {
        return; // User cancelled or error occurred
      }

      // Call Cloud Function to upload to Google Drive
      const uploadFn = httpsCallable(functions, 'uploadInstructionMedia');
      const result = await uploadFn({
        accessToken,
        projectId,
        fileName: filename,
        mimeType: asset.mimeType || asset.type || 'image/jpeg',
        base64Data,
      });

      const { fileId, publicUrl, webViewLink, thumbnailLink } = result.data;

      // Add to instruction images
      const newImage = {
        id: fileId,
        name: filename,
        url: publicUrl,
        webViewLink,
        thumbnailLink,
        type: 'image/jpeg',
      };

      setInstructionImages([...instructionImages, newImage]);
      Alert.alert('Thành công', 'Đã tải ảnh hướng dẫn lên Google Drive');
    } catch (error) {
      console.error('Error uploading instruction image:', error);
      Alert.alert('Lỗi', `Không thể tải ảnh lên: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const removeInstructionImage = (index) => {
    const updatedImages = instructionImages.filter((_, i) => i !== index);
    setInstructionImages(updatedImages);
  };

  // Audio Functions
  const startRecording = async () => {
    try {
      // Xin quyền ghi âm
      const hasPermission = await requestAudioPermission();
      if (!hasPermission) {
        return;
      }

      // Cấu hình audio mode cho ghi âm
      const audioModeSet = await setupAudioMode();
      if (!audioModeSet) {
        Alert.alert('Lỗi', 'Không thể cấu hình audio mode');
        return;
      }

      const { recording } = await Audio.Recording.createAsync({
        android: {
          extension: '.mp3',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_LINEARPCM,
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      });
      setRecording(recording);
      setIsRecording(true);

      // Thông báo bắt đầu ghi âm
      Alert.alert('Ghi âm', 'Đã bắt đầu ghi âm. Nhấn nút dừng để kết thúc.');
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert(
        'Lỗi',
        'Không thể bắt đầu ghi âm. Vui lòng kiểm tra quyền microphone.'
      );
    }
  };

  const stopRecording = async () => {
    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      // Xác định extension và type dựa trên platform
      const isAndroid = Platform.OS === 'android';
      const extension = isAndroid ? '.mp3' : '.wav';
      const mimeType = isAndroid ? 'audio/mpeg' : 'audio/wav';

      setInstructionAudio({
        uri,
        name: `instruction_audio_${Date.now()}${extension}`,
        type: mimeType,
      });
      setRecording(null);

      // Thông báo ghi âm thành công
      Alert.alert('Thành công', 'Đã ghi âm xong. Bạn có thể phát để nghe lại.');
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert('Lỗi', 'Không thể dừng ghi âm. Vui lòng thử lại.');
    }
  };

  const playAudio = async () => {
    try {
      if (!instructionAudio) {
        Alert.alert('Lỗi', 'Không có file audio để phát');
        return;
      }

      // Kiểm tra URI
      let audioUri = instructionAudio.uri;

      // Nếu không có URI local, sử dụng URL từ Google Drive
      if (!audioUri && instructionAudio.url) {
        audioUri = instructionAudio.url;
      }

      // Nếu có ID file từ Google Drive, tạo direct download URL
      if (!audioUri && instructionAudio.id) {
        audioUri = `https://drive.google.com/uc?export=download&id=${instructionAudio.id}`;
      }

      if (!audioUri) {
        Alert.alert('Lỗi', 'Không tìm thấy đường dẫn file audio');
        return;
      }

      console.log('Playing audio from:', audioUri);
      console.log('Audio object:', instructionAudio);

      // Setup audio mode trước khi phát
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Nếu đang phát thì dừng trước
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
        setIsPlaying(false);
      }

      // Kiểm tra file có tồn tại không (chỉ cho local file)
      if (audioUri.startsWith('file://')) {
        const fileInfo = await FileSystem.getInfoAsync(audioUri);
        console.log('Local file info:', fileInfo);
        if (!fileInfo.exists) {
          Alert.alert('Lỗi', 'File audio không tồn tại trên thiết bị');
          return;
        }
        if (fileInfo.size === 0) {
          Alert.alert('Lỗi', 'File audio rỗng');
          return;
        }
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true }
      );

      setSound(newSound);
      setIsPlaying(true);

      newSound.setOnPlaybackStatusUpdate((status) => {
        console.log('Playback status:', status);
        if (status.didJustFinish) {
          setIsPlaying(false);
          newSound.unloadAsync();
          setSound(null);
        }
        if (status.error) {
          console.error('Playback error:', status.error);
          setIsPlaying(false);
          newSound.unloadAsync();
          setSound(null);
          Alert.alert('Lỗi phát audio', status.error);
        }
      });

      console.log('Audio playback started successfully');
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsPlaying(false);
      if (sound) {
        sound.unloadAsync();
        setSound(null);
      }

      let errorMessage = 'Không thể phát audio';
      if (error.message.includes('Unable to load')) {
        errorMessage =
          'File audio không thể tải. Có thể file bị lỗi hoặc không tồn tại.';
      } else if (error.message.includes('Network')) {
        errorMessage = 'Lỗi mạng. Vui lòng kiểm tra kết nối internet.';
      }

      Alert.alert('Lỗi phát audio', errorMessage);
    }
  };

  const stopAudio = async () => {
    try {
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
        setIsPlaying(false);
      }
    } catch (error) {
      console.error('Error stopping audio:', error);
    }
  };

  const deleteAudio = () => {
    Alert.alert('Xác nhận', 'Bạn có chắc muốn xóa file ghi âm này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          setInstructionAudio(null);
          if (sound) {
            sound.unloadAsync();
            setSound(null);
            setIsPlaying(false);
          }
        },
      },
    ]);
  };

  // Function to navigate to task details
  const navigateToTaskDetail = (taskKey) => {
    navigation.navigate('TaskDetail', { projectId, taskKey });
  };

  // Function to render task items
  const renderTaskItem = ({ item }) => {
    const { key, task } = item;
    const taskLabel = getTaskDisplayLabel(key, task);
    const statusLabel = getStatusDisplayLabel(task.status);
    const statusColor = getStatusColor(task.status);

    return (
      <TouchableOpacity
        style={styles.taskItem}
        onPress={() => navigateToTaskDetail(key)}
      >
        <View style={styles.taskHeader}>
          <Text style={styles.taskName}>{taskLabel}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>
        </View>

        {task.assignedTo && (
          <View style={styles.assigneeContainer}>
            <View style={styles.assigneeAvatar}>
              <Text style={styles.avatarInitial}>
                {(task.assignedToName || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.assigneeName}>
              {task.assignedToName || 'Người dùng không xác định'}
            </Text>
          </View>
        )}

        <View style={styles.taskActions}>
          <TouchableOpacity
            style={styles.taskButton}
            onPress={() => navigateToTaskDetail(key)}
          >
            <Ionicons name="eye-outline" size={18} color="#0066cc" />
            <Text style={styles.taskButtonText}>Chi tiết</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // Filter tasks related to this stage
  const getStageTasks = () => {
    if (!project || !project.tasks) return [];

    // Convert tasks object to array of {key, task} objects
    const taskArray = Object.entries(project.tasks)
      .filter(([_, task]) => task.stageId === stage.stageId) // Filter tasks for this stage
      .map(([key, task]) => ({ key, task }));

    return taskArray;
  };

  const stageTasks = project ? getStageTasks() : [];

  // 检查此阶段是否有关联任务
  const hasAssignedTasks = stageTasks.length > 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
    >
      {/* QA/QC Check Section */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Ionicons name="checkmark-circle-outline" size={24} color="#4CAF50" />
          <Text style={styles.sectionTitle}>Kiểm tra QA/QC</Text>
        </View>

        <View style={styles.sectionContent}>
          <Text style={styles.label}>Trạng thái</Text>
          <View style={styles.statusRow}>
            {STATUS_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.statusBtn,
                  status === opt.value && { backgroundColor: opt.color },
                ]}
                onPress={() => setStatus(opt.value)}
              >
                <Text
                  style={[
                    styles.statusBtnText,
                    status === opt.value && { color: '#fff' },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Ghi chú / Mô tả kết quả</Text>
          <TextInput
            style={styles.textArea}
            multiline
            value={notes}
            onChangeText={setNotes}
            placeholder="Nhập ghi chú ..."
          />

          {/* File Attachments for QA/QC */}
          <Text style={styles.label}>Tải lên tệp đính kèm</Text>
          {files.map((f) => (
            <View key={f.name} style={styles.fileRow}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                onPress={() => viewFile(f)}
              >
                {f.preview && f.preview.startsWith('http') ? (
                  <Image source={{ uri: f.preview }} style={styles.thumb} />
                ) : (
                  <Ionicons name="document-outline" size={24} color="#666" />
                )}
                <Text style={styles.fileName}>{f.name}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => removeFile(f)}
                style={{ padding: 4 }}
              >
                <Ionicons name="trash-outline" size={20} color="#d11a2a" />
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.attachActions}>
            <TouchableOpacity
              style={styles.attachBtn}
              onPress={openQcReportsFolder}
            >
              <Ionicons name="folder-open" size={20} color="#fff" />
              <Text style={styles.attachBtnText}>Tải lên tệp đính kèm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* PGD & Engineer Guidance Section */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Ionicons name="school-outline" size={24} color="#2196F3" />
          <Text style={styles.sectionTitle}>Hướng dẫn PGD & Kỹ sư</Text>
        </View>

        <View style={styles.sectionContent}>
          <Text style={styles.label}>Ghi chú hướng dẫn</Text>
          <TextInput
            style={styles.textArea}
            multiline
            value={instructionNotes}
            onChangeText={setInstructionNotes}
            placeholder="Nhập hướng dẫn chi tiết cho người thực hiện..."
          />

          <Text style={styles.label}>Ảnh hướng dẫn</Text>
          <View style={styles.instructionImagesContainer}>
            {instructionImages.map((image, index) => (
              <View key={index} style={styles.instructionImageItem}>
                <Image
                  source={{ uri: image.uri }}
                  style={styles.instructionImage}
                />
                <TouchableOpacity
                  onPress={() => removeInstructionImage(index)}
                  style={styles.removeImageBtn}
                >
                  <Ionicons name="close-circle" size={24} color="#d11a2a" />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <View style={styles.mediaActions}>
            <TouchableOpacity
              style={styles.mediaBtn}
              onPress={pickInstructionImage}
            >
              <Ionicons name="images-outline" size={20} color="#fff" />
              <Text style={styles.mediaBtnText}>Chọn ảnh</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.mediaBtn}
              onPress={takeInstructionPhoto}
            >
              <Ionicons name="camera-outline" size={20} color="#fff" />
              <Text style={styles.mediaBtnText}>Chụp ảnh</Text>
            </TouchableOpacity>
          </View>

          {/* Instruction Files */}
          <Text style={styles.label}>Tải lên tệp đính kèm</Text>
          <View style={styles.instructionFilesContainer}>
            {instructionFiles &&
              instructionFiles.map((f, index) => (
                <View key={index} style={styles.fileRow}>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      flex: 1,
                    }}
                    onPress={() => viewInstructionFile(f)}
                  >
                    <Ionicons name="document-outline" size={24} color="#666" />
                    <Text style={styles.fileName}>{f.name}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => removeInstructionFile(index)}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="trash-outline" size={20} color="#d11a2a" />
                  </TouchableOpacity>
                </View>
              ))}
          </View>

          <View style={styles.attachActions}>
            <TouchableOpacity
              style={styles.attachBtn}
              onPress={openQcReportsFolder}
            >
              <Ionicons name="folder-open" size={20} color="#fff" />
              <Text style={styles.attachBtnText}>Tải lên tệp đính kèm</Text>
            </TouchableOpacity>
          </View>

          {/* Audio Instructions */}
          <Text style={styles.label}>Hướng dẫn bằng giọng nói</Text>
          <View style={styles.audioContainer}>
            {instructionAudio && (
              <View style={styles.audioPlayer}>
                <TouchableOpacity
                  style={styles.playBtn}
                  onPress={isPlaying ? stopAudio : playAudio}
                >
                  <Ionicons
                    name={isPlaying ? 'pause' : 'play'}
                    size={24}
                    color="#fff"
                  />
                </TouchableOpacity>
                <Text style={styles.audioText}>
                  {isPlaying ? 'Đang phát...' : 'Nhấn để phát'}
                </Text>
                <TouchableOpacity
                  style={styles.deleteAudioBtn}
                  onPress={deleteAudio}
                >
                  <Ionicons name="trash-outline" size={20} color="#d11a2a" />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.recordingActions}>
              <TouchableOpacity
                style={[styles.recordBtn, isRecording && styles.recordingBtn]}
                onPress={isRecording ? stopRecording : startRecording}
              >
                <Ionicons
                  name={isRecording ? 'stop' : 'mic'}
                  size={24}
                  color="#fff"
                />
                <Text style={styles.recordBtnText}>
                  {isRecording ? 'Dừng ghi âm' : 'Ghi âm'}
                </Text>
              </TouchableOpacity>

              {/* Thông báo về quyền ghi âm */}
              <Text style={styles.permissionNote}>
                💡 Để ghi âm, ứng dụng cần quyền truy cập microphone
              </Text>

              {/* Nút kiểm tra quyền (chỉ hiển thị trong development) */}
              <TouchableOpacity
                style={styles.checkPermissionBtn}
                onPress={checkAllPermissions}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={16}
                  color="#0066cc"
                />
                <Text style={styles.checkPermissionText}>Kiểm tra quyền</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Related Tasks Section */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Ionicons name="list-outline" size={24} color="#FF9800" />
          <Text style={styles.sectionTitle}>Công việc liên quan</Text>
        </View>

        <View style={styles.sectionContent}>
          {loading ? (
            <ActivityIndicator
              size="small"
              color="#0066cc"
              style={{ marginVertical: 20 }}
            />
          ) : stageTasks.length > 0 ? (
            <FlatList
              data={stageTasks}
              keyExtractor={(item) => item.key}
              renderItem={renderTaskItem}
              scrollEnabled={false}
              style={styles.taskList}
            />
          ) : (
            <Text style={styles.noTasksText}>
              Không có công việc nào được gán cho giai đoạn này.
            </Text>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={styles.saveButton}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Lưu</Text>
        )}
      </TouchableOpacity>

      {/* Image preview modal */}
      <Modal
        visible={!!imagePreviewUri}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalCloseArea}
            onPress={() => setImagePreviewUri(null)}
          />
          <Image
            source={{ uri: imagePreviewUri }}
            style={styles.modalImage}
            resizeMode="contain"
          />
          <TouchableOpacity
            style={styles.modalCloseBtn}
            onPress={() => setImagePreviewUri(null)}
          >
            <Ionicons name="close-circle" size={36} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: '#333',
  },
  statusRow: {
    flexDirection: 'row',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  statusBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f1f1',
    marginRight: 8,
    marginBottom: 8,
  },
  statusBtnText: {
    color: '#333',
    fontWeight: '500',
  },
  textArea: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginRight: 10,
  },
  fileName: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  attachActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    marginBottom: 24,
    gap: 10,
  },
  attachBtn: {
    backgroundColor: '#0066cc',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 120,
    justifyContent: 'center',
  },
  attachBtnText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 32,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // New styles for tasks
  sectionHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },

  taskList: {
    marginTop: 8,
  },
  noTasksText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    marginTop: 16,
    marginBottom: 16,
  },
  taskItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  assigneeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginBottom: 8,
  },
  assigneeAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0066cc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarInitial: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  assigneeName: {
    fontSize: 14,
    color: '#333',
  },
  taskActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  taskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f0f7ff',
  },
  taskButtonText: {
    color: '#0066cc',
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    maxHeight: '80%',
  },
  modalClose: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  imagePreview: {
    width: '100%',
    height: 300,
    resizeMode: 'contain',
    marginVertical: 20,
  },

  // Section Container Styles
  sectionContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fafafa',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  sectionContent: {
    padding: 16,
  },

  // Media Instructions Styles
  instructionImagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  instructionFilesContainer: {
    marginBottom: 16,
  },
  instructionImageItem: {
    position: 'relative',
    marginRight: 12,
    marginBottom: 12,
  },
  instructionImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  removeImageBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  mediaActions: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  mediaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0066cc',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  mediaBtnText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '500',
  },
  audioContainer: {
    marginBottom: 16,
  },
  audioPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  playBtn: {
    backgroundColor: '#28a745',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  audioText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  deleteAudioBtn: {
    padding: 8,
  },
  recordingActions: {
    alignItems: 'center',
  },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc3545',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  recordingBtn: {
    backgroundColor: '#ff6b6b',
  },
  recordBtnText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '500',
    fontSize: 16,
  },
  permissionNote: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  checkPermissionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f7ff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginTop: 8,
    alignSelf: 'center',
  },
  checkPermissionText: {
    color: '#0066cc',
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '500',
  },
});

export default StageDetailScreen;
