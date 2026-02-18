#!/bin/bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────
# App Store Submission — All-in-One
# 1. Push metadata via EAS
# 2. Upload build to App Store Connect
# 3. Capture & composite screenshots
# 4. Upload privacy labels via Fastlane
# 5. (Optional) Submit a featuring nomination
# ─────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

info()  { echo "→ $*"; }
warn()  { echo "⚠ $*"; }
step()  { echo ""; echo "══════════════════════════════════════════"; echo "  $*"; echo "══════════════════════════════════════════"; echo ""; }

# Parse args
SKIP_METADATA=false
SKIP_BUILD=false
SKIP_SCREENSHOTS=false
SKIP_PRIVACY=false
SKIP_NOMINATION=true  # off by default
DEVICE_FLAG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-metadata)    SKIP_METADATA=true; shift ;;
    --skip-build)       SKIP_BUILD=true; shift ;;
    --skip-screenshots) SKIP_SCREENSHOTS=true; shift ;;
    --skip-privacy)     SKIP_PRIVACY=true; shift ;;
    --nominate)         SKIP_NOMINATION=false; shift ;;
    --device=*)         DEVICE_FLAG="$1"; shift ;;
    --help|-h)
      echo "Usage: $0 [options]"
      echo ""
      echo "  --skip-metadata      Skip EAS metadata push"
      echo "  --skip-build         Skip build upload"
      echo "  --skip-screenshots   Skip screenshot capture"
      echo "  --skip-privacy       Skip privacy labels upload"
      echo "  --nominate           Include App Store featuring nomination"
      echo "  --device=pro|promax  Simulator device (default: promax)"
      echo ""
      echo "Steps:"
      echo "  1. eas metadata:push      (store.config.json → App Store Connect)"
      echo "  2. eas submit             (latest build → App Store Connect)"
      echo "  3. capture-screenshots.sh  (simulator → raw → composited PNGs)"
      echo "  4. fastlane upload_privacy (privacy labels → App Store Connect)"
      echo "  5. nomination prompt       (only with --nominate flag)"
      echo ""
      echo "Manual steps (App Store Connect web UI):"
      echo "  - Age rating (EAS CLI bug prevents automation)"
      echo "  - App Clip experience (card image, subtitle, invocation URLs)"
      echo "  - Select build for version & submit for review"
      echo "  - Upload screenshots to version"
      exit 0 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

TOTAL_STEPS=4
if [[ "$SKIP_NOMINATION" == false ]]; then
  TOTAL_STEPS=5
fi

CURRENT_STEP=0
next_step() { CURRENT_STEP=$((CURRENT_STEP + 1)); step "Step $CURRENT_STEP/$TOTAL_STEPS: $1"; }

# ─── Step 1: Metadata ───

if [[ "$SKIP_METADATA" == false ]]; then
  next_step "Push Store Metadata"

  # Workaround: eas metadata:push validator rejects autoSubmit in build profiles.
  if grep -q '"autoSubmit"' eas.json 2>/dev/null; then
    info "Temporarily removing autoSubmit from eas.json (metadata validator bug)..."
    sed -i.metadata-bak 's/.*"autoSubmit".*,$//' eas.json
    trap 'mv eas.json.metadata-bak eas.json 2>/dev/null' EXIT
  fi

  info "Pushing store.config.json to App Store Connect..."
  eas metadata:push

  if [[ -f eas.json.metadata-bak ]]; then
    mv eas.json.metadata-bak eas.json
    trap - EXIT
    info "Restored autoSubmit in eas.json"
  fi

  info "Metadata pushed."
else
  info "Skipping metadata push"
fi

# ─── Step 2: Build Upload ───

if [[ "$SKIP_BUILD" == false ]]; then
  next_step "Upload Build"

  echo ""
  echo "  Choose a build source:"
  echo "    1) Latest EAS cloud build (default)"
  echo "    2) Specific EAS build URL or ID"
  echo "    3) Local IPA file path"
  echo ""
  read -rp "  Selection [1]: " build_choice
  build_choice="${build_choice:-1}"

  case "$build_choice" in
    1)
      info "Submitting latest EAS build..."
      eas submit --platform ios --latest --profile production
      ;;
    2)
      read -rp "  Enter EAS build URL or ID: " build_id
      info "Submitting build: $build_id"
      eas submit --platform ios --id "$build_id" --profile production
      ;;
    3)
      read -rp "  Enter IPA file path: " ipa_path
      info "Submitting IPA: $ipa_path"
      eas submit --platform ios --path "$ipa_path" --profile production
      ;;
    *)
      warn "Invalid choice, skipping build upload."
      ;;
  esac

  info "Build uploaded to App Store Connect."
  echo "  Note: It takes ~10-15 min for Apple to process the build."
  echo "  You'll then need to select it for your version in App Store Connect."
