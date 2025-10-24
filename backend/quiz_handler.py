"""
Psychometric Quiz Handler
Handles question generation, scoring, and feedback
"""

import json
import time
import os
from typing import List, Dict, Any
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

# Initialize Groq client
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not found in environment variables")

client = Groq(api_key=GROQ_API_KEY)


def call_groq(prompt: str, system_prompt: str = "", temperature: float = 0.7, max_tokens: int = 2000) -> str:
    """Call Groq API with error handling"""
    try:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error calling Groq: {str(e)}")
        return None


def determine_difficulty_level(age: int, education: str) -> Dict[str, Any]:
    """Determine difficulty based on age and education"""
    education_scores = {
        'Primary school': 1, 
        'Secondary school': 2, 
        'High school': 3,
        'Undergraduate': 5, 
        'Graduate': 7, 
        'PhD/Research': 9, 
        'Professional': 6
    }
    
    edu_score = education_scores.get(education, 3)
    age_contrib = 0 if age < 12 else 1 if age < 18 else 2 if age < 25 else 3
    total_score = min(10, edu_score + age_contrib)
    
    if total_score <= 3:
        return {"level": "beginner", "score": total_score}
    elif total_score <= 6:
        return {"level": "intermediate", "score": total_score}
    elif total_score <= 8:
        return {"level": "advanced", "score": total_score}
    else:
        return {"level": "expert", "score": total_score}


def generate_questions(domain: str, difficulty_info: Dict, num_questions: int = 10) -> List[Dict]:
    """Generate questions using Groq with validation"""
    system_prompt = "You are an expert in creating research aptitude assessment questions. Always return valid JSON."
    
    user_prompt = f"""Create exactly {num_questions} multiple-choice questions for research aptitude in {domain}.

Difficulty Level: {difficulty_info['level']}

IMPORTANT: Return ONLY a valid JSON array, nothing else. No markdown, no extra text.

[
  {{
    "stem": "What is the first step in the scientific method?",
    "options": ["Observation", "Hypothesis", "Experiment", "Conclusion"],
    "answer": 0,
    "explanation": "Observation is typically the first step as it leads to questions and hypotheses."
  }},
  ...
]

Requirements:
- Each question must have exactly 4 options
- "answer" must be 0, 1, 2, or 3
- All fields are required"""

    print(f"Generating {num_questions} questions for {domain}...")
    
    response = call_groq(user_prompt, system_prompt, temperature=0.5, max_tokens=4000)
    
    if not response:
        print("ERROR: No response from Groq")
        return []
    
    try:
        # Find JSON in response
        start_idx = response.find('[')
        end_idx = response.rfind(']') + 1
        
        if start_idx == -1 or end_idx == 0:
            print(f"ERROR: No JSON array found in response")
            print(f"Response: {response[:200]}")
            return []
        
        json_str = response[start_idx:end_idx]
        questions = json.loads(json_str)
        
        if not isinstance(questions, list):
            print("ERROR: Response is not a list")
            return []
        
        # Validate questions
        validated = []
        for i, q in enumerate(questions):
            try:
                if not all(k in q for k in ['stem', 'options', 'answer']):
                    print(f"Question {i}: Missing required fields")
                    continue
                
                if not isinstance(q['options'], list) or len(q['options']) != 4:
                    print(f"Question {i}: Options must be a list of 4 items")
                    continue
                
                if not isinstance(q['answer'], int) or not (0 <= q['answer'] <= 3):
                    print(f"Question {i}: Answer must be 0-3, got {q['answer']}")
                    continue
                
                validated.append(q)
            except Exception as e:
                print(f"Question {i}: Validation error - {str(e)}")
                continue
        
        if not validated:
            print("ERROR: No valid questions generated")
            return []
        
        print(f"✅ Generated {len(validated)} valid questions")
        return validated[:num_questions]
        
    except json.JSONDecodeError as e:
        print(f"ERROR: JSON parsing failed - {str(e)}")
        print(f"Response: {response[:300]}")
        return []
    except Exception as e:
        print(f"ERROR: Unexpected error - {str(e)}")
        return []


