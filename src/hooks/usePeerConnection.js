import { useState, useRef, useCallback, useEffect } from 'react';
import Peer from 'peerjs';

/**
 * Hook for WebRTC peer-to-peer connections using PeerJS
 * Used for Private Room 1v1 battles
 */
export function usePeerConnection() {
  const peerRef = useRef(null);
  const connRef = useRef(null);
  const [isHost, setIsHost] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState(null);
  const [peerData, setPeerData] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  /**
   * Create a room (host)
   * Returns the room code to share
   */
  const createRoom = useCallback(() => {
    return new Promise((resolve, reject) => {
      setIsConnecting(true);
      setError(null);

      const code = 'MOG-' + Math.random().toString(36).substring(2, 8).toUpperCase();

      const peer = new Peer(code, {
        debug: 0,
      });

      peer.on('open', (id) => {
        peerRef.current = peer;
        setRoomCode(id);
        setIsHost(true);
        setIsConnecting(false);
        resolve(id);
      });

      peer.on('connection', (conn) => {
        connRef.current = conn;

        conn.on('open', () => {
          setIsConnected(true);
        });

        conn.on('data', (data) => {
          setPeerData(data);
        });

        conn.on('close', () => {
          setIsConnected(false);
          setPeerData(null);
        });

        conn.on('error', (err) => {
          console.error('Connection error:', err);
          setError('Connection lost');
        });
      });

      peer.on('error', (err) => {
        console.error('Peer error:', err);
        setIsConnecting(false);
        if (err.type === 'unavailable-id') {
          setError('Room code already in use. Try again.');
        } else {
          setError('Connection error: ' + err.message);
        }
        reject(err);
      });
    });
  }, []);

  /**
   * Join a room (guest)
   */
  const joinRoom = useCallback((code) => {
    return new Promise((resolve, reject) => {
      setIsConnecting(true);
      setError(null);

      const peer = new Peer(undefined, {
        debug: 0,
      });

      peer.on('open', () => {
        peerRef.current = peer;
        setIsHost(false);

        const conn = peer.connect(code, { reliable: true });

        conn.on('open', () => {
          connRef.current = conn;
          setRoomCode(code);
          setIsConnected(true);
          setIsConnecting(false);
          resolve();
        });

        conn.on('data', (data) => {
          setPeerData(data);
        });

        conn.on('close', () => {
          setIsConnected(false);
          setPeerData(null);
        });

        conn.on('error', (err) => {
          console.error('Connection error:', err);
          setError('Connection lost');
          setIsConnecting(false);
          reject(err);
        });

        // Timeout if no connection after 10s
        setTimeout(() => {
          if (!connRef.current || !connRef.current.open) {
            setIsConnecting(false);
            setError('Room not found or host disconnected.');
            reject(new Error('Connection timeout'));
          }
        }, 10000);
      });

      peer.on('error', (err) => {
        console.error('Peer error:', err);
        setIsConnecting(false);
        setError('Failed to connect: ' + err.message);
        reject(err);
      });
    });
  }, []);

  /**
   * Send data to the connected peer
   */
  const sendData = useCallback((data) => {
    if (connRef.current && connRef.current.open) {
      connRef.current.send(data);
    }
  }, []);

  /**
   * Disconnect and cleanup
   */
  const disconnect = useCallback(() => {
    if (connRef.current) {
      connRef.current.close();
      connRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    setIsConnected(false);
    setRoomCode('');
    setPeerData(null);
    setIsHost(false);
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connRef.current) connRef.current.close();
      if (peerRef.current) peerRef.current.destroy();
    };
  }, []);

  return {
    createRoom,
    joinRoom,
    sendData,
    disconnect,
    isHost,
    isConnected,
    isConnecting,
    roomCode,
    peerData,
    error,
  };
}
