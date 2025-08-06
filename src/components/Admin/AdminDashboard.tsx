import React, { useState, useEffect } from 'react';
import { 
  Users, 
  FileText, 
  BarChart3, 
  Settings, 
  LogOut,
  Plus,
  Key,
  Clock,
  TrendingUp,
  Award,
  UserCheck
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { adminLogout } from '../../lib/auth';
import QuestionManager from './QuestionManager';
import ExamCodeManager from './ExamCodeManager';
import CandidateResults from './CandidateResults';
import toast from 'react-hot-toast';

interface AdminDashboardProps {
  admin: any;
  onLogout: () => void;
}

export default function AdminDashboard({ admin, onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    totalCandidates: 0,
    activeInterviews: 0,
    completedInterviews: 0,
    totalQuestions: 0,
    averageScore: 0
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [
        candidatesRes,
        activeInterviewsRes,
        completedInterviewsRes,
        questionsRes,
        scoresRes
      ] = await Promise.all([
        supabase.from('candidates').select('id', { count: 'exact' }),
        supabase.from('interviews').select('id', { count: 'exact' }).eq('status', 'in_progress'),
        supabase.from('interviews').select('id', { count: 'exact' }).eq('status', 'completed'),
        supabase.from('questions').select('id', { count: 'exact' }).eq('is_active', true),
        supabase.from('interviews').select('percentage_score').eq('status', 'completed')
      ]);

      const avgScore = scoresRes.data?.length > 0 
        ? scoresRes.data.reduce((sum, interview) => sum + (interview.percentage_score || 0), 0) / scoresRes.data.length
        : 0;

      setStats({
        totalCandidates: candidatesRes.count || 0,
        activeInterviews: activeInterviewsRes.count || 0,
        completedInterviews: completedInterviewsRes.count || 0,
        totalQuestions: questionsRes.count || 0,
        averageScore: avgScore
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleLogout = () => {
    adminLogout();
    toast.success('Logged out successfully');
    onLogout();
  };

  const StatCard = ({ icon: Icon, title, value, subtitle, color }: any) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'questions', label: 'Questions', icon: FileText },
    { id: 'exam-codes', label: 'Exam Codes', icon: Key },
    { id: 'results', label: 'Results', icon: Award },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600">Welcome back, {admin.name}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="lg:w-64 flex-shrink-0">
            <nav className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <ul className="space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <li key={tab.id}>
                      <button
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                          activeTab === tab.id
                            ? 'bg-blue-100 text-blue-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        {tab.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard
                    icon={Users}
                    title="Total Candidates"
                    value={stats.totalCandidates}
                    subtitle="Registered users"
                    color="bg-blue-500"
                  />
                  <StatCard
                    icon={Clock}
                    title="Active Interviews"
                    value={stats.activeInterviews}
                    subtitle="In progress"
                    color="bg-yellow-500"
                  />
                  <StatCard
                    icon={UserCheck}
                    title="Completed"
                    value={stats.completedInterviews}
                    subtitle="Finished interviews"
                    color="bg-green-500"
                  />
                  <StatCard
                    icon={TrendingUp}
                    title="Average Score"
                    value={`${stats.averageScore.toFixed(1)}%`}
                    subtitle="Overall performance"
                    color="bg-purple-500"
                  />
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                      onClick={() => setActiveTab('questions')}
                      className="flex items-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors group"
                    >
                      <Plus className="w-6 h-6 text-gray-400 group-hover:text-blue-500" />
                      <span className="font-medium text-gray-600 group-hover:text-blue-700">Add Questions</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('exam-codes')}
                      className="flex items-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors group"
                    >
                      <Key className="w-6 h-6 text-gray-400 group-hover:text-green-500" />
                      <span className="font-medium text-gray-600 group-hover:text-green-700">Manage Exam Codes</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('results')}
                      className="flex items-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors group"
                    >
                      <Award className="w-6 h-6 text-gray-400 group-hover:text-purple-500" />
                      <span className="font-medium text-gray-600 group-hover:text-purple-700">View Results</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'questions' && <QuestionManager admin={admin} />}
            {activeTab === 'exam-codes' && <ExamCodeManager admin={admin} />}
            {activeTab === 'results' && <CandidateResults />}
            
            {activeTab === 'settings' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Settings</h3>
                <p className="text-gray-600">Settings panel coming soon...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}