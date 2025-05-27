'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../context/UserContext';
import { BluetoothConnector, getUserId, detectBump, simulateConnection } from '../utils/bluetooth';
import ProfileCard from './ProfileCard';

enum ConnectionState {
  WAITING,
  CONNECTING,
  REQUEST_RECEIVED,
  CONNECTION_FAILED,
  SUCCESS
}

interface ContactRequest {
  userId: string;
  name: string;
  // Contact data will be redefined when we implement the connection flow
  contactData: any;
}

const ConnectionScreen: React.FC = () => {
  const router = useRouter();
  const { userData } = useUser();
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.WAITING);
  const [isLoading, setIsLoading] = useState(false);
  const [contactRequest, setContactRequest] = useState<ContactRequest | null>(null);
  const [bluetoothSupported, setBluetoothSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize bluetooth connector
  useEffect(() => {
    const connector = new BluetoothConnector(
      (connected) => {
        if (!connected) {
          setConnectionState(ConnectionState.CONNECTION_FAILED);
          setError('Failed to connect. Please try again.');
        }
      },
      (data) => {
        // Received contact data from another user
        setContactRequest({
          userId: data.userId,
          name: data.name,
          contactData: data
        });
        setConnectionState(ConnectionState.REQUEST_RECEIVED);
      }
    );

    // Check if Bluetooth is supported
    if (!connector.isSupported()) {
      setBluetoothSupported(false);
      setError('Web Bluetooth is not supported in this browser. Try Chrome on Android or use simulation mode.');
    }

    // Setup bump detection
    const cleanupBumpDetection = detectBump(() => {
      if (connectionState === ConnectionState.WAITING) {
        handleStartConnection();
      }
    });

    return () => {
      cleanupBumpDetection();
    };
  }, [connectionState]);

  const handleStartConnection = async () => {
    setIsLoading(true);
    setConnectionState(ConnectionState.CONNECTING);
    
    try {
      if (!bluetoothSupported) {
        // Use simulation mode if Bluetooth not supported
        simulateConnection(
          (connected) => {
            if (!connected) {
              setConnectionState(ConnectionState.CONNECTION_FAILED);
              setError('Simulation failed. Please try again.');
            }
          },
          (data) => {
            setContactRequest({
              userId: data.userId,
              name: data.name,
              contactData: data
            });
            setConnectionState(ConnectionState.REQUEST_RECEIVED);
          }
        );
      } else {
        const connector = new BluetoothConnector();
        const connected = await connector.connect();
        
        if (!connected) {
          setConnectionState(ConnectionState.CONNECTION_FAILED);
          setError('Failed to connect. Please try again.');
          setIsLoading(false);
          return;
        }
        
        // Send our contact info
        const contactData = {
          userId: getUserId(),
          name: 'User',
          contactData: {
            platform: 'unknown',
            username: 'user'
          }
        };
        
        await connector.sendData(contactData);
      }
    } catch (err) {
      console.error('Connection error:', err);
      setConnectionState(ConnectionState.CONNECTION_FAILED);
      setError('An error occurred during connection. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptRequest = () => {
    // Navigate to success screen with contact data
    if (contactRequest) {
      router.push(`/success?name=${encodeURIComponent(contactRequest.name)}`);
    }
  };

  const handleReject = () => {
    // Reset the connection state
    setConnectionState(ConnectionState.WAITING);
    setContactRequest(null);
  };

  const handleTryAgain = () => {
    setConnectionState(ConnectionState.WAITING);
    setError(null);
  };

  // Render loading spinner
  const renderLoadingSpinner = () => (
    <div className="flex justify-center my-8">
      <div className="spinner">
        <div className="relative">
          <div className="w-12 h-12 rounded-full absolute border-4 border-solid border-gray-200"></div>
          <div className="w-12 h-12 rounded-full animate-spin absolute border-4 border-solid border-red-600 border-t-transparent"></div>
        </div>
      </div>
    </div>
  );

  // Render based on connection state
  const renderConnectionContent = () => {
    switch (connectionState) {
      case ConnectionState.WAITING:
        return (
          <div className="text-center p-6">
            <h2 className="text-xl font-bold mb-4">Ready to Connect</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Bump phones with someone to exchange contact info, or tap the button below.
            </p>
            <button 
              onClick={handleStartConnection} 
              className="btn-primary w-full py-3"
            >
              Start Connection
            </button>
          </div>
        );
        
      case ConnectionState.CONNECTING:
        return (
          <div className="text-center p-6">
            <h2 className="text-xl font-bold mb-4">Connecting...</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Looking for nearby devices
            </p>
            {renderLoadingSpinner()}
          </div>
        );
        
      case ConnectionState.REQUEST_RECEIVED:
        return contactRequest ? (
          <div className="p-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold">Nice! {contactRequest.name} wants to Nekt with you.</h2>
            </div>
            
            <div className="mb-6">
              <ProfileCard 
                userData={{
                  name: contactRequest.contactData.name,
                  internationalPhone: contactRequest.contactData.internationalPhone,
                  email: contactRequest.contactData.email,
                  title: contactRequest.contactData.title,
                  company: contactRequest.contactData.company,
                  location: contactRequest.contactData.location,
                  socialProfiles: (contactRequest.contactData.socialProfiles || []).map((p: { platform: string; username: string }) => ({
                    platform: p.platform,
                    username: p.username,
                    shareEnabled: true
                  }))
                }}
                onNektClick={handleAcceptRequest}
              />
            </div>
            
            <div className="flex space-x-4">
              <button 
                onClick={handleReject}
                className="btn-secondary flex-1"
              >
                Decline
              </button>
              <button 
                onClick={handleAcceptRequest}
                className="btn-primary flex-1"
              >
                Nekt Us
              </button>
            </div>
          </div>
        ) : null;
        
      case ConnectionState.CONNECTION_FAILED:
        return (
          <div className="text-center p-6">
            <div className="text-red-600 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-4">Connection Failed</h2>
            {error && <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>}
            <button 
              onClick={handleTryAgain}
              className="btn-primary w-full"
            >
              Try Again
            </button>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
      <div className="flex-1 container mx-auto max-w-md p-4">
        {!bluetoothSupported && (
          <div className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 p-3 rounded-lg mb-4 text-sm">
            Web Bluetooth is not supported in this browser. Using simulation mode instead.
          </div>
        )}
        
        {renderConnectionContent()}
      </div>
    </div>
  );
};

export default ConnectionScreen;
