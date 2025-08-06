import React, { useState, useEffect, useCallback } from 'react';
import { 
  Clock, 
  Play, 
  Square, 
  Send, 
  ChevronLeft, 
  ChevronRight,
  Code,
  FileText,
  CheckCircle,
  AlertCircle,
  Monitor,
  Shield,
  Camera
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { executeCode } from '../../lib/codeExecution';
import { validateAnswer } from '../../lib/aiValidation';
import type { Question, Domain, ExamCode, Interview, InterviewAnswer } from '../../lib/supabase';
import Editor from '@monaco-editor/react';
import ProctoringSystem from './ProctoringSystem';
import toast from 'react-hot-toast';

interface InterviewInterfaceProps {
  candidate: any;
  domain: Domain;
  examCode: ExamCode;
  experienceLevel: string;
  onComplete: (interview: Interview) => void;
}

export default function InterviewInterface({ 
  candidate, 
  domain, 
  examCode, 
  experienceLevel, 
  onComplete 
}: InterviewInterfaceProps) {
  const [interview, setInterview] = useState<Interview | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [codeOutput, setCodeOutput] = useState('');
  const [codeError, setCodeError] = useState('');
  const [loading, setLoading] = useState(false);
  const [proctoringActive, setProctoringActive] = useState(false);
  const [violations, setViolations] = useState<Array<{type: string, details: string, timestamp: Date}>>([]);
  const [showProctoringSetup, setShowProctoringSetup] = useState(true);

  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswer = answers[currentQuestion?.id] || {};

  useEffect(() => {
    initializeInterview();
  }, []);

  useEffect(() => {
    if (interview && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [interview, timeRemaining]);

  const initializeInterview = async () => {
    try {
      // Load questions for this domain and experience level
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('domain_id', domain.id)
        .eq('experience_level', experienceLevel)
        .eq('is_active', true)
        .order('difficulty', { ascending: true });

      if (questionsError) throw questionsError;

      if (!questionsData || questionsData.length === 0) {
        toast.error('No questions available for this domain and experience level');
        return;
      }

      setQuestions(questionsData);

      // Create interview record
      const totalTimeLimit = questionsData.reduce((sum, q) => sum + q.time_limit, 0);
      const { data: interviewData, error: interviewError } = await supabase
        .from('interviews')
        .insert({
          candidate_id: candidate.id,
          domain_id: domain.id,
          exam_code_used: examCode.code,
          experience_level: experienceLevel,
          status: 'in_progress',
          questions_assigned: questionsData.map(q => q.id),
          max_possible_score: questionsData.reduce((sum, q) => sum + q.max_score, 0),
          current_question_index: 0
        })
        .select()
        .single();

      if (interviewError) throw interviewError;

      setInterview(interviewData);
      setTimeRemaining(totalTimeLimit);

      // Initialize answers
      const initialAnswers: Record<string, any> = {};
      questionsData.forEach(question => {
        initialAnswers[question.id] = {
          answer_text: '',
          answer_code: question.starter_code || '',
          selected_option: ''
        };
      });
      setAnswers(initialAnswers);

    } catch (error) {
      console.error('Error initializing interview:', error);
      toast.error('Failed to initialize interview');
    }
  };

  const handleProctoringViolation = (type: string, details: string) => {
    const violation = {
      type,
      details,
      timestamp: new Date()
    };
    
    setViolations(prev => [...prev, violation]);
    
    // Log violation to database
    if (interview) {
      supabase
        .from('interview_violations')
        .insert({
          interview_id: interview.id,
          violation_type: type,
          violation_details: details,
          timestamp: violation.timestamp.toISOString()
        })
        .then(({ error }) => {
          if (error) console.error('Failed to log violation:', error);
        });
    }
    
    // Auto-submit if too many violations
    if (violations.length >= 5) {
      toast.error('Too many violations detected. Auto-submitting exam.');
      setTimeout(() => {
        handleAutoSubmit();
      }, 3000);
    }
  };

  const startProctoredExam = () => {
    setProctoringActive(true);
    setShowProctoringSetup(false);
    toast.success('Proctoring enabled. Exam started.');
  };

  const handleAnswerChange = (questionId: string, field: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [field]: value
      }
    }));
  };

  const handleRunCode = async () => {
    if (!currentQuestion || !interview) return;

    const code = currentAnswer.answer_code || '';
    if (!code.trim()) {
      toast.error('Please write some code to run');
      return;
    }

    setIsRunningCode(true);
    setCodeOutput('');
    setCodeError('');

    try {
      const result = await executeCode(
        code,
        currentQuestion.language || 'python',
        interview.id,
        currentQuestion.id
      );

      if (result.status === 'success') {
        setCodeOutput(result.output || 'Code executed successfully (no output)');
        setCodeError('');
        toast.success('Code executed successfully!');
      } else {
        setCodeOutput('');
        setCodeError(result.error || 'Execution failed');
        toast.error('Code execution failed');
      }
    } catch (error) {
      setCodeError('Failed to execute code');
      toast.error('Failed to execute code');
    } finally {
      setIsRunningCode(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!currentQuestion || !interview) return;

    setLoading(true);
    try {
      const answerData = currentAnswer;
      const answer = answerData.answer_text || answerData.answer_code || answerData.selected_option;

      if (!answer?.trim()) {
        toast.error('Please provide an answer before submitting');
        return;
      }

      // Validate answer with AI
      const validation = await validateAnswer(currentQuestion, answer);

      // Save answer to database
      const { error } = await supabase
        .from('interview_answers')
        .insert({
          interview_id: interview.id,
          question_id: currentQuestion.id,
          answer_text: answerData.answer_text || answerData.selected_option,
          answer_code: answerData.answer_code,
          score: validation.score,
          max_score: validation.maxScore,
          ai_feedback: validation.feedback,
          time_taken: currentQuestion.time_limit - Math.max(0, timeRemaining - questions.slice(currentQuestionIndex + 1).reduce((sum, q) => sum + q.time_limit, 0))
        });

      if (error) throw error;

      // Update interview progress
      const newTotalScore = interview.total_score + validation.score;
      const newPercentageScore = (newTotalScore / interview.max_possible_score) * 100;

      await supabase
        .from('interviews')
        .update({
          current_question_index: currentQuestionIndex + 1,
          total_score: newTotalScore,
          percentage_score: newPercentageScore
        })
        .eq('id', interview.id);

      setInterview(prev => prev ? {
        ...prev,
        current_question_index: currentQuestionIndex + 1,
        total_score: newTotalScore,
        percentage_score: newPercentageScore
      } : null);

      toast.success(`Answer submitted! Score: ${validation.score}/${validation.maxScore}`);

      // Move to next question or complete interview
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setCodeOutput('');
        setCodeError('');
      } else {
        await completeInterview();
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      toast.error('Failed to submit answer');
    } finally {
      setLoading(false);
    }
  };

  const completeInterview = async () => {
    if (!interview) return;

    try {
      const endTime = new Date().toISOString();
      const timeTaken = Math.max(0, interview.max_possible_score * 30 - timeRemaining); // Rough calculation

      // Determine overall rating
      let rating: string;
      if (interview.percentage_score >= 90) rating = 'excellent';
      else if (interview.percentage_score >= 75) rating = 'good';
      else if (interview.percentage_score >= 60) rating = 'average';
      else rating = 'poor';

      const { data: completedInterview, error } = await supabase
        .from('interviews')
        .update({
          status: 'completed',
          end_time: endTime,
          time_taken: timeTaken,
          overall_rating: rating
        })
        .eq('id', interview.id)
        .select()
        .single();

      if (error) throw error;

      toast.success('Interview completed successfully!');
      onComplete(completedInterview);
    } catch (error) {
      console.error('Error completing interview:', error);
      toast.error('Failed to complete interview');
    }
  };

  const handleAutoSubmit = useCallback(async () => {
    toast.info('Time is up! Auto-submitting current answer...');
    await handleSubmitAnswer();
  }, [currentQuestion, interview, currentAnswer]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getQuestionIcon = (type: string) => {
    switch (type) {
      case 'coding': return <Code className="w-5 h-5" />;
      case 'text': return <FileText className="w-5 h-5" />;
      default: return <CheckCircle className="w-5 h-5" />;
    }
  };

  // Show proctoring setup before starting exam
  if (showProctoringSetup && interview) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-2xl w-full mx-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Shield className="w-10 h-10 text-blue-600" />
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Exam Proctoring Setup
            </h1>
            <p className="text-gray-600 mb-8">
              This exam is proctored for security. We need to enable camera and microphone monitoring 
              and set your browser to full-screen mode.
            </p>

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-8">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <h3 className="font-semibold text-yellow-900 mb-2">Important Requirements:</h3>
                  <ul className="text-sm text-yellow-800 space-y-1">
                    <li>• Camera and microphone access will be requested</li>
                    <li>• Your exam session will be recorded</li>
                    <li>• Browser will enter full-screen mode</li>
                    <li>• Tab switching and shortcuts will be disabled</li>
                    <li>• Any violations will be logged and may result in exam termination</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="p-4 border border-gray-200 rounded-lg">
                <Camera className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <h4 className="font-medium text-gray-900 mb-1">Camera Access</h4>
                <p className="text-sm text-gray-600">Required for identity verification</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <Monitor className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <h4 className="font-medium text-gray-900 mb-1">Screen Recording</h4>
                <p className="text-sm text-gray-600">Your screen activity will be monitored</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <Shield className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <h4 className="font-medium text-gray-900 mb-1">Full Screen</h4>
                <p className="text-sm text-gray-600">Prevents tab switching during exam</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={startProctoredExam}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Shield className="w-5 h-5" />
                Enable Proctoring & Start Exam
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-6">
              By clicking "Enable Proctoring", you consent to exam monitoring and recording.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!interview || !currentQuestion) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Initializing interview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Proctoring System */}
      <ProctoringSystem 
        onViolation={handleProctoringViolation}
        isActive={proctoringActive}
      />

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {domain.name} Interview
                </h1>
                <p className="text-sm text-gray-600">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-red-500" />
                <span className={`font-mono text-lg font-bold ${
                  timeRemaining < 300 ? 'text-red-600' : 'text-gray-900'
                }`}>
                  {formatTime(timeRemaining)}
                </span>
              </div>
              
              <div className="text-sm text-gray-600">
                Score: {interview.total_score}/{interview.max_possible_score}
              </div>
              
              {violations.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  <span>Violations: {violations.length}</span>
                </div>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="pb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-gray-600">Progress:</span>
              <span className="text-sm font-medium text-gray-900">
                {Math.round(((currentQuestionIndex) / questions.length) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestionIndex) / questions.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Question Panel */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                {getQuestionIcon(currentQuestion.question_type)}
                <h2 className="text-xl font-bold text-gray-900">
                  {currentQuestion.title}
                </h2>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  currentQuestion.difficulty === 'easy' 
                    ? 'bg-green-100 text-green-800'
                    : currentQuestion.difficulty === 'medium'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {currentQuestion.difficulty}
                </span>
                <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                  {currentQuestion.max_score} points
                </span>
              </div>
              
              <div className="prose max-w-none mb-6">
                <p className="text-gray-700 whitespace-pre-wrap">
                  {currentQuestion.description}
                </p>
              </div>

              {/* Answer Interface */}
              {currentQuestion.question_type === 'mcq' && (
                <div className="space-y-3">
                  {(currentQuestion.options || []).map((option, index) => (
                    <label key={index} className="flex items-center p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="radio"
                        name="mcq_answer"
                        value={option}
                        checked={currentAnswer.selected_option === option}
                        onChange={(e) => handleAnswerChange(currentQuestion.id, 'selected_option', e.target.value)}
                        className="mr-3"
                      />
                      <span className="text-gray-900">{option}</span>
                    </label>
                  ))}
                </div>
              )}

              {currentQuestion.question_type === 'text' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Answer
                  </label>
                  <textarea
                    rows={8}
                    value={currentAnswer.answer_text || ''}
                    onChange={(e) => handleAnswerChange(currentQuestion.id, 'answer_text', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Write your answer here..."
                  />
                </div>
              )}

              {currentQuestion.question_type === 'coding' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">
                      Code Editor ({currentQuestion.language})
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleRunCode}
                        disabled={isRunningCode}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {isRunningCode ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Running...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            Run Code
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="border border-gray-300 rounded-lg overflow-hidden">
                    <Editor
                      height="400px"
                      language={currentQuestion.language}
                      value={currentAnswer.answer_code || ''}
                      onChange={(value) => handleAnswerChange(currentQuestion.id, 'answer_code', value || '')}
                      theme="vs-dark"
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        wordWrap: 'on'
                      }}
                    />
                  </div>

                  {/* Code Output */}
                  {(codeOutput || codeError) && (
                    <div className="border border-gray-300 rounded-lg p-4 bg-gray-900 text-white">
                      <div className="flex items-center gap-2 mb-2">
                        <Monitor className="w-4 h-4" />
                        <span className="text-sm font-medium">Output:</span>
                      </div>
                      {codeOutput && (
                        <pre className="text-green-400 text-sm whitespace-pre-wrap font-mono">
                          {codeOutput}
                        </pre>
                      )}
                      {codeError && (
                        <pre className="text-red-400 text-sm whitespace-pre-wrap font-mono">
                          {codeError}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center">
              <button
                onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                disabled={currentQuestionIndex === 0}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <button
                onClick={handleSubmitAnswer}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
                {currentQuestionIndex === questions.length - 1 ? 'Complete Interview' : 'Submit & Next'}
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Question Navigation */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-medium text-gray-900 mb-4">Questions</h3>
              <div className="grid grid-cols-4 gap-2">
                {questions.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentQuestionIndex(index)}
                    disabled={index > currentQuestionIndex}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                      index === currentQuestionIndex
                        ? 'bg-blue-600 text-white'
                        : index < currentQuestionIndex
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Test Cases (for coding questions) */}
            {currentQuestion.question_type === 'coding' && currentQuestion.test_cases && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-medium text-gray-900 mb-4">Test Cases</h3>
                <div className="space-y-3">
                  {currentQuestion.test_cases.map((testCase: any, index: number) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900 mb-1">
                          Test Case {index + 1}
                        </div>
                        {testCase.input && (
                          <div className="text-gray-600">
                            <span className="font-medium">Input:</span> {testCase.input}
                          </div>
                        )}
                        {testCase.expected_output && (
                          <div className="text-gray-600">
                            <span className="font-medium">Expected:</span> {testCase.expected_output}
                          </div>
                        )}
                        {testCase.description && (
                          <div className="text-gray-600 mt-1">
                            {testCase.description}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interview Info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-medium text-gray-900 mb-4">Interview Info</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Domain:</span>
                  <span className="font-medium">{domain.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Level:</span>
                  <span className="font-medium capitalize">{experienceLevel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Questions:</span>
                  <span className="font-medium">{questions.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Current Score:</span>
                  <span className="font-medium">
                    {interview.total_score}/{interview.max_possible_score}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Proctoring:</span>
                  <span className={`font-medium ${proctoringActive ? 'text-green-600' : 'text-red-600'}`}>
                    {proctoringActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-red-50 rounded-xl border border-red-200 p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-red-900 mb-1">Important</h4>
                  <p className="text-sm text-red-800">
                    This exam is being proctored. Do not refresh, navigate away, or switch tabs. 
                    Violations will be recorded and may result in exam termination.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}