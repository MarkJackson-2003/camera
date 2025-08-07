import React, { useState, useRef, useCallback } from 'react';
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
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStep('capture');
    } catch (error) {
      console.error('Failed to access camera:', error);
      toast.error('Camera access is required for ID verification');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedPhoto(photoDataUrl);
    stopCamera();
    setStep('review');
  }, [stream]);

  const retakePhoto = () => {
    setCapturedPhoto(null);
    startCamera();
  };

  const uploadPhoto = async (photoDataUrl: string): Promise<string> => {
    try {
      // Convert data URL to blob
      const response = await fetch(photoDataUrl);
      const blob = await response.blob();
      
      // Generate unique filename
      const filename = `id-verification/${candidate.id}/${Date.now()}.jpg`;
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('candidate-photos')
        .upload(filename, blob, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('candidate-photos')
        .getPublicUrl(filename);

      return publicUrl;
    } catch (error) {
      console.error('Failed to upload photo:', error);
      throw new Error('Failed to upload photo');
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

      if (error) throw error;

      toast.success('ID verification submitted successfully!');
      onVerificationComplete(data);
    } catch (error) {
      console.error('Failed to submit verification:', error);
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
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Camera className="w-5 h-5" />
                Start Camera for ID Capture
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
                  className="w-full h-80 object-cover"
                />
                <div className="absolute inset-0 border-4 border-dashed border-white/50 m-8 rounded-lg flex items-center justify-center">
                  <div className="text-white text-center">
                    <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-75" />
                    <p className="text-sm opacity-75">Position ID here</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={capturePhoto}
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
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