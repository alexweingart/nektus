'use client';

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  // Helper function to check if PWA is installed using getInstalledRelatedApps
  const checkPWAInstalled = async (): Promise<boolean> => {
    try {
      if ('getInstalledRelatedApps' in navigator) {
        const relatedApps = await (navigator as unknown as { getInstalledRelatedApps: () => Promise<Array<{ platform: string; url?: string }>> }).getInstalledRelatedApps();
        return relatedApps.some((app: { platform: string; url?: string }) => 
          app.platform === 'webapp' && app.url && app.url.endsWith('/manifest.json')
        );
      }
    } catch (error) {
      console.log('PWA: getInstalledRelatedApps not available or failed:', error);
    }
    return false;
  };

  useEffect(() => {
    const checkInstallation = async () => {
      // Check if app is already installed (running in standalone mode)
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isInWebAppiOS = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      
      // Check if PWA is installed via getInstalledRelatedApps (Chrome Android)
      const isPWAInstalled = await checkPWAInstalled();
      
      const isInstalled = isStandalone || isInWebAppiOS || isPWAInstalled;
      
      setIsInstalled(isInstalled);
      
      // If already installed, don't show the button
      if (isInstalled) {
        setIsInstallable(false);
        return;
      }

      // Show button for all platforms when not installed
      setIsInstallable(true);
    };

    checkInstallation();

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Button is already visible, so no need to set isInstallable again
    };

    const handleAppInstalled = async () => {
      console.log('PWA: app installed');
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installPWA = async () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
      // For iOS Safari, show the custom modal
      setShowIOSModal(true);
      return;
    }

    // For Android/other platforms
    if (!deferredPrompt) {
      console.log('PWA: No deferred prompt available - Chrome hasn\'t fired the beforeinstallprompt event yet');
      // This shouldn't happen often now that we properly detect installation
      // But if it does, we could show instructions or just log it
      return;
    }

    try {
      console.log('PWA: Showing install prompt');
      // Show the install prompt
      await deferredPrompt.prompt();
      
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the PWA install prompt');
      } else {
        console.log('User dismissed the PWA install prompt');
      }
      
      // Clear the deferredPrompt for next time
      setDeferredPrompt(null);
      setIsInstallable(false);
    } catch (error) {
      console.error('Error installing PWA:', error);
    }
  };

  const closeIOSModal = () => {
    setShowIOSModal(false);
  };

  return {
    isInstallable: isInstallable && !isInstalled,
    isInstalled,
    installPWA,
    showIOSModal,
    closeIOSModal
  };
};
