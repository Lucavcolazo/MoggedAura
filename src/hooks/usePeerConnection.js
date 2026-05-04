import { useState, useRef, useCallback, useEffect } from 'react';
import Peer from 'peerjs';

/**
 * Hook for WebRTC peer-to-peer connections using PeerJS
 * Used for Private Room 1v1 battles
 * Supports both data channels AND media (video) calls
 */
export function usePeerConnection() {
  const peerRef = useRef(null);
  const connRef = useRef(null);
  const callRef = useRef(null);
  const [isHost, setIsHost] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState(null);
  const [peerData, setPeerData] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);

  /**
   * Create a room (host)
   * Returns the room code to share
   */
  const createRoom = useCallback((preferredCode) => {
    return new Promise((resolve, reject) => {
      setIsConnecting(true);
      setError(null);

      const code = preferredCode || ('MOG-' + Math.random().toString(36).substring(2, 8).toUpperCase());

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

      // Handle incoming media calls (host answers guest's call)
      peer.on('call', (call) => {
        callRef.current = call;
        // We'll answer later when we have our local stream via callPeer
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

      // Handle incoming media calls (guest receives host's call)
      peer.on('call', (call) => {
        callRef.current = call;
        // Answer with our local stream if available
        // El flujo local se comparte luego desde callPeer para evitar dobles respuestas.
        call.on('stream', (stream) => {
          setRemoteStream(stream);
        });
        call.on('close', () => {
          setRemoteStream(null);
        });
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
   * Start a media call — share local camera stream with the peer
   * Both host and guest call this once they have their camera running
   * @param {MediaStream} localStream - The camera stream to share
   */
  const callPeer = useCallback((localStream) => {
    if (!peerRef.current || !localStream) return;

    // If we have a pending incoming call, answer it with our stream
    if (callRef.current && !callRef.current.open) {
      callRef.current.answer(localStream);
      callRef.current.on('stream', (stream) => {
        setRemoteStream(stream);
      });
      callRef.current.on('close', () => {
        setRemoteStream(null);
      });
      return;
    }

    // Otherwise, initiate the call to the remote peer
    const remotePeerId = isHost
      ? connRef.current?.peer   // host calls the guest's peer ID
      : roomCode;                // guest calls the host (roomCode = host's peer ID)

    if (!remotePeerId) return;

    const call = peerRef.current.call(remotePeerId, localStream);
    if (!call) return;

    callRef.current = call;

    call.on('stream', (stream) => {
      setRemoteStream(stream);
    });

    call.on('close', () => {
      setRemoteStream(null);
    });

    call.on('error', (err) => {
      console.error('Media call error:', err);
    });
  }, [isHost, roomCode]);

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
    if (callRef.current) {
      callRef.current.close();
      callRef.current = null;
    }
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
    setRemoteStream(null);
    setIsHost(false);
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callRef.current) callRef.current.close();
      if (connRef.current) connRef.current.close();
      if (peerRef.current) peerRef.current.destroy();
    };
  }, []);

  return {
    createRoom,
    joinRoom,
    callPeer,
    sendData,
    disconnect,
    isHost,
    isConnected,
    isConnecting,
    roomCode,
    peerData,
    remoteStream,
    error,
  };
}
