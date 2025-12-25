/**
 * ALERT SERVICE - PostgreSQL LISTEN/NOTIFY Bridge
 * 
 * This service creates a dedicated PostgreSQL connection that listens
 * for database notifications and broadcasts them via WebSocket to all
 * connected dashboard clients in real-time.
 * 
 * Flow: Database INSERT → NOTIFY → This Service → WebSocket → Dashboard
 */

import pg from 'pg';
const { Client } = pg;

let alertClient = null;
let io = null;

/**
 * Initialize the alert service
 * @param {SocketIO.Server} socketIO - Socket.IO server instance
 */
export async function initializeAlertService(socketIO) {
  io = socketIO;
  
  try {
    // Create dedicated connection for LISTEN
    alertClient = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : false
    });

    await alertClient.connect();
    console.log('🔔 Alert Service: Connected to PostgreSQL');

    // Listen to the notification channel
    await alertClient.query('LISTEN new_security_alert');
    console.log('🔔 Alert Service: Listening for security alerts...');

    // Handle notifications
    alertClient.on('notification', (msg) => {
      try {
        const alertData = JSON.parse(msg.payload);
        console.log('🚨 New Security Alert:', alertData);

        // Broadcast to all connected WebSocket clients
        if (io) {
          io.emit('security-alert', alertData);
          console.log('📡 Alert broadcasted to all clients');
        }
      } catch (error) {
        console.error('Error processing notification:', error);
      }
    });

    // Handle connection errors
    alertClient.on('error', (err) => {
      console.error('🔔 Alert Service: Database connection error:', err);
      // Attempt reconnection
      setTimeout(() => reconnectAlertService(), 5000);
    });

    return true;
  } catch (error) {
    console.error('🔔 Alert Service: Failed to initialize:', error);
    throw error;
  }
}

/**
 * Reconnect to PostgreSQL LISTEN channel
 */
async function reconnectAlertService() {
  console.log('🔔 Alert Service: Attempting to reconnect...');
  try {
    if (alertClient) {
      await alertClient.end();
    }
    await initializeAlertService(io);
  } catch (error) {
    console.error('🔔 Alert Service: Reconnection failed:', error);
    setTimeout(() => reconnectAlertService(), 10000);
  }
}

/**
 * Gracefully shutdown the alert service
 */
export async function shutdownAlertService() {
  if (alertClient) {
    try {
      await alertClient.query('UNLISTEN new_security_alert');
      await alertClient.end();
      console.log('🔔 Alert Service: Shutdown complete');
    } catch (error) {
      console.error('🔔 Alert Service: Error during shutdown:', error);
    }
  }
}

/**
 * Get current connection status
 */
export function getAlertServiceStatus() {
  return {
    connected: alertClient && !alertClient.ended,
    listening: alertClient && !alertClient.ended
  };
}
