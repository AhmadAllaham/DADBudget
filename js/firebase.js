import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, doc, getDoc, getDocs, collection, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

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
const SESSION_PROFILE_KEY = 'dadBudgetCurrentProfile';

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
    departments: ['ALL'],
    departmentLabel: 'All Departments',
    departmentLabels: ['All Departments'],
    modules: ALL_MODULES,
    updatedAt: serverTimestamp()
  }, { merge: true });
  return ref.path;
}

function cleanUserProfile(uid, profile = {}) {
  const isMain = uid === MAIN_ADMIN_UID;
  const incomingDepartments = Array.isArray(profile.departments)
    ? profile.departments.map(x => String(x || '').trim()).filter(Boolean)
    : (profile.department ? [String(profile.department).trim()] : []);
  const incomingLabels = Array.isArray(profile.departmentLabels)
    ? profile.departmentLabels.map(x => String(x || '').trim()).filter(Boolean)
    : (profile.departmentLabel ? [String(profile.departmentLabel).trim()] : []);
  const departments = isMain ? ['ALL'] : [...new Set(incomingDepartments)];
  const departmentLabels = isMain ? ['All Departments'] : incomingLabels;
  return {
    uid,
    email: String(profile.email || '').trim().toLowerCase(),
    role: isMain ? 'admin' : String(profile.role || 'department_user'),
    isMainAdmin: isMain,
    enabled: isMain ? true : profile.enabled !== false,
    department: isMain ? 'ALL' : String(departments[0] || ''),
    departments,
    departmentLabel: isMain ? 'All Departments' : String(departmentLabels[0] || 'Not Restricted'),
    departmentLabels,
    modules: isMain ? ALL_MODULES : Array.isArray(profile.modules) ? profile.modules : [],
    updatedAt: serverTimestamp()
  };
}

async function getProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

function clearSessionCache() {
  localStorage.removeItem('dadBudgetCurrentUid');
  localStorage.removeItem('dadBudgetCurrentEmail');
  localStorage.removeItem(SESSION_PROFILE_KEY);
}

function cacheSession(user, profile) {
  localStorage.setItem('dadBudgetCurrentUid', user.uid);
  localStorage.setItem('dadBudgetCurrentEmail', (user.email || '').toLowerCase());
  localStorage.setItem(SESSION_PROFILE_KEY, JSON.stringify({
    uid: user.uid,
    email: (user.email || '').toLowerCase(),
    role: profile?.role || '',
    isMainAdmin: !!profile?.isMainAdmin,
    enabled: profile?.enabled !== false,
    department: profile?.department || '',
    departments: Array.isArray(profile?.departments) ? profile.departments : (profile?.department ? [profile.department] : []),
    departmentLabel: profile?.departmentLabel || '',
    departmentLabels: Array.isArray(profile?.departmentLabels) ? profile.departmentLabels : [],
    modules: Array.isArray(profile?.modules) ? profile.modules : []
  }));
}

function moduleForPath(path) {
  const p = String(path || '').toLowerCase();
  if (!p || p === 'index.html') return 'dashboard';
  if (p === 'ims-sales.html') return 'ims';
  if (p === 'capex.html') return 'capex';
  if (p === 'travel-budget.html') return 'travel';
  if (p === 'hr-budget.html') return 'hr';
  if (p === 'ap-budget.html') return 'ap';
  if (p === 'data-admin.html') return 'data_admin';
  if (p === 'user-settings.html') return 'admin_only';
  if (p === 'opex.html' || p === 'opex-summary.html') return 'opex';
  return '';
}