def calculate_score(correct: int, total: int, time_taken: float, difficulty_score: int) -> Dict:
    """Calculate psychometric score"""
    accuracy = (correct / total) * 100 if total > 0 else 0
    avg_time = time_taken / total if total > 0 else time_taken
    
    # Time-based scoring
    if 30 <= avg_time <= 60:
        time_score = 100
    elif avg_time < 30:
        time_score = 80
    else:
        time_score = max(50, 100 - (avg_time - 60) * 2)
    
    # Difficulty multiplier
    difficulty_multiplier = 1 + (difficulty_score / 20)
    adjusted_score = accuracy * difficulty_multiplier
    
    # Final aptitude score
    aptitude_score = accuracy * 0.6 + time_score * 0.2 + adjusted_score * 0.2
    
    # Categorize performance
    if aptitude_score >= 85:
        level, fit = "Exceptional", "Highly Suitable"
    elif aptitude_score >= 70:
        level, fit = "Strong", "Well Suited"
    elif aptitude_score >= 55:
        level, fit = "Moderate", "Suitable with Development"
    elif aptitude_score >= 40:
        level, fit = "Developing", "Needs Foundation"
    else:
        level, fit = "Beginner", "Requires Development"
    
    return {
        "aptitude_score": round(aptitude_score, 2),
        "accuracy": round(accuracy, 2),
        "level": level,
        "fit": fit,
        "correct": correct,
        "total": total,
        "time_taken": round(time_taken, 2)
    }


def generate_feedback(user_meta: Dict, score_data: Dict, questions: List[Dict], user_answers: List[int]) -> str:
    """Generate detailed feedback"""
    
    wrong_topics = []
    for i, (q, ans) in enumerate(zip(questions, user_answers)):
        if ans != q['answer']:
            wrong_topics.append({
                'question': q['stem'][:80] + "..." if len(q['stem']) > 80 else q['stem'],
                'your_answer': q['options'][ans] if 0 <= ans < len(q['options']) else "No answer",
                'correct_answer': q['options'][q['answer']],
                'explanation': q.get('explanation', 'Review this concept')
            })
    
    wrong_analysis = ""
    if wrong_topics:
        wrong_analysis = "\n\n**Questions You Got Wrong:**\n\n"
        for idx, item in enumerate(wrong_topics[:5], 1):  # Limit to first 5
            wrong_analysis += f"{idx}. **Q:** {item['question']}\n"
            wrong_analysis += f"   - **Your Answer:** {item['your_answer']}\n"
            wrong_analysis += f"   - **Correct Answer:** {item['correct_answer']}\n"
            wrong_analysis += f"   - **Why:** {item['explanation']}\n\n"
    
    system_prompt = "You are an expert educational psychologist providing personalized career guidance. Be concise and practical."
    
    user_prompt = f"""Generate personalized feedback for a research aptitude assessment.

**User Profile:**
- Age: {user_meta['age']}
- Education: {user_meta['education']}
- Domain: {user_meta['domain']}

**Results:**
- Score: {score_data['aptitude_score']}/100
- Accuracy: {score_data['accuracy']}%
- Correct: {score_data['correct']}/{score_data['total']}
- Performance Level: {score_data['level']}
- Domain Fit: {score_data['fit']}

{wrong_analysis}

Provide structured feedback with:

1. Overall Performance Analysis (2-3 sentences)
2. Your Strengths (3-4 bullet points)
3. Areas for Improvement (3-4 bullet points)
4. Topic-Specific Study Recommendations (3-4 items)
5. Career Path Guidance in {user_meta['domain']} (2-3 sentences)

Be encouraging and practical."""

    print("Generating personalized feedback...")
    response = call_groq(user_prompt, system_prompt, temperature=0.7, max_tokens=2000)
    
    if not response:
        return "Continue building your research skills and domain expertise!"
    
    return response