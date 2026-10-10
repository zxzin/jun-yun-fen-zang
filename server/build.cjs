const fs=require('node:fs');
fs.mkdirSync('public-api',{recursive:true});
fs.writeFileSync('public-api/index.html','<!doctype html><meta charset="utf-8"><title>FairShare · 均匀分赃</title><a href="https://zxzin.github.io/jun-yun-fen-zang/">打开均匀分赃</a>');
