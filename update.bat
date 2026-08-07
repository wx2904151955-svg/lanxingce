@echo off
chcp 65001 >nul
echo ===== 揽星册 一键更新 =====
echo [1/3] 从桌面复制最新文件...
copy "C:\Users\wang'xuan\Desktop\index.html" "E:\lanxingce\index.html" /Y
copy "C:\Users\wang'xuan\Desktop\icon.png" "E:\lanxingce\icon.png" /Y
copy "C:\Users\wang'xuan\Desktop\manifest.json" "E:\lanxingce\manifest.json" /Y

echo [2/3] 提交到 git...
cd /d E:\lanxingce
git add -A
git commit -m "揽星册更新 %date% %time%" || echo （没有新改动，跳过提交）

echo [3/3] 推送到 GitHub Pages...
git push
echo ===== 完成！约 1 分钟后生效：https://wx2904151955-svg.github.io/lanxingce/ =====
pause
