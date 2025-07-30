// functions/add-categories.js
// Script to add inventory categories for the warehouse system

const admin = require('firebase-admin');
const serviceAccount = require('./service-account-credentials.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Categories to add
const categories = [
  {
    name: 'Phôi thép',
    description: 'Vật liệu phôi thép các loại',
  },
  {
    name: 'Phôi inox',
    description: 'Vật liệu phôi inox các loại',
  },
  {
    name: 'Phụ kiện',
    description: 'Phụ kiện và linh kiện các loại',
  },
  {
    name: 'Sơn',
    description: 'Sơn và vật liệu sơn các loại',
  },
  {
    name: 'Máy móc',
    description: 'Máy móc và thiết bị sản xuất',
  },
  {
    name: 'Vật tư tiêu hao',
    description: 'Vật tư tiêu hao trong sản xuất',
  },
  {
    name: 'Công cụ',
    description: 'Dụng cụ và công cụ sản xuất',
  },
];

// Function to add categories
async function addCategories() {
  console.log('Starting to add categories...');

  try {
    for (const category of categories) {
      const docRef = await db.collection('inventory_categories').add({
        name: category.name,
        description: category.description,
        // No parentId for these top-level categories
      });

      console.log(`Added category ${category.name} with ID: ${docRef.id}`);
    }

    console.log('All categories added successfully');
  } catch (error) {
    console.error('Error adding categories:', error);
  }
}

// Execute the function
addCategories()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
