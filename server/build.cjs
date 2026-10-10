const fs=require('node:fs');
fs.mkdirSync('public-api',{recursive:true});
fs.writeFileSync('public-api/index.html','<!doctype html><meta charset="utf-8"><title>FairShare · 好好分赃</title><a href="https://zxzin.github.io/jun-yun-fen-zang/">打开好好分赃</a>');
