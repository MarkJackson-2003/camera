import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Mic, 
  MicOff, 
  VideoOff, 
  AlertTriangle,
  Eye,
  EyeOff,
  Maximize,
  Shield
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
  const [isInitialized, setIsInitialized] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const fullscreenInitializedRef = useRef(false);

  useEffect(() => {
    if (isActive && !isInitialized) {
      initializeProctoring();
      setIsInitialized(true);
    } else if (!isActive && isInitialized) {
      cleanup();
      setIsInitialized(false);
    }

    return () => {
      if (!isActive) {
        cleanup();
      }
    };
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

      // Setup event listeners after fullscreen is entered
      setTimeout(() => {
        setupEventListeners();
        fullscreenInitializedRef.current = true;
      }, 1000);

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
      
      // Only count as violation if proctoring was already initialized and this isn't the initial fullscreen entry
      if (!isCurrentlyFullScreen && isActive && fullscreenInitializedRef.current) {
        onViolation('fullscreen_exit', 'Candidate exited fullscreen mode');
        toast.error('Please return to fullscreen mode');
        // Attempt to re-enter fullscreen
        setTimeout(enterFullScreen, 1000);
      } else if (isCurrentlyFullScreen && !fullscreenInitializedRef.current) {
        // This is the initial fullscreen entry, don't count as violation
        fullscreenInitializedRef.current = true;
      }
    };

    // Tab visibility change detection
    const handleVisibilityChange = () => {
      if (document.hidden && isActive && fullscreenInitializedRef.current) {
        onViolation('tab_switch', 'Candidate switched tabs or minimized window');
        toast.error('Tab switching detected! Please return to the exam.');
      }
    };

    // Prevent right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      if (isActive && fullscreenInitializedRef.current) {
        e.preventDefault();
        onViolation('context_menu', 'Candidate attempted to open context menu');
      }
    };

    // Prevent keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isActive && fullscreenInitializedRef.current) {
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

    // Reset states
    setCameraEnabled(false);
    setMicrophoneEnabled(false);
    setIsFullScreen(false);
    fullscreenInitializedRef.current = false;
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
      {/* Enhanced Proctoring Panel */}
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/50 p-6 min-w-[320px]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-semibold text-gray-900">Exam Monitoring</span>
              <div className="text-xs text-gray-500">Secure Testing Environment</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
            <span className="text-xs font-medium text-gray-600">
              {isRecording ? 'Recording' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Enhanced Video Preview */}
        <div className="relative mb-4">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-36 bg-gray-900 rounded-xl object-cover shadow-inner"
          />
          {!cameraEnabled && (
            <div className="absolute inset-0 bg-gray-900 rounded-xl flex items-center justify-center">
              <VideoOff className="w-8 h-8 text-gray-400" />
            </div>
          )}
          <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 text-white text-xs rounded-lg">
            Live Feed
          </div>
        </div>

        {/* Enhanced Controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleCamera}
              className={`p-3 rounded-xl transition-all duration-200 ${
                cameraEnabled 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200 shadow-sm' 
                  : 'bg-red-100 text-red-700 hover:bg-red-200 shadow-sm'
              }`}
              title={cameraEnabled ? 'Disable Camera' : 'Enable Camera'}
            >
              {cameraEnabled ? <Camera className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
            
            <button
              onClick={toggleMicrophone}
              className={`p-3 rounded-xl transition-all duration-200 ${
                microphoneEnabled 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200 shadow-sm' 
                  : 'bg-red-100 text-red-700 hover:bg-red-200 shadow-sm'
              }`}
              title={microphoneEnabled ? 'Disable Microphone' : 'Enable Microphone'}
            >
              {microphoneEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
          </div>

          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium ${
            isFullScreen 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            <Maximize className="w-4 h-4" />
            {isFullScreen ? 'Fullscreen' : 'Windowed'}
          </div>
        </div>

        {/* Enhanced Status Indicators */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 font-medium">Camera:</span>
            <span className={`font-semibold ${cameraEnabled ? 'text-green-600' : 'text-red-600'}`}>
              {cameraEnabled ? 'Active' : 'Disabled'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 font-medium">Microphone:</span>
            <span className={`font-semibold ${microphoneEnabled ? 'text-green-600' : 'text-red-600'}`}>
              {microphoneEnabled ? 'Active' : 'Disabled'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 font-medium">Full Screen:</span>
            <span className={`font-semibold ${isFullScreen ? 'text-green-600' : 'text-red-600'}`}>
              {isFullScreen ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Enhanced Violations Warning */}
        {violations.length > 0 && (
          <div className="mt-4 p-4 bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span className="text-sm font-semibold text-red-800">
                Violations Detected: {violations.length}
              </span>
            </div>
            <div className="text-xs text-red-700">
              Your exam session is being monitored for security
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Warning Overlay for violations */}
      {!isFullScreen && isActive && fullscreenInitializedRef.current && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="bg-white rounded-3xl p-10 max-w-md text-center shadow-2xl">
            <div className="w-20 h-20 bg-gradient-to-r from-red-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              Return to Full Screen
            </h3>
            <p className="text-gray-600 mb-8 leading-relaxed">
              You must remain in full screen mode during the exam for security purposes. 
              Click the button below to continue.
            </p>
            <button
              onClick={enterFullScreen}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-semibold text-lg shadow-lg"
            >
              Enter Full Screen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}