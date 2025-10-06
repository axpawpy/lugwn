/**
 * api/adduser.js
 * Admin-only endpoint to add user with email/app_pass and optional premiumDays
 * Expects Authorization: Bearer <token>
 */
const { getFileSHAAndContent, putFileContent, verifyToken } = require('./utils');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ success:false, message:'Method Not Allowed' });
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ success:false, message:'Unauthorized' });
  if (payload.role !== 'admin') return res.status(403).json({ success:false, message:'Forbidden: admin only' });

  const { username, password, role='user', email='', app_pass='', premiumDays=0 } = req.body || {};
  if (!username || !password) return res.status(400).json({ success:false, message:'username & password required' });

  try {
    const { sha, contentB64 } = await getFileSHAAndContent();
    const users = JSON.parse(Buffer.from(contentB64, 'base64').toString('utf8'));

    if (users.find(u => u.username === username)) return res.status(409).json({ success:false, message:'User already exists' });

    const premiumUntil = premiumDays && Number(premiumDays) > 0 ? Date.now() + Number(premiumDays)*24*60*60*1000 : 0;

    users.push({
      username,
      password,
      role,
      email,
      app_pass: app_pass,
      premium: !!(premiumDays>0),
      premiumUntil,
      lastSend: 0,
      usedToday: 0,
      dailyResetDate: '1970-01-01'
    });

    await putFileContent(users, sha, `Add user ${username} via admin panel`);
    return res.status(200).json({ success:true, message:'User berhasil ditambahkan' });
  } catch (err) {
    console.error('adduser err', err);
    return res.status(500).json({ success:false, message:'Internal Server Error' });
  }
};
