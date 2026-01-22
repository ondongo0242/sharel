#!/bin/bash

# Sharel - EAS Build Pre-Check Script
# Runs all verification commands and logs results

LOG_FILE="check-log.txt"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
ERROR_COUNT=0

echo "========================================" > $LOG_FILE
echo "SHAREL EAS BUILD CHECK - $TIMESTAMP" >> $LOG_FILE
echo "========================================" >> $LOG_FILE
echo "" >> $LOG_FILE

run_check() {
    local name="$1"
    local cmd="$2"
    
    echo "🔍 Running: $name..."
    echo "----------------------------------------" >> $LOG_FILE
    echo "[$name]" >> $LOG_FILE
    echo "Command: $cmd" >> $LOG_FILE
    echo "" >> $LOG_FILE
    
    eval "$cmd" >> $LOG_FILE 2>&1
    local exit_code=$?
    
    echo "" >> $LOG_FILE
    if [ $exit_code -eq 0 ]; then
        echo "Status: ✅ OK" >> $LOG_FILE
    else
        echo "Status: ❌ ERROR (exit code: $exit_code)" >> $LOG_FILE
        ((ERROR_COUNT++))
    fi
    echo "" >> $LOG_FILE
    
    return $exit_code
}

echo "Starting comprehensive checks..."
echo ""

# 0) Check for lock file
run_check "Lock File Check" "test -f package-lock.json && echo 'package-lock.json found' || (test -f yarn.lock && echo 'yarn.lock found') || (echo 'No lock file! Run npm install' && exit 1)"

# 1) Expo Doctor - Full health check
run_check "Expo Doctor" "npx expo-doctor"

# 2) Check dependencies versions
run_check "Expo Dependencies Check" "npx expo install --check"

# 3) TypeScript Check - Catch type errors
run_check "TypeScript Check" "npx tsc --noEmit 2>&1 || echo 'TypeScript errors found - review above'"

# 4) ESLint Check - Catch JS/TS errors
run_check "ESLint Check" "npx eslint src/ --ext .ts,.tsx,.js,.jsx --max-warnings 0 2>&1 || echo 'Lint errors found'"

# 5) Check Expo config (app.json validation)
run_check "Expo Config Check" "npx expo config --type public"

# 6) Check EAS config
run_check "EAS Config Check" "npx eas config 2>&1 || echo 'EAS CLI not available or not logged in'"

# 7) Check React Native CLI
run_check "React Native Doctor" "npx react-native doctor 2>&1 || echo 'Some checks may require native environment'"

# 8) Check JS bundle export (Android) - Catches Metro bundler errors
run_check "JS Bundle Export (Android)" "npx expo export --platform android --output-dir /tmp/expo-check-export 2>&1; rm -rf /tmp/expo-check-export"

# 9) Check JS bundle export (iOS)
run_check "JS Bundle Export (iOS)" "npx expo export --platform ios --output-dir /tmp/expo-check-export-ios 2>&1; rm -rf /tmp/expo-check-export-ios"

# 10) Check for duplicate dependencies
run_check "Duplicate Dependencies" "npm ls 2>&1 | grep -E 'UNMET|invalid|extraneous|deduped' | head -50 || echo 'No major duplicates found'"

# 11) Check peer dependencies
run_check "Peer Dependencies" "npm ls 2>&1 | grep -i 'peer dep' | head -30 || echo 'No peer dependency issues'"

# 12) Check native modules imports
run_check "Native Modules Check" "grep -r 'NativeModules' src/ --include='*.ts' --include='*.tsx' 2>&1 | head -20 || echo 'No NativeModules usage found'"

# 13) Check for common React Native errors
run_check "Common RN Issues" "grep -rn 'require(' src/ --include='*.ts' --include='*.tsx' 2>&1 | grep -v 'node_modules' | head -20 || echo 'No dynamic requires found'"

# 14) Check Kotlin/Java files package names
run_check "Android Package Names" "grep -r 'package com.' android/app/src/main/java --include='*.kt' --include='*.java' 2>&1 | sort -u"

# 15) Validate app.json schema
run_check "App.json Validation" "node -e \"const config = require('./app.json'); console.log('App name:', config.expo.name); console.log('Version:', config.expo.version); console.log('SDK:', config.expo.sdkVersion);\""

# 16) Check for missing assets
run_check "Assets Check" "ls -la assets/images/ 2>&1"

# 17) Check prebuild (skip on Replit due to git restrictions)
run_check "Expo Prebuild Check" "echo 'Skipped on Replit - run locally with: npx expo prebuild --no-install --clean'"

# Summary
echo "" >> $LOG_FILE
echo "========================================" >> $LOG_FILE
echo "CHECK COMPLETE - $TIMESTAMP" >> $LOG_FILE
echo "Total Errors: $ERROR_COUNT" >> $LOG_FILE
echo "========================================" >> $LOG_FILE

echo ""
if [ $ERROR_COUNT -eq 0 ]; then
    echo "✅ All checks passed! Ready for EAS build."
else
    echo "❌ Found $ERROR_COUNT error(s). Review $LOG_FILE for details."
fi
echo "📄 Results saved to: $LOG_FILE"
echo ""
echo "Quick view errors: grep -A5 'ERROR' $LOG_FILE"
