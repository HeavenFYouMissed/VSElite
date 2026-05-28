@echo off
set PATH=C:\nvm4w\nodejs;%PATH%
cd /d C:\Users\heave\Desktop\mcp\vselite
start "" .\scripts\code.bat --user-data-dir .\.tmp\user-data --extensions-dir .\.tmp\extensions
