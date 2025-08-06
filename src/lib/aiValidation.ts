import { supabase } from './supabase';
import type { Question, InterviewAnswer } from './supabase';

export interface AIValidationResult {
  score: number;
  maxScore: number;
  feedback: string;
  suggestions: string[];
  strengths: string[];
  weaknesses: string[];
}

export const validateAnswer = async (
  question: Question,
  answer: string,
  executionResult?: any
): Promise<AIValidationResult> => {
  try {
    // This is a mock AI validation - in production, you'd use OpenAI, Claude, or similar
    const result = await mockAIValidation(question, answer, executionResult);
    return result;
  } catch (error) {
    console.error('AI validation error:', error);
    return {
      score: 0,
      maxScore: question.max_score,
      feedback: 'Unable to validate answer due to system error.',
      suggestions: ['Please try submitting again.'],
      strengths: [],
      weaknesses: ['System validation failed']
    };
  }
};

const mockAIValidation = async (
  question: Question,
  answer: string,
  executionResult?: any
): Promise<AIValidationResult> => {
  // Simulate AI processing time
  await new Promise(resolve => setTimeout(resolve, 1000));

  const maxScore = question.max_score;
  let score = 0;
  const suggestions: string[] = [];
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  switch (question.question_type) {
    case 'mcq':
      // MCQ validation
      if (answer === question.correct_answer) {
        score = maxScore;
        strengths.push('Correct answer selected');
      } else {
        score = 0;
        weaknesses.push('Incorrect answer selected');
        suggestions.push(`The correct answer is: ${question.correct_answer}`);
      }
      break;

    case 'coding':
      // Coding validation
      score = validateCodingAnswer(question, answer, executionResult);
      if (score >= maxScore * 0.8) {
        strengths.push('Excellent code implementation');
        strengths.push('Good programming practices followed');
      } else if (score >= maxScore * 0.6) {
        strengths.push('Code works but can be improved');
        suggestions.push('Consider edge cases and error handling');
      } else {
        weaknesses.push('Code needs significant improvement');
        suggestions.push('Review the problem requirements');
        suggestions.push('Test your code with different inputs');
      }
      break;

    case 'text':
      // Text answer validation
      score = validateTextAnswer(question, answer);
      if (score >= maxScore * 0.8) {
        strengths.push('Comprehensive and well-structured answer');
      } else {
        suggestions.push('Provide more detailed explanation');
        suggestions.push('Include relevant examples');
      }
      break;
  }

  const feedback = generateFeedback(score, maxScore, strengths, weaknesses, suggestions);

  return {
    score,
    maxScore,
    feedback,
    suggestions,
    strengths,
    weaknesses
  };
};

const validateCodingAnswer = (question: Question, answer: string, executionResult?: any): number => {
  const maxScore = question.max_score;
  let score = 0;

  // Basic checks
  if (!answer || answer.trim().length === 0) {
    return 0;
  }

  // Check if code has basic structure
  if (answer.includes('def ') || answer.includes('function') || answer.includes('trigger')) {
    score += maxScore * 0.3; // 30% for basic structure
  }

  // Check execution result
  if (executionResult && !executionResult.error) {
    score += maxScore * 0.4; // 40% for running without errors
  }

  // Check for test cases (simplified)
  if (question.test_cases && question.test_cases.length > 0) {
    score += maxScore * 0.3; // 30% for test case compliance
  }

  return Math.min(score, maxScore);
};

const validateTextAnswer = (question: Question, answer: string): number => {
  const maxScore = question.max_score;
  
  if (!answer || answer.trim().length === 0) {
    return 0;
  }

  const wordCount = answer.trim().split(/\s+/).length;
  
  // Score based on answer length and relevance
  if (wordCount >= 50) {
    return maxScore * 0.9;
  } else if (wordCount >= 25) {
    return maxScore * 0.7;
  } else if (wordCount >= 10) {
    return maxScore * 0.5;
  } else {
    return maxScore * 0.3;
  }
};

const generateFeedback = (
  score: number,
  maxScore: number,
  strengths: string[],
  weaknesses: string[],
  suggestions: string[]
): string => {
  const percentage = (score / maxScore) * 100;
  let feedback = `Score: ${score}/${maxScore} (${percentage.toFixed(1)}%)\n\n`;

  if (strengths.length > 0) {
    feedback += '✅ Strengths:\n';
    strengths.forEach(strength => {
      feedback += `• ${strength}\n`;
    });
    feedback += '\n';
  }

  if (weaknesses.length > 0) {
    feedback += '⚠️ Areas for Improvement:\n';
    weaknesses.forEach(weakness => {
      feedback += `• ${weakness}\n`;
    });
    feedback += '\n';
  }

  if (suggestions.length > 0) {
    feedback += '💡 Suggestions:\n';
    suggestions.forEach(suggestion => {
      feedback += `• ${suggestion}\n`;
    });
  }

  return feedback;
};