'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { FaBluetoothB, FaExchangeAlt, FaCheckCircle, FaTimesCircle, FaPhoneAlt, FaEnvelope, FaFacebook, FaInstagram, FaTwitter, FaSnapchat, FaLinkedin, FaWhatsapp, FaTelegram } from 'react-icons/fa';
import { BluetoothConnector, ContactExchange as ContactData, detectBump, simulateConnection, getUserId } from '../utils/bluetooth';
import { useProfile } from '../context/ProfileContext';

const BUMP_SENSITIVITY = 12; // Lower values make it more sensitive

export default function ContactExchange() {
  // Function to get the appropriate icon for a social platform
  const getSocialIcon = (platform: string) => {
    switch (platform) {
      case 'facebook':
        return <FaFacebook style={{ color: '#3b5998' }} />;
      case 'instagram':
        return <FaInstagram style={{ color: '#e4405f' }} />;
      case 'twitter':
        return <FaTwitter style={{ color: '#1da1f2' }} />;
      case 'snapchat':
        return <FaSnapchat style={{ color: '#fffc00' }} />;
      case 'linkedin':
        return <FaLinkedin style={{ color: '#0077b5' }} />;
      case 'whatsapp':
        return <FaWhatsapp style={{ color: '#25d366' }} />;
      case 'telegram':
        return <FaTelegram style={{ color: '#0088cc' }} />;
      default:
        return null;
    }
  };

  const { data: session } = useSession();
  const { profile } = useProfile();
  const router = useRouter();

  const [isScanning, setIsScanning] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [bumpDetected, setBumpDetected] = useState(false);
  const [exchangeComplete, setExchangeComplete] = useState(false);
  const [receivedContact, setReceivedContact] = useState<ContactData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bluetoothSupported, setBluetoothSupported] = useState(true);
  const [bluetoothConnector, setBluetoothConnector] = useState<BluetoothConnector | null>(null);
  const [bumpCount, setBumpCount] = useState(0); // Used to visualize bump progress
  const [showBumpInstructions, setShowBumpInstructions] = useState(false);

  // Handle connection status change
  const handleConnectionChange = useCallback((connected: boolean) => {
    setIsConnected(connected);
    if (connected) {
      setIsScanning(false);
      setShowBumpInstructions(true);
    } else {
      setShowBumpInstructions(false);
    }
  }, []);

  // Handle received contact data
  const handleReceivedData = useCallback((data: ContactData) => {
    setReceivedContact(data);
    setExchangeComplete(true);
    // Navigate to success page after a short delay
    setTimeout(() => {
      router.push('/success');
    }, 3000);
  }, [router]);

  // Initialize Bluetooth connector
  useEffect(() => {
    const connector = new BluetoothConnector(handleConnectionChange, handleReceivedData);
    setBluetoothConnector(connector);
    setBluetoothSupported(connector.isSupported());

    return () => {
      if (connector) {
        connector.disconnect();
      }
    };
  }, [handleConnectionChange, handleReceivedData]);

  // Start bump detection when connected
  useEffect(() => {
    let cleanupBumpDetection: (() => void) | null = null;
    
    if (isConnected && !exchangeComplete) {
      setBumpDetected(false);
      setBumpCount(0);
      
      // Set up bump detection
      cleanupBumpDetection = detectBump(() => {
        // Increment bump count
        setBumpCount(prev => {
          const newCount = prev + 1;
          
          // Consider exchange complete after 3 bumps
          if (newCount >= 3 && !bumpDetected) {
            setBumpDetected(true);
            sendContactData();
          }
          
          return newCount;
        });
      }, BUMP_SENSITIVITY);
    }
    
    return () => {
      if (cleanupBumpDetection) {
        cleanupBumpDetection();
      }
    };
  }, [isConnected, exchangeComplete, bumpDetected]);

  // Function to send contact data via Bluetooth
  const sendContactData = async () => {
    if (!bluetoothConnector || !profile) return;
    
    try {
      // Format contact data from profile
      const contactData: ContactData = {
        userId: profile.userId,
        name: profile.name,
        email: profile.email,
        internationalPhone: profile.internationalPhone || '',
        socialProfiles: profile.socialProfiles || []
      };
      
      // Send the data
      const success = await bluetoothConnector.sendData(contactData);
      
      if (!success) {
        throw new Error('Failed to send contact data');
      }
    } catch (error) {
      setErrorMessage('Error sending contact data. Try again?');
      setBumpDetected(false);
    }
  };

  // Function to start Bluetooth scanning
  const startScanning = async () => {
    setIsScanning(true);
    setErrorMessage(null);
    
    try {
      if (bluetoothConnector) {
        const connected = await bluetoothConnector.connect();
        if (!connected) {
          throw new Error('Failed to connect');
        }
      }
    } catch (error) {
      setErrorMessage('Connection failed. Please try again.');
      setIsScanning(false);
    }
  };

  // Function to disconnect from Bluetooth
  const disconnect = () => {
    if (bluetoothConnector) {
      bluetoothConnector.disconnect();
    }
    setIsConnected(false);
    setIsScanning(false);
    setBumpDetected(false);
    setExchangeComplete(false);
    setReceivedContact(null);
    setErrorMessage(null);
    setBumpCount(0);
    setShowBumpInstructions(false);
  };

  // For testing in environments without Bluetooth
  const startSimulation = async () => {
    setIsScanning(true);
    setErrorMessage(null);
    
    await simulateConnection(handleConnectionChange, handleReceivedData);
  };

  // Card styles
  const cardStyle = {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '16px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
  };

  // Button styles
  const buttonStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '14px 20px',
    backgroundColor: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: '100px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: '16px',
  };

  // Disabled button style
  const disabledButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#cccccc',
    cursor: 'not-allowed',
  };

  // Show a loader when scanning
  const renderScanning = () => (
    <div style={{ textAlign: 'center', marginTop: '32px' }}>
      <div
        style={{
          width: '40px',
          height: '40px',
          border: '4px solid rgba(76, 175, 80, 0.3)',
          borderTop: '4px solid var(--primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px'
        }}
      />
      <p>Scanning for nearby devices...</p>
      <button
        onClick={disconnect}
        style={{
          ...buttonStyle,
          backgroundColor: 'var(--danger)',
          marginTop: '24px',
        }}
      >
        Cancel
      </button>
    </div>
  );

  // Render the bump instructions
  const renderBumpInstructions = () => (
    <div style={{ textAlign: 'center', marginTop: '32px' }}>
      <div style={{ 
        position: 'relative', 
        width: '120px', 
        height: '120px',
        margin: '0 auto 24px',
      }}>
        <div style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          animation: `pulse ${bumpDetected ? '0.5s' : '1.5s'} infinite ease-in-out`,
        }} />
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          backgroundColor: 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '36px',
        }}>
          <FaPhoneAlt />
        </div>
      </div>
      
      <h3 style={{ marginBottom: '8px' }}>
        {bumpDetected ? 'Bump detected!' : 'Bump phones together'}
      </h3>
      
      <p style={{ marginBottom: '16px', color: '#666' }}>
        {bumpDetected
          ? 'Exchanging contact information...'
          : 'Hold both phones and gently bump them together'
        }
      </p>
      
      {/* Bump progress indicator */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        gap: '8px',
        marginBottom: '24px' 
      }}>
        {[1, 2, 3].map(num => (
          <div
            key={num}
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: bumpCount >= num ? 'var(--primary)' : '#ddd',
              transition: 'background-color 0.3s'
            }}
          />
        ))}
      </div>
      
      <button
        onClick={disconnect}
        style={{
          ...buttonStyle,
          backgroundColor: 'var(--danger)',
        }}
      >
        Cancel
      </button>
    </div>
  );

  // Render the success state
  const renderSuccess = () => (
    <div style={{ textAlign: 'center', marginTop: '32px' }}>
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        backgroundColor: 'var(--primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '40px',
        margin: '0 auto 16px'
      }}>
        <FaCheckCircle />
      </div>
      
      <h3 style={{ marginBottom: '8px' }}>Contact Exchanged!</h3>
      
      {receivedContact && (
        <div style={cardStyle}>
          <h4 style={{ marginBottom: '8px' }}>{receivedContact.name}</h4>
          {receivedContact.internationalPhone && (
            <p style={{ marginBottom: '4px', color: '#666' }}>
              {receivedContact.internationalPhone}
            </p>
          )}
          <p style={{ marginBottom: '16px', color: '#666' }}>
            {receivedContact.email}
          </p>
          
          {receivedContact.socialProfiles && receivedContact.socialProfiles.length > 0 && (
            <div>
              <h5 style={{ marginBottom: '8px', color: '#888' }}>Social Profiles</h5>
              {receivedContact.socialProfiles.map((profile, index) => (
                <div key={index} style={{ marginBottom: '4px' }}>
                  <span style={{ textTransform: 'capitalize', marginRight: '4px' }}>
                    {profile.platform}:
                  </span>
                  <span>{profile.username}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      <p style={{ marginBottom: '24px', color: '#666' }}>
        Redirecting to success page...
      </p>
    </div>
  );

  // Show the profile and a message if Bluetooth isn't supported
  if (!bluetoothSupported) {
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px' }}>
        {/* Profile Card */}
        {profile && (
          <div style={cardStyle}>
            <h2 style={{ textAlign: 'center', marginBottom: '16px' }}>Your Profile</h2>
            <div style={{ marginBottom: '24px' }}>
              {session?.user?.image && (
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden', margin: '0 auto 16px' }}>
                  <img 
                    src={session.user.image} 
                    alt={profile.name} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              )}
              <h3 style={{ textAlign: 'center', marginBottom: '8px' }}>{profile.name}</h3>
              
              <div style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <FaPhoneAlt style={{ marginRight: '8px', color: 'var(--primary)' }} />
                  <span>{profile.internationalPhone}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <FaEnvelope style={{ marginRight: '8px', color: 'var(--primary)' }} />
                  <span>{profile.email}</span>
                </div>
                
                {profile.socialProfiles && profile.socialProfiles.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <h4 style={{ marginBottom: '8px' }}>Social Profiles</h4>
                    {profile.socialProfiles.map((social, index) => (
                      <div key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                        {getSocialIcon(social.platform)}
                        <span style={{ marginLeft: '8px' }}>{social.username}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Bluetooth Not Supported Message */}
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', color: 'var(--danger)' }}>
            <FaTimesCircle size={48} style={{ marginBottom: '16px' }} />
            <h2 style={{ marginBottom: '16px' }}>Bluetooth Not Supported</h2>
            <p style={{ marginBottom: '24px' }}>
              Your browser doesn't support the Web Bluetooth API needed for contact exchange.
            </p>
            <p style={{ marginBottom: '16px' }}>
              Please try using Chrome on Android or macOS for the best experience.
            </p>
            
            <button
              onClick={startSimulation}
              style={{
                ...buttonStyle,
                backgroundColor: '#888',
              }}
            >
              Simulate Contact Exchange
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px' }}>
      <div style={cardStyle}>
        <h2 style={{ textAlign: 'center', marginBottom: '24px' }}>
          Exchange Contacts
        </h2>
        
        {errorMessage && (
          <div style={{
            backgroundColor: 'rgba(244, 67, 54, 0.1)',
            color: 'var(--danger)',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            {errorMessage}
          </div>
        )}
        
        {!isScanning && !isConnected && !exchangeComplete ? (
          <div>
            <p style={{ marginBottom: '24px', textAlign: 'center' }}>
              Connect with someone nearby to exchange contact information via Bluetooth.
            </p>
            
            <button
              onClick={startScanning}
              style={buttonStyle}
              disabled={!profile}
            >
              <FaBluetoothB style={{ marginRight: '8px' }} />
              Find Nearby Devices
            </button>
            
            {!profile && (
              <p style={{ marginTop: '16px', textAlign: 'center', color: 'var(--danger)' }}>
                Please complete your profile setup first.
              </p>
            )}
          </div>
        ) : isScanning && !isConnected ? (
          renderScanning()
        ) : isConnected && !exchangeComplete ? (
          showBumpInstructions && renderBumpInstructions()
        ) : exchangeComplete ? (
          renderSuccess()
        ) : null}
      </div>
      
      {/* Instructions card */}
      {!isScanning && !isConnected && !exchangeComplete && (
        <div style={cardStyle}>
          <h3 style={{ marginBottom: '16px' }}>How It Works</h3>
          <ol style={{ paddingLeft: '24px', marginBottom: '0' }}>
            <li style={{ marginBottom: '8px' }}>
              Tap "Find Nearby Devices" to discover other Nekt.Us users
            </li>
            <li style={{ marginBottom: '8px' }}>
              Select the device you want to connect with
            </li>
            <li style={{ marginBottom: '8px' }}>
              Once connected, bump your phones together to exchange contacts
            </li>
            <li style={{ marginBottom: '0' }}>
              Both users will receive each other's contact information
            </li>
          </ol>
        </div>
      )}
      
      <style jsx global>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.2); opacity: 0.3; }
          100% { transform: scale(1); opacity: 0.7; }
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
