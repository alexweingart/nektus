#!/bin/bash

# Update ProfileView.tsx
sed -i '' 's/import { SuccessModal } from '\''\.\.\/ui\/SuccessModal'\'';/import { StandardModal } from '\''\.\.\/ui\/StandardModal'\'';/' src/app/components/views/ProfileView.tsx
sed -i '' 's/import { PWAInstallModal } from '\''\.\.\/ui\/PWAInstallModal'\'';//' src/app/components/views/ProfileView.tsx

# Update ContactView.tsx
sed -i '' 's/import { ContactWriteUpsellModal } from '\''\.\.\/ui\/ContactWriteUpsellModal'\'';/import { StandardModal } from '\''\.\.\/ui\/StandardModal'\'';/' src/app/components/views/ContactView.tsx
sed -i '' 's/import { SuccessModal } from '\''\.\.\/ui\/SuccessModal'\'';//' src/app/components/views/ContactView.tsx

echo "Import statements updated"
