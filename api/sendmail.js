/**
 * api/sendmail.js
 * Expects Authorization: Bearer <token>
 * Body: { number: "+628..." }
 * Enforces cooldown (5 minutes) and daily limit (default 25)
 */
const { getFileSHAAndContent, putFileContent, verifyToken } = require('./utils');
const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ success:false, message:'Method Not Allowed' });

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ success:false, message:'Unauthorized' });

  const { number } = req.body || {};
  if (!number) return res.status(400).json({ success:false, message:'Nomor WhatsApp belum diisi!' });

  try {
    const { sha, contentB64 } = await getFileSHAAndContent();
    const users = JSON.parse(Buffer.from(contentB64, 'base64').toString('utf8'));
    const user = users.find(u => u.username === payload.username);
    if (!user) return res.status(403).json({ success:false, message:'User tidak ditemukan' });

    const now = Date.now();
    const COOLDOWN_MS = 5*60*1000;
    const today = new Date(now).toISOString().slice(0,10);

    if (!user.dailyResetDate || user.dailyResetDate !== today) {
      user.dailyResetDate = today;
      user.usedToday = 0;
    }

    const DAILY_LIMIT = user.limit || 25;
    if (user.usedToday >= DAILY_LIMIT) return res.status(429).json({ success:false, message:`Limit harian tercapai (${DAILY_LIMIT}). Coba besok.` });
    if (user.lastSend && (now - user.lastSend) < COOLDOWN_MS) {
      const wait = Math.ceil((COOLDOWN_MS - (now - user.lastSend))/1000);
      return res.status(429).json({ success:false, message:`Cooldown aktif. Tunggu ${wait} detik.` });
    }

    if (!user.email || !user.appPassword) return res.status(500).json({ success:false, message:'Sender email atau app password belum terkonfigurasi.' });

    const transporter = nodemailer.createTransport({ service:'gmail', auth:{ user: user.email, pass: user.appPassword } });
    await transporter.sendMail({ from: user.email, to:'support@support.whatsapp.com', subject:'', text:`${number}` });

    user.lastSend = now;
    user.usedToday = (user.usedToday||0) + 1;

    await putFileContent(users, sha, `Update usage for ${user.username}`);

    return res.status(200).json({ success:true, message:'✅ Email berhasil dikirim ke WhatsApp Support!' });
  } catch (err) {
    console.error('sendmail err', err);
    return res.status(500).json({ success:false, message:'❌ Gagal mengirim email.' });
  }
};
