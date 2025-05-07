import React, { useState, useEffect, useRef } from 'react';
import socketService from '../services/socketService';

const Room = () => {
    const [isStreaming, setIsStreaming] = useState(false);
    const [roomId, setRoomId] = useState('');
    const [inputRoomId, setInputRoomId] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [remoteStreams, setRemoteStreams] = useState({});
    const [socketId, setSocketId] = useState('');
    const [isAudioMuted, setIsAudioMuted] = useState(false);
    const [isVideoMuted, setIsVideoMuted] = useState(false);
    
    const localVideoRef = useRef(null);
    const streamRef = useRef(null);
    const remoteVideosRef = useRef({});

    // Connect to socket server on component mount
    useEffect(() => {
        const connectToServer = async () => {
            try {
                const id = await socketService.connect();
                setSocketId(id);
                
                // Set up handlers for remote streams
                socketService.onRemoteStream((userId, stream) => {
                    console.log('Received remote stream from:', userId);
                    setRemoteStreams(prev => ({
                        ...prev,
                        [userId]: stream
                    }));
                });
                
                socketService.onUserDisconnected((userId) => {
                    console.log('User disconnected, removing stream:', userId);
                    setRemoteStreams(prev => {
                        const newStreams = {...prev};
                        delete newStreams[userId];
                        return newStreams;
                    });
                });
            } catch (error) {
                console.error('Failed to connect to socket server:', error);
            }
        };
        
        connectToServer();
        
        // Clean up on unmount
        return () => {
            stopStream();
            socketService.disconnect();
        };
    }, []);
    
    // Update video elements when remote streams change
    useEffect(() => {
        Object.entries(remoteStreams).forEach(([userId, stream]) => {
            if (remoteVideosRef.current[userId]) {
                remoteVideosRef.current[userId].srcObject = stream;
            }
        });
    }, [remoteStreams]);

    const setupDevice = async () => {
        try {
            console.log("Setting up media devices...");
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true
            });
            
            streamRef.current = stream;
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            
            socketService.setLocalStream(stream);
            
            setIsStreaming(true);
            setIsAudioMuted(false);
            setIsVideoMuted(false);
            console.log("Media devices set up successfully!");
        } catch (error) {
            console.error('Error accessing media devices:', error);
            alert('Failed to access camera and microphone. Please check your permissions.');
        }
    };

    const stopStream = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = null;
            }
            setIsStreaming(false);
            console.log("Stream stopped");
        }
    };

    const toggleAudio = () => {
        if (streamRef.current) {
            const audioTracks = streamRef.current.getAudioTracks();
            if (audioTracks.length > 0) {
                const newEnabled = !audioTracks[0].enabled;
                audioTracks.forEach(track => {
                    track.enabled = newEnabled;
                });
                setIsAudioMuted(!newEnabled);
            }
        }
    };

    const toggleVideo = () => {
        if (streamRef.current) {
            const videoTracks = streamRef.current.getVideoTracks();
            if (videoTracks.length > 0) {
                const newEnabled = !videoTracks[0].enabled;
                videoTracks.forEach(track => {
                    track.enabled = newEnabled;
                });
                setIsVideoMuted(!newEnabled);
            }
        }
    };

    const handleJoinRoom = () => {
        if (inputRoomId.trim()) {
            socketService.joinRoom(inputRoomId.trim());
            setRoomId(inputRoomId.trim());
            setIsConnected(true);
            console.log(`Joined room: ${inputRoomId.trim()}`);
        }
    };

    const handleCreateRoom = () => {
        const newRoomId = Math.random().toString(36).substring(2, 8);
        socketService.joinRoom(newRoomId);
        setRoomId(newRoomId);
        setInputRoomId(newRoomId);
        setIsConnected(true);
        console.log(`Created and joined room: ${newRoomId}`);
    };

    return (
        <div className="w-full h-full p-4 flex flex-col items-center">
            <h1 className="text-2xl font-bold mb-4">Welcome to PulseConnect</h1>
            
            <div className="mb-4 flex gap-4">
                <button 
                    onClick={isStreaming ? stopStream : setupDevice}
                    className={`px-4 py-2 rounded ${isStreaming ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
                >
                    {isStreaming ? 'Stop Camera' : 'Start Camera'}
                </button>
                {isStreaming && (
                    <>
                        <button 
                            onClick={toggleAudio}
                            className={`px-4 py-2 rounded ${isAudioMuted ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} text-white`}
                        >
                            {isAudioMuted ? 'Unmute Audio' : 'Mute Audio'}
                        </button>
                        <button 
                            onClick={toggleVideo}
                            className={`px-4 py-2 rounded ${isVideoMuted ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} text-white`}
                        >
                            {isVideoMuted ? 'Turn On Video' : 'Turn Off Video'}
                        </button>
                    </>
                )}
            </div>
            
            {isStreaming && !isConnected && (
                <div className="mb-4 flex gap-2 items-center">
                    <input 
                        type="text" 
                        value={inputRoomId}
                        onChange={(e) => setInputRoomId(e.target.value)}
                        placeholder="Enter room ID" 
                        className="px-3 py-2 border border-gray-300 rounded"
                    />
                    <button 
                        onClick={handleJoinRoom}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded"
                    >
                        Join Room
                    </button>
                    <button 
                        onClick={handleCreateRoom}
                        className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded"
                    >
                        Create Room
                    </button>
                </div>
            )}
            
            {isConnected && (
                <div className="mb-4 p-2 bg-gray-100 rounded">
                    <p>Room ID: <span className="font-medium">{roomId}</span></p>
                    <p className="text-sm text-gray-600">Share this ID with others to join your room</p>
                </div>
            )}
            
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="w-full flex flex-col items-center">
                    <h2 className="text-lg font-medium mb-2">Your Video</h2>
                    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border-2 border-gray-300">
                        <video 
                            ref={localVideoRef}
                            autoPlay 
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                        />
                        {isVideoMuted && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 text-white text-lg">
                                Your video is off
                            </div>
                        )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">Your ID: {socketId}</p>
                </div>
                
                {Object.keys(remoteStreams).length > 0 ? (
                    Object.keys(remoteStreams).map(userId => (
                        <div key={userId} className="w-full flex flex-col items-center">
                            <h2 className="text-lg font-medium mb-2">Remote Video</h2>
                            <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border-2 border-green-300">
                                <video 
                                    ref={el => {
                                        if (el) {
                                            remoteVideosRef.current[userId] = el;
                                            el.srcObject = remoteStreams[userId];
                                        }
                                    }}
                                    autoPlay 
                                    playsInline
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <p className="text-sm text-gray-500 mt-1">User ID: {userId}</p>
                        </div>
                    ))
                ) : isConnected ? (
                    <div className="w-full flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-8 aspect-video">
                        <p className="text-gray-500">Waiting for others to join...</p>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default Room;