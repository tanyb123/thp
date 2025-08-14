import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

const { width } = Dimensions.get('window');

const MediaInstructionsViewer = ({
  instructionImages = [],
  instructionNotes = '',
  instructionAudio = null,
  visible = true,
}) => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const playAudio = async () => {
    try {
      if (instructionAudio && instructionAudio.url) {
        const { sound } = await Audio.Sound.createAsync(
          { uri: instructionAudio.url },
          { shouldPlay: true }
        );
        setSound(sound);
        setIsPlaying(true);

        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) {
            setIsPlaying(false);
            sound.unloadAsync();
          }
        });
      }
    } catch (error) {
      console.error('Error playing audio:', error);
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

  const openImageModal = (image) => {
    setSelectedImage(image);
  };

  const closeImageModal = () => {
    setSelectedImage(null);
  };

  if (!visible) return null;

  const hasInstructions =
    instructionNotes ||
    (instructionImages && instructionImages.length > 0) ||
    instructionAudio;

  if (!hasInstructions) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="information-circle-outline" size={24} color="#666" />
          <Text style={styles.headerTitle}>Hướng dẫn thực hiện</Text>
        </View>
        <Text style={styles.noInstructionsText}>
          Chưa có hướng dẫn cho công đoạn này
        </Text>
        <Text
          style={[styles.noInstructionsText, { fontSize: 12, marginTop: 8 }]}
        >
          Vui lòng liên hệ quản lý để được hướng dẫn chi tiết.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="information-circle" size={24} color="#0066cc" />
        <Text style={styles.headerTitle}>Hướng dẫn thực hiện</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Text Instructions */}
        {instructionNotes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 Hướng dẫn chi tiết</Text>
            <View style={styles.notesContainer}>
              <Text style={styles.notesText}>{instructionNotes}</Text>
            </View>
          </View>
        ) : null}

        {/* Image Instructions */}
        {instructionImages && instructionImages.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📸 Hình ảnh hướng dẫn</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.imagesScroll}
            >
              {instructionImages.map((image, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.imageContainer}
                  onPress={() => openImageModal(image)}
                >
                  <Image
                    source={{ uri: image.url || image.uri }}
                    style={styles.instructionImage}
                    resizeMode="cover"
                  />
                  <View style={styles.imageOverlay}>
                    <Ionicons name="expand-outline" size={20} color="#fff" />
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Audio Instructions */}
        {instructionAudio ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎤 Hướng dẫn bằng giọng nói</Text>
            <View style={styles.audioContainer}>
              <TouchableOpacity
                style={styles.audioButton}
                onPress={isPlaying ? stopAudio : playAudio}
              >
                <Ionicons
                  name={isPlaying ? 'pause-circle' : 'play-circle'}
                  size={48}
                  color="#0066cc"
                />
              </TouchableOpacity>
              <Text style={styles.audioText}>
                {isPlaying ? 'Đang phát...' : 'Nhấn để nghe hướng dẫn'}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Image Modal */}
      <Modal
        visible={!!selectedImage}
        transparent={true}
        animationType="fade"
        onRequestClose={closeImageModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={closeImageModal}
            >
              <Ionicons name="close" size={30} color="#fff" />
            </TouchableOpacity>
            {selectedImage && (
              <Image
                source={{ uri: selectedImage.url || selectedImage.uri }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  content: {
    maxHeight: 400,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  notesContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#0066cc',
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
  },
  imagesScroll: {
    marginBottom: 8,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  instructionImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  imageOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    padding: 4,
  },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
  },
  audioButton: {
    marginRight: 16,
  },
  audioText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  noInstructionsText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    fontSize: 14,
    paddingVertical: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width * 0.95,
    height: '80%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
});

export default MediaInstructionsViewer;
