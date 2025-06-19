/**
 * // Real-time exchange settings
export const REAL_TIME_CONFIG = {
  // Time window for matching (milliseconds) - increased for better real-world matching
  matchTimeWindow: 10000,
  
  // Connection timeout (milliseconds) 
  connectionTimeout: 15000,
  
  // Retry attempts for failed connections
  maxRetries: 3,
  
  // Enable motion vector matching
  useMotionVectors: true,
  
  // Enable debug logging
  debugMode: true
}; switching between simulation and real-time exchange
 */

// Set to true for real-time exchange, false for simulation
export const USE_REAL_TIME_EXCHANGE = true;

// Real-time exchange settings
export const REAL_TIME_CONFIG = {
  // Time window for matching (milliseconds)
  matchTimeWindow: 3000,
  
  // Connection timeout (milliseconds) 
  connectionTimeout: 10000,
  
  // Retry attempts for failed connections
  maxRetries: 3,
  
  // Enable motion vector matching
  useMotionVectors: true,
  
  // Enable debug logging
  debugMode: true
};

// Simulation settings
export const SIMULATION_CONFIG = {
  // Delay before showing match (milliseconds)
  matchDelay: 2000,
  
  // Use mock profile data
  useMockProfile: true,
  
  // Enable debug logging
  debugMode: true
};
