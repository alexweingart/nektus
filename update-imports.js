const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'src/app/page.tsx',
  'src/app/edit/page.tsx',
  'src/app/connect/page.tsx',
  'src/app/components/ProfileSetup.tsx',
  'src/app/components/EditProfile.tsx',
  'src/app/components/ProfileView.tsx',
];

// Update loading-spinner imports to LoadingSpinner
filesToUpdate.forEach(filePath => {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    let content = fs.readFileSync(fullPath, 'utf8');
    const updatedContent = content.replace(
      /from ['"].*\/loading-spinner['"]/g,
      match => match.replace('loading-spinner', 'LoadingSpinner')
    );
    
    if (content !== updatedContent) {
      fs.writeFileSync(fullPath, updatedContent, 'utf8');
      console.log(`Updated imports in ${filePath}`);
    }
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error);
  }
});

console.log('Import updates complete!');
