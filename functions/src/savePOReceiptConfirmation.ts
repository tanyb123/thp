import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

/**
 * savePOReceiptConfirmation
 * Updates the purchase order document with receipt confirmation data
 * This function only updates the Firestore document, it doesn't upload any files
 * It now also automatically adds received items to inventory
 * and creates expense records for materials
 */
export const savePOReceiptConfirmation = functions
  .region('asia-southeast1')
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .https.onCall(async (data, context) => {
    console.log(
      'savePOReceiptConfirmation called with data:',
      JSON.stringify(data)
    );

    // Authentication check
    if (!context.auth) {
      console.log('Authentication failed - no auth context');
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Bạn cần đăng nhập'
      );
    }

    const {
      poId,
      projectId,
      filesToSave,
      remarks = '',
    } = data as {
      poId?: string;
      projectId?: string;
      filesToSave?: Array<{
        id: string;
        name: string;
        url: string;
        mimeType?: string;
      }>;
      remarks?: string;
    };

    console.log(
      `Processing confirmation for PO: ${poId}, Project: ${projectId}`
    );

    // Validate required parameters
    if (!poId || !projectId || !filesToSave) {
      console.log('Missing required parameters', {
        poId,
        projectId,
        filesCount: filesToSave?.length,
      });
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Thiếu tham số bắt buộc'
      );
    }

    try {
      const db = admin.firestore();
      console.log('Getting PO document:', poId);
      const poRef = db.collection('purchase_orders').doc(poId);
      const poSnap = await poRef.get();

      if (!poSnap.exists) {
        console.log(`PO not found: ${poId}`);
        throw new functions.https.HttpsError('not-found', 'Không tìm thấy PO');
      }

      const poData = poSnap.data();

      // --- IDEMPOTENCY CHECK ---
      // Check if this PO has already been processed to prevent double-counting.
      if (poData?.inventoryProcessed) {
        console.log(`PO ${poId} has already been processed. Skipping.`);
        return {
          success: true,
          message: 'PO đã được xử lý vào kho trước đó. Không có gì thay đổi.',
        };
      }

      // ----- Extract materials regardless of PO data structure -----
      // Older POs had materials at the root level, while newer ones have them
      // nested inside formattedData.materials. Unify them into one array.
      const materialsList: any[] = Array.isArray(poData?.materials)
        ? poData!.materials
        : Array.isArray(poData?.formattedData?.materials)
        ? poData!.formattedData.materials
        : [];

      console.log(
        `PO data retrieved, materials detected: ${materialsList.length}`
      );
      if (materialsList.length) {
        console.log(`First material sample:`, JSON.stringify(materialsList[0]));
      }

      // Get current user info for transaction records
      const userDoc = await db.collection('users').doc(context.auth.uid).get();
      const userName = userDoc.exists
        ? userDoc.data()?.displayName || 'Người dùng'
        : 'Người dùng';

      // Update PO document
      console.log('Updating PO document with status: received');
      await poRef.update({
        status: 'received',
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
        receiptPhotos: filesToSave,
        receiptRemarks: remarks,
        updatedBy: context.auth.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('PO document updated successfully');

      // Get project data for expense creation
      const projectSnap = await db.collection('projects').doc(projectId).get();
      const projectName = projectSnap.exists
        ? projectSnap.data()?.name || 'Unknown Project'
        : 'Unknown Project';

      // Track expenses to be created
      const expensesCreated = [];

      // Automatically add received items to inventory
      if (materialsList.length > 0) {
        console.log(
          `Processing ${materialsList.length} materials for inventory`
        );

        for (const material of materialsList) {
          try {
            console.log('--- Processing Material ---');
            console.log(
              'Raw material data:',
              JSON.stringify(material, null, 2)
            );

            const name = material.name ? String(material.name).trim() : '';
            const code = material.code ? String(material.code).trim() : '';

            if (!name) {
              console.log('Skipping material: name is missing.');
              continue;
            }

            // Check all possible field names for price
            // Try multiple field names: unitPrice, price, unit_price
            const quantity = Number(material.quantity) || 0;
            const price =
              Number(material.unitPrice) ||
              Number(material.unit_price) ||
              Number(material.price) ||
              0;

            console.log(
              `Parsed values -> Name: "${name}", Code: "${code}", Quantity: ${quantity}, Price: ${price}`
            );

            // Skip if quantity is not a valid number or is zero
            if (isNaN(quantity) || quantity <= 0) {
              console.log(
                `Skipping material with invalid quantity: ${material.name}, raw quantity: ${material.quantity}`
              );
              continue;
            }

            // First, check if the item already exists in inventory by code or name
            let inventoryQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
              db.collection('inventory');

            // If the material has a code, search by code which is more reliable
            if (code) {
              console.log(`Searching inventory by code: "${code}"`);
              inventoryQuery = inventoryQuery.where('code', '==', code);
            } else {
              console.log(`Searching inventory by name: "${name}"`);
              inventoryQuery = inventoryQuery.where('name', '==', name);
            }

            const inventorySnap = await inventoryQuery.get();
            console.log(
              `Inventory search results: ${inventorySnap.size} items found`
            );

            if (inventorySnap.empty) {
              // Item doesn't exist - create new inventory item
              console.log(`Creating new inventory item: "${name}"`);

              const newItemData = {
                name: name, // Use trimmed name
                code:
                  code ||
                  `AUTO-${Date.now()}-${Math.round(Math.random() * 1000)}`,
                description: material.description || '',
                material: material.material || '',
                categoryId: material.categoryId || '',
                unit: material.unit || 'cái',
                stockQuantity: quantity,
                minQuantity: 0, // Set min quantity to 0 for PO-added items
                price: price,
                weight: material.weight || 0,
                totalPrice: quantity * price,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              };

              console.log(
                `New inventory data: ${JSON.stringify(newItemData, null, 2)}`
              );
              const newItemRef = await db
                .collection('inventory')
                .add(newItemData);
              console.log(
                `New inventory item created with ID: ${newItemRef.id}`
              );

              // Create a transaction record for this new item
              await db.collection('inventory_transactions').add({
                itemId: newItemRef.id,
                type: 'in',
                quantity: quantity,
                date: admin.firestore.FieldValue.serverTimestamp(),
                reason: `Nhận hàng từ PO: ${poData.poNumber || poId}`,
                createdBy: context.auth.uid,
                createdByName: userName,
                projectId: projectId,
                poId: poId,
              });
              console.log(`Inventory transaction record created for new item`);
            } else {
              // Item exists - update quantity
              const itemDoc = inventorySnap.docs[0];
              const itemData = itemDoc.data();
              const currentQuantity = Number(itemData.stockQuantity) || 0;
              const newQuantity = currentQuantity + quantity;

              console.log(
                `Updating existing inventory item ${itemDoc.id}: "${itemData.name}", adding ${quantity} to current ${currentQuantity}`
              );

              // Update the inventory item with new quantity
              await db
                .collection('inventory')
                .doc(itemDoc.id)
                .update({
                  stockQuantity: newQuantity,
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                  // Update price if the new one is provided and different
                  ...(price && price !== itemData.price
                    ? { price: price }
                    : {}),
                  // Update totalPrice based on new quantity and price
                  totalPrice: newQuantity * (price || itemData.price || 0),
                });
              console.log(
                `Inventory item updated with new quantity: ${newQuantity}`
              );

              // Create a transaction record for this update
              await db.collection('inventory_transactions').add({
                itemId: itemDoc.id,
                type: 'in',
                quantity: quantity,
                date: admin.firestore.FieldValue.serverTimestamp(),
                reason: `Nhận hàng từ PO: ${poData.poNumber || poId}`,
                createdBy: context.auth.uid,
                createdByName: userName,
                projectId: projectId,
                poId: poId,
              });
              console.log(
                `Inventory transaction record created for existing item`
              );
            }

            // Calculate total cost for this material
            const totalCost = quantity * price;

            // Create expense record for this material
            if (totalCost > 0) {
              const expenseData = {
                projectId: projectId,
                projectName: projectName,
                type: 'material',
                amount: totalCost,
                description: `${name} (${quantity} ${material.unit || 'cái'})`,
                date: admin.firestore.FieldValue.serverTimestamp(),
                relatedDocId: poId,
                createdBy: context.auth.uid,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              };

              const expenseRef = await db
                .collection('expenses')
                .add(expenseData);
              console.log(
                `Expense record created with ID: ${expenseRef.id} for material: ${name}`
              );

              // Keep track of created expenses
              expensesCreated.push({
                id: expenseRef.id,
                description: expenseData.description,
                amount: expenseData.amount,
              });
            } else {
              console.log(
                `No expense record created for material ${name} - cost is zero`
              );
            }
          } catch (itemError) {
            // Log error but continue with other items
            console.error(
              `Error processing inventory item ${material.name}:`,
              itemError
            );
          }
        }

        console.log(`Finished processing all materials for inventory`);

        // Mark the PO as processed to prevent it from being run again.
        await poRef.update({
          inventoryProcessed: true,
          inventoryProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
          expensesCreated: expensesCreated,
        });
        console.log(`PO ${poId} has been marked as processed for inventory.`);
      } else {
        console.log(`No materials found in PO data to add to inventory`);
      }

      return {
        success: true,
        message: 'PO đã được xác nhận và vật tư đã được thêm vào kho tự động.',
        expenses: {
          count: expensesCreated.length,
          total: expensesCreated.reduce((sum, exp) => sum + exp.amount, 0),
          items: expensesCreated,
        },
      };
    } catch (err: any) {
      console.error('savePOReceiptConfirmation error', err);
      throw new functions.https.HttpsError(
        'internal',
        err.message || 'Lỗi xử lý xác nhận PO'
      );
    }
  });
