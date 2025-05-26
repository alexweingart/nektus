#!/bin/bash
# local-vercel-check.sh - Run pre-deployment checks locally before pushing to git

echo "🔍 Running local Vercel deployment checks for Nekt.Us..."

# 1. Run existing pre-deploy checks first
echo "✅ Running pre-deployment validation script..."
node pre-deploy-check.js
if [ $? -ne 0 ]; then
  echo "❌ Pre-deploy checks failed - fix issues before pushing to git"
  exit 1
fi

# 2. Run type checking
echo "✅ Running TypeScript checks..."
npx tsc --noEmit
if [ $? -ne 0 ]; then
  echo "❌ TypeScript checks failed - fix type issues before pushing to git"
  exit 1
fi

# 3. Run local build test
echo "✅ Building project locally..."
npm run build
if [ $? -ne 0 ]; then
  echo "❌ Build failed - fix build issues before pushing to git"
  exit 1
fi

# 4. Run Vercel build simulation
echo "✅ Running Vercel build simulation..."
npx vercel build --local-config
if [ $? -ne 0 ]; then
  echo "❌ Vercel build simulation failed - fix build issues before pushing to git"
  exit 1
fi

echo "✅ All checks passed! Safe to push to git."
echo "   Note: These checks help catch issues but cannot guarantee Vercel deployment will succeed."
echo "   Some environment-specific configurations may still cause differences."
