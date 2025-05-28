'use client';

// Define inline Web Bluetooth API interfaces to avoid TypeScript errors
interface BluetoothRemoteGATTCharacteristic {
  service: BluetoothRemoteGATTService;
  uuid: string;
  properties: any;
  value?: DataView;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  readValue(): Promise<DataView>;
  writeValue(value: BufferSource): Promise<void>;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

interface BluetoothRemoteGATTService {
  device: BluetoothDevice;
  uuid: string;
  isPrimary: boolean;
  getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>;
  getCharacteristics(characteristic?: string): Promise<BluetoothRemoteGATTCharacteristic[]>;
}

interface BluetoothRemoteGATTServer {
  device: BluetoothDevice;
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>;
  getPrimaryServices(service?: string): Promise<BluetoothRemoteGATTService[]>;
}

interface BluetoothDevice {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

// Generate a UUID v4
const generateUUID = (): string => {
  // @ts-ignore - crypto.randomUUID is available in all modern browsers
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    // @ts-ignore
    return crypto.randomUUID();
  }
  // Fallback for older browsers or non-browser environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Store the user ID persistently
export const getOrCreateUserId = (): string => {
  if (typeof window !== 'undefined') {
    // Check if we already have a user ID in local storage
    let userId = localStorage.getItem('nektus_user_id');
    
    // If no user ID exists, generate a new one and store it
    if (!userId) {
      userId = generateUUID();
      localStorage.setItem('nektus_user_id', userId);
    }
    
    // For backward compatibility, also set the old key
    if (!localStorage.getItem('nektus-user-id')) {
      localStorage.setItem('nektus-user-id', userId);
    }
    
    return userId;
  }
  
  // For server-side rendering, return a placeholder
  return 'temp-user-id';
};

// Alias for backward compatibility
export const getUserId = getOrCreateUserId;

// Generate a unique ID for the user (deprecated - use getOrCreateUserId instead)
export const generateUserId = (): string => {
  return getOrCreateUserId();
};

// Class to handle Bluetooth functionality
export class BluetoothConnector {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private serviceUUID = '0000ffe0-0000-1000-8000-00805f9b34fb'; // Custom service UUID
  private characteristicUUID = '0000ffe1-0000-1000-8000-00805f9b34fb'; // Custom characteristic UUID
  
  constructor(private onConnectionCallback?: (connected: boolean) => void,
              private onDataReceivedCallback?: (data: any) => void) {}
  
  // Check if Web Bluetooth is supported
  isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }
  
  // Connect to a nearby device
  async connect(): Promise<boolean> {
    if (!this.isSupported()) {
      console.error('Web Bluetooth API is not supported in this browser');
      return false;
    }
    
    try {
      // Request the device with our custom service
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [this.serviceUUID] }]
      });
      
      if (!this.device) return false;
      
      // Connect to the GATT server
      if (this.device.gatt) {
        this.server = await this.device.gatt.connect();
      }
      
      if (!this.server) return false;
      
      // Get primary service
      const service = await this.server.getPrimaryService(this.serviceUUID);
      
      // Get characteristic
      const characteristic = await service.getCharacteristic(this.characteristicUUID);
      
      // Set up notifications
      await characteristic.startNotifications();
      
      // Listen for notifications
      characteristic.addEventListener('characteristicvaluechanged', (event) => {
        // Use a type assertion with unknown intermediate step to avoid TypeScript errors
        const target = event.target as unknown;
        const characteristic = target as BluetoothRemoteGATTCharacteristic;
        const value = characteristic.value;
        if (value) {
          const decoder = new TextDecoder('utf-8');
          const data = decoder.decode(value);
          try {
            const contactData = JSON.parse(data);
            if (this.onDataReceivedCallback) {
              this.onDataReceivedCallback(contactData);
            }
          } catch (e) {
            console.error('Error parsing contact data', e);
          }
        }
      });
      
      if (this.onConnectionCallback) {
        this.onConnectionCallback(true);
      }
      
      return true;
    } catch (error) {
      console.error('Bluetooth connection error:', error);
      if (this.onConnectionCallback) {
        this.onConnectionCallback(false);
      }
      return false;
    }
  }
  
  // Send data to connected device
  async sendData(data: any): Promise<boolean> {
    if (!this.server) {
      console.error('Not connected to any device');
      return false;
    }
    
    try {
      // Get the service
      const service = await this.server.getPrimaryService(this.serviceUUID);
      
      // Get the characteristic
      const characteristic = await service.getCharacteristic(this.characteristicUUID);
      
      // Encode and send the data
      const encoder = new TextEncoder();
      const dataString = JSON.stringify(data);
      await characteristic.writeValue(encoder.encode(dataString));
      
      return true;
    } catch (error) {
      console.error('Error sending data:', error);
      return false;
    }
  }
  
  // Disconnect from the device
  disconnect(): void {
    if (this.device && this.device.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.device = null;
    this.server = null;
    
    if (this.onConnectionCallback) {
      this.onConnectionCallback(false);
    }
  }
}

// Simulate a bump detection using device motion
export const detectBump = (
  onBumpDetected: () => void,
  sensitivity = 15
): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  
  let lastX = 0;
  let lastY = 0;
  let lastZ = 0;
  let lastTime = 0;
  
  const handleMotion = (event: DeviceMotionEvent) => {
    const acceleration = event.accelerationIncludingGravity;
    if (!acceleration || !acceleration.x || !acceleration.y || !acceleration.z) return;
    
    const currentTime = new Date().getTime();
    if ((currentTime - lastTime) > 100) {
      const diffTime = currentTime - lastTime;
      lastTime = currentTime;
      
      const x = acceleration.x;
      const y = acceleration.y;
      const z = acceleration.z;
      
      const speed = Math.abs(x + y + z - lastX - lastY - lastZ) / diffTime * 10000;
      
      if (speed > sensitivity) {
        onBumpDetected();
      }
      
      lastX = x;
      lastY = y;
      lastZ = z;
    }
  };
  
  // Add event listener
  window.addEventListener('devicemotion', handleMotion, false);
  
  // Return function to remove event listener
  return () => {
    window.removeEventListener('devicemotion', handleMotion, false);
  };
};

// Fallback method for browsers that don't support Web Bluetooth API
export const simulateConnection = async (
  onConnectionCallback?: (connected: boolean) => void,
  onDataReceivedCallback?: (data: any) => void
): Promise<void> => {
  // Simulate connection delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  if (onConnectionCallback) {
    onConnectionCallback(true);
  }
  
  // Simulate receiving data after a delay
  setTimeout(() => {
    if (onDataReceivedCallback) {
      onDataReceivedCallback({
        userId: generateUserId(),
        name: 'Simulated Contact',
        internationalPhone: '+1234567890',
        email: 'contact@example.com',
        title: 'Software Engineer',
        company: 'Tech Company',
        socialProfiles: [
          { platform: 'linkedin', username: 'simulated-user' },
          { platform: 'x', username: 'sim_user' }
        ]
      });
    }
  }, 3000);
};
