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

// Define the shape of a contact exchange
export interface ContactExchange {
  userId: string;
  name: string;
  internationalPhone: string; // Updated to match new field structure
  email: string;
  title?: string;
  company?: string;
  location?: string;
  socialProfiles: Array<{
    platform: string;
    username: string;
  }>;
}

// Generate a unique ID for the user
export const generateUserId = (): string => {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
};

// Store the user ID persistently
export const getUserId = (): string => {
  if (typeof window !== 'undefined') {
    let userId = localStorage.getItem('nektus-user-id');
    if (!userId) {
      userId = generateUserId();
      localStorage.setItem('nektus-user-id', userId);
    }
    return userId;
  }
  return generateUserId(); // Fallback for SSR
};

// Class to handle Bluetooth functionality
export class BluetoothConnector {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private serviceUUID = '0000ffe0-0000-1000-8000-00805f9b34fb'; // Custom service UUID
  private characteristicUUID = '0000ffe1-0000-1000-8000-00805f9b34fb'; // Custom characteristic UUID
  
  constructor(private onConnectionCallback?: (connected: boolean) => void,
              private onDataReceivedCallback?: (data: ContactExchange) => void) {}
  
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
            const contactData = JSON.parse(data) as ContactExchange;
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
  async sendData(data: ContactExchange): Promise<boolean> {
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
  onDataReceivedCallback?: (data: ContactExchange) => void
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
          { platform: 'twitter', username: 'sim_user' }
        ]
      });
    }
  }, 3000);
};
