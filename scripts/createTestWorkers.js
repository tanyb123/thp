// scripts/createTestWorkers.js
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

// Firebase config (thay bằng config thực của bạn)
const firebaseConfig = {
  // Thêm config của bạn ở đây
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const testWorkers = [
  {
    displayName: 'Nguyễn Văn An',
    email: 'worker1@test.com',
    role: 'cong_nhan',
    photoURL: null,
    createdAt: new Date(),
  },
  {
    displayName: 'Trần Thị Bình',
    email: 'worker2@test.com',
    role: 'tho_han',
    photoURL: null,
    createdAt: new Date(),
  },
  {
    displayName: 'Lê Văn Cường',
    email: 'worker3@test.com',
    role: 'tho_co_khi',
    photoURL: null,
    createdAt: new Date(),
  },
  {
    displayName: 'Phạm Thị Dung',
    email: 'worker4@test.com',
    role: 'tho_lap_rap',
    photoURL: null,
    createdAt: new Date(),
  },
  {
    displayName: 'Hoàng Văn Em',
    email: 'worker5@test.com',
    role: 'cong_nhan',
    photoURL: null,
    createdAt: new Date(),
  },
];

async function createTestWorkers() {
  try {
    console.log('Creating test workers...');

    for (const worker of testWorkers) {
      const docRef = await addDoc(collection(db, 'users'), worker);
      console.log(
        `Created worker: ${worker.displayName} with ID: ${docRef.id}`
      );
    }

    console.log('All test workers created successfully!');
  } catch (error) {
    console.error('Error creating test workers:', error);
  }
}

createTestWorkers();
