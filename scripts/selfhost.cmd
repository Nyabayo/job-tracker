@echo off
rem Windows Command Prompt: runs selfhost.ps1 (no Git Bash needed).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0selfhost.ps1"
