import React, { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import Image from 'next/image';

type GoogleUser = {
  name: string;
  email: string;
  picture: string;
};

type SocialProfile = {
  platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'snapchat' | 'whatsapp' | 'telegram';
  username: string;
  shareEnabled: boolean;
};

export default function ProfileSetup() {
  const { data: session, status } = useSession();
  const [step, setStep] = useState(1);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);
  const [phone, setPhone] = useState('');
  const [socialProfiles, setSocialProfiles] = useState<SocialProfile[]>([]);
  const [currentPlatform, setCurrentPlatform] = useState<SocialProfile['platform']>('instagram');
  const [currentUsername, setCurrentUsername] = useState('');
  const [formattedPhone, setFormattedPhone] = useState('');

  // Styles for various components
  const googleButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '12px 20px',
    backgroundColor: 'white',
    color: '#444',
    border: '1px solid #ddd',
    borderRadius: '100px',
    fontSize: '16px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.3s',
  };

  const containerStyle = {
    maxWidth: '480px',
    margin: '0 auto',
    padding: '24px',
    color: 'var(--text)',
  };

  const headerStyle = {
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '48px',
    color: 'var(--primary)',
    textAlign: 'center' as const,
  };

  const cardStyle = {
    backgroundColor: 'var(--card-bg)',
    borderRadius: '16px',
    padding: '32px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    marginBottom: '24px',
  };

  const inputStyle = {
    display: 'block',
    width: '100%',
    padding: '12px 16px',
    marginBottom: '24px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--input-bg)',
    color: 'var(--text)',
    fontSize: '16px',
  };

  const buttonStyle = {
    display: 'block',
    width: '100%',
    padding: '14px 20px',
    backgroundColor: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: '100px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background-color 0.3s',
  };

  const stepIndicatorStyle = {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '32px',
  };

  const stepDotStyle = {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    margin: '0 6px',
    backgroundColor: 'var(--border)',
  };

  const activeStepDotStyle = {
    ...stepDotStyle,
    backgroundColor: 'var(--primary)',
    transform: 'scale(1.2)',
  };

  // Handle session changes
  useEffect(() => {
    if (status === 'authenticated' && session.user) {
      // User is signed in with Google, extract the profile data
      setGoogleUser({
        name: session.user.name || '',
        email: session.user.email || '',
        picture: session.user.image || '',
      });
      
      // Advance to the next step
      setStep(2);
      setIsSigningIn(false);
    }
  }, [status, session]);
  
  // Google Sign-in handler with direct configuration to match Google Console settings
  const handleGoogleSignIn = () => {
    // Show loading state
    setIsSigningIn(true);
    
    try {
      // Clear any potential error state
      console.log("Initiating Google sign-in");
      
      // Use minimal signIn call - the configuration in [...nextauth]/route.ts 
      // handles the exact redirect URI matching
      signIn('google');
    } catch (error) {
      console.error("Error during sign in:", error);
      setIsSigningIn(false);
    }
  };
  
  // Handle phone number changes
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value.replace(/\D/g, '');
    setPhone(input);
    
    // Format phone number as (XXX) XXX-XXXX
    if (input.length > 0) {
      const areaCode = input.substring(0, 3);
      const middle = input.substring(3, 6);
      const last = input.substring(6, 10);
      
      if (input.length <= 3) {
        setFormattedPhone(`(${areaCode}`);
      } else if (input.length <= 6) {
        setFormattedPhone(`(${areaCode}) ${middle}`);
      } else {
        setFormattedPhone(`(${areaCode}) ${middle}-${last}`);
      }
    } else {
      setFormattedPhone('');
    }
  };
  
  // Handle proceeding to social profiles
  const handlePhoneSubmit = () => {
    if (phone.length >= 10) {
      setStep(3);
    }
  };
  
  // Handle adding a social profile
  const handleAddSocialProfile = () => {
    if (currentUsername) {
      setSocialProfiles([
        ...socialProfiles,
        {
          platform: currentPlatform,
          username: currentUsername,
          shareEnabled: true,
        },
      ]);
      setCurrentUsername('');
    }
  };
  
  // Handle completing the profile setup
  const handleCompleteSetup = () => {
    console.log('Profile setup complete:', {
      user: googleUser,
      phone,
      socialProfiles,
    });
    
    // In a real app, you would save this data to a database
    // and redirect the user to the next step
    alert('Profile setup complete! You can now close this setup.');
  };
  
  return (
    <div style={containerStyle}>
      <h1 style={headerStyle}>Create Your Profile</h1>
      
      <div style={stepIndicatorStyle}>
        <div style={step === 1 ? activeStepDotStyle : stepDotStyle}></div>
        <div style={step === 2 ? activeStepDotStyle : stepDotStyle}></div>
        <div style={step === 3 ? activeStepDotStyle : stepDotStyle}></div>
      </div>
      
      {step === 1 && (
        <>
          <div style={cardStyle}>
            <h2 style={{ marginBottom: '24px', textAlign: 'center' }}>Sign in with Google to get started</h2>
            
            <button
              onClick={handleGoogleSignIn}
              style={{
                ...googleButtonStyle,
                backgroundColor: isSigningIn ? '#cccccc' : 'white',
                cursor: isSigningIn ? 'not-allowed' : 'pointer'
              }}
              disabled={isSigningIn || status === 'loading'}
            >
              {isSigningIn ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div 
                    style={{ 
                      width: '20px', 
                      height: '20px', 
                      borderRadius: '50%', 
                      border: '2px solid #4caf50',
                      borderTopColor: 'transparent',
                      marginRight: '16px',
                      animation: 'spin 1s linear infinite'
                    }}
                  />
                  Signing in...
                </div>
              ) : (
                <>
                  <Image 
                    src="/icons/google.svg" 
                    alt="Google" 
                    width={24} 
                    height={24}
                    style={{ marginRight: '16px' }}
                  />
                  Sign in with Google
                </>
              )}
            </button>
            
            {status === 'authenticated' && (
              <p style={{ marginTop: '12px', fontSize: '14px', textAlign: 'center' }}>
                Redirecting to profile setup...
              </p>
            )}
            
            <p style={{ marginTop: '20px', fontSize: '14px', color: 'var(--secondary-dark)', textAlign: 'center' }}>
              Google account required for Nekt.Us
            </p>
          </div>
        </>
      )}
      
      {step === 2 && googleUser && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
            <Image 
              src={googleUser.picture} 
              alt={googleUser.name} 
              width={60} 
              height={60}
              style={{ borderRadius: '50%', marginRight: '16px' }}
            />
            <div>
              <h2 style={{ margin: '0 0 4px 0' }}>{googleUser.name}</h2>
              <p style={{ margin: 0, color: 'var(--secondary)', fontSize: '14px' }}>{googleUser.email}</p>
            </div>
          </div>
          
          <h3 style={{ marginBottom: '16px' }}>Enter your phone number</h3>
          <input
            type="tel"
            value={formattedPhone}
            onChange={handlePhoneChange}
            placeholder="(555) 555-5555"
            style={inputStyle}
            maxLength={14}
          />
          
          <button 
            onClick={handlePhoneSubmit}
            style={{
              ...buttonStyle,
              opacity: phone.length < 10 ? 0.7 : 1,
              cursor: phone.length < 10 ? 'not-allowed' : 'pointer',
            }}
            disabled={phone.length < 10}
          >
            Continue
          </button>
        </div>
      )}
      
      {step === 3 && googleUser && (
        <div style={cardStyle}>
          <h3 style={{ marginBottom: '24px' }}>Add your social profiles</h3>
          
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>Platform</label>
            <select
              value={currentPlatform}
              onChange={(e) => setCurrentPlatform(e.target.value as SocialProfile['platform'])}
              style={inputStyle}
            >
              <option value="instagram">Instagram</option>
              <option value="twitter">Twitter</option>
              <option value="linkedin">LinkedIn</option>
              <option value="facebook">Facebook</option>
              <option value="snapchat">Snapchat</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="telegram">Telegram</option>
            </select>
            
            <label style={{ display: 'block', marginBottom: '8px' }}>Username</label>
            <div style={{ display: 'flex', marginBottom: '16px' }}>
              <input
                type="text"
                value={currentUsername}
                onChange={(e) => setCurrentUsername(e.target.value)}
                placeholder={`Your ${currentPlatform} username`}
                style={{ ...inputStyle, marginBottom: 0, borderRadius: '8px 0 0 8px' }}
              />
              <button
                onClick={handleAddSocialProfile}
                style={{
                  padding: '12px 16px',
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0 8px 8px 0',
                  cursor: currentUsername ? 'pointer' : 'not-allowed',
                  opacity: currentUsername ? 1 : 0.7,
                }}
                disabled={!currentUsername}
              >
                Add
              </button>
            </div>
          </div>
          
          {socialProfiles.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ marginBottom: '12px' }}>Your profiles:</h4>
              {socialProfiles.map((profile, index) => (
                <div 
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    backgroundColor: 'var(--input-bg)',
                    borderRadius: '8px',
                    marginBottom: '8px',
                  }}
                >
                  <div>
                    <strong style={{ textTransform: 'capitalize' }}>{profile.platform}:</strong> {profile.username}
                  </div>
                  <button
                    onClick={() => {
                      const updatedProfiles = [...socialProfiles];
                      updatedProfiles.splice(index, 1);
                      setSocialProfiles(updatedProfiles);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--danger)',
                      cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <button 
            onClick={handleCompleteSetup}
            style={buttonStyle}
          >
            Complete Setup
          </button>
        </div>
      )}
      
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        :root {
          --primary: #4caf50;
          --secondary: #666666;
          --secondary-dark: #888888;
          --text: #333333;
          --card-bg: #ffffff;
          --border: #dddddd;
          --input-bg: #f5f5f5;
          --danger: #e53935;
        }
        
        body {
          background-color: #f0f2f5;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          margin: 0;
          padding: 0;
        }
      `}</style>
    </div>
  );
}
