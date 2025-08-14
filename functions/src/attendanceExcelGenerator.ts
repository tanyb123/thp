import * as functions from 'firebase-functions/v1';
import { google, sheets_v4 } from 'googleapis';
import { CallableContext } from 'firebase-functions/v1/https';
import * as admin from 'firebase-admin';

// Ensure admin is initialized
try {
  admin.app();
} catch (e) {
  admin.initializeApp();
}

// Define attendance data interface
interface AttendanceRecord {
  userId: string;
  userName: string;
  date: string;
  present?: boolean;
  overtime?: number;
  clockIn?: admin.firestore.Timestamp;
  clockOut?: admin.firestore.Timestamp;
}

// ----- CONFIGURATION -----

// ----- MAIN FUNCTION -----
export const generateExcelAttendance = functions
  .region('asia-southeast1') // Using asia-southeast1 which was working before
  .runWith({
    timeoutSeconds: 300,
    memory: '1GB',
    maxInstances: 10,
  })
  .https.onCall(
    async (
      data: {
        year: number;
        month: number;
        projectId?: string;
        accessToken: string;
      },
      context: CallableContext
    ) => {
      // Add detailed logging for debugging
      console.log('Attendance Generator called with data:', {
        year: data.year,
        month: data.month,
        projectId: data.projectId,
        hasAccessToken: data.accessToken ? 'Yes' : 'No',
      });
      console.log(
        'Auth context:',
        context.auth ? 'Authenticated' : 'Not authenticated'
      );

      // Check authentication
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Bạn cần đăng nhập để sử dụng tính năng này.'
        );
      }

      // Check if we have the required data
      const { year, month, projectId, accessToken } = data;

      // Validate required parameters
      if (!year || !month) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Thiếu thông tin năm và tháng.'
        );
      }

      // Check for accessToken (required for Google API access)
      if (!accessToken) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Thiếu accessToken Google của người dùng.'
        );
      }

      try {
        // Initialize Google APIs with user accessToken similar to other generators
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: accessToken });

        const drive = google.drive({ version: 'v3', auth });
        const sheets = google.sheets({ version: 'v4', auth });

        // Get the first and last day of the month
        const firstDayOfMonth = new Date(year, month - 1, 1);
        const lastDayOfMonth = new Date(year, month, 0);
        const daysInMonth = lastDayOfMonth.getDate();

        // Format dates for Firestore queries
        const formatDate = (date: Date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        const startDate = formatDate(firstDayOfMonth);
        const endDate = formatDate(lastDayOfMonth);

        console.log(
          `Đang truy xuất dữ liệu chấm công từ ${startDate} đến ${endDate}`
        );

        // Get Firestore database reference
        const db = admin.firestore();

        // Get all employees
        const usersSnapshot = await db.collection('users').get();
        const employees = usersSnapshot.docs.map((doc) => ({
          userId: doc.id,
          name: doc.data().displayName || doc.data().email || doc.id,
          dailySalary: doc.data().dailySalary || 0,
          monthlySalary: doc.data().monthlySalary || 0, // Get monthly salary
        }));

        // Get all attendance records for the month
        const attendanceQuery = db
          .collection('attendance')
          .where('date', '>=', startDate)
          .where('date', '<=', endDate);

        const attendanceSnapshot = await attendanceQuery.get();
        const attendanceRecords: AttendanceRecord[] =
          attendanceSnapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              userId: data.userId,
              userName: '', // Will be filled later
              date: data.date,
              present: data.present,
              overtime: data.overtime,
              clockIn: data.clockIn,
              clockOut: data.clockOut,
            };
          });

        // Process attendance data by employee and day
        const employeeAttendance = employees.map((employee) => {
          const attendanceByDay: {
            [day: number]: { present: boolean; overtime: boolean };
          } = {};

          // Initialize all days to absent
          for (let day = 1; day <= daysInMonth; day++) {
            attendanceByDay[day] = { present: false, overtime: false };
          }

          // Fill in actual attendance data
          attendanceRecords
            .filter((record) => record.userId === employee.userId)
            .forEach((record) => {
              const day = parseInt(record.date.split('-')[2]);
              const isPresent = record.present || record.clockIn !== undefined;
              const hasOvertime =
                record.overtime !== undefined && record.overtime > 0;

              attendanceByDay[day] = {
                present: isPresent,
                overtime: hasOvertime,
              };
            });

          return {
            userId: employee.userId,
            name: employee.name,
            attendanceByDay,
          };
        });

        // Calculate salary for each employee
        const salaryData = employeeAttendance.map((employee) => {
          // Count regular workdays (present regardless of overtime)
          const regularWorkDays = Object.entries(
            employee.attendanceByDay
          ).filter(([_, value]) => value.present).length;

          // Count overtime instances (0.5 per overtime)
          const overtimeCount = Object.entries(employee.attendanceByDay).filter(
            ([_, value]) => value.overtime
          ).length;

          // Calculate total work units (1 for each regular day + 0.5 for each overtime)
          const totalWorkUnits = regularWorkDays + overtimeCount * 0.5;

          const employeeDetails = employees.find(
            (e) => e.userId === employee.userId
          );
          const dailySalary = employeeDetails?.dailySalary || 0;
          const monthlySalary = employeeDetails?.monthlySalary || 0;

          let totalSalary = 0;
          let salaryType = '';

          // Determine salary type and calculate total salary
          if (monthlySalary > 0 && dailySalary === 0) {
            // Only monthly salary is set
            totalSalary = monthlySalary;
            salaryType = 'Cố định tháng';
          } else if (dailySalary > 0 && monthlySalary === 0) {
            // Only daily salary is set - calculate based on total work units
            totalSalary = totalWorkUnits * dailySalary;
            salaryType = 'Theo ngày';
          } else if (dailySalary > 0 && monthlySalary > 0) {
            // Both are set - this shouldn't happen with the new UI, but handle it gracefully
            console.log(
              `Warning: User ${employee.name} has both salary types set. Using monthly salary.`
            );
            totalSalary = monthlySalary;
            salaryType = 'Cố định tháng';
          } else {
            // No salary is set
            totalSalary = 0;
            salaryType = 'Chưa thiết lập';
          }

          return {
            name: employee.name,
            regularWorkDays,
            overtimeCount,
            totalWorkUnits,
            dailySalary,
            monthlySalary,
            totalSalary,
            salaryType,
          };
        });

        // Find or create root folder in Drive
        let rootFolderId: string;

        if (projectId) {
          // If project ID is provided, use the project folder
          const projectDoc = await db
            .collection('projects')
            .doc(projectId)
            .get();
          const projectData = projectDoc.data();

          if (!projectData || !projectData.driveFolderId) {
            throw new functions.https.HttpsError(
              'failed-precondition',
              'Không tìm thấy thư mục Drive của dự án.'
            );
          }

          rootFolderId = projectData.driveFolderId;
        } else {
          // Otherwise look for a company root folder
          const rootFolderResponse = await drive.files.list({
            q: `name='THP' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id)',
          });

          if (
            rootFolderResponse.data.files &&
            rootFolderResponse.data.files.length > 0
          ) {
            rootFolderId = rootFolderResponse.data.files[0].id;
          } else {
            // Create root folder if it doesn't exist
            const folderResponse = await drive.files.create({
              requestBody: {
                name: 'THP',
                mimeType: 'application/vnd.google-apps.folder',
              },
              fields: 'id',
            });
            rootFolderId = folderResponse.data.id;
          }
        }

        // Create a new spreadsheet
        const monthName = new Date(year, month - 1, 1).toLocaleString('vi-VN', {
          month: 'long',
        });
        const fileName = `Bảng chấm công - ${monthName} ${year}`;

        console.log(`Bắt đầu tạo file Excel: ${fileName}`);

        // Calculate the required number of rows and columns
        const requiredRows = employees.length + 30; // Header + employees + legend + salary table + buffer
        const requiredColumns = Math.max(daysInMonth + 10, 30); // Ensure enough columns for all data

        // Create a new spreadsheet with sufficient rows and columns
        const spreadsheetResponse = await sheets.spreadsheets.create({
          requestBody: {
            properties: {
              title: fileName,
            },
            sheets: [
              {
                properties: {
                  title: 'Chấm công',
                  gridProperties: {
                    rowCount: requiredRows,
                    columnCount: requiredColumns,
                  },
                },
              },
            ],
          },
        });

        const spreadsheetId = spreadsheetResponse.data.spreadsheetId;
        if (!spreadsheetId) {
          throw new Error('Không tạo được bảng tính');
        }

        // Move the file to the desired folder
        await drive.files.update({
          fileId: spreadsheetId,
          addParents: rootFolderId,
          removeParents: 'root',
          fields: 'id, parents',
        });

        const sheetId =
          spreadsheetResponse.data.sheets?.[0].properties?.sheetId;
        if (!sheetId) {
          throw new Error('Không tìm thấy ID sheet');
        }

        // Prepare the spreadsheet with headers
        const requests: sheets_v4.Schema$Request[] = [];

        // Set column widths
        requests.push({
          updateDimensionProperties: {
            range: {
              sheetId,
              dimension: 'COLUMNS',
              startIndex: 0,
              endIndex: 1,
            },
            properties: {
              pixelSize: 200, // Width for column A (names)
            },
            fields: 'pixelSize',
          },
        });

        // Set header style for the entire first row
        requests.push({
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: daysInMonth + 1,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.8, green: 0.8, blue: 0.8 },
                horizontalAlignment: 'CENTER',
                textFormat: { bold: true },
                borders: {
                  top: { style: 'SOLID' },
                  bottom: { style: 'SOLID' },
                  left: { style: 'SOLID' },
                  right: { style: 'SOLID' },
                },
              },
            },
            fields: 'userEnteredFormat',
          },
        });

        // Add column headers (days of the month)
        const headerValues = [
          { userEnteredValue: { stringValue: 'Tên nhân viên' } },
        ];

        for (let day = 1; day <= daysInMonth; day++) {
          headerValues.push({
            userEnteredValue: { stringValue: String(day) },
          });
        }

        requests.push({
          updateCells: {
            rows: [{ values: headerValues }],
            fields: 'userEnteredValue',
            start: { sheetId, rowIndex: 0, columnIndex: 0 },
          },
        });

        // Add employee rows with attendance data
        const rows: sheets_v4.Schema$RowData[] = employeeAttendance.map(
          (employee) => {
            const cells: sheets_v4.Schema$CellData[] = [
              {
                userEnteredValue: { stringValue: employee.name },
                userEnteredFormat: {
                  verticalAlignment: 'MIDDLE',
                  borders: {
                    top: { style: 'SOLID' },
                    bottom: { style: 'SOLID' },
                    left: { style: 'SOLID' },
                    right: { style: 'SOLID' },
                  },
                },
              },
            ];

            // Add attendance cells for each day
            for (let day = 1; day <= daysInMonth; day++) {
              const attendance = employee.attendanceByDay[day];
              let cellValue = '';

              if (attendance.present && attendance.overtime) {
                cellValue = 'O'; // Overtime
              } else if (attendance.present) {
                cellValue = 'X'; // Present
              } else {
                cellValue = ''; // Absent
              }

              cells.push({
                userEnteredValue: { stringValue: cellValue },
                userEnteredFormat: {
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                  borders: {
                    top: { style: 'SOLID' },
                    bottom: { style: 'SOLID' },
                    left: { style: 'SOLID' },
                    right: { style: 'SOLID' },
                  },
                  backgroundColor: attendance.overtime
                    ? { red: 1, green: 0.9, blue: 0.6 } // Light yellow for overtime
                    : attendance.present
                    ? { red: 0.9, green: 1, blue: 0.9 } // Light green for present
                    : undefined, // No color for absent
                },
              });
            }

            return { values: cells };
          }
        );

        // Add all rows to the sheet
        requests.push({
          updateCells: {
            rows,
            fields: 'userEnteredValue,userEnteredFormat',
            start: { sheetId, rowIndex: 1, columnIndex: 0 },
          },
        });

        // Add legend at the bottom
        const legendRow = rows.length + 2; // Add some spacing after the data
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: { stringValue: 'Chú thích:' },
                    userEnteredFormat: { textFormat: { bold: true } },
                  },
                ],
              },
              {
                values: [
                  {
                    userEnteredValue: { stringValue: 'X: Đi làm 1 công' },
                  },
                ],
              },
              {
                values: [
                  {
                    userEnteredValue: { stringValue: 'O: Có tăng ca' },
                  },
                ],
              },
              {
                values: [
                  {
                    userEnteredValue: { stringValue: 'Ô trống: Nghỉ' },
                  },
                ],
              },
            ],
            fields: 'userEnteredValue,userEnteredFormat',
            start: { sheetId, rowIndex: legendRow, columnIndex: 0 },
          },
        });

        // Add salary table header
        const salaryHeaderRow = legendRow + 5; // Add some spacing
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: { stringValue: 'Bảng Lương' },
                    userEnteredFormat: {
                      textFormat: { bold: true, fontSize: 14 },
                    },
                  },
                ],
              },
            ],
            fields: 'userEnteredValue,userEnteredFormat',
            start: { sheetId, rowIndex: salaryHeaderRow, columnIndex: 0 },
          },
        });
        requests.push({
          mergeCells: {
            range: {
              sheetId,
              startRowIndex: salaryHeaderRow,
              endRowIndex: salaryHeaderRow + 1,
              startColumnIndex: 0,
              endColumnIndex: 8, // Increased column span for more columns
            },
            mergeType: 'MERGE_ALL',
          },
        });

        const salaryTableStartRow = salaryHeaderRow + 1;
        const salaryHeaderCells = [
          'Tên Nhân Viên',
          'Số Ngày Công',
          'Số Lần Tăng Ca',
          'Tổng Công',
          'Lương/Ngày',
          'Lương Cố Định',
          'Loại Lương',
          'Tổng Lương',
        ].map((header) => ({
          userEnteredValue: { stringValue: header },
          userEnteredFormat: {
            textFormat: { bold: true },
            backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
          },
        }));

        requests.push({
          updateCells: {
            rows: [{ values: salaryHeaderCells }],
            fields: 'userEnteredValue,userEnteredFormat',
            start: { sheetId, rowIndex: salaryTableStartRow, columnIndex: 0 },
          },
        });

        // Add salary data rows
        const salaryRows = salaryData.map((data) => ({
          values: [
            { userEnteredValue: { stringValue: data.name } },
            {
              userEnteredValue: { numberValue: data.regularWorkDays },
              userEnteredFormat: { horizontalAlignment: 'CENTER' },
            },
            {
              userEnteredValue: { numberValue: data.overtimeCount },
              userEnteredFormat: { horizontalAlignment: 'CENTER' },
            },
            {
              userEnteredValue: { numberValue: data.totalWorkUnits },
              userEnteredFormat: { horizontalAlignment: 'CENTER' },
            },
            {
              userEnteredValue: { numberValue: data.dailySalary },
              userEnteredFormat: {
                numberFormat: { type: 'NUMBER', pattern: '#,##0' },
              },
            },
            {
              userEnteredValue: { numberValue: data.monthlySalary },
              userEnteredFormat: {
                numberFormat: { type: 'NUMBER', pattern: '#,##0' },
              },
            },
            {
              userEnteredValue: { stringValue: data.salaryType },
              userEnteredFormat: { horizontalAlignment: 'CENTER' },
            },
            {
              userEnteredValue: { numberValue: data.totalSalary },
              userEnteredFormat: {
                numberFormat: { type: 'NUMBER', pattern: '#,##0' },
              },
            },
          ],
        }));

        // Make sure we have enough rows for the data - this is now redundant but kept for safety
        const gridProperties = {
          rowCount: Math.max(
            salaryTableStartRow + salaryRows.length + 5,
            requiredRows
          ),
          columnCount: requiredColumns,
        };

        // Update sheet properties to ensure enough rows and columns
        requests.push({
          updateSheetProperties: {
            properties: {
              sheetId,
              gridProperties,
            },
            fields: 'gridProperties',
          },
        });

        // Then add the salary rows
        requests.push({
          updateCells: {
            rows: salaryRows,
            fields: 'userEnteredValue,userEnteredFormat',
            start: {
              sheetId,
              rowIndex: salaryTableStartRow + 1,
              columnIndex: 0,
            },
          },
        });

        // Apply all updates to the spreadsheet
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests },
        });

        // Make the file accessible to anyone with the link
        await drive.permissions.create({
          fileId: spreadsheetId,
          requestBody: { role: 'reader', type: 'anyone' },
        });

        // Get the file's web view link
        const fileResponse = await drive.files.get({
          fileId: spreadsheetId,
          fields: 'webViewLink',
        });

        console.log('Đã tạo file Excel báo cáo chấm công thành công');

        return {
          success: true,
          fileId: spreadsheetId,
          fileUrl: fileResponse.data.webViewLink,
          message: 'Đã tạo file Excel báo cáo chấm công thành công',
        };
      } catch (error: any) {
        console.error('Error details in generateExcelAttendance:', error);
        throw new functions.https.HttpsError(
          'internal',
          `Lỗi khi tạo file Excel chấm công: ${error.message}`,
          error
        );
      }
    }
  );
