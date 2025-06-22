#!/bin/bash

# Create temporary files
cp src/app/components/views/ProfileView.tsx src/app/components/views/ProfileView.tsx.tmp
cp src/app/components/views/ContactView.tsx src/app/components/views/ContactView.tsx.tmp

# Replace SuccessModal usage in ProfileView.tsx
awk '
/<SuccessModal/,/\/>/ {
  if ($0 ~ /<SuccessModal/) {
    print "      <StandardModal"
    print "        isOpen={showSuccessModal}"
    print "        onClose={() => setShowSuccessModal(false)}"
    print "        title=\"All set - new friend saved!\""
    print "        subtitle=\"Shoot them a quick text before you forget\""
    print "        primaryButtonText=\"Say hey 👋\""
    print "        onPrimaryButtonClick={handleMessageContact}"
    print "        secondaryButtonText=\"Maybe later\""
    print "        variant=\"success\""
    print "      />"
    next
  }
  if ($0 ~ /\/>/) next
}
{ print }
' src/app/components/views/ProfileView.tsx.tmp > src/app/components/views/ProfileView.tsx

# Replace PWAInstallModal usage in ProfileView.tsx
awk '
/<PWAInstallModal/,/\/>/ {
  if ($0 ~ /<PWAInstallModal/) {
    print "      <StandardModal"
    print "        isOpen={showIOSModal}"
    print "        onClose={closeIOSModal}"
    print "        title=\"Nekt in a tap\""
    print "        subtitle=\"Tap the share icon, then select &quot;Add to Home Screen&quot;\""
    print "        primaryButtonText=\"I&apos;ll do that right now!\""
    print "        onPrimaryButtonClick={() => {"
    print "          console.log('\''📱 PWA install modal button clicked'\'');"
    print "          closeIOSModal();"
    print "        }}"
    print "        variant=\"info\""
    print "      />"
    next
  }
  if ($0 ~ /\/>/) next
}
{ print }
' src/app/components/views/ProfileView.tsx > src/app/components/views/ProfileView.tsx.new && mv src/app/components/views/ProfileView.tsx.new src/app/components/views/ProfileView.tsx

echo "ProfileView modals replaced"
