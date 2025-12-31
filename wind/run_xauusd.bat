@echo off
setlocal

REM 一键运行：优先用 Windows 自带的 Python Launcher（py），其次用 python

echo.
echo [1/3] 检查 Python...
where py >nul 2>&1
if %errorlevel%==0 (
  echo 使用：py
  py -3 "%~dp0xauusd_windpy.py"
  goto :done
)

where python >nul 2>&1
if %errorlevel%==0 (
  echo 使用：python
  python "%~dp0xauusd_windpy.py"
  goto :done
)

echo.
echo 没找到 Python（py / python 都不可用）。
echo 请先安装 Python 3，然后再双击本文件。
echo.

:done
echo.
echo 运行结束。请查看同目录是否生成 XAUUSD.xlsx / XAUUSD.csv
echo 如果失败，把窗口里的报错整段复制给我。
echo.
pause
endlocal

