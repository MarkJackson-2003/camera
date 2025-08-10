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
  X,
  Shield
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface IDVerificationProps {
  candidate: any; // Replace 'any' with a specific type if candidate structure is known
  onVerificationComplete: (verificationData: any) => void; // Replace 'any' with a specific type if known
}

export default function IDVerification({ candidate, onVerificationComplete }: IDVerificationProps) {
  const [step, setStep] = useState<'select' | 'capture' | 'review'>('select');
  const [verificationType, setVerificationType] = useState<'aadhar' | 'pan' | 'other'>('aadhar');
  const [idNumber, setIdNumber] = useState<string>('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play().then(() => {
                setCameraActive(true);
                setLoading(false);
                toast.success('Camera ready! Position your ID clearly in the frame.');
                resolve(true);
              }).catch((error) => {
                console.error('Video play error:', error);
                setLoading(false);
                setCameraError('Failed to start video playback');
              });
            };
          }
        });
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
  };

  const capturePhoto = () => {
    if (!videoRef.current || !cameraActive) {
      toast.error('Camera not ready');
      return;
    }

    const canvas = document.createElement('canvas');
    const video = videoRef.current;
    
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    
    if (width === 0 || height === 0) {
      toast.error('Video not ready. Please wait a moment and try again.');
      return;
    }
    
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, width, height);
      
      canvas.toBlob((blob) => {
        if (blob && blob.size > 0) {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            setCapturedPhoto(dataUrl);
            stopCamera();
            setStep('review');
            toast.success('Photo captured successfully!');
          };
          reader.readAsDataURL(blob);
        } else {
          toast.error('Failed to capture photo. Please try again.');
        }
      }, 'image/jpeg', 0.9);
    }
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    setStep('capture');
  };

  const handleSkipVerification = () => {
    stopCamera();
    toast.info('Skipping verification for demo');
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

    if (!candidate) {
      toast.error('Candidate information not found.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(capturedPhoto);
      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error('Invalid image data');
      }

      const fileName = `verification_${candidate.id}_${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('verification-photos')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error('Failed to upload photo');
      }

      const { data: urlData } = supabase.storage
        .from('verification-photos')
        .getPublicUrl(fileName);

      const { data: verificationData, error: dbError } = await supabase
        .from('candidate_verifications')
        .insert({
          candidate_id: candidate.id,
          verification_type: verificationType,
          id_number: idNumber || null,
          photo_url: urlData.publicUrl,
          verification_status: 'approved'
        })
        .select()
        .single();

      if (dbError) {
        console.error('Database error:', dbError);
        throw new Error('Failed to save verification');
      }

      toast.success('ID verification completed successfully!');
      onVerificationComplete(verificationData);
    } catch (error) {
      console.error('Verification error:', error);
      toast.error(`Failed to submit verification: ${error.message}`);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-cyan-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 p-8">
          {step === 'select' && (
            <div className="text-center mb-8">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <Shield className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-3">
                Identity Verification
              </h1>
              <p className="text-gray-600 text-lg">
                Please verify your identity before proceeding to the interview
              </p>
              
              <button
                onClick={handleSkipVerification}
                className="mt-4 text-sm text-blue-600 hover:text-blue-700 underline transition-colors"
              >
                Skip verification (Demo mode)
              </button>
            </div>
          )}

          {step === 'select' && (
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Select ID Document Type</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { type: 'aadhar', label: 'Aadhar Card', description: 'Government issued ID', color: 'from-blue-500 to-blue-600' },
                    { type: 'pan', label: 'PAN Card', description: 'Tax identification', color: 'from-green-500 to-green-600' },
                    { type: 'other', label: 'Other ID', description: 'Any government ID', color: 'from-purple-500 to-purple-600' }
                  ].map((option) => (
                    <button
                      key={option.type}
                      onClick={() => setVerificationType(option.type as 'aadhar' | 'pan' | 'other')}
                      className={`p-6 border-2 rounded-2xl transition-all duration-300 text-left transform hover:scale-105 ${
                        verificationType === option.type
                          ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg'
                          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${option.color} flex items-center justify-center mb-4`}>
                        {getVerificationIcon(option.type)}
                      </div>
                      <h4 className="font-semibold text-gray-900 mb-2">{option.label}</h4>
                      <p className="text-sm text-gray-600">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  ID Number (Optional)
                </label>
                <input
                  type="text"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder={`Enter your ${verificationType.toUpperCase()} number`}
                />
              </div>

              <button
                onClick={() => setStep('capture')}
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all duration-200 flex items-center justify-center gap-3 shadow-lg"
              >
                {loading ? (
                  <>
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Starting Camera...
                  </>
                ) : (
                  <>
                    <Camera className="w-6 h-6" />
                    Start Camera for ID Capture
                  </>
                )}
              </button>

              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6">
                <div className="flex items-start gap-4">
                  <AlertCircle className="w-6 h-6 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-amber-900 mb-2">Capture Instructions</h4>
                    <ul className="text-sm text-amber-800 space-y-2">
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

          {step === 'capture' && (
            <div>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Position Your ID Document</h2>
                <p className="text-gray-600">
                  Hold your {verificationType.toUpperCase()} clearly in front of the camera
                </p>
              </div>

              <div className="relative bg-gray-900 rounded-2xl overflow-hidden mb-6 shadow-2xl" style={{ minHeight: '400px' }}>
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
                />
                {!cameraActive && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                    <div className="text-white text-center">
                      <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                      <p className="text-lg">Initializing camera...</p>
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 border-4 border-dashed border-white/40 m-8 rounded-2xl pointer-events-none" />
                
                <div className="absolute top-4 left-4 right-4 bg-black/50 text-white p-3 rounded-xl">
                  <p className="text-sm text-center">Position your ID document within the dashed frame</p>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={capturePhoto}
                  disabled={!cameraActive}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 transition-all duration-200 flex items-center justify-center gap-3 shadow-lg"
                >
                  <Camera className="w-6 h-6" />
                  Capture Photo
                </button>
                <button
                  onClick={() => {
                    stopCamera();
                    setStep('select');
                  }}
                  className="px-6 py-4 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <X className="w-5 h-5" />
                  Cancel
                </button>
              </div>
            </div>
          )}

          {step === 'review' && capturedPhoto && (
            <div>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Review Your Photo</h2>
                <p className="text-gray-600">Make sure the ID is clearly visible and readable</p>
              </div>

              <div className="bg-gray-100 rounded-2xl p-4 mb-6 shadow-inner">
                <img
                  src={capturedPhoto}
                  alt="Captured ID"
                  className="w-full h-auto max-h-96 object-contain rounded-xl shadow-lg"
                />
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 mb-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">ID Type:</span>
                    <span className="font-semibold text-gray-900 ml-2">{verificationType.toUpperCase()}</span>
                  </div>
                  {idNumber && (
                    <div>
                      <span className="text-gray-600">ID Number:</span>
                      <span className="font-semibold text-gray-900 ml-2">{idNumber}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={submitVerification}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all duration-200 flex items-center justify-center gap-3 shadow-lg"
                >
                  {loading ? (
                    <>
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-6 h-6" />
                      Submit Verification
                    </>
                  )}
                </button>
                <button
                  onClick={retakePhoto}
                  className="px-6 py-4 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-all duration-200 flex items-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
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