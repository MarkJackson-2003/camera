import React from 'react';

interface InterviewInterfaceProps {
  timeRemaining: number;
}

const InterviewInterface: React.FC<InterviewInterfaceProps> = ({ timeRemaining }) => {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div>
      <span style={{ color: 'red', fontWeight: 'bold' }}>
        {formatTime(timeRemaining)}
      </span>
    </div>
  );
};

export default InterviewInterface;