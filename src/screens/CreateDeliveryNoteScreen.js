import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useDeliveryNoteGenerator from '../hooks/useDeliveryNoteGenerator';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const CreateDeliveryNoteScreen = ({ route, navigation }) => {
  const { projectId, materials: initialMaterials } = route.params;
  const [projectData, setProjectData] = useState(null);
  const [loadingProject, setLoadingProject] = useState(false);
  const [fileId, setFileId] = useState('');

  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState(
    `BBGH-${new Date().getFullYear()}-${String(
      Math.floor(Math.random() * 1000)
    ).padStart(3, '0')}`
  );
  const [deliveryDate, setDeliveryDate] = useState(new Date());
  const [customerName, setCustomerName] = useState('');
  const [customerTaxCode, setCustomerTaxCode] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerRepresentative, setCustomerRepresentative] = useState('');
  const [customerRepresentativePosition, setCustomerRepresentativePosition] =
    useState('');

  const [items, setItems] = useState([]);

  const {
    generateDeliveryNote,
    shareDeliveryNote,
    isLoading,
    excelUrl,
    latestQuotation,
    isLoadingQuotation,
  } = useDeliveryNoteGenerator({ projectId });

  // Fetch project data including materials and customer info
  useEffect(() => {
    const fetchProjectData = async () => {
      try {
        setLoadingProject(true);
        const projectRef = doc(db, 'projects', projectId);
        const projectSnap = await getDoc(projectRef);

        if (projectSnap.exists()) {
          const project = { id: projectSnap.id, ...projectSnap.data() };
          setProjectData(project);

          // Set customer info
          if (project.customerName) setCustomerName(project.customerName);
          if (project.customerTaxCode)
            setCustomerTaxCode(project.customerTaxCode);
          if (project.customerAddress)
            setCustomerAddress(project.customerAddress);
        }
      } catch (error) {
        console.error('Error fetching project data:', error);
        Alert.alert('Lỗi', 'Không thể tải thông tin dự án');
      } finally {
        setLoadingProject(false);
      }
    };

    fetchProjectData();
  }, [projectId]);

  // Use materials from latest quotation when available
  useEffect(() => {
    if (
      latestQuotation &&
      latestQuotation.materials &&
      latestQuotation.materials.length > 0
    ) {
      console.log(
        'Using materials from latest quotation:',
        latestQuotation.quotationNumber
      );

      // Transform materials from quotation to the format needed for delivery note
      const transformedItems = latestQuotation.materials.map((item) => ({
        stt: item.stt,
        name: item.name || item.description || '',
        material: item.material || item.type || '',
        unit: item.unit || '',
        quantity: item.quantity || 0,
        selected: false, // Add selected property initialized to false
      }));

      setItems(transformedItems);
    } else if (initialMaterials && initialMaterials.length > 0) {
      // Fallback to materials passed in route params
      console.log('Using materials from route params');
      const transformedItems = initialMaterials.map((item) => ({
        stt: item.stt,
        name: item.name || item.description || '',
        material: item.material || item.type || '',
        unit: item.unit || '',
        quantity: item.quantity || 0,
        selected: false, // Add selected property initialized to false
      }));

      setItems(transformedItems);
    } else {
      // Add an empty item if no materials are found
      console.log('No materials found, adding empty item');
      setItems([
        {
          stt: '',
          name: '',
          material: '',
          unit: '',
          quantity: '',
          selected: false,
        },
      ]);
    }
  }, [latestQuotation, initialMaterials]);

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        stt: '',
        name: '',
        material: '',
        unit: '',
        quantity: '',
        selected: false,
      },
    ]);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleToggleItemSelection = (index) => {
    const newItems = [...items];
    newItems[index].selected = !newItems[index].selected;
    setItems(newItems);
  };

  const handleGenerate = async () => {
    // Basic validation
    if (!customerName) {
      Alert.alert('Thông báo', 'Vui lòng nhập tên khách hàng');
      return;
    }

    // Check if any items are selected
    const selectedItems = items.filter((item) => item.selected);

    if (selectedItems.length === 0) {
      Alert.alert(
        'Thông báo',
        'Vui lòng chọn ít nhất một vật tư để đưa vào biên bản giao hàng'
      );
      return;
    }

    // Check if selected items have name and quantity
    if (!selectedItems.some((item) => item.name && item.quantity)) {
      Alert.alert(
        'Thông báo',
        'Vui lòng đảm bảo các vật tư đã chọn có tên và số lượng'
      );
      return;
    }

    const deliveryNoteData = {
      deliveryNoteNumber,
      deliveryDate: deliveryDate.toISOString(),
      customerName,
      customerTaxCode,
      customerAddress,
      customerRepresentative,
      customerRepresentativePosition,
      items: selectedItems, // Only include selected items
    };

    try {
      console.log('Generating delivery note with data:', deliveryNoteData);
      const url = await generateDeliveryNote(deliveryNoteData);
      if (url) {
        Alert.alert(
          'Thành công',
          'Đã tạo biên bản giao hàng thành công. Bạn có muốn chia sẻ không?',
          [
            { text: 'Để sau', style: 'cancel' },
            { text: 'Chia sẻ', onPress: shareDeliveryNote },
          ]
        );
      }
    } catch (error) {
      console.error('Error in handleGenerate:', error);
      // Error is already handled in the hook
    }
  };

  if (loadingProject || isLoadingQuotation) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007BFF" />
        <Text style={styles.loadingText}>
          {isLoadingQuotation
            ? 'Đang tải báo giá gần nhất...'
            : 'Đang tải dữ liệu dự án...'}
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tạo Biên Bản Giao Hàng</Text>
        <View style={{ width: 24 }} />
      </View>

      {latestQuotation && (
        <View style={styles.quotationInfo}>
          <Text style={styles.quotationInfoText}>
            Sử dụng dữ liệu từ báo giá:{' '}
            {latestQuotation.quotationNumber || 'Không có mã'}
          </Text>
        </View>
      )}

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông tin chung</Text>
          <TextInput
            style={styles.input}
            placeholder="Số biên bản"
            value={deliveryNoteNumber}
            onChangeText={setDeliveryNoteNumber}
          />
          <Text style={styles.dateText}>
            Ngày: {deliveryDate.toLocaleDateString('vi-VN')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông tin khách hàng (Bên B)</Text>
          <TextInput
            style={styles.input}
            placeholder="Tên khách hàng"
            value={customerName}
            onChangeText={setCustomerName}
          />
          <TextInput
            style={styles.input}
            placeholder="Mã số thuế"
            value={customerTaxCode}
            onChangeText={setCustomerTaxCode}
          />
          <TextInput
            style={styles.input}
            placeholder="Địa chỉ"
            value={customerAddress}
            onChangeText={setCustomerAddress}
          />
          <TextInput
            style={styles.input}
            placeholder="Người đại diện"
            value={customerRepresentative}
            onChangeText={setCustomerRepresentative}
          />
          <TextInput
            style={styles.input}
            placeholder="Chức vụ"
            value={customerRepresentativePosition}
            onChangeText={setCustomerRepresentativePosition}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danh sách vật tư</Text>
          <Text style={styles.selectionNote}>
            Chọn các vật tư cần đưa vào biên bản giao hàng
          </Text>
          {items.map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => handleToggleItemSelection(index)}
              >
                <Ionicons
                  name={item.selected ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={item.selected ? '#28A745' : '#999'}
                />
              </TouchableOpacity>
              <TextInput
                style={[styles.itemInput, { flex: 3 }]}
                placeholder="Tên vật tư, hàng hóa"
                value={item.name}
                onChangeText={(value) => handleItemChange(index, 'name', value)}
              />
              <TextInput
                style={[styles.itemInput, { flex: 2 }]}
                placeholder="Vật liệu"
                value={item.material}
                onChangeText={(value) =>
                  handleItemChange(index, 'material', value)
                }
              />
              <TextInput
                style={[styles.itemInput, { flex: 1 }]}
                placeholder="ĐVT"
                value={item.unit}
                onChangeText={(value) => handleItemChange(index, 'unit', value)}
              />
              <TextInput
                style={[styles.itemInput, { flex: 1 }]}
                placeholder="Số lượng"
                value={String(item.quantity)}
                onChangeText={(value) =>
                  handleItemChange(index, 'quantity', value)
                }
                keyboardType="numeric"
              />
            </View>
          ))}
          <TouchableOpacity style={styles.addButton} onPress={handleAddItem}>
            <Ionicons name="add-circle" size={24} color="#007BFF" />
            <Text style={styles.addButtonText}>Thêm vật tư</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.generateButton}
          onPress={handleGenerate}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.generateButtonText}>
              Tạo Biên Bản Giao Hàng
            </Text>
          )}
        </TouchableOpacity>

        {excelUrl && (
          <TouchableOpacity
            style={styles.shareButton}
            onPress={shareDeliveryNote}
            disabled={isLoading}
          >
            <Text style={styles.shareButtonText}>Chia sẻ File</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFF',
    padding: 16,
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  selectionNote: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#666',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  dateText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkbox: {
    marginRight: 8,
  },
  itemInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 8,
    marginRight: 8,
    fontSize: 14,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  addButtonText: {
    marginLeft: 8,
    color: '#007BFF',
    fontSize: 16,
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  generateButton: {
    backgroundColor: '#28A745',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  generateButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  shareButton: {
    backgroundColor: '#17A2B8',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  shareButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333',
  },
  quotationInfo: {
    backgroundColor: '#E3F2FD',
    padding: 10,
    alignItems: 'center',
  },
  quotationInfoText: {
    color: '#0D47A1',
    fontWeight: '500',
  },
});

export default CreateDeliveryNoteScreen;