function applyUserAccess(profile) {
  if (!profile) return;
  const modules = new Set(Array.isArray(profile.modules) ? profile.modules : []);
  const isAdmin = profile.isMainAdmin === true || profile.role === 'admin';
  const nav = document.querySelector('.sidebar-nav');

  if (nav) {
    nav.querySelectorAll('a').forEach(link => {
      const href = (link.getAttribute('href') || '').split('?')[0].toLowerCase();
      const label = String(link.textContent || '').trim().toLowerCase();
      let required = '';
      if (href.includes('ims-sales')) required = 'ims';
      else if (href.includes('capex')) required = 'capex';
      else if (href.includes('travel-budget')) required = 'travel';
      else if (href.includes('hr-budget')) required = 'hr';
      else if (href.includes('ap-budget')) required = 'ap';
      else if (href.includes('opex')) required = 'opex';
      else if (href.includes('data-admin')) required = 'data_admin';
      else if (href.includes('user-settings')) required = 'admin_only';
      else if (href.includes('index')) required = 'dashboard';
      else if (label.includes('p&l')) required = 'pl';
      else if (label.includes('approval')) required = 'approvals';

      if (required === 'admin_only') link.style.display = isAdmin ? '' : 'none';
      else if (required) link.style.display = (isAdmin || modules.has(required)) ? '' : 'none';
    });
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn && !document.getElementById('currentUserBadge')) {
    const badge = document.createElement('div');
    badge.id = 'currentUserBadge';
    badge.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;margin-left:auto;margin-right:8px;font-size:10px;line-height:1.35;color:#557076';
    badge.innerHTML = `<b style="color:#163f46">${profile.email || ''}</b><span>${profile.role || ''}</span>`;
    logoutBtn.parentNode?.insertBefore(badge, logoutBtn);
  }

  const currentPath = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const required = moduleForPath(currentPath);
  const allowed = required === '' || isAdmin || (required === 'admin_only' ? isAdmin : modules.has(required));
  if (!allowed && currentPath !== 'index.html') location.replace('index.html');
}

function setupLogoutHandler() {
  const btn = document.getElementById('logoutBtn');
  if (!btn || btn.dataset.firebaseLogoutBound === '1') return;
  btn.dataset.firebaseLogoutBound = '1';
  btn.addEventListener('click', async e => {
    e.preventDefault();
    e.stopImmediatePropagation();
    try { await signOut(auth); } catch (_) {}
    clearSessionCache();
    location.replace('login.html');
  }, true);
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
    const profile = await getProfile(cred.user.uid);
    if (!profile) {
      await signOut(auth);
      clearSessionCache();
      throw new Error('This account does not have a Budget 2027 user profile yet.');
    }
    if (profile.enabled === false) {
      await signOut(auth);
      clearSessionCache();
      throw new Error('This Budget 2027 account is disabled.');
    }
    cacheSession(cred.user, profile);
    return cred.user;
  },
  async signOut() {
    await signOut(auth);
    clearSessionCache();
  },
  onAuthStateChanged(callback) {
    return onAuthStateChanged(auth, callback);
  },
  async getUserProfile(uid) {
    return getProfile(uid);
  },
  async listUserProfiles() {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map(x => ({ id: x.id, ...x.data() }));
  },
  async saveUserProfile(uid, profile) {
    if (!auth.currentUser) throw new Error('Sign in first.');
    if (!uid) throw new Error('Firebase UID is required.');
    const ref = doc(db, 'users', uid);
    await setDoc(ref, cleanUserProfile(uid, profile), { merge: true });
    return ref.path;
  },
  async setUserEnabled(uid, enabled) {
    if (!auth.currentUser) throw new Error('Sign in first.');
    if (!uid) throw new Error('Firebase UID is required.');
    if (uid === MAIN_ADMIN_UID && !enabled) throw new Error('Main Admin cannot be disabled.');
    const ref = doc(db, 'users', uid);
    await setDoc(ref, { enabled: !!enabled, updatedAt: serverTimestamp() }, { merge: true });
    return ref.path;
  },
  async sendPasswordReset(email) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) throw new Error('User email is required.');
    await sendPasswordResetEmail(auth, cleanEmail);
    return cleanEmail;
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

onAuthStateChanged(auth, async user => {
  const currentPath = (location.pathname.split('/').pop() || '').toLowerCase();
  const isLoginPage = currentPath === 'login.html' || currentPath === '';
  if (!user) {
    clearSessionCache();
    if (!isLoginPage) location.replace('login.html');
    return;
  }
  if (isLoginPage) return;
  try {
    await ensureMainAdminProfile(user);
    const profile = await getProfile(user.uid);
    if (!profile || profile.enabled === false) {
      await signOut(auth);
      clearSessionCache();
      location.replace('login.html');
      return;
    }
    cacheSession(user, profile);
    setupLogoutHandler();
    applyUserAccess(profile);
    window.dispatchEvent(new CustomEvent('dad-user-ready', { detail: { user, profile } }));
  } catch (e) {
    console.error('Budget user session error:', e);
  }
});

window.dispatchEvent(new CustomEvent('dad-firebase-ready', {
  detail: { projectId: firebaseConfig.projectId, mainAdminUid: MAIN_ADMIN_UID }
}));
