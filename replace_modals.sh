#!/bin/bash

# Replace SuccessModal in ProfileView.tsx
sed -i '' '/SuccessModal/,/)/c\
      <StandardModal\
        isOpen={showSuccessModal}\
        onClose={() => setShowSuccessModal(false)}\
        title="All set - new friend saved!"\
        subtitle="Shoot them a quick text before you forget"\
        primaryButtonText="Say hey 👋"\
        onPrimaryButtonClick={handleMessageContact}\
        secondaryButtonText="Maybe later"\
        variant="success"\
      />' src/app/components/views/ProfileView.tsx

# Replace PWAInstallModal in ProfileView.tsx
sed -i '' '/PWAInstallModal/,/)/c\
      <StandardModal\
        isOpen={showIOSModal}\
        onClose={closeIOSModal}\
        title="Nekt in a tap"\
        subtitle="Tap the share icon, then select &quot;Add to Home Screen&quot;"\
        primaryButtonText="I&apos;ll do that right now!"\
        onPrimaryButtonClick={() => {\
          console.log('\''📱 PWA install modal button clicked'\'');\
          closeIOSModal();\
        }}\
        variant="info"\
      />' src/app/components/views/ProfileView.tsx

echo "ProfileView modals replaced"
