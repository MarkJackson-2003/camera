import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  CheckCircle, 
  AlertCircle,
  RefreshCw,
  User,
  CreditCard,
  FileText
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface IDVerificationProps {
  candidate: any;
  onVerificationComplete: (verificationData: any) => void;
}

export default function IDVerification({ candidate, onVerificationComplete }: IDVerificationProps) {
  const [step, setStep] = useState<'select' | 'capture' | 'review' | 'submit'>('select');
  const [verificationType, setVerificationType] = useState<'aadhar' | 'pan' | 'other'>('aadhar');
  const [idNumber, setIdNumber] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setLoading(true);
      setCameraReady(false);
      
      // Stop any existing stream first
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          facingMode: 'user'
        },
        audio: false
      });

      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        // Wait for video to load and play
        const handleLoadedData = () => {
          if (videoRef.current) {
            videoRef.current.play().then(() => {
              setCameraReady(true);
              setStep('capture');
              setLoading(false);
              toast.success('Camera ready!');
            }).catch((error) => {
              console.error('Video play error:', error);
              toast.error('Failed to start camera preview');
              setLoading(false);
            });
          }
        };
        
        videoRef.current.addEventListener('loadeddata', handleLoadedData);
        
        // Handle video errors
        videoRef.current.onerror = (error) => {
          console.error('Video error:', error);
          toast.error('Camera initialization failed');
          setLoading(false);
        };
      }
    } catch (error) {
      console.error('Failed to access camera:', error);
      toast.error('Camera access denied. Please allow camera permissions and refresh the page.');
      setLoading(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
      });
      setStream(null);
    }
    setCameraReady(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) {
      toast.error('Camera not ready. Please wait a moment and try again.');
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
      toast.error('Failed to capture photo. Please try again.');
      return;
    }

    // Ensure video has dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      toast.error('Camera not ready. Please wait and try again.');
      return;
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw the video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to data URL with good quality
    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    
    if (photoDataUrl === 'data:,' || photoDataUrl.length < 1000) {
      toast.error('Failed to capture photo. Please ensure camera is working and try again.');
      return;
    }

    setCapturedPhoto(photoDataUrl);
    stopCamera();
    setStep('review');
    toast.success('Photo captured successfully!');
  }, [cameraReady, stream]);

  const retakePhoto = () => {
    setCapturedPhoto(null);
    startCamera();
  };

  const dataURLtoBlob = (dataURL: string): Blob => {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  const uploadPhoto = async (photoDataUrl: string): Promise<string> => {
    try {
      // Convert data URL to blob
      const blob = dataURLtoBlob(photoDataUrl);
      
      if (blob.size === 0) {
        throw new Error('Invalid photo data');
      }
      
      // Generate unique filename
      const timestamp = Date.now();
      const filename = `id-verification/${candidate.id}/${timestamp}.jpg`;
      
      // First, ensure the bucket exists and is accessible
      const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
      
      if (bucketError) {
        console.error('Storage bucket error:', bucketError);
        throw new Error('Storage service unavailable');
      }

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('candidate-photos')
        .upload(filename, blob, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) {
        console.error('Storage upload error:', error);
        
        // Try creating the bucket if it doesn't exist
        if (error.message.includes('not found')) {
          const { error: createError } = await supabase.storage.createBucket('candidate-photos', {
            public: true
          });
          
          if (!createError) {
            // Retry upload
            const { data: retryData, error: retryError } = await supabase.storage
              .from('candidate-photos')
              .upload(filename, blob, {
                contentType: 'image/jpeg',
                upsert: true
              });
              
            if (retryError) throw retryError;
            data = retryData;
          } else {
            throw createError;
          }
        } else {
          throw error;
        }
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('candidate-photos')
        .getPublicUrl(filename);

      return publicUrl;
    } catch (error) {
      console.error('Failed to upload photo:', error);
      // Fallback: store as base64 in database if storage fails
      return photoDataUrl;
    }
  };

  const submitVerification = async () => {
    if (!capturedPhoto) {
      toast.error('Please capture a photo first');
      return;
    }

    setLoading(true);
    try {
      // Upload photo
      const photoUrl = await uploadPhoto(capturedPhoto);

      // Save verification record
      const { data, error } = await supabase
        .from('candidate_verifications')
        .insert({
          candidate_id: candidate.id,
          verification_type: verificationType,
          id_number: idNumber || null,
          photo_url: photoUrl,
          verification_status: 'pending'
        })
        .select()
        .single();

      if (error) {
        console.error('Database insert error:', error);
        throw new Error(`Failed to save verification: ${error.message}`);
      }

      toast.success('ID verification submitted successfully!');
      onVerificationComplete(data);
    } catch (error) {
      console.error('Failed to submit verification:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit verification');
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Camera className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">ID Verification Required</h1>
            <p className="text-gray-600 mt-2">
              Please verify your identity before proceeding to the interview
            </p>
          </div>

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
                onClick={startCamera}
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

          {step === 'capture' && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Position Your ID Document
                </h3>
                <p className="text-gray-600">
                  Hold your {verificationType.toUpperCase()} clearly in front of the camera
                </p>
              </div>

              <div className="relative bg-gray-900 rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-80 object-cover"
                  style={{ transform: 'scaleX(-1)' }} // Mirror effect
                />
                {!cameraReady && (
                  <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                    <div className="text-white text-center">
                      <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-sm">Initializing camera...</p>
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 border-4 border-dashed border-white/50 m-8 rounded-lg flex items-center justify-center pointer-events-none">
                  <div className="text-white text-center">
                    <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-75" />
                    <p className="text-sm opacity-75">Position ID here</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={capturePhoto}
                  disabled={!cameraReady}
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
                  className="px-6 py-3 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {step === 'review' && capturedPhoto && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Review Captured Photo
                </h3>
                <p className="text-gray-600">
                  Please verify the photo is clear and readable
                </p>
              </div>

              <div className="bg-gray-100 rounded-lg p-4">
                <img
                  src={capturedPhoto}
                  alt="Captured ID"
                  className="w-full max-h-80 object-contain rounded-lg"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-blue-900 mb-1">Verification Details</h4>
                    <div className="text-sm text-blue-800 space-y-1">
                      <p><strong>ID Type:</strong> {verificationType.toUpperCase()}</p>
                      {idNumber && <p><strong>ID Number:</strong> {idNumber}</p>}
                      <p><strong>Status:</strong> Ready for submission</p>
                    </div>
                  </div>
                </div>
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
                      <Upload className="w-5 h-5" />
                      Submit Verification
                    </>
                  )}
                </button>
                <button
                  onClick={retakePhoto}
                  disabled={loading}
                  className="px-6 py-3 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retake
                </button>
              </div>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>
      </div>
    </div>
  );
}