@echo off
echo ========================================
echo Building THPApp with Audio Permissions
echo ========================================

echo.
echo 1. Checking dependencies...
call npx expo install expo-av

echo.
echo 2. Clearing cache...
call npx expo start --clear

echo.
echo 3. Building for Android...
echo Choose one of the following options:
echo 1. EAS Build (Production)
echo 2. Development Build
echo 3. Expo Go (Testing only)
echo.
set /p choice="Enter your choice (1-3): "

if "%choice%"=="1" (
    echo Building with EAS...
    call npx eas build --platform android
) else if "%choice%"=="2" (
    echo Building development version...
    call npx expo run:android
) else if "%choice%"=="3" (
    echo Starting Expo Go...
    call npx expo start
) else (
    echo Invalid choice. Please run the script again.
)

echo.
echo ========================================
echo Build process completed!
echo ========================================
echo.
echo IMPORTANT: After building, check app permissions:
echo Android: Settings > Apps > thpapp > Permissions
echo iOS: Settings > Privacy & Security > Microphone > thpapp
echo.
pause 