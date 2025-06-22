BEGIN { in_success_modal = 0; in_pwa_modal = 0; in_upsell_modal = 0; modal_depth = 0; }

# Track modal depth
/<SuccessModal/ { in_success_modal = 1; modal_depth = 1; }
/<PWAInstallModal/ { in_pwa_modal = 1; modal_depth = 1; }
/<ContactWriteUpsellModal/ { in_upsell_modal = 1; modal_depth = 1; }
/{/ { if (in_success_modal || in_pwa_modal || in_upsell_modal) modal_depth++; }
/}/ { if (in_success_modal || in_pwa_modal || in_upsell_modal) modal_depth--; }

# Replace SuccessModal in ProfileView
in_success_modal && modal_depth == 1 && /\/>/ {
  print "      <StandardModal";
  print "        isOpen={showSuccessModal}";
  print "        onClose={() => setShowSuccessModal(false)}";
  print "        title=\"All set - new friend saved!\"";
  print "        subtitle=\"Shoot them a quick text before you forget\"";
  print "        primaryButtonText=\"Say hey 👋\"";
  print "        onPrimaryButtonClick={handleMessageContact}";
  print "        secondaryButtonText=\"Maybe later\"";
  print "        variant=\"success\"";
  print "      />";
  in_success_modal = 0;
  next;
}

# Replace PWAInstallModal in ProfileView
in_pwa_modal && modal_depth == 1 && /\/>/ {
  print "      <StandardModal";
  print "        isOpen={showIOSModal}";
  print "        onClose={closeIOSModal}";
  print "        title=\"Nekt in a tap\"";
  print "        subtitle=\"Tap the share icon, then select &quot;Add to Home Screen&quot;\"";
  print "        primaryButtonText=\"I&apos;ll do that right now!\"";
  print "        onPrimaryButtonClick={() => {";
  print "          console.log('\''📱 PWA install modal button clicked'\'');";
  print "          closeIOSModal();";
  print "        }}";
  print "        variant=\"info\"";
  print "      />";
  in_pwa_modal = 0;
  next;
}

# Replace ContactWriteUpsellModal in ContactView
in_upsell_modal && modal_depth == 1 && /\/>/ {
  print "      <StandardModal";
  print "        isOpen={showUpsellModal}";
  print "        onClose={dismissUpsellModal}";
  print "        title=\"Whoops - contact not fully saved\"";
  print "        subtitle=\"You need to let us save contacts to Google to easily text your new friend!\"";
  print "        primaryButtonText=\"OK! I&apos;ll do that\"";
  print "        onPrimaryButtonClick={handleUpsellAccept}";
  print "        secondaryButtonText=\"Nah\"";
  print "        onSecondaryButtonClick={handleUpsellDecline}";
  print "        variant=\"upsell\"";
  print "      />";
  in_upsell_modal = 0;
  next;
}

# Skip lines that are part of the modal we're replacing
in_success_modal || in_pwa_modal || in_upsell_modal { next; }

# Print all other lines
{ print; }
