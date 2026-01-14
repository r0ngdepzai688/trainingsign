// Modular Firebase v9 initialization
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Cấu hình Firebase chính thức của dự án IQC-Training-Pro
const firebaseConfig = {
  apiKey: "AIzaSyAK_WMRMz0Sr_gwXIOuVvujzmrTSW0EoPM",
  authDomain: "iqc-training-pro.firebaseapp.com",
  projectId: "iqc-training-pro",
  storageBucket: "iqc-training-pro.firebasestorage.app",
  messagingSenderId: "667670717176",
  appId: "1:667670717176:web:7ff21c027415efd386510d",
  measurementId: "G-B2G67322GE"
};

// Initialize Firebase app and services
// Use initializeApp from firebase/app as a named export for modular SDK v9+
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);