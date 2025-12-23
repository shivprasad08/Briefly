@echo off
setlocal
rem Start backend with the project virtual environment to ensure dependencies and correct working dir
cd /d "%~dp0"

set VENV_PY=..\.venv\Scripts\python.exe
if exist "%VENV_PY%" (
	"%VENV_PY%" -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
) else (
	rem Fallback to system Python if venv is missing
	py -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
)

endlocal
