/**
 * utils.js
 * Helpers for GitHub read/write and token sign/verify.
 * IMPORTANT: Replace CONFIG placeholders with your GitHub repo/token and a SIGNING_SECRET.
 */
const crypto = require('crypto');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const CONFIG = {
  GITHUB_OWNER: "axpawpy",
  GITHUB_REPO: "pandahpeler",
  GITHUB_PATH: "users.json",
  GITHUB_BRANCH: "main",
  GITHUB_TOKEN: "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",
  SIGNING_SECRET: "axpawbackbrow"
};

function signToken(payload) {
  const b = Buffer.from(JSON.stringify(payload)).toString('base64');
  const mac = crypto.createHmac('sha256', CONFIG.SIGNING_SECRET).update(b).digest('hex');
  return `${b}.${mac}`;
}

function verifyToken(token) {
  try {
    const [b, mac] = (token||'').split('.');
    if (!b || !mac) return null;
    const expected = crypto.createHmac('sha256', CONFIG.SIGNING_SECRET).update(b).digest('hex');
    if (expected !== mac) return null;
    const payload = JSON.parse(Buffer.from(b, 'base64').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

async function getFileSHAAndContent() {
  const url = `https://api.github.com/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/contents/${CONFIG.GITHUB_PATH}?ref=${CONFIG.GITHUB_BRANCH}`;
  const r = await fetch(url, {
    headers: { Authorization: `token ${CONFIG.GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error('GitHub GET failed: '+r.status+' - '+t);
  }
  const j = await r.json();
  return { sha: j.sha, contentB64: j.content };
}

async function putFileContent(newUsers, sha, commitMessage) {
  const url = `https://api.github.com/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/contents/${CONFIG.GITHUB_PATH}`;
  const contentB64 = Buffer.from(JSON.stringify(newUsers, null, 2)).toString('base64');
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `token ${CONFIG.GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: commitMessage, branch: CONFIG.GITHUB_BRANCH, content: contentB64, sha })
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error('GitHub PUT failed: '+res.status+' - '+t);
  }
  return await res.json();
}

module.exports = { CONFIG, signToken, verifyToken, getFileSHAAndContent, putFileContent };
