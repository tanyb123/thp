import axios from 'axios';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';

/**
 * Lấy danh sách file từ Google Drive
 * @param {string} accessToken - Token xác thực Google
 * @param {string} folderId - ID thư mục cần lấy (tùy chọn)
 * @returns {Promise<Array>} - Mảng các file/thư mục
 */
export const listFiles = async (accessToken, folderId = null) => {
  try {
    let url = 'https://www.googleapis.com/drive/v3/files';
    let params = {
      fields: 'files(id, name, mimeType, modifiedTime, size)',
      orderBy: 'modifiedTime desc'
    };

    // Nếu có folderId, lọc theo thư mục
    if (folderId) {
      params.q = `'${folderId}' in parents and trashed = false`;
    } else {
      params.q = 'trashed = false';
    }

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      params
    });

    return response.data.files;
  } catch (error) {
    console.error('Lỗi khi lấy danh sách file từ Google Drive:', error);
    throw error;
  }
};

/**
 * Tìm kiếm file trên Google Drive
 * @param {string} accessToken - Token xác thực Google
 * @param {string} query - Từ khóa tìm kiếm
 * @returns {Promise<Array>} - Mảng các file phù hợp
 */
export const searchFiles = async (accessToken, query) => {
  try {
    const url = 'https://www.googleapis.com/drive/v3/files';
    const params = {
      q: `name contains '${query}' and trashed = false`,
      fields: 'files(id, name, mimeType, modifiedTime, size)',
      orderBy: 'modifiedTime desc'
    };

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      params
    });

    return response.data.files;
  } catch (error) {
    console.error('Lỗi khi tìm kiếm file trên Google Drive:', error);
    throw error;
  }
};

/**
 * Tải nội dung file từ Google Drive
 * @param {string} accessToken - Token xác thực Google
 * @param {string} fileId - ID của file cần tải
 * @returns {Promise<Object>} - Dữ liệu file
 */
export const downloadFile = async (accessToken, fileId) => {
  try {
    // Đầu tiên lấy thông tin file để biết định dạng
    const fileInfoUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType`;
    const fileInfoResponse = await axios.get(fileInfoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    const { name, mimeType } = fileInfoResponse.data;
    
    // Tải nội dung file
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const response = await axios.get(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      responseType: 'arraybuffer'
    });
    
    return {
      name,
      mimeType,
      data: response.data
    };
  } catch (error) {
    console.error('Lỗi khi tải file từ Google Drive:', error);
    throw error;
  }
};

/**
 * Tải lên file lên Google Drive
 * @param {string} accessToken - Token xác thực Google
 * @param {File|Blob} file - File cần tải lên
 * @param {string} folderId - ID thư mục đích (tùy chọn)
 * @returns {Promise<Object>} - Thông tin file đã tải lên
 */
export const uploadFile = async (accessToken, file, folderId = null) => {
  try {
    const metadata = {
      name: file.name,
      mimeType: file.type
    };
    
    // Nếu có folderId, đặt file vào thư mục đó
    if (folderId) {
      metadata.parents = [folderId];
    }
    
    // Tạo form data để tải lên
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);
    
    // Tải lên file
    const response = await axios.post(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      form,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Lỗi khi tải file lên Google Drive:', error);
    throw error;
  }
};

/**
 * Đọc nội dung file Excel từ Google Drive
 * @param {string} accessToken - Token xác thực Google
 * @param {string} fileId - ID của file Excel
 * @returns {Promise<Object>} - Dữ liệu đã xử lý từ file Excel
 */
export const readExcelFile = async (accessToken, fileId) => {
  try {
    // Tải file từ Google Drive
    const file = await downloadFile(accessToken, fileId);
    
    // Kiểm tra xem file có phải là Excel không
    const isExcel = file.mimeType.includes('spreadsheet') || 
                    file.mimeType.includes('excel') || 
                    file.name.endsWith('.xlsx') || 
                    file.name.endsWith('.xls');
    
    if (!isExcel) {
      throw new Error('File không phải là Excel');
    }
    
    // Xử lý file Excel với thư viện xlsx
    const data = new Uint8Array(file.data);
    const workbook = XLSX.read(data, { type: 'array' });
    
    // Lấy sheet đầu tiên
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Chuyển đổi dữ liệu sang dạng JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Nếu có nhiều sheet, lấy tất cả
    const allSheets = {};
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      allSheets[sheetName] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    });
    
    return {
      fileName: file.name,
      firstSheet: jsonData,
      allSheets: allSheets,
      sheetNames: workbook.SheetNames
    };
  } catch (error) {
    console.error('Lỗi khi đọc file Excel từ Google Drive:', error);
    throw error;
  }
};

/**
 * Lưu file Excel tạm thời vào bộ nhớ thiết bị
 * @param {string} accessToken - Token xác thực Google
 * @param {string} fileId - ID của file Excel
 * @returns {Promise<string>} - Đường dẫn đến file đã lưu
 */
export const saveExcelFileLocally = async (accessToken, fileId) => {
  try {
    // Tải file từ Google Drive
    const file = await downloadFile(accessToken, fileId);
    
    // Tạo tên file tạm thời
    const tempFilePath = `${FileSystem.cacheDirectory}${file.name}`;
    
    // Chuyển đổi dữ liệu thành base64 để lưu với FileSystem
    const base64Data = Buffer.from(file.data).toString('base64');
    
    // Lưu file vào bộ nhớ tạm
    await FileSystem.writeAsStringAsync(tempFilePath, base64Data, {
      encoding: FileSystem.EncodingType.Base64
    });
    
    return tempFilePath;
  } catch (error) {
    console.error('Lỗi khi lưu file Excel vào bộ nhớ tạm:', error);
    throw error;
  }
};

/**
 * Tạo thư mục mới trên Google Drive
 * @param {string} accessToken - Token xác thực Google
 * @param {string} folderName - Tên thư mục
 * @param {string} parentFolderId - ID thư mục cha (tùy chọn)
 * @returns {Promise<Object>} - Thông tin thư mục đã tạo
 */
export const createFolder = async (accessToken, folderName, parentFolderId = null) => {
  try {
    const metadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    };
    
    // Nếu có parentFolderId, đặt thư mục vào thư mục cha đó
    if (parentFolderId) {
      metadata.parents = [parentFolderId];
    }
    
    const response = await axios.post(
      'https://www.googleapis.com/drive/v3/files',
      metadata,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Lỗi khi tạo thư mục trên Google Drive:', error);
    throw error;
  }
}; 