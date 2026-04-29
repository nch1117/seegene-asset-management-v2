import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';

const firebaseConfig = {
  apiKey: "AIzaSyDPu8abIeEsDa3MtuFGpyRUuqJAubR7-sE",
  authDomain: "seegene-asset.firebaseapp.com",
  projectId: "seegene-asset",
  storageBucket: "seegene-asset.firebasestorage.app",
  messagingSenderId: "83959785360",
  appId: "1:83959785360:web:a0a0b67ed0e20b404ff515"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
