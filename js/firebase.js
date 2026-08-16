import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getFirestore, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDAMLbm1ngqtzKjnDp6AMz8ucyhqNSnfBY',
  authDomain: 'budget-8c575.firebaseapp.com',
  projectId: 'budget-8c575',
  storageBucket: 'budget-8c575.firebasestorage.app',
  messagingSenderId: '990142203884',
  appId: '1:990142203884:web:5c22dc2c14855528a022c9',
  measurementId: 'G-CVGT8LE9PE'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

window.DADFirebase = {
  app,
  db,
  projectId: firebaseConfig.projectId,
  async testConnection() {
    const ref = doc(db, 'system_status', 'web_connection');
    await setDoc(ref, {
      app: 'DAD Budget 2027',
      projectId: firebaseConfig.projectId,
      status: 'connected',
      updatedAt: serverTimestamp()
    }, { merge: true });
    return ref.path;
  }
};

window.dispatchEvent(new CustomEvent('dad-firebase-ready', {
  detail: { projectId: firebaseConfig.projectId }
}));
