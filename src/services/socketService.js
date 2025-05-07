import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.peerConnections = {};
    this.localStream = null;
    this.onRemoteStreamCallback = null;
    this.onUserDisconnectedCallback = null;
  }

  connect(serverUrl = 'https://pulseconnect-backend-dqql.onrender.com:5000') {
    return new Promise((resolve, reject) => {
      this.socket = io(serverUrl);
      
      this.socket.on('connect', () => {
        console.log('Connected to signaling server with ID:', this.socket.id);
        resolve(this.socket.id);
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        reject(error);
      });

      this.setupSocketListeners();
    });
  }

  setupSocketListeners() {
    this.socket.on('user-joined', async (userId) => {
      console.log('New user joined:', userId);
      await this.createPeerConnection(userId, true);
    });

    this.socket.on('offer', async ({ from, offer }) => {
      console.log('Received offer from:', from);
      const peerConnection = await this.createPeerConnection(from, false);
      
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      this.socket.emit('answer', {
        to: from,
        answer
      });
    });

    this.socket.on('answer', async ({ from, answer }) => {
      console.log('Received answer from:', from);
      const peerConnection = this.peerConnections[from];
      if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    this.socket.on('ice-candidate', async ({ from, candidate }) => {
      console.log('Received ICE candidate from:', from);
      const peerConnection = this.peerConnections[from];
      if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    this.socket.on('user-disconnected', (userId) => {
      console.log('User disconnected:', userId);
      if (this.peerConnections[userId]) {
        this.peerConnections[userId].close();
        delete this.peerConnections[userId];
      }
      
      if (this.onUserDisconnectedCallback) {
        this.onUserDisconnectedCallback(userId);
      }
    });
  }

  async createPeerConnection(userId, isInitiator) {
    console.log(`Creating ${isInitiator ? 'initiator' : 'receiver'} peer connection for user:`, userId);
    
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const peerConnection = new RTCPeerConnection(configuration);
    this.peerConnections[userId] = peerConnection;

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, this.localStream);
      });
    } else {
      console.warn('No local stream available to add to peer connection');
    }

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('ice-candidate', {
          to: userId,
          candidate: event.candidate
        });
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log(`Connection state for ${userId}:`, peerConnection.connectionState);
    };

    peerConnection.ontrack = (event) => {
      console.log('Received remote track from:', userId);
      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(userId, event.streams[0]);
      }
    };

    if (isInitiator) {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      this.socket.emit('offer', {
        to: userId,
        offer
      });
    }

    return peerConnection;
  }

  joinRoom(roomId) {
    this.socket.emit('join-room', roomId);
  }

  setLocalStream(stream) {
    this.localStream = stream;
    
    Object.values(this.peerConnections).forEach(peerConnection => {
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });
    });
  }

  onRemoteStream(callback) {
    this.onRemoteStreamCallback = callback;
  }

  onUserDisconnected(callback) {
    this.onUserDisconnectedCallback = callback;
  }

  disconnect() {
    Object.values(this.peerConnections).forEach(peerConnection => {
      peerConnection.close();
    });
    this.peerConnections = {};

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.localStream = null;
  }
}

export default new SocketService();