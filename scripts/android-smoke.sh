#!/usr/bin/env bash
# Installs the debug APK on a running Android emulator, starts the app, and drives it (the work is in
# android-smoke.mjs). CI runs it (.github/workflows/android.yml); it needs adb and a booted emulator.
set -euo pipefail

APK=${1:?usage: android-smoke.sh path/to/app-debug.apk [output-dir]}
OUT=${2:-smoke-out}
PKG=com.tocfactory.game
mkdir -p "$OUT"

adb install -r "$APK"
adb logcat -c
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 > /dev/null
sleep 12
adb exec-out screencap -p > "$OUT/first-launch.png"

set +e
OUT="$OUT" PKG="$PKG" node scripts/android-smoke.mjs
STATUS=$?
set -e

adb logcat -d > "$OUT/logcat.txt"
if grep -E "FATAL EXCEPTION|ANR in $PKG" "$OUT/logcat.txt"; then
  echo "The app crashed or stopped responding during the run."
  STATUS=1
fi
exit $STATUS
