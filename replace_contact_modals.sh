#!/bin/bash

# Replace SuccessModal usage in ContactView.tsx
awk '
/<SuccessModal/,/\/>/ {
  if ($0 ~ /<SuccessModal/) {
    print "      <StandardModal"
    print "        isOpen={showSuccessModal}"
    print "        onClose={handleSuccessModalClose}"
    print "        title=\"Contact Saved! 🎉\""
    print "        subtitle={`${profile.name}'\''s contact has been saved successfully!`}"
    print "        primaryButtonText=\"Say hi 👋\""
    print "        onPrimaryButtonClick={handleSayHi}"
    print "        secondaryButtonText=\"I'\''m done\""
    print "        variant=\"success\""
    print "      />"
    next
  }
  if ($0 ~ /\/>/) next
}
{ print }
' src/app/components/views/ContactView.tsx > src/app/components/views/ContactView.tsx.new && mv src/app/components/views/ContactView.tsx.new src/app/components/views/ContactView.tsx

# Replace ContactWriteUpsellModal usage in ContactView.tsx
awk '
/<ContactWriteUpsellModal/,/\/>/ {
  if ($0 ~ /<ContactWriteUpsellModal/) {
    print "      <StandardModal"
    print "        isOpen={showUpsellModal}"
    print "        onClose={dismissUpsellModal}"
    print "        title=\"Whoops - contact not fully saved\""
    print "        subtitle=\"You need to let us save contacts to Google to easily text your new friend!\""
    print "        primaryButtonText=\"OK! I'\''ll do that\""
    print "        onPrimaryButtonClick={handleUpsellAccept}"
    print "        secondaryButtonText=\"Nah\""
    print "        onSecondaryButtonClick={handleUpsellDecline}"
    print "        variant=\"upsell\""
    print "      />"
    next
  }
  if ($0 ~ /\/>/) next
}
{ print }
' src/app/components/views/ContactView.tsx > src/app/components/views/ContactView.tsx.new && mv src/app/components/views/ContactView.tsx.new src/app/components/views/ContactView.tsx

echo "ContactView modals replaced"
