@echo off
chcp 65001 >nul
echo ===== 揽星册 一键更新 =====
echo 请直接在 E:\lanxingce 中编辑 index.html，改完点此脚本即可发布。
cd /d E:\lanxingce
git add -A
git commit -m "揽星册更新 %date% %time%" || echo （没有新改动，跳过提交）
git push
echo ===== 完成！约 1 分钟后生效：https://wx2904151955-svg.github.io/lanxingce/ =====
pause
