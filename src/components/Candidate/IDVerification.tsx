import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  User,
  CreditCard,
  FileText,
  X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
 
interface IDVerificationProps {
  candidate: any;
  onVerificationComplete: (verificationData: any) => void;
}
 
export default function IDVerification({ candidate, onVerificationComplete }: IDVerificationProps) {
  const [step, setStep] = useState<'select' | 'capture' | 'review'>('select');
  const [verificationType, setVerificationType] = useState<'aadhar' | 'pan' | 'other'>('aadhar');
  const [idNumber, setIdNumber] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
 
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
 
  // Start camera immediately when component mounts for select step
  useEffect(() => {
    if (step === 'capture') {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [step]);
 
  const startCamera = async () => {
    try {
      setLoading(true);
      setCameraError(null);
      console.log('Starting camera...');
     
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      });
 
      console.log('Stream obtained:', stream);
      streamRef.current = stream;
 
      if (videoRef.current) {
        console.log('Setting video source...');
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setLoading(false);
        toast.success('Camera ready!');
      }
    } catch (error: any) {
      console.error('Camera error:', error);
      setLoading(false);
      setCameraError(error.message);
     
      if (error.name === 'NotAllowedError') {
        toast.error('Camera permission denied. Please allow camera access and refresh.');
      } else if (error.name === 'NotFoundError') {
        toast.error('No camera found on this device.');
      } else {
        toast.error(`Camera error: ${error.message}`);
      }
    }
  };
 
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setIsRecording(false);
  };
 
  const capturePhoto = () => {
    if (!videoRef.current) {
      toast.error('Camera not ready');
      return;
    }
 
    const canvas = document.createElement('canvas');
    const video = videoRef.current;
   
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
   
    canvas.width = width;
    canvas.height = height;
   
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
     
      if (dataUrl && dataUrl.length > 100) {
        setCapturedPhoto(dataUrl);
        stopCamera();
        setStep('review');
        toast.success('Photo captured!');
      } else {
        toast.error('Failed to capture photo. Please try again.');
      }
    }
  };
 
  const retakePhoto = () => {
    setCapturedPhoto(null);
    setStep('select');
  };
 
  const handleSkipVerification = () => {
    stopCamera();
    toast.info('Skipping verification');
    onVerificationComplete({
      candidate_id: candidate.id,
      verification_type: 'skipped',
      verification_status: 'skipped'
    });
  };
 
  const submitVerification = async () => {
    if (!capturedPhoto) {
      toast.error('Please capture a photo first');
      return;
    }
 
    setLoading(true);
    try {
      const verificationData = {
        id: Date.now(),
        candidate_id: candidate.id,
        verification_type: verificationType,
        id_number: idNumber || null,
        photo_url: 'photo_captured',
        verification_status: 'verified',
        created_at: new Date().toISOString()
      };
 
      toast.success('ID verification completed!');
      onVerificationComplete(verificationData);
    } catch (error) {
      console.error('Verification error:', error);
      toast.error('Failed to submit verification');
    } finally {
      setLoading(false);
    }
  };
 
  const getVerificationIcon = (type: string) => {
    switch (type) {
      case 'aadhar': return <CreditCard className="w-6 h-6" />;
      case 'pan': return <FileText className="w-6 h-6" />;
      default: return <User className="w-6 h-6" />;
    }
  };
 
  const [isRecording, setIsRecording] = useState(false);
 
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Debug Info */}
          <div className="bg-gray-100 p-4 rounded mb-4 text-sm">
            <p>Camera Status: {isRecording ? '✅ Active' : '❌ Inactive'}</p>
            <p>Video Element: {videoRef.current ? '✅ Ready' : '❌ Not Ready'}</p>
            <p>Stream: {streamRef.current ? '✅ Connected' : '❌ Not Connected'}</p>
            <p>Current Step: {step}</p>
          </div>
 
          {/* Header */}
          {step === 'select' && (
            <div className="text-center mb-8">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Camera className="w-8 h-8 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">ID Verification Required</h1>
              <p className="text-gray-600 mt-2">
                Please verify your identity before proceeding to the interview
              </p>
             
              <button
                onClick={handleSkipVerification}
                className="mt-4 text-sm text-blue-600 hover:text-blue-700 underline"
              >
                Skip verification (Testing only)
              </button>
            </div>
          )}
 
          {/* Step: Select ID Type */}
          {step === 'select' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Select ID Type</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { type: 'aadhar', label: 'Aadhar Card', description: 'Government issued ID' },
                    { type: 'pan', label: 'PAN Card', description: 'Tax identification' },
                    { type: 'other', label: 'Other ID', description: 'Any government ID' }
                  ].map((option) => (
                    <button
                      key={option.type}
                      onClick={() => setVerificationType(option.type as any)}
                      className={`p-4 border-2 rounded-xl transition-colors text-left ${
                        verificationType === option.type
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        {getVerificationIcon(option.type)}
                        <span className="font-medium text-gray-900">{option.label}</span>
                      </div>
                      <p className="text-sm text-gray-600">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>
 
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ID Number (Optional)
                </label>
                <input
                  type="text"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={`Enter your ${verificationType.toUpperCase()} number`}
                />
              </div>
 
              <button
                onClick={() => setStep('capture')}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Starting Camera...
                  </>
                ) : (
                  <>
                    <Camera className="w-5 h-5" />
                    Start Camera for ID Capture
                  </>
                )}
              </button>
 
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-yellow-900 mb-1">Instructions</h4>
                    <ul className="text-sm text-yellow-800 space-y-1">
                      <li>• Hold your ID document clearly in front of the camera</li>
                      <li>• Ensure good lighting and all text is readable</li>
                      <li>• Your face should be visible alongside the ID</li>
                      <li>• Avoid glare or shadows on the document</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
 
          {/* Step: Capture */}
          {step === 'capture' && (
            <div>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Position Your ID Document</h2>
                <p className="text-gray-600 mt-2">
                  Hold your {verificationType.toUpperCase()} clearly in front of the camera
                </p>
              </div>
 
              <div className="relative bg-black rounded-lg overflow-hidden mb-6" style={{ minHeight: '400px' }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{
                    transform: 'scaleX(-1)',
                    minHeight: '400px',
                    display: 'block'
                  }}
                  onLoadedMetadata={() => console.log('Video metadata loaded')}
                  onPlay={() => {
                    console.log('Video playing');
                    setIsRecording(true);
                  }}
                  onError={(e) => console.error('Video error:', e)}
                />
                {!cameraActive && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                    <div className="text-white text-center">
                      <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <p>Initializing camera...</p>
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 border-4 border-dashed border-white/30 m-8 rounded-lg pointer-events-none" />
              </div>
 
              <div className="flex gap-4">
                <button
                  onClick={capturePhoto}
                  disabled={!cameraActive}
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  Capture Photo
                </button>
                <button
                  onClick={() => {
                    stopCamera();
                    setStep('select');
                  }}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
                >
                  <X className="w-5 h-5" />
                  Cancel
                </button>
                <button
                  onClick={startCamera}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  Restart Camera
                </button>
              </div>
            </div>
          )}
 
          {/* Step: Review */}
          {step === 'review' && capturedPhoto && (
            <div>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Review Your Photo</h2>
                <p className="text-gray-600 mt-2">Make sure the ID is clearly visible</p>
              </div>
 
              <div className="bg-gray-100 rounded-lg p-4 mb-6">
                <img
                  src={capturedPhoto}
                  alt="Captured ID"
                  className="w-full h-auto max-h-96 object-contain rounded"
                />
              </div>
 
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                  <strong>ID Type:</strong> {verificationType.toUpperCase()}
                  {idNumber && <><br /><strong>ID Number:</strong> {idNumber}</>}
                </p>
              </div>
 
              <div className="flex gap-4">
                <button
                  onClick={submitVerification}
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Submit Verification
                    </>
                  )}
                </button>
                <button
                  onClick={retakePhoto}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                >
                  <RefreshCw className="w-4 h-4 inline mr-2" />
                  Retake
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
 