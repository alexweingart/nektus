/**
 * Modal component for upselling contact writing permissions
 * Shows when Google Contacts save fails or for iOS first-time users
 */

import React, { useEffect, useState } from 'react';
import { X, UserPlus } from 'lucide-react';

interface ContactWriteUpsellModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  onDecline: () => void;
}

export const ContactWriteUpsellModal: React.FC<ContactWriteUpsellModalProps> = ({
  isOpen,
  onClose,
  onAccept,
  onDecline
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Small delay to ensure the element is rendered before animating
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
      // Wait for animation to complete before removing from DOM
      setTimeout(() => setShouldRender(false), 200);
    }
  }, [isOpen]);

  if (!shouldRender) return null;

  const handleAccept = () => {
    onAccept();
    onClose();
  };

  const handleDecline = () => {
    onDecline();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />
      
      {/* Modal */}
      <div
        className={`relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden transition-all duration-200 ${
          isVisible 
            ? 'opacity-100 scale-100 translate-y-0' 
            : 'opacity-0 scale-95 translate-y-5'
        }`}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-r from-red-500 to-orange-600 p-6 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/20 transition-colors"
          >
            <X size={20} />
          </button>
          
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-full">
              <UserPlus size={24} />
            </div>
            <div>
              <h3 className="text-xl font-semibold">Whoops - contact not fully saved</h3>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-gray-600">
                You need to let us save contacts to Google to easily text your new friend!
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3 mt-6">
            <button
              onClick={handleDecline}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Nah
            </button>
            <button
              onClick={handleAccept}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-orange-600 text-white rounded-lg hover:from-red-600 hover:to-orange-700 transition-colors font-medium"
            >
              OK! I'll do that
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
