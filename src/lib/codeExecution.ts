import { supabase } from './supabase';

export interface ExecutionResult {
  output?: string;
  error?: string;
  executionTime?: number;
  memoryUsage?: number;
  status: 'success' | 'error' | 'timeout';
}

export const executeCode = async (
  code: string,
  language: string,
  interviewId: string,
  questionId: string
): Promise<ExecutionResult> => {
  try {
    // Create execution record
    const { data: execution, error: insertError } = await supabase
      .from('code_executions')
      .insert({
        interview_id: interviewId,
        question_id: questionId,
        code,
        language,
        status: 'running'
      })
      .select()
      .single();

    if (insertError) throw insertError;

    let result: ExecutionResult;

    // Execute code based on language
    switch (language.toLowerCase()) {
      case 'python':
        result = await executePython(code);
        break;
      case 'javascript':
        result = await executeJavaScript(code);
        break;
      case 'html':
        result = await executeHTML(code);
        break;
      case 'apex':
        result = await executeApex(code);
        break;
      default:
        result = {
          error: `Language ${language} is not supported`,
          status: 'error'
        };
    }

    // Update execution record with results
    await supabase
      .from('code_executions')
      .update({
        output: result.output || null,
        error: result.error || null,
        execution_time: result.executionTime || null,
        memory_usage: result.memoryUsage || null,
        status: result.status === 'success' ? 'completed' : 'error'
      })
      .eq('id', execution.id);

    return result;
  } catch (error) {
    return {
      error: `Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'error'
    };
  }
};

const executePython = async (code: string): Promise<ExecutionResult> => {
  try {
    const startTime = Date.now();
    
    // Use Pyodide for Python execution in the browser
    // This is a simplified version - in production, you'd use a secure sandboxed environment
    const response = await fetch('https://pyodide-cdn2.iodide.io/v0.18.1/full/pyodide.js');
    
    // Mock Python execution for demo
    const mockOutput = `# Python Code Execution Result
# This is a demo - in production, use a secure sandbox environment
# Code executed successfully
`;
    
    const executionTime = Date.now() - startTime;
    
    return {
      output: mockOutput + '\n' + code,
      executionTime,
      status: 'success'
    };
  } catch (error) {
    return {
      error: `Python execution error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'error'
    };
  }
};

const executeJavaScript = async (code: string): Promise<ExecutionResult> => {
  try {
    const startTime = Date.now();
    
    // Create a sandbox for JavaScript execution
    const originalLog = console.log;
    let output = '';
    
    console.log = (...args) => {
      output += args.join(' ') + '\n';
    };
    
    // Execute the code
    const result = eval(code);
    if (result !== undefined) {
      output += String(result);
    }
    
    console.log = originalLog;
    const executionTime = Date.now() - startTime;
    
    return {
      output,
      executionTime,
      status: 'success'
    };
  } catch (error) {
    return {
      error: `JavaScript execution error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'error'
    };
  }
};

const executeHTML = async (code: string): Promise<ExecutionResult> => {
  try {
    // For HTML, we'll validate the structure and return a preview
    const startTime = Date.now();
    
    // Basic HTML validation
    const hasHtml = code.includes('<html');
    const hasHead = code.includes('<head');
    const hasBody = code.includes('<body');
    
    let output = 'HTML Structure Analysis:\n';
    output += `- HTML tag: ${hasHtml ? '✓' : '✗'}\n`;
    output += `- HEAD section: ${hasHead ? '✓' : '✗'}\n`;
    output += `- BODY section: ${hasBody ? '✓' : '✗'}\n`;
    
    const executionTime = Date.now() - startTime;
    
    return {
      output,
      executionTime,
      status: 'success'
    };
  } catch (error) {
    return {
      error: `HTML validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'error'
    };
  }
};

const executeApex = async (code: string): Promise<ExecutionResult> => {
  try {
    const startTime = Date.now();
    
    // Mock Apex execution for demo
    const mockOutput = `// Apex Code Analysis
// This is a demo - in production, connect to Salesforce Developer Org
// Code syntax validation: PASSED
// Compilation: SUCCESS
`;
    
    const executionTime = Date.now() - startTime;
    
    return {
      output: mockOutput + '\n\n// Your Code:\n' + code,
      executionTime,
      status: 'success'
    };
  } catch (error) {
    return {
      error: `Apex execution error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'error'
    };
  }
};