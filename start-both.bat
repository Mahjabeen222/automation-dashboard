@echo off
echo Starting Automation Dashboard - Backend and Frontend

REM Start backend in new window
echo Starting Backend Server...
start "Backend API" cmd /k "cd backend && python run.py"

REM Wait a moment for backend to start
timeout /t 5 /nobreak

REM Start frontend in new window  
echo Starting Frontend Server...
start "React Frontend" cmd /k "cd frontend && npm start"

echo Both servers are starting...
echo Backend: http://localhost:8000
echo Frontend: http://localhost:3000
echo API Docs: http://localhost:8000/docs
pause 