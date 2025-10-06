/**
 * api/login.js
 * POST { username, password } -> returns token
 */
const { getFileSHAAndContent, signToken } = require('./utils');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ success:false, message:'Method Not Allowed' });
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ success:false, message:'Username & password required' });

  try {
    const { contentB64 } = await getFileSHAAndContent();
    const users = JSON.parse(Buffer.from(contentB64, 'base64').toString('utf8'));
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) return res.status(401).json({ success:false, message:'Username atau password salah' });

    // if premium expired, turn off
    if (user.premiumUntil && Date.now() > user.premiumUntil) {
      user.premium = false;
    }

    const payload = { username: user.username, role: user.role || 'user', exp: Date.now() + 1000*60*60*6 };
    const token = signToken(payload);
    return res.status(200).json({ success:true, message:'Login berhasil', role: payload.role, token });
  } catch (err) {
    console.error('login err', err);
    return res.status(500).json({ success:false, message:'Internal Server Error' });
  }
};
