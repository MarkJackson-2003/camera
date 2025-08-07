import React from 'react';
import { 
  CheckCircle, 
  Award, 
  Clock, 
  TrendingUp, 
  Home,
  Download,
  Star
} from 'lucide-react';
import type { Interview } from '../../lib/supabase';
import { format } from 'date-fns';

interface InterviewCompleteProps {
  interview: Interview;
  onGoHome: () => void;
}

export default function InterviewComplete({ interview, onGoHome }: InterviewCompleteProps) {
  const getRatingColor = (rating?: string) => {
    switch (rating) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-blue-600';
      case 'average': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getRatingIcon = (rating?: string) => {
    const iconClass = "w-8 h-8";
    switch (rating) {
      case 'excellent': return <Star className={`${iconClass} text-green-600`} />;
      case 'good': return <TrendingUp className={`${iconClass} text-blue-600`} />;
      case 'average': return <Award className={`${iconClass} text-yellow-600`} />;
      case 'poor': return <Award className={`${iconClass} text-red-600`} />;
      default: return <Award className={`${iconClass} text-gray-600`} />;
    }
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Certificate download functionality commented out as requested
  // const downloadCertificate = () => {
  //   // Generate a simple certificate
  //   const canvas = document.createElement('canvas');
  //   const ctx = canvas.getContext('2d');
  //   
  //   if (!ctx) return;
  //   
  //   canvas.width = 800;
  //   canvas.height = 600;
  //   
  //   // Background
  //   ctx.fillStyle = '#f8fafc';
  //   ctx.fillRect(0, 0, canvas.width, canvas.height);
  //   
  //   // Border
  //   ctx.strokeStyle = '#3b82f6';
  //   ctx.lineWidth = 4;
  //   ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
  //   
  //   // Title
  //   ctx.fillStyle = '#1f2937';
  //   ctx.font = 'bold 36px Arial';
  //   ctx.textAlign = 'center';
  //   ctx.fillText('Certificate of Completion', canvas.width / 2, 120);
  //   
  //   // Content
  //   ctx.font = '24px Arial';
  //   ctx.fillText('This is to certify that', canvas.width / 2, 200);
  //   
  //   ctx.font = 'bold 32px Arial';
  //   ctx.fillStyle = '#3b82f6';
  //   ctx.fillText(interview.candidate?.name || 'Candidate', canvas.width / 2, 250);
  //   
  //   ctx.font = '24px Arial';
  //   ctx.fillStyle = '#1f2937';
  //   ctx.fillText('has successfully completed the', canvas.width / 2, 300);
  //   ctx.fillText(`${interview.domain?.name} Interview`, canvas.width / 2, 340);
  //   
  //   ctx.fillText(`Score: ${interview.percentage_score.toFixed(1)}%`, canvas.width / 2, 400);
  //   ctx.fillText(`Rating: ${interview.overall_rating?.toUpperCase()}`, canvas.width / 2, 440);
  //   
  //   // Date
  //   ctx.font = '18px Arial';
  //   ctx.fillStyle = '#6b7280';
  //   ctx.fillText(`Completed on ${format(new Date(interview.end_time || interview.start_time), 'MMM dd, yyyy')}`, canvas.width / 2, 520);
  //   
  //   // Download
  //   const link = document.createElement('a');
  //   link.download = 'interview-certificate.png';
  //   link.href = canvas.toDataURL();
  //   link.click();
  // };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Success Icon */}
          <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Interview Completed!
          </h1>
          <p className="text-gray-600 mb-8">
            Congratulations on completing your {interview.domain?.name} interview.
          </p>

          {/* Results Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-blue-50 p-6 rounded-xl">
              <div className="flex items-center justify-center mb-3">
                <Award className="w-8 h-8 text-blue-600" />
              </div>
              <div className={`text-3xl font-bold mb-1 ${getScoreColor(interview.percentage_score)}`}>
                {interview.percentage_score.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Overall Score</div>
              <div className="text-xs text-gray-500 mt-1">
                {interview.total_score} / {interview.max_possible_score} points
              </div>
            </div>

            <div className="bg-purple-50 p-6 rounded-xl">
              <div className="flex items-center justify-center mb-3">
                {getRatingIcon(interview.overall_rating)}
              </div>
              <div className={`text-2xl font-bold mb-1 capitalize ${getRatingColor(interview.overall_rating)}`}>
                {interview.overall_rating || 'N/A'}
              </div>
              <div className="text-sm text-gray-600">Performance Rating</div>
            </div>

            <div className="bg-green-50 p-6 rounded-xl">
              <div className="flex items-center justify-center mb-3">
                <Clock className="w-8 h-8 text-green-600" />
              </div>
              <div className="text-3xl font-bold text-green-600 mb-1">
                {interview.time_taken ? Math.floor(interview.time_taken / 60) : 0}m
              </div>
              <div className="text-sm text-gray-600">Time Taken</div>
            </div>
          </div>

          {/* Interview Details */}
          <div className="bg-gray-50 rounded-xl p-6 mb-8">
            <h3 className="font-semibold text-gray-900 mb-4">Interview Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Domain:</span>
                <span className="font-medium">{interview.domain?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Experience Level:</span>
                <span className="font-medium capitalize">{interview.experience_level}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Start Time:</span>
                <span className="font-medium">
                  {format(new Date(interview.start_time), 'MMM dd, yyyy HH:mm')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">End Time:</span>
                <span className="font-medium">
                  {interview.end_time 
                    ? format(new Date(interview.end_time), 'MMM dd, yyyy HH:mm')
                    : 'N/A'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Exam Code Used:</span>
                <span className="font-mono text-xs bg-gray-200 px-2 py-1 rounded">
                  {interview.exam_code_used}
                </span>
              </div>
            </div>
          </div>

          {/* AI Feedback */}
          {interview.ai_feedback && (
            <div className="bg-blue-50 rounded-xl p-6 mb-8 text-left">
              <h3 className="font-semibold text-gray-900 mb-3">AI Feedback</h3>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">
                {interview.ai_feedback}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {/* Certificate download commented out as requested */}
            {/* <button
              onClick={downloadCertificate}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              <Download className="w-5 h-5" />
              Download Certificate
            </button> */}
            <button
              onClick={onGoHome}
              className="flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Home className="w-5 h-5" />
              Back to Dashboard
            </button>
          </div>

          {/* Thank You Message */}
          <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
            <div className="text-center">
              <h4 className="font-semibold text-blue-900 mb-2">Thank You!</h4>
              <p className="text-sm text-blue-800">
              Thank you for taking the interview! Your results have been recorded and will be reviewed by our team. 
              You will be contacted regarding the next steps within 3-5 business days.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}