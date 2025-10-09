// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB8Ap9F6IPV79U6sT6HzJ_4tkuTmA55gJc",
  authDomain: "cadirect-fea91.firebaseapp.com",
  databaseURL: "https://cadirect-fea91-default-rtdb.firebaseio.com",
  projectId: "cadirect-fea91",
  storageBucket: "cadirect-fea91.firebasestorage.app",
  messagingSenderId: "928235816313",
  appId: "1:928235816313:web:3d9a4ef987250b42ad5ba8",
  measurementId: "G-YZNVXJWXEC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firebase services
export const rtdb = getDatabase(app);
export const storage = getStorage(app);
export const firestore = getFirestore(app);
export default app;