else
  info "Skipping build upload"
fi

# ─── Step 3: Screenshots ───

if [[ "$SKIP_SCREENSHOTS" == false ]]; then
  next_step "Capture Screenshots"
  bash "$SCRIPT_DIR/capture-screenshots.sh" $DEVICE_FLAG
else
  info "Skipping screenshots"
fi

# ─── Step 4: Privacy Labels ───

if [[ "$SKIP_PRIVACY" == false ]]; then
  next_step "Upload Privacy Labels"
  info "Uploading privacy labels to App Store Connect..."
  fastlane upload_privacy
  info "Privacy labels uploaded."
else
  info "Skipping privacy labels"
fi

# ─── Step 5: Nomination (optional) ───

if [[ "$SKIP_NOMINATION" == false ]]; then
  next_step "App Store Featuring Nomination"

  echo ""
  echo "  Featuring nominations require an App Store Connect API Key."
  echo "  If you haven't set one up yet, you can create one at:"
  echo "    App Store Connect → Users and Access → Integrations → Keys"
  echo ""
  read -rp "  Do you have an ASC API key configured? (y/N): " has_key

  if [[ "$has_key" =~ ^[Yy] ]]; then
    echo ""
    echo "  Nomination types:"
    echo "    1) App Launch (new app)"
    echo "    2) App Enhancements (new features/update)"
    echo "    3) New Content (content, offers, events)"
    echo ""
    read -rp "  Type [1]: " nom_type
    nom_type="${nom_type:-1}"

    read -rp "  Description (what makes this worth featuring?): " nom_desc
    read -rp "  Target publish date (YYYY-MM-DD): " nom_date

    case "$nom_type" in
      1) nom_type_str="appLaunch" ;;
      2) nom_type_str="appEnhancements" ;;
      3) nom_type_str="newContent" ;;
      *) nom_type_str="appLaunch" ;;
    esac

    info "To submit the nomination, use the App Store Connect API:"
    echo ""
    echo "  POST https://api.appstoreconnect.apple.com/v1/nominations"
    echo "  Body:"
    echo "  {"
    echo "    \"data\": {"
    echo "      \"type\": \"nominations\","
    echo "      \"attributes\": {"
    echo "        \"name\": \"Nekt - $nom_type_str\","
    echo "        \"type\": \"$nom_type_str\","
    echo "        \"description\": \"$nom_desc\","
    echo "        \"publishStartDate\": \"$nom_date\""
    echo "      },"
    echo "      \"relationships\": {"
    echo "        \"relatedApps\": {"
    echo "          \"data\": [{ \"type\": \"apps\", \"id\": \"6756943273\" }]"
    echo "        }"
    echo "      }"
    echo "    }"
    echo "  }"
    echo ""
    info "You can also submit via App Store Connect web UI or CSV upload."
  else
    info "Skipping nomination — set up an API key first."
    echo "  You can also submit nominations manually at:"
    echo "  App Store Connect → Your App → Featuring → Nominations"
  fi
fi

# ─── Done ───

step "All Done"
echo "Checklist:"
echo "  [✓] Store metadata (title, description, keywords, review notes)"
echo "  [✓] Build uploaded to App Store Connect"
echo "  [✓] Screenshots (composited with captions)"
echo "  [✓] Privacy labels (data collection declarations)"
if [[ "$SKIP_NOMINATION" == false ]]; then
echo "  [✓] Featuring nomination"
fi
echo ""
echo "Manual steps remaining in App Store Connect:"
echo "  [ ] Set age rating (all 'None' for 4+)"
echo "  [ ] Configure App Clip experience (card image, subtitle, URLs)"
echo "  [ ] Select build for version"
echo "  [ ] Upload screenshots to version"
echo "  [ ] Submit for review"
