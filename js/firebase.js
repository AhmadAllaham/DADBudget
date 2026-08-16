import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDAMLbm1ngqtzKjnDp6AMz8ucyhqNSnfBY',
  authDomain: 'budget-8c575.firebaseapp.com',
  projectId: 'budget-8c575',
  storageBucket: 'budget-8c575.firebasestorage.app',
  messagingSenderId: '990142203884',
  appId: '1:990142203884:web:5c22dc2c14855528a022c9',
  measurementId: 'G-CVGT8LE9PE'
};

const MAIN_ADMIN_UID = 'PST3chwdZmaQGeG25t4ym9Vlixe2';
const MAIN_ADMIN_EMAIL = 'allaham@dadgroup.com';
const ALL_MODULES = ['dashboard','opex','capex','travel','hr','ap','ims','pl','approvals','data_admin'];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function ensureMainAdminProfile(user) {
  if (!user || user.uid !== MAIN_ADMIN_UID) return null;
  const ref = doc(db, 'users', user.uid);
  await setDoc(ref, {
    uid: user.uid,
    email: (user.email || MAIN_ADMIN_EMAIL).toLowerCase(),
    role: 'admin',
    isMainAdmin: true,
    enabled: true,
    department: 'ALL',
    departmentLabel: 'All Departments',
    modules: ALL_MODULES,
    updatedAt: serverTimestamp()
  }, { merge: true });
  return ref.path;
}

window.DADFirebase = {
  app,
  auth,
  db,
  projectId: firebaseConfig.projectId,
  mainAdminUid: MAIN_ADMIN_UID,
  mainAdminEmail: MAIN_ADMIN_EMAIL,
  async signIn(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await ensureMainAdminProfile(cred.user);
    return cred.user;
  },
  async signOut() {
    await signOut(auth);
  },
  onAuthStateChanged(callback) {
    return onAuthStateChanged(auth, callback);
  },
  async getUserProfile(uid) {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },
  async bootstrapMainAdmin() {
    const user = auth.currentUser;
    if (!user) throw new Error('Sign in first.');
    if (user.uid !== MAIN_ADMIN_UID) throw new Error('Signed-in account is not the configured Main Admin UID.');
    return ensureMainAdminProfile(user);
  },
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
  detail: { projectId: firebaseConfig.projectId, mainAdminUid: MAIN_ADMIN_UID }
}));
