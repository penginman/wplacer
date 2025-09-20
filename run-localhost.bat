@echo off
echo Starting WPlacer with localhost-only access (127.0.0.1) for better security...
echo.

REM Set HOST to localhost only
set HOST=127.0.0.1
set PORT=80

echo Using HOST=%HOST% and PORT=%PORT%
echo.

REM Start the application
npm start

pause
