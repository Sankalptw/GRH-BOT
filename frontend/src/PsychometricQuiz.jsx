import React, { useState } from 'react';

const BACKEND_URL = "http://127.0.0.1:8000";

const PsychometricQuiz = ({ onClose }) => {
  const [step, setStep] = useState('setup');
  const [formData, setFormData] = useState({
    age: 20,
    education: 'Undergraduate',
    domain: 'Computer Science'
  });
  const [quizData, setQuizData] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [questionNum, setQuestionNum] = useState(1);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  const startQuiz = async () => {
    setLoading(true);
    try {
      console.log('Starting quiz with data:', formData);
      const response = await fetch(`${BACKEND_URL}/api/quiz/start`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(formData),
        credentials: 'include',
        mode: 'cors'
      });
      
      console.log('Start quiz response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Start quiz error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Quiz start response:', data);
      
      if (data.success) {
        setQuizData(data);
        setCurrentQuestion(data.first_question);
        setQuestionNum(1);
        setSessionId(data.session_id);
        console.log('Session ID stored:', data.session_id);
        setStep('quiz');
      } else {
        console.error('Quiz start failed:', data.message);
        alert(`Failed to start quiz: ${data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error starting quiz:', error);
      alert(`Error starting quiz: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (selectedAnswer === null) return;
    
    setLoading(true);
    try {
      console.log('Submitting answer:', selectedAnswer, 'for question:', questionNum);
      
      const response = await fetch(`${BACKEND_URL}/api/quiz/answer`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          answer: selectedAnswer,
          question_num: questionNum,
          session_id: sessionId
        }),
        credentials: 'include',
        mode: 'cors'
      });
      
      console.log('Answer submit response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Answer submit error:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Answer response data:', JSON.stringify(data, null, 2));
      
      if (data.completed === true) {
        console.log('Quiz completed! Fetching results...');
        
        const resultsResponse = await fetch(`${BACKEND_URL}/api/quiz/results?session_id=${sessionId}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          credentials: 'include',
          mode: 'cors'
        });
        
        console.log('Results response status:', resultsResponse.status);
        
        if (!resultsResponse.ok) {
          const errorText = await resultsResponse.text();
          console.error('Results fetch error:', errorText);
          throw new Error(`Results HTTP ${resultsResponse.status}: ${errorText}`);
        }
        
        const resultsData = await resultsResponse.json();
        console.log('Results data:', resultsData);
        
        if (resultsData.success && resultsData.score_data) {
          setResults(resultsData);
          setStep('results');
        } else {
          throw new Error('Invalid results format from server');
        }
      } else if (data.completed === false && data.next_question) {
        console.log('Moving to next question:', data.next_question.question_num);
        setCurrentQuestion(data.next_question);
        setQuestionNum(data.next_question.question_num);
        setSelectedAnswer(null);
      } else {
        throw new Error(`Unexpected response: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    modal: {
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1rem'
    },
    content: {
      backgroundColor: 'white',
      borderRadius: '1rem',
      padding: '2rem',
      maxWidth: '42rem',
      width: '100%',
      maxHeight: '90vh',
      overflowY: 'auto',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
    },
    header: {
      marginBottom: '1.5rem'
    },
    title: {
      fontSize: '1.5rem',
      fontWeight: 'bold',
      color: '#1f2937',
      marginBottom: '0.5rem'
    },
    formGroup: {
      marginBottom: '1.5rem'
    },
    label: {
      display: 'block',
      fontSize: '0.875rem',
      fontWeight: '600',
      color: '#374151',
      marginBottom: '0.5rem'
    },
    input: {
      width: '100%',
      padding: '0.5rem 0.75rem',
      border: '2px solid #e5e7eb',
      borderRadius: '0.5rem',
      fontSize: '1rem',
      boxSizing: 'border-box'
    },
    buttonGroup: {
      display: 'flex',
      gap: '1rem',
      marginTop: '2rem'
    },
    btnPrimary: {
      flex: 1,
      backgroundColor: '#2563eb',
      color: 'white',
      padding: '0.75rem 1.5rem',
      borderRadius: '0.5rem',
      border: 'none',
      fontSize: '1rem',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'background-color 0.2s'
    },
    btnSecondary: {
      flex: 1,
      backgroundColor: '#f3f4f6',
      color: '#374151',
      padding: '0.75rem 1.5rem',
      borderRadius: '0.5rem',
      border: 'none',
      fontSize: '1rem',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'background-color 0.2s'
    },
    questionCard: {
      backgroundColor: '#f9fafb',
      padding: '1.5rem',
      borderRadius: '0.75rem',
      marginBottom: '1.5rem'
    },
    optionBtn: {
      width: '100%',
      padding: '1rem',
      marginBottom: '0.75rem',
      borderWidth: '2px',
      borderStyle: 'solid',
      borderColor: '#e5e7eb',
      borderRadius: '0.5rem',
      backgroundColor: 'white',
      cursor: 'pointer',
      textAlign: 'left',
      fontSize: '1rem',
      transition: 'all 0.2s'
    },
    optionBtnSelected: {
      borderColor: '#2563eb',
      backgroundColor: '#eff6ff'
    },
    resultsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '1rem',
      marginBottom: '2rem'
    },
    scoreCard: {
      padding: '1.5rem',
      backgroundColor: '#f9fafb',
      borderRadius: '0.75rem',
      textAlign: 'center'
    },
    scoreValue: {
      fontSize: '2rem',
      fontWeight: 'bold',
      color: '#2563eb',
      margin: '0.5rem 0'
    },
    feedbackSection: {
      backgroundColor: '#f0f9ff',
      padding: '1.5rem',
      borderRadius: '0.75rem',
      marginBottom: '1.5rem'
    }
  };

  return (
    <div style={styles.modal} onClick={onClose}>
      <div style={styles.content} onClick={(e) => e.stopPropagation()}>
        {/* Setup Step */}
        {step === 'setup' && (
          <div>
            <div style={styles.header}>
              <h2 style={styles.title}>📊 Psychometric Assessment</h2>
              <p style={{ color: '#6b7280' }}>Let's evaluate your research aptitude</p>
            </div>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Age:</label>
              <input
                style={styles.input}
                type="number"
                value={formData.age}
                onChange={(e) => setFormData({...formData, age: parseInt(e.target.value)})}
                min="8"
                max="60"
              />
            </div>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Education Level:</label>
              <select
                style={styles.input}
                value={formData.education}
                onChange={(e) => setFormData({...formData, education: e.target.value})}
              >
                <option>Primary school</option>
                <option>Secondary school</option>
                <option>High school</option>
                <option>Undergraduate</option>
                <option>Graduate</option>
                <option>PhD/Research</option>
                <option>Professional</option>
              </select>
            </div>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Domain:</label>
              <select
                style={styles.input}
                value={formData.domain}
                onChange={(e) => setFormData({...formData, domain: e.target.value})}
              >
                <option>Biology</option>
                <option>Computer Science</option>
                <option>Psychology</option>
                <option>Physics</option>
                <option>Chemistry</option>
                <option>Mathematics</option>
                <option>Engineering</option>
                <option>Medicine</option>
              </select>
            </div>
            
            <div style={styles.buttonGroup}>
              <button onClick={onClose} style={styles.btnSecondary}>Cancel</button>
              <button 
                onClick={startQuiz} 
                disabled={loading} 
                style={{
                  ...styles.btnPrimary,
                  opacity: loading ? 0.5 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Generating...' : 'Start Quiz'}
              </button>
            </div>
          </div>
        )}

        {/* Quiz Step */}
        {step === 'quiz' && currentQuestion && quizData && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
              <span>Question {questionNum}/{quizData.total_questions}</span>
              <span>{Math.round((questionNum/quizData.total_questions)*100)}% Complete</span>
            </div>
            
            <div style={styles.questionCard}>
              <h3 style={{ fontSize: '1.125rem', marginBottom: '0' }}>{currentQuestion.stem}</h3>
            </div>
            
            <div>
              {currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  style={{
                    ...styles.optionBtn,
                    ...(selectedAnswer === index ? styles.optionBtnSelected : {})
                  }}
                  onClick={() => setSelectedAnswer(index)}
                >
                  <strong>{String.fromCharCode(65 + index)}.</strong> {option}
                </button>
              ))}
            </div>
            
            <button
              style={{
                ...styles.btnPrimary,
                width: '100%',
                opacity: (selectedAnswer === null || loading) ? 0.5 : 1,
                cursor: (selectedAnswer === null || loading) ? 'not-allowed' : 'pointer'
              }}
              onClick={submitAnswer}
              disabled={selectedAnswer === null || loading}
            >
              {loading ? 'Loading...' : (questionNum === quizData.total_questions ? '🏁 Submit Quiz' : '➡️ Next Question')}
            </button>
          </div>
        )}

        {/* Results Step */}
        {step === 'results' && results && results.score_data && (
          <div>
            <h2 style={{ ...styles.title, textAlign: 'center', marginBottom: '2rem' }}>✨ Assessment Complete!</h2>
            
            <div style={styles.resultsGrid}>
              <div style={styles.scoreCard}>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Aptitude Score</div>
                <div style={styles.scoreValue}>{results.score_data.aptitude_score}</div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>out of 100</div>
              </div>
              
              <div style={styles.scoreCard}>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Accuracy</div>
                <div style={styles.scoreValue}>{results.score_data.accuracy}%</div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{results.score_data.correct}/{results.score_data.total} correct</div>
              </div>
              
              <div style={styles.scoreCard}>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Level</div>
                <div style={{ ...styles.scoreValue, fontSize: '1.25rem' }}>{results.score_data.level}</div>
              </div>
              
              <div style={styles.scoreCard}>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Domain Fit</div>
                <div style={{ ...styles.scoreValue, fontSize: '1.25rem' }}>{results.score_data.fit}</div>
              </div>
            </div>
            
            <div style={styles.feedbackSection}>
              <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>💡 Your Personalized Feedback</h3>
              <div>
                {results.feedback && results.feedback.split('\n').map((line, i) => (
                  <p key={i} style={{ marginBottom: '0.75rem', lineHeight: '1.6', color: '#374151' }}>{line}</p>
                ))}
              </div>
            </div>
            
            <button onClick={onClose} style={{ ...styles.btnPrimary, width: '100%' }}>
              Return to Chat
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PsychometricQuiz;