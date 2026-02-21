#!/bin/bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────
# App Store Screenshot Capture Script
# Boots simulator, navigates to screens via deep links, captures
# raw PNGs, then calls composite-screenshots.js for final output.
# ─────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$PROJECT_DIR/screenshots"
RAW_DIR="$OUTPUT_DIR/raw"

# Simulator UDIDs
SIM_PRO_MAX="4C208E0C-252D-4A69-A2D9-F2F81B49891D"  # iPhone 16 Pro Max (6.9")
SIM_PRO="28A2AFE7-67DD-42EE-A639-FC15C4059A84"       # iPhone 16 Pro (6.3")

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
    # Poll until the device reports as Booted (up to 60s)
    local elapsed=0
    while [[ $elapsed -lt 60 ]]; do
      if xcrun simctl list devices | grep "$udid" | grep -q "(Booted)"; then
        break
      fi
      sleep 2
      elapsed=$((elapsed + 2))
    done
    # Extra wait for SpringBoard to be ready
    sleep 5
    info "$name booted."
  else
    info "$name already booted"
  fi
}

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
  local device_udid="$SIM_PRO_MAX"
  local device_name="iPhone 16 Pro Max"
  local device_key="promax"

  # Parse args
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --device=pro)
        device_udid="$SIM_PRO"
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

  mkdir -p "$RAW_DIR"

  echo ""
  echo "╔══════════════════════════════════════════════════════╗"
  echo "║   App Store Screenshot Capture                       ║"
  echo "║   Device: $device_name                               ║"
  echo "╚══════════════════════════════════════════════════════╝"
  echo ""

  # 1. Boot simulator
  ensure_sim_booted "$device_udid" "$device_name"

  # 2. Build & install app if needed
  if ! xcrun simctl listapps "$device_udid" 2>/dev/null | grep -q "com.nektus.app"; then
    info "App not installed on $device_name. Building..."
    cd "$PROJECT_DIR"
    # Build with xcodebuild (more reliable than expo run:ios with Xcode betas)
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

  # 3. Launch app
  info "Launching Nekt..."
  xcrun simctl launch "$device_udid" com.nektus.app 2>/dev/null || true
  sleep 3
  info "App launched. Sign in if needed before continuing."
  wait_for_enter

  # 4. Capture each screenshot
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

  # 5. Composite all screenshots into marketing images
  echo ""
  info "Compositing marketing screenshots..."
  cd "$PROJECT_DIR"
  node scripts/composite-screenshots.js --device="$device_key"

  echo ""
  echo "✓ All done for $device_name!"
  echo "  Raw:   screenshots/raw/"
  echo "  Final: screenshots/final/$device_name/"
  echo ""
  if [[ "$device_key" == "promax" ]]; then
    echo "Next: Run again with --device=pro for iPhone 16 Pro screenshots."
  fi
}

main "$@"
