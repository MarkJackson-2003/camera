import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Code, 
  FileText,
  Play,
  Save,
  Send,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Shield
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { executeCode } from '../../lib/codeExecution';
import { validateAnswer } from '../../lib/aiValidation';
import type { Question, Domain, ExamCode, Candidate } from '../../lib/supabase';
import Editor from '@monaco-editor/react';
import ProctoringSystem from './ProctoringSystem';
import toast from 'react-hot-toast';

interface InterviewInterfaceProps {
  candidate: Candidate;
  domain: Domain;
  examCode: ExamCode;
  onComplete: (interview: any) => void;
}

export default function InterviewInterface({ candidate, domain, examCode, onComplete }: InterviewInterfaceProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [timeRemaining, setTimeRemaining] = useState(3600); // 1 hour default
  const [interview, setInterview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [violations, setViolations] = useState<string[]>([]);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [executing, setExecuting] = useState(false);
  const [proctoringActive, setProctoringActive] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoSubmitRef = useRef<boolean>(false);

  useEffect(() => {
    initializeInterview();
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (timeRemaining <= 0 && !autoSubmitRef.current) {
      autoSubmitRef.current = true;
      handleAutoSubmit('time_expired');
    }
  }, [timeRemaining]);

  useEffect(() => {
    if (violations.length >= 3 && !autoSubmitRef.current && proctoringActive) {
      autoSubmitRef.current = true;
      handleAutoSubmit('violation_limit');
    }
  }, [violations, proctoringActive]);

  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setProctoringActive(false);
  };

  const initializeInterview = async () => {
    try {
      // Load questions for this domain and experience level
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('domain_id', domain.id)
        .eq('experience_level', examCode.experience_level)
        .eq('is_active', true)
        .limit(10); // Limit to 10 questions

      if (questionsError) throw questionsError;

      if (!questionsData || questionsData.length === 0) {
        toast.error('No questions available for this domain and experience level');
        return;
      }

      setQuestions(questionsData);

      // Create interview record
      const { data: interviewData, error: interviewError } = await supabase
        .from('interviews')
        .insert({
          candidate_id: candidate.id,
          domain_id: domain.id,
          exam_code_used: examCode.code,
          experience_level: examCode.experience_level,
          status: 'in_progress',
          questions_assigned: questionsData.map(q => q.id),
          max_possible_score: questionsData.reduce((sum, q) => sum + q.max_score, 0),
          start_time: new Date().toISOString()
        })
        .select()
        .single();

      if (interviewError) throw interviewError;

      setInterview(interviewData);
      setTimeRemaining(3600); // 1 hour
      setLoading(false);

      // Don't start timer or proctoring yet - wait for user to click start
      toast.success('Interview loaded! Click "Start Test" to begin.');
    } catch (error) {
      console.error('Failed to initialize interview:', error);
      toast.error('Failed to start interview');
    }
  };

  const startExam = () => {
    // Enter fullscreen as part of user gesture
    document.documentElement.requestFullscreen().catch((error) => {
      console.error('Failed to enter fullscreen:', error);
      toast.error('Please allow fullscreen mode for the exam');
    });
    
    startTimer();
    setProctoringActive(true);
    toast.success('Exam started! Good luck!');
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleViolation = async (type: string, details: string) => {
    try {
      // Log violation to database
      await supabase
        .from('interview_violations')
        .insert({
          interview_id: interview?.id,
          violation_type: type,
          violation_details: details
        });

      // Update local violations
      setViolations(prev => [...prev, `${type}: ${details}`]);

      // Update interview violation count
      if (interview) {
        await supabase
          .from('interviews')
          .update({ 
            violation_count: violations.length + 1 
          })
          .eq('id', interview.id);
      }

      // Show warning
      if (violations.length >= 2) {
        toast.error(`Warning: ${3 - violations.length - 1} violations remaining before auto-submit!`);
      } else {
        toast(`Violation detected: ${type}`, { icon: '⚠️' });
      }
    } catch (error) {
      console.error('Failed to log violation:', error);
    }
  };

  const handleAutoSubmit = async (reason: string) => {
    toast.error(`Interview auto-submitted due to: ${reason}`);
    await submitInterview(true);
  };

  const handleAnswerChange = (questionId: string, answer: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const executeCurrentCode = async () => {
    const currentQuestion = questions[currentQuestionIndex];
    const answer = answers[currentQuestion.id];

    if (!answer?.code || currentQuestion.question_type !== 'coding') {
      toast.error('No code to execute');
      return;
    }

    setExecuting(true);
    try {
      const result = await executeCode(
        answer.code,
        currentQuestion.language || 'python',
        interview.id,
        currentQuestion.id
      );
      
      setExecutionResult(result);
      
      if (result.status === 'success') {
        toast.success('Code executed successfully!');
      } else {
        toast.error('Code execution failed');
      }
    } catch (error) {
      toast.error('Failed to execute code');
    } finally {
      setExecuting(false);
    }
  };

  const submitInterview = async (isAutoSubmit = false) => {
    if (submitting) return;
    
    setSubmitting(true);
    setProctoringActive(false); // Stop proctoring immediately
    
    try {
      cleanup(); // Stop timer and exit fullscreen

      let totalScore = 0;
      const answerPromises = [];

      // Process all answers
      for (const question of questions) {
        const answer = answers[question.id];
        if (!answer) continue;

        // Validate answer using AI
        const validation = await validateAnswer(question, answer.text || answer.code || '', executionResult);
        totalScore += validation.score;

        // Save answer to database
        const answerPromise = supabase
          .from('interview_answers')
          .insert({
            interview_id: interview.id,
            question_id: question.id,
            answer_text: answer.text || null,
            answer_code: answer.code || null,
            execution_result: executionResult || null,
            score: validation.score,
            max_score: question.max_score,
            ai_feedback: validation.feedback,
            time_taken: Math.floor((3600 - timeRemaining) / questions.length)
          });

        answerPromises.push(answerPromise);
      }

      await Promise.all(answerPromises);

      // Calculate final scores and rating
      const maxPossibleScore = questions.reduce((sum, q) => sum + q.max_score, 0);
      const percentageScore = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
      
      let overallRating = 'poor';
      if (percentageScore >= 90) overallRating = 'excellent';
      else if (percentageScore >= 75) overallRating = 'good';
      else if (percentageScore >= 60) overallRating = 'average';

      // Update interview record
      const { data: updatedInterview, error: updateError } = await supabase
        .from('interviews')
        .update({
          status: 'completed',
          total_score: totalScore,
          percentage_score: percentageScore,
          overall_rating: overallRating,
          end_time: new Date().toISOString(),
          time_taken: 3600 - timeRemaining,
          ai_feedback: `Interview completed ${isAutoSubmit ? 'automatically' : 'manually'}. Total violations: ${violations.length}`
        })
        .eq('id', interview.id)
        .select()
        .single();

      if (updateError) throw updateError;

      toast.success('Interview submitted successfully!');
      onComplete(updatedInterview);
    } catch (error) {
      console.error('Failed to submit interview:', error);
      toast.error('Failed to submit interview');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const getTimeColor = () => {
    if (timeRemaining <= 300) return 'text-red-600'; // Last 5 minutes
    if (timeRemaining <= 600) return 'text-yellow-600'; // Last 10 minutes
    return 'text-green-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading interview...</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Questions Available</h2>
          <p className="text-gray-600">No questions found for this domain and experience level.</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswer = answers[currentQuestion.id] || {};

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Proctoring System */}
      <ProctoringSystem 
        onViolation={handleViolation}
        isActive={proctoringActive && !submitting}
      />

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-gray-900">
                {domain.name} Interview
              </h1>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                {examCode.experience_level}
              </span>
            </div>
            
            <div className="flex items-center gap-6">
              {!proctoringActive && (
                <button
                  onClick={startExam}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 font-medium"
                >
                  <Shield className="w-4 h-4" />
                  Start Test
                </button>
              )}
              
              {/* Violation Warning */}
              {violations.length > 0 && proctoringActive && (
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                  violations.length >= 2 
                    ? 'bg-red-100 text-red-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  <AlertTriangle className="w-4 h-4" />
                  {violations.length}/3 Violations
                </div>
              )}
              
              {/* Timer */}
              <div className={`flex items-center gap-2 font-mono text-lg font-bold ${proctoringActive ? getTimeColor() : 'text-gray-400'}`}>
                <Clock className="w-5 h-5" />
                {formatTime(timeRemaining)}
              </div>
              
              {/* Submit Button */}
              <button
                onClick={() => submitInterview(false)}
                disabled={submitting || !proctoringActive}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit Interview
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!proctoringActive && (
          <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">Ready to Begin?</h3>
                <p className="text-blue-800 text-sm">
                  Click "Start Test" to begin your proctored exam. Make sure you're in a quiet environment with good lighting.
                </p>
              </div>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Question Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sticky top-24">
              <h3 className="font-medium text-gray-900 mb-4">Questions</h3>
              <div className="space-y-2">
                {questions.map((question, index) => (
                  <button
                    key={question.id}
                    onClick={() => setCurrentQuestionIndex(index)}
                    disabled={!proctoringActive}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      !proctoringActive
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        :
                      index === currentQuestionIndex
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : answers[question.id]
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Q{index + 1}</span>
                      {answers[question.id] && (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      )}
                    </div>
                    <div className="text-xs mt-1 opacity-75">
                      {question.question_type.toUpperCase()} • {question.max_score} pts
                    </div>
                  </button>
                ))}
              </div>
              
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Progress: {Object.keys(answers).length}/{questions.length}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(Object.keys(answers).length / questions.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Main Question Area */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              {/* Question Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {currentQuestion.question_type === 'coding' ? (
                      <Code className="w-6 h-6 text-blue-600" />
                    ) : (
                      <FileText className="w-6 h-6 text-green-600" />
                    )}
                    <h2 className="text-xl font-bold text-gray-900">
                      Question {currentQuestionIndex + 1}
                    </h2>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      currentQuestion.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                      currentQuestion.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {currentQuestion.difficulty}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {currentQuestion.max_score} points • {Math.floor(currentQuestion.time_limit / 60)} min
                  </div>
                </div>
                
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {currentQuestion.title}
                </h3>
                <div className="text-gray-700 whitespace-pre-wrap">
                  {currentQuestion.description}
                </div>
              </div>

              {/* Answer Area */}
              <div className="p-6">
                {currentQuestion.question_type === 'mcq' && (
                  <div className="space-y-3">
                    {currentQuestion.options?.map((option, index) => (
                      <label key={index} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                          type="radio"
                          name={`question-${currentQuestion.id}`}
                          value={option}
                          checked={currentAnswer.text === option}
                          onChange={(e) => handleAnswerChange(currentQuestion.id, { text: e.target.value })}
                          disabled={!proctoringActive}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-gray-900">{option}</span>
                      </label>
                    ))}
                  </div>
                )}

                {currentQuestion.question_type === 'text' && (
                  <textarea
                    value={currentAnswer.text || ''}
                    onChange={(e) => handleAnswerChange(currentQuestion.id, { text: e.target.value })}
                    disabled={!proctoringActive}
                    className="w-full h-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Type your answer here..."
                  />
                )}

                {currentQuestion.question_type === 'coding' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">Code Editor</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">
                          Language: {currentQuestion.language}
                        </span>
                        <button
                          onClick={executeCurrentCode}
                         disabled={executing || !currentAnswer.code || !proctoringActive}
                          className="flex items-center gap-2 px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                        >
                          {executing ? (
                            <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Play className="w-3 h-3" />
                          )}
                          Run Code
                        </button>
                      </div>
                    </div>
                    
                    <div className="border border-gray-300 rounded-lg overflow-hidden">
                      <Editor
                        height="300px"
                        language={currentQuestion.language}
                        value={currentAnswer.code || currentQuestion.starter_code || ''}
                        onChange={(value) => handleAnswerChange(currentQuestion.id, { code: value || '' })}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 14,
                          lineNumbers: 'on',
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                          wordWrap: 'on',
                          readOnly: !proctoringActive
                        }}
                        theme="vs-dark"
                      />
                    </div>

                    {executionResult && (
                      <div className="bg-gray-900 text-white p-4 rounded-lg">
                        <h5 className="font-medium mb-2">Execution Result:</h5>
                        {executionResult.error ? (
                          <pre className="text-red-400 text-sm whitespace-pre-wrap">
                            {executionResult.error}
                          </pre>
                        ) : (
                          <pre className="text-green-400 text-sm whitespace-pre-wrap">
                            {executionResult.output || 'Code executed successfully (no output)'}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div className="p-6 border-t border-gray-200 flex justify-between">
                <button
                  onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                  disabled={currentQuestionIndex === 0 || !proctoringActive}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Previous
                </button>
                
                <button
                  onClick={() => setCurrentQuestionIndex(Math.min(questions.length - 1, currentQuestionIndex + 1))}
                  disabled={currentQuestionIndex === questions.length - 1 || !proctoringActive}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}