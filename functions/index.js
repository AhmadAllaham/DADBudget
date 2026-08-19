const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

initializeApp();

const MAIN_ADMIN_UID = 'PST3chwdZmaQGeG25t4ym9Vlixe2';

async function requireMainAdmin(req, res) {
  const authHeader = String(req.headers.authorization || '');
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ ok: false, error: 'authentication-required' });
    return null;
  }

  const decoded = await getAuth().verifyIdToken(match[1], true);
  if (decoded.uid !== MAIN_ADMIN_UID) {
    res.status(403).json({ ok: false, error: 'main-admin-required' });
    return null;
  }
  return decoded;
}

exports.adminSetUserPassword = onRequest(
  {
    region: 'us-central1',
    cors: true,
    timeoutSeconds: 30,
    memory: '256MiB'
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.set('Allow', 'POST');
      return res.status(405).json({ ok: false, error: 'method-not-allowed' });
    }

    try {
      if (!(await requireMainAdmin(req, res))) return;

      const uid = String(req.body?.uid || '').trim();
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');

      if (!uid) return res.status(400).json({ ok: false, error: 'uid-required' });
      if (password.length < 6) return res.status(400).json({ ok: false, error: 'weak-password' });
      if (password.length > 128) return res.status(400).json({ ok: false, error: 'password-too-long' });

      const target = await getAuth().getUser(uid);
      const targetEmail = String(target.email || '').trim().toLowerCase();
      if (email && targetEmail && email !== targetEmail) {
        return res.status(409).json({ ok: false, error: 'email-uid-mismatch' });
      }

      await getAuth().updateUser(uid, { password });

      return res.status(200).json({
        ok: true,
        uid,
        email: targetEmail || email
      });
    } catch (err) {
      console.error('adminSetUserPassword failed', err);
      const code = String(err?.code || 'internal');
      if (code.includes('id-token-expired') || code.includes('argument-error')) {
        return res.status(401).json({ ok: false, error: code });
      }
      if (code.includes('user-not-found')) {
        return res.status(404).json({ ok: false, error: 'user-not-found' });
      }
      return res.status(500).json({ ok: false, error: code });
    }
  }
);

exports.adminSetUserEmail = onRequest(
  {
    region: 'us-central1',
    cors: true,
    timeoutSeconds: 30,
    memory: '256MiB'
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.set('Allow', 'POST');
      return res.status(405).json({ ok: false, error: 'method-not-allowed' });
    }

    try {
      if (!(await requireMainAdmin(req, res))) return;

      const uid = String(req.body?.uid || '').trim();
      const email = String(req.body?.email || '').trim().toLowerCase();

      if (!uid) return res.status(400).json({ ok: false, error: 'uid-required' });
      if (!email || !email.includes('@')) {
        return res.status(400).json({ ok: false, error: 'valid-email-required' });
      }

      const target = await getAuth().getUser(uid);
      const currentEmail = String(target.email || '').trim().toLowerCase();

      if (currentEmail === email) {
        return res.status(200).json({ ok: true, uid, email, changed: false });
      }

      await getAuth().updateUser(uid, { email });

      return res.status(200).json({
        ok: true,
        uid,
        email,
        previousEmail: currentEmail,
        changed: true
      });
    } catch (err) {
      console.error('adminSetUserEmail failed', err);
      const code = String(err?.code || 'internal');
      if (code.includes('id-token-expired') || code.includes('argument-error')) {
        return res.status(401).json({ ok: false, error: code });
      }
      if (code.includes('user-not-found')) {
        return res.status(404).json({ ok: false, error: 'user-not-found' });
      }
      if (code.includes('email-already-exists')) {
        return res.status(409).json({ ok: false, error: 'email-already-exists' });
      }
      return res.status(500).json({ ok: false, error: code });
    }
  }
);
