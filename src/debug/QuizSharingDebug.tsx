import React, { useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import { logger } from '../services/logService';

export const QuizSharingDebug: React.FC = () => {
  const [shareId, setShareId] = useState('0f551e5e-101e-460f-b8e4-43072d9192b0');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testQuizSharing = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      logger.info('=== DEBUG TEST === Starting quiz sharing test', 'QuizSharingDebug', { shareId });
      console.log('🧪 Starting quiz sharing test with ID:', shareId);
      
      const quiz = await supabaseService.getPublicQuizById(shareId);
      
      if (quiz) {
        setResult({
          success: true,
          quiz: {
            id: quiz.id,
            title: quiz.title,
            questionsCount: quiz.questions?.length || 0,
            creator: quiz.creator,
            isShared: quiz.isShared,
            sharedTimestamp: quiz.sharedTimestamp
          }
        });
        console.log('✅ Quiz sharing test successful:', quiz);
      } else {
        setResult({
          success: false,
          message: 'Quiz not found or not accessible'
        });
        console.log('❌ Quiz sharing test failed: Quiz not found');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('💥 Quiz sharing test error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h2>🔬 Quiz Sharing Debug Tool</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="shareId">Share ID:</label>
        <br />
        <input
          id="shareId"
          type="text"
          value={shareId}
          onChange={(e) => setShareId(e.target.value)}
          style={{ 
            width: '400px', 
            padding: '8px', 
            fontFamily: 'monospace',
            border: '1px solid #ccc',
            borderRadius: '4px'
          }}
        />
      </div>
      
      <button 
        onClick={testQuizSharing}
        disabled={loading}
        style={{
          padding: '10px 20px',
          backgroundColor: loading ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? '🔄 Testing...' : '🚀 Test Quiz Sharing'}
      </button>
      
      {error && (
        <div style={{ 
          marginTop: '20px', 
          padding: '10px', 
          backgroundColor: '#ffe6e6', 
          border: '1px solid #ff9999',
          borderRadius: '4px',
          color: '#cc0000'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {result && (
        <div style={{ 
          marginTop: '20px', 
          padding: '10px', 
          backgroundColor: result.success ? '#e6ffe6' : '#ffe6e6',
          border: `1px solid ${result.success ? '#99ff99' : '#ff9999'}`,
          borderRadius: '4px'
        }}>
          <strong>Result:</strong>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: '10px' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
      
      <div style={{ 
        marginTop: '30px', 
        padding: '10px', 
        backgroundColor: '#f5f5f5',
        border: '1px solid #ddd',
        borderRadius: '4px'
      }}>
        <h4>📋 Instructions:</h4>
        <ol>
          <li>Open browser console (F12) to see detailed logs</li>
          <li>Enter a quiz share ID (or use the default)</li>
          <li>Click "Test Quiz Sharing" to test the functionality</li>
          <li>Check the result and console logs for debugging info</li>
        </ol>
        
        <h4>🔍 Common Test IDs:</h4>
        <ul>
          <li><code>0f551e5e-101e-460f-b8e4-43072d9192b0</code> - Known quiz ID</li>
          <li><code>invalid-id-test</code> - Test invalid ID handling</li>
        </ul>
      </div>
    </div>
  );
};
