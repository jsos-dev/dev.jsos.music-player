#!/bin/sh

VER=$(node -e 'console.log(require("./package.json").version)')
echo Building music-player-app
echo VER:$VER

npm run build

echo "删除开发依赖"
cp package.json package.json.bak
node -e 'const j = require("./package.json");j["devDependencies"]={};fs.writeFileSync("package.json", JSON.stringify(j, null, 2));'

echo "压缩中"
zip -r dist.zip dist/ package.json server.js icon.svg

echo "还原中"
mv package.json.bak package.json

echo "打包完成：dist.zip"

echo OK
