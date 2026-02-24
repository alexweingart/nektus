#!/bin/bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────
# App Store Screenshot Capture Script
# Boots simulator, starts Metro, navigates to screens via deep
# links, captures raw PNGs, then composites final marketing images.
# ─────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$PROJECT_DIR/screenshots"
RAW_DIR="$OUTPUT_DIR/raw"

# Simulator device types
SIM_TYPE_PRO_MAX="com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro-Max"
SIM_TYPE_PRO="com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro"

METRO_PID=""

# Screenshot definitions: slug|caption|deep_link_or_manual
SCREENSHOTS=(
  "01-profile|Share Who You Are|nekt://profile"
  "02-exchange|Bump to Connect|MANUAL"
  "03-appclip|Connect Without the App|MANUAL"
  "04-contact|Save Contact & Text Instantly|MANUAL"
  "05-history|Keep Every Connection|nekt://history"
  "06-smart-schedule|Find Time to Meet|MANUAL"
  "07-ai-schedule|Let AI Plan It|MANUAL"
)

# ─────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────

info()  { echo "→ $*"; }
warn()  { echo "⚠ $*"; }

wait_for_enter() {
  echo ""
  read -rp "   Press ENTER when ready to capture..." _
}

cleanup() {
  if [[ -n "$METRO_PID" ]] && kill -0 "$METRO_PID" 2>/dev/null; then
    info "Stopping Metro dev server (PID $METRO_PID)..."
    kill "$METRO_PID" 2>/dev/null || true
    wait "$METRO_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# ─────────────────────────────────────────────────────────────────
# Preflight Checks
# ─────────────────────────────────────────────────────────────────

preflight() {
  local errors=0

  info "Running preflight checks..."

  # Required CLI tools
  for tool in xcodebuild xcrun node; do
    if ! command -v "$tool" &>/dev/null; then
      warn "Missing required tool: $tool"
      errors=$((errors + 1))
    fi
  done

  # Xcode workspace
  if [[ ! -d "$PROJECT_DIR/ios/Nekt.xcworkspace" ]]; then
    warn "Xcode workspace not found at ios/Nekt.xcworkspace"
    warn "Run: cd apps/ios-native && npx expo prebuild"
    errors=$((errors + 1))
  fi

  # Pods installed
  if [[ ! -d "$PROJECT_DIR/ios/Pods" ]]; then
    warn "CocoaPods not installed. Run: cd ios && pod install"
    errors=$((errors + 1))
  fi

  # canvas npm package (needed for compositing)
  if ! node -e "require('canvas')" 2>/dev/null; then
    warn "Missing npm package 'canvas'. Run: bun add -D canvas"
    errors=$((errors + 1))
  fi

  if [[ $errors -gt 0 ]]; then
    echo ""
    echo "Preflight failed with $errors error(s). Fix the issues above and retry."
    exit 1
  fi

  info "Preflight passed."
}

# ─────────────────────────────────────────────────────────────────
# Simulator Resolution — find or create the right device
# ─────────────────────────────────────────────────────────────────

resolve_simulator() {
  local device_type="$1"
  local device_name="$2"

  # Look for an existing simulator of this type
  local udid
  udid=$(xcrun simctl list devices available -j 2>/dev/null \
    | python3 -c "
import json, sys
data = json.load(sys.stdin)
for runtime, devices in data['devices'].items():
    for d in devices:
        if d['name'] == '$device_name' and d['isAvailable']:
            print(d['udid'])
            sys.exit(0)
" 2>/dev/null || true)

  if [[ -n "$udid" ]]; then
    echo "$udid"
    return
  fi

  # Find the latest iOS runtime
  local runtime
  runtime=$(xcrun simctl list runtimes -j 2>/dev/null \
    | python3 -c "
import json, sys
data = json.load(sys.stdin)
ios_runtimes = [r for r in data['runtimes'] if r['platform'] == 'iOS' and r['isAvailable']]
if ios_runtimes:
    # Sort by version descending
    ios_runtimes.sort(key=lambda r: r['version'], reverse=True)
    print(ios_runtimes[0]['identifier'])
" 2>/dev/null || true)

  if [[ -z "$runtime" ]]; then
    warn "No iOS simulator runtime found. Install one via Xcode → Settings → Platforms."
    exit 1
  fi

  info "Creating $device_name simulator (runtime: $runtime)..."
  udid=$(xcrun simctl create "$device_name" "$device_type" "$runtime")
  echo "$udid"
}

ensure_sim_booted() {
  local udid="$1"
  local name="$2"

  # Shut down any other booted simulators first to avoid conflicts
  local other_booted
  other_booted=$(xcrun simctl list devices | grep "(Booted)" | grep -v "$udid" | grep -oE "[0-9A-F-]{36}" || true)
  if [[ -n "$other_booted" ]]; then
    info "Shutting down other booted simulators..."
    while IFS= read -r other_udid; do
      xcrun simctl shutdown "$other_udid" 2>/dev/null || true
    done <<< "$other_booted"
    sleep 2
  fi

  local state
  state=$(xcrun simctl list devices | grep "$udid" | grep -oE "\(Booted\)|\(Shutdown\)" | head -1)
  if [[ "$state" != "(Booted)" ]]; then
    info "Booting $name..."
    xcrun simctl boot "$udid" 2>/dev/null || true
    open -a Simulator --args -CurrentDeviceUDID "$udid"
    info "Waiting for simulator to finish booting..."
    local elapsed=0
    while [[ $elapsed -lt 60 ]]; do
      if xcrun simctl list devices | grep "$udid" | grep -q "(Booted)"; then
        break
      fi
      sleep 2
      elapsed=$((elapsed + 2))
    done
    sleep 5
    info "$name booted."
  else
    info "$name already booted"
  fi
}

# ─────────────────────────────────────────────────────────────────
# Metro Dev Server
# ─────────────────────────────────────────────────────────────────

ensure_metro_running() {
  # Check if Metro is already running on port 8081
  if curl -s http://localhost:8081/status 2>/dev/null | grep -q "packager-status:running"; then
    info "Metro dev server already running"
    return
  fi

  info "Starting Metro dev server..."
  cd "$PROJECT_DIR"
  npx expo start --port 8081 &>/dev/null &
  METRO_PID=$!

  # Wait for Metro to be ready (up to 30s)
  local elapsed=0
  while [[ $elapsed -lt 30 ]]; do
    if curl -s http://localhost:8081/status 2>/dev/null | grep -q "packager-status:running"; then
      info "Metro dev server ready (PID $METRO_PID)"
      return
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done

  warn "Metro dev server didn't start within 30s. The app may not load JS correctly."
  warn "You can start it manually: cd apps/ios-native && npx expo start"
}

# ─────────────────────────────────────────────────────────────────
# Capture helpers
# ─────────────────────────────────────────────────────────────────

capture_raw() {
  local udid="$1"
  local filename="$2"
  xcrun simctl io "$udid" screenshot --type=png "$filename"
  info "Captured: $(basename "$filename")"
}

navigate() {
  local udid="$1"
  local url="$2"
  xcrun simctl openurl "$udid" "$url"
  sleep 2
}

# ─────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────

main() {
  local device_type="$SIM_TYPE_PRO_MAX"
  local device_name="iPhone 16 Pro Max"
  local device_key="promax"

  # Parse args
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --device=pro)
        device_type="$SIM_TYPE_PRO"
        device_name="iPhone 16 Pro"
        device_key="pro"
        shift ;;
      --device=promax)
        shift ;;
      --composite-only)
        info "Composite-only mode — skipping capture"
        cd "$PROJECT_DIR"
        node scripts/composite-screenshots.js --device="$device_key"
        return ;;
      --help|-h)
        echo "Usage: $0 [--device=pro|promax] [--composite-only]"
        echo ""
        echo "  --device=promax   iPhone 16 Pro Max 6.9\" (default)"
        echo "  --device=pro      iPhone 16 Pro 6.3\""
        echo "  --composite-only  Skip capture, just re-composite from raw/"
        echo ""
        echo "Run once per device. Raw → screenshots/raw/, Final → screenshots/final/"
        return ;;
      *) echo "Unknown arg: $1"; exit 1 ;;
    esac
  done

  # 0. Preflight
  cd "$PROJECT_DIR"
  preflight

  mkdir -p "$RAW_DIR"

  echo ""
  echo "╔══════════════════════════════════════════════════════╗"
  echo "║   App Store Screenshot Capture                      ║"
  echo "║   Device: $device_name                              ║"
  echo "╚══════════════════════════════════════════════════════╝"
  echo ""

  # 1. Resolve & boot simulator
  local device_udid
  device_udid=$(resolve_simulator "$device_type" "$device_name")
  info "Using simulator: $device_name ($device_udid)"
  ensure_sim_booted "$device_udid" "$device_name"

  # 2. Start Metro dev server (Debug builds need it for JS)
  ensure_metro_running

  # 3. Build & install app if needed
  if ! xcrun simctl listapps "$device_udid" 2>/dev/null | grep -q "com.nektus.app"; then
    info "App not installed on $device_name. Building..."
    cd "$PROJECT_DIR"
    info "Building with xcodebuild..."
    if ! xcodebuild -workspace ios/Nekt.xcworkspace -scheme Nekt -configuration Debug \
        -destination "id=$device_udid" build 2>&1 | tail -5; then
      warn "Build failed. Trying clean prebuild..."
      bash "$SCRIPT_DIR/clean-prebuild.sh"
      if ! xcodebuild -workspace ios/Nekt.xcworkspace -scheme Nekt -configuration Debug \
          -destination "id=$device_udid" build 2>&1 | tail -5; then
        echo ""; echo "Build failed again. Check the Xcode logs."; exit 1
      fi
    fi
    # Find and install the built .app
    local app_path
    app_path=$(find ~/Library/Developer/Xcode/DerivedData -name "Nekt.app" -path "*/Debug-iphonesimulator/*" -newer "$PROJECT_DIR/ios/Nekt.xcworkspace" 2>/dev/null | head -1)
    if [[ -z "$app_path" ]]; then
      app_path=$(find ~/Library/Developer/Xcode/DerivedData -name "Nekt.app" -path "*/Debug-iphonesimulator/*" 2>/dev/null | head -1)
    fi
    if [[ -n "$app_path" ]]; then
      xcrun simctl install "$device_udid" "$app_path"
      info "App installed from: $app_path"
    else
      warn "Could not find built Nekt.app to install"; exit 1
    fi
    info "Build complete."
  fi

  # 4. Launch app
  info "Launching Nekt..."
  xcrun simctl launch "$device_udid" com.nektus.app 2>/dev/null || true
  sleep 3
  info "App launched. Sign in if needed before continuing."
  wait_for_enter

  # 5. Capture each screenshot
  for entry in "${SCREENSHOTS[@]}"; do
    IFS='|' read -r slug caption deep_link <<< "$entry"
    local raw_file="$RAW_DIR/${slug}_${device_name// /-}.png"

    echo ""
    echo "━━━ Screenshot $(echo "$slug" | cut -d- -f1): $caption ━━━"

    if [[ "$deep_link" == "MANUAL" ]]; then
      warn "Manual navigation required."
      case "$slug" in
        02-exchange)
          echo "   Navigate to Profile and tap the Nekt button (exchange mode active)." ;;
        03-appclip)
          echo "   Open Safari → https://nekt.us/x/<token> for App Clip card,"
          echo "   or take a separate screenshot of the App Clip experience." ;;
        04-contact)
          echo "   Complete a contact exchange, or open a saved contact from History." ;;
        06-smart-schedule)
          echo "   Open a contact → tap 'Find Time to Meet' → calendar slots view." ;;
        07-ai-schedule)
          echo "   From Smart Schedule → tap 'Let AI Plan It' → chat interface." ;;
      esac
      wait_for_enter
    else
      info "Navigating via deep link: $deep_link"
      navigate "$device_udid" "$deep_link"
      sleep 1
      echo "   Adjust the screen if needed (scroll, dismiss keyboard, etc.)"
      wait_for_enter
    fi

    capture_raw "$device_udid" "$raw_file"
  done

  # 6. Composite all screenshots into marketing images
  echo ""
  info "Compositing marketing screenshots..."
  cd "$PROJECT_DIR"
  node scripts/composite-screenshots.js --device="$device_key"

  echo ""
  echo "All done for $device_name!"
  echo "  Raw:   screenshots/raw/"
  echo "  Final: screenshots/final/$device_name/"
  echo ""
  if [[ "$device_key" == "promax" ]]; then
    echo "Next: Run again with --device=pro for iPhone 16 Pro screenshots."
  fi
}

main "$@"
