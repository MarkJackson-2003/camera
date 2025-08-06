import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Mic, 
  MicOff, 
  VideoOff, 
  AlertTriangle,
  Eye,
  EyeOff,
  Maximize
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ProctoringSystemProps {
  onViolation: (type: string, details: string) => void;
  isActive: boolean;
}

export default function ProctoringSystem({ onViolation, isActive }: ProctoringSystemProps) {
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [violations, setViolations] = useState<string[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (isActive) {
      initializeProctoring();
      setupEventListeners();
    } else {
      cleanup();
    }

    return () => cleanup();
  }, [isActive]);

  const initializeProctoring = async () => {
    try {
      // Request camera and microphone permissions
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: true
      });

      setStream(mediaStream);
      setCameraEnabled(true);
      setMicrophoneEnabled(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Start recording
      startRecording(mediaStream);

      // Enter full screen
      await enterFullScreen();

      toast.success('Proctoring system activated');
    } catch (error) {
      console.error('Failed to initialize proctoring:', error);
      toast.error('Camera/microphone access required for exam');
      onViolation('media_access_denied', 'Failed to access camera or microphone');
    }
  };

  const startRecording = (mediaStream: MediaStream) => {
    try {
      const mediaRecorder = new MediaRecorder(mediaStream, {
        mimeType: 'video/webm;codecs=vp9'
      });

      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: 'video/webm'
        });
        // In production, upload this blob to your server
        console.log('Recording stopped, blob size:', blob.size);
      };

      mediaRecorder.start(10000); // Record in 10-second chunks
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const enterFullScreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (error) {
      console.error('Failed to enter fullscreen:', error);
      onViolation('fullscreen_denied', 'Failed to enter fullscreen mode');
    }
  };

  const setupEventListeners = () => {
    // Fullscreen change detection
    const handleFullScreenChange = () => {
      const isCurrentlyFullScreen = !!document.fullscreenElement;
      setIsFullScreen(isCurrentlyFullScreen);
      
      if (!isCurrentlyFullScreen && isActive) {
        onViolation('fullscreen_exit', 'Candidate exited fullscreen mode');
        toast.error('Please return to fullscreen mode');
        // Attempt to re-enter fullscreen
        setTimeout(enterFullScreen, 1000);
      }
    };

    // Tab visibility change detection
    const handleVisibilityChange = () => {
      if (document.hidden && isActive) {
        onViolation('tab_switch', 'Candidate switched tabs or minimized window');
        toast.error('Tab switching detected! Please return to the exam.');
      }
    };

    // Prevent right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      if (isActive) {
        e.preventDefault();
        onViolation('context_menu', 'Candidate attempted to open context menu');
      }
    };

    // Prevent keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isActive) {
        // Prevent common shortcuts
        const forbiddenKeys = [
          'F12', // Developer tools
          'F5',  // Refresh
          'F11', // Fullscreen toggle
        ];

        const forbiddenCombos = [
          { ctrl: true, key: 'r' }, // Refresh
          { ctrl: true, key: 'R' }, // Refresh
          { ctrl: true, key: 'w' }, // Close tab
          { ctrl: true, key: 'W' }, // Close tab
          { ctrl: true, key: 't' }, // New tab
          { ctrl: true, key: 'T' }, // New tab
          { ctrl: true, key: 'n' }, // New window
          { ctrl: true, key: 'N' }, // New window
          { ctrl: true, shift: true, key: 'I' }, // Developer tools
          { ctrl: true, shift: true, key: 'J' }, // Console
          { ctrl: true, shift: true, key: 'C' }, // Inspector
          { alt: true, key: 'Tab' }, // Alt+Tab
          { alt: true, key: 'F4' },  // Alt+F4
        ];

        if (forbiddenKeys.includes(e.key)) {
          e.preventDefault();
          onViolation('forbidden_key', `Attempted to use ${e.key}`);
          return;
        }

        for (const combo of forbiddenCombos) {
          if (
            (combo.ctrl && e.ctrlKey) &&
            (combo.shift ? e.shiftKey : !e.shiftKey) &&
            (combo.alt ? e.altKey : !e.altKey) &&
            e.key.toLowerCase() === combo.key.toLowerCase()
          ) {
            e.preventDefault();
            onViolation('forbidden_shortcut', `Attempted to use ${combo.ctrl ? 'Ctrl+' : ''}${combo.shift ? 'Shift+' : ''}${combo.alt ? 'Alt+' : ''}${combo.key}`);
            return;
          }
        }
      }
    };

    // Add event listeners
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    // Store cleanup function
    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  };

  const cleanup = () => {
    // Stop media stream
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    // Stop recording
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }

    // Exit fullscreen
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(console.error);
    }

    setCameraEnabled(false);
    setMicrophoneEnabled(false);
    setIsFullScreen(false);
  };

  const toggleCamera = async () => {
    if (!stream) return;

    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCameraEnabled(videoTrack.enabled);
      
      if (!videoTrack.enabled) {
        onViolation('camera_disabled', 'Candidate disabled camera');
        toast.warning('Camera disabled - this may affect your exam');
      }
    }
  };

  const toggleMicrophone = async () => {
    if (!stream) return;

    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicrophoneEnabled(audioTrack.enabled);
      
      if (!audioTrack.enabled) {
        onViolation('microphone_disabled', 'Candidate disabled microphone');
        toast.warning('Microphone disabled - this may affect your exam');
      }
    }
  };

  if (!isActive) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      {/* Proctoring Panel */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 min-w-[300px]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-gray-900">Exam Monitoring</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
            <span className="text-xs text-gray-500">
              {isRecording ? 'Recording' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Video Preview */}
        <div className="relative mb-3">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-32 bg-gray-900 rounded-lg object-cover"
          />
          {!cameraEnabled && (
            <div className="absolute inset-0 bg-gray-900 rounded-lg flex items-center justify-center">
              <VideoOff className="w-8 h-8 text-gray-400" />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleCamera}
              className={`p-2 rounded-lg transition-colors ${
                cameraEnabled 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                  : 'bg-red-100 text-red-700 hover:bg-red-200'
              }`}
              title={cameraEnabled ? 'Disable Camera' : 'Enable Camera'}
            >
              {cameraEnabled ? <Camera className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </button>
            
            <button
              onClick={toggleMicrophone}
              className={`p-2 rounded-lg transition-colors ${
                microphoneEnabled 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                  : 'bg-red-100 text-red-700 hover:bg-red-200'
              }`}
              title={microphoneEnabled ? 'Disable Microphone' : 'Enable Microphone'}
            >
              {microphoneEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
              isFullScreen 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              <Maximize className="w-3 h-3" />
              {isFullScreen ? 'Fullscreen' : 'Windowed'}
            </div>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Camera:</span>
            <span className={cameraEnabled ? 'text-green-600' : 'text-red-600'}>
              {cameraEnabled ? 'Active' : 'Disabled'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Microphone:</span>
            <span className={microphoneEnabled ? 'text-green-600' : 'text-red-600'}>
              {microphoneEnabled ? 'Active' : 'Disabled'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Full Screen:</span>
            <span className={isFullScreen ? 'text-green-600' : 'text-red-600'}>
              {isFullScreen ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Violations Warning */}
        {violations.length > 0 && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-red-800">
                Violations Detected: {violations.length}
              </span>
            </div>
            <div className="text-xs text-red-700">
              Your exam session is being monitored
            </div>
          </div>
        )}
      </div>

      {/* Warning Overlay for violations */}
      {!isFullScreen && isActive && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40">
          <div className="bg-white rounded-xl p-8 max-w-md text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Return to Full Screen
            </h3>
            <p className="text-gray-600 mb-6">
              You must remain in full screen mode during the exam. 
              Click the button below to continue.
            </p>
            <button
              onClick={enterFullScreen}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Enter Full Screen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}