const FIREBASE_FUNCTION_URL =
  'https://asia-southeast1-tanyb-fe4bf.cloudfunctions.net/processPayableLedgerFromDrive'; // Replace with your actual function URL after deployment
const SECRET_TOKEN = 'THP_FINANCE_SECRET_TOKEN'; // Must match the token in Firebase function
const FOLDER_ID = '1Ci_BHZx0-Uhv2xg5IzwLPn05yPAUXOOU';
const PROCESSED_FOLDER_NAME = 'Đã xử lý';

/**
 * Main function to check for new Excel files and process them
 */
function checkAndProcessFiles() {
  const targetFolder = DriveApp.getFolderById(FOLDER_ID);
  const processedFolder = getOrCreateSubFolder(
    targetFolder,
    PROCESSED_FOLDER_NAME
  );

  // Look for Excel files (.xlsx, .xls)
  const files = targetFolder.getFilesByType(MimeType.MICROSOFT_EXCEL);

  while (files.hasNext()) {
    const file = files.next();
    Logger.log('Processing file: ' + file.getName());

    try {
      // Call Firebase function to process the file
      const response = callFirebaseFunction(file.getId());

      // Check if processing was successful
      if (response.getResponseCode() == 200) {
        // Move file to processed folder
        file.moveTo(processedFolder);
        Logger.log('Successfully processed and moved file: ' + file.getName());
      } else {
        Logger.log(
          'Error from Firebase for file ' +
            file.getName() +
            ': ' +
            response.getContentText()
        );
      }
    } catch (error) {
      Logger.log(
        'Error processing file ' + file.getName() + ': ' + error.toString()
      );
    }
  }
}

/**
 * Helper function to get or create a subfolder
 */
function getOrCreateSubFolder(parentFolder, folderName) {
  const folders = parentFolder.getFoldersByName(folderName);
  return folders.hasNext()
    ? folders.next()
    : parentFolder.createFolder(folderName);
}

/**
 * Call Firebase function with file ID
 */
function callFirebaseFunction(fileId) {
  const payload = JSON.stringify({ fileId: fileId });
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: payload,
    headers: { Authorization: 'Bearer ' + SECRET_TOKEN },
    muteHttpExceptions: true,
  };

  return UrlFetchApp.fetch(FIREBASE_FUNCTION_URL, options);
}

/**
 * Create time-driven trigger to run every 15 minutes
 */
function createTimeDrivenTriggers() {
  // Delete any existing triggers
  ScriptApp.getProjectTriggers().forEach((trigger) =>
    ScriptApp.deleteTrigger(trigger)
  );

  // Create new trigger to run every 15 minutes
  ScriptApp.newTrigger('checkAndProcessFiles')
    .timeBased()
    .everyMinutes(15)
    .create();

  Logger.log('Trigger created to run every 15 minutes.');
}

/**
 * Manual function to test file processing without moving files
 */
function testProcessFile() {
  const targetFolder = DriveApp.getFolderById(FOLDER_ID);
  const files = targetFolder.getFilesByType(MimeType.MICROSOFT_EXCEL);

  if (files.hasNext()) {
    const file = files.next();
    Logger.log('Testing processing of file: ' + file.getName());

    try {
      const response = callFirebaseFunction(file.getId());
      Logger.log('Response code: ' + response.getResponseCode());
      Logger.log('Response content: ' + response.getContentText());
    } catch (error) {
      Logger.log('Error testing file: ' + error.toString());
    }
  } else {
    Logger.log('No Excel files found in the target folder.');
  }
}
