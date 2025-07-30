//src/api/googleDriveService.js
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
      orderBy: 'modifiedTime desc',
    };

    // Nếu có folderId, lọc theo thư mục
    if (folderId) {
      params.q = `'${folderId}' in parents and trashed = false`;
    } else {
      params.q = 'trashed = false';
    }

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      params,
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
      orderBy: 'modifiedTime desc',
    };

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      params,
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
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const { name, mimeType } = fileInfoResponse.data;

    // Tải nội dung file
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const response = await axios.get(downloadUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      responseType: 'arraybuffer',
    });

    return {
      name,
      mimeType,
      data: response.data,
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
      mimeType: file.type,
    };

    // Nếu có folderId, đặt file vào thư mục đó
    if (folderId) {
      metadata.parents = [folderId];
    }

    // Tạo form data để tải lên
    const form = new FormData();
    form.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );
    form.append('file', file);

    // Tải lên file
    const response = await axios.post(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      form,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'multipart/form-data',
        },
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
    const isExcel =
      file.mimeType.includes('spreadsheet') ||
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
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      allSheets[sheetName] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    });

    return {
      fileName: file.name,
      firstSheet: jsonData,
      allSheets: allSheets,
      sheetNames: workbook.SheetNames,
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
      encoding: FileSystem.EncodingType.Base64,
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
export const createFolder = async (
  accessToken,
  folderName,
  parentFolderId = null
) => {
  try {
    const metadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
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
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('Lỗi khi tạo thư mục trên Google Drive:', error);
    throw error;
  }
};

/**
 * Lấy file Excel mới nhất từ thư mục cụ thể và xử lý dữ liệu
 * @param {string} accessToken - Token xác thực Google
 * @param {string} folderId - ID thư mục cần lấy
 * @returns {Promise<Object>} - Dữ liệu đã xử lý từ file Excel mới nhất
 */
export const getLatestExcelFromFolder = async (accessToken, folderId) => {
  try {
    // Lấy danh sách các file trong thư mục, sắp xếp theo thời gian sửa đổi mới nhất
    const files = await listFiles(accessToken, folderId);

    // Lọc chỉ lấy các file Excel
    const excelFiles = files.filter(
      (file) =>
        file.mimeType.includes('spreadsheet') ||
        file.mimeType.includes('excel') ||
        file.name.endsWith('.xlsx') ||
        file.name.endsWith('.xls')
    );

    if (excelFiles.length === 0) {
      throw new Error('Không tìm thấy file Excel nào trong thư mục');
    }

    // Lấy file mới nhất (đã sắp xếp theo modifiedTime desc)
    const latestExcelFile = excelFiles[0];
    console.log('Đã tìm thấy file Excel mới nhất:', latestExcelFile.name);

    // Đọc và xử lý file Excel
    const excelData = await readExcelFile(accessToken, latestExcelFile.id);

    return {
      fileInfo: latestExcelFile,
      data: excelData,
    };
  } catch (error) {
    console.error('Lỗi khi lấy file Excel mới nhất:', error);
    throw error;
  }
};

/**
 * Phân tích dữ liệu từ file Excel công nợ
 * @param {Object} excelData - Dữ liệu Excel đã đọc
 * @returns {Object} - Dữ liệu công nợ đã phân tích
 */
export const processDebtExcelData = (excelData) => {
  try {
    const sheets = excelData.allSheets;
    const result = {
      totalAccountsPayable: 0,
      totalAccountsReceivable: 0,
      top5Payable: [],
      top5Receivable: [],
      lastUpdated: new Date(),
    };

    // Tìm sheet công nợ phải trả
    const payableSheet = findSheetByName(sheets, [
      'Phải Trả',
      'Phai Tra',
      'Accounts Payable',
      'Công Nợ Phải Trả',
    ]);
    if (payableSheet) {
      const payableData = processPayableSheet(payableSheet);
      result.totalAccountsPayable = payableData.total;
      result.top5Payable = payableData.top5;
    }

    // Tìm sheet công nợ phải thu
    const receivableSheet = findSheetByName(sheets, [
      'Phải Thu',
      'Phai Thu',
      'Accounts Receivable',
      'Công Nợ Phải Thu',
    ]);
    if (receivableSheet) {
      const receivableData = processReceivableSheet(receivableSheet);
      result.totalAccountsReceivable = receivableData.total;
      result.top5Receivable = receivableData.top5;
    }

    // Tính vị thế công nợ ròng
    result.netDebtPosition =
      result.totalAccountsReceivable - result.totalAccountsPayable;

    // Định dạng số tiền
    result.formattedTotals = {
      totalAccountsPayable: formatCurrency(result.totalAccountsPayable),
      totalAccountsReceivable: formatCurrency(result.totalAccountsReceivable),
      netDebtPosition: formatCurrency(result.netDebtPosition),
    };

    return result;
  } catch (error) {
    console.error('Lỗi khi phân tích dữ liệu Excel công nợ:', error);
    throw error;
  }
};

// Hàm trợ giúp tìm sheet theo tên
const findSheetByName = (sheets, possibleNames) => {
  for (const sheetName in sheets) {
    if (
      possibleNames.some((name) =>
        sheetName.toLowerCase().includes(name.toLowerCase())
      )
    ) {
      return sheets[sheetName];
    }
  }
  return null;
};

// Xử lý sheet công nợ phải trả
const processPayableSheet = (sheetData) => {
  // Tìm các cột chứa thông tin nhà cung cấp và số tiền
  const headerRow = sheetData.find((row) =>
    row.some(
      (cell) =>
        typeof cell === 'string' &&
        (cell.toLowerCase().includes('nhà cung cấp') ||
          cell.toLowerCase().includes('supplier') ||
          cell.toLowerCase().includes('tên'))
    )
  );

  if (!headerRow) return { total: 0, top5: [] };

  const supplierColIndex = headerRow.findIndex(
    (cell) =>
      typeof cell === 'string' &&
      (cell.toLowerCase().includes('nhà cung cấp') ||
        cell.toLowerCase().includes('supplier') ||
        cell.toLowerCase().includes('tên'))
  );

  const amountColIndex = headerRow.findIndex(
    (cell) =>
      typeof cell === 'string' &&
      (cell.toLowerCase().includes('số tiền') ||
        cell.toLowerCase().includes('amount') ||
        cell.toLowerCase().includes('còn nợ') ||
        cell.toLowerCase().includes('tổng'))
  );

  if (supplierColIndex === -1 || amountColIndex === -1) {
    return { total: 0, top5: [] };
  }

  // Lấy dữ liệu từ các hàng sau header
  const dataRows = sheetData.slice(sheetData.indexOf(headerRow) + 1);

  // Lọc các hàng có dữ liệu hợp lệ
  const validRows = dataRows.filter(
    (row) =>
      row[supplierColIndex] &&
      row[amountColIndex] &&
      !isNaN(parseFloat(row[amountColIndex]))
  );

  // Tính tổng
  const total = validRows.reduce(
    (sum, row) => sum + parseFloat(row[amountColIndex]),
    0
  );

  // Sắp xếp theo số tiền giảm dần và lấy top 5
  const sortedRows = [...validRows].sort(
    (a, b) => parseFloat(b[amountColIndex]) - parseFloat(a[amountColIndex])
  );

  const top5 = sortedRows.slice(0, 5).map((row) => ({
    supplier: row[supplierColIndex].toString(),
    amount: parseFloat(row[amountColIndex]),
    amountInMillions: parseFloat(
      (parseFloat(row[amountColIndex]) / 1000000).toFixed(1)
    ),
  }));

  return { total, top5 };
};

// Xử lý sheet công nợ phải thu (tương tự như phải trả)
const processReceivableSheet = (sheetData) => {
  // Tìm các cột chứa thông tin khách hàng và số tiền
  const headerRow = sheetData.find((row) =>
    row.some(
      (cell) =>
        typeof cell === 'string' &&
        (cell.toLowerCase().includes('khách hàng') ||
          cell.toLowerCase().includes('customer') ||
          cell.toLowerCase().includes('tên'))
    )
  );

  if (!headerRow) return { total: 0, top5: [] };

  const customerColIndex = headerRow.findIndex(
    (cell) =>
      typeof cell === 'string' &&
      (cell.toLowerCase().includes('khách hàng') ||
        cell.toLowerCase().includes('customer') ||
        cell.toLowerCase().includes('tên'))
  );

  const amountColIndex = headerRow.findIndex(
    (cell) =>
      typeof cell === 'string' &&
      (cell.toLowerCase().includes('số tiền') ||
        cell.toLowerCase().includes('amount') ||
        cell.toLowerCase().includes('còn nợ') ||
        cell.toLowerCase().includes('tổng'))
  );

  if (customerColIndex === -1 || amountColIndex === -1) {
    return { total: 0, top5: [] };
  }

  // Lấy dữ liệu từ các hàng sau header
  const dataRows = sheetData.slice(sheetData.indexOf(headerRow) + 1);

  // Lọc các hàng có dữ liệu hợp lệ
  const validRows = dataRows.filter(
    (row) =>
      row[customerColIndex] &&
      row[amountColIndex] &&
      !isNaN(parseFloat(row[amountColIndex]))
  );

  // Tính tổng
  const total = validRows.reduce(
    (sum, row) => sum + parseFloat(row[amountColIndex]),
    0
  );

  // Sắp xếp theo số tiền giảm dần và lấy top 5
  const sortedRows = [...validRows].sort(
    (a, b) => parseFloat(b[amountColIndex]) - parseFloat(a[amountColIndex])
  );

  const top5 = sortedRows.slice(0, 5).map((row) => ({
    customer: row[customerColIndex].toString(),
    amount: parseFloat(row[amountColIndex]),
    amountInMillions: parseFloat(
      (parseFloat(row[amountColIndex]) / 1000000).toFixed(1)
    ),
  }));

  return { total, top5 };
};

// Hàm định dạng tiền tệ
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export default {
  listFiles,
  searchFiles,
  downloadFile,
  uploadFile,
  readExcelFile,
  saveExcelFileLocally,
  createFolder,
  getLatestExcelFromFolder,
  processDebtExcelData,
};
