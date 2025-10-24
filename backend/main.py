from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
import os
import logging
from datetime import datetime
from quiz_handler import (
    determine_difficulty_level,
    generate_questions,
    calculate_score,
    generate_feedback
)
import time
from typing import Dict, List
import uuid

from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create app
app = FastAPI(
    title="GRH Chatbot API",
    description="AI-powered chatbot for Global Research Hub",
    version="1.0.0"
)

# CORS Configuration - MUST be FIRST middleware
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# ============= REQUEST/RESPONSE MODELS =============

class QuestionRequest(BaseModel):
    question: str

class AnswerResponse(BaseModel):
    question: str
    answer: str
    status: str

class QuizStartRequest(BaseModel):
    age: int = 20
    education: str = "Undergraduate"
    domain: str = "Computer Science"

class QuizAnswerRequest(BaseModel):
    answer: int
    question_num: int
    session_id: str

# ============= GLOBAL VARIABLES =============

db = None
retrieval_chain = None

# Store quiz sessions in memory (use Redis or database in production)
quiz_sessions: Dict[str, Dict] = {}

def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

def initialize_rag_system():
    global db, retrieval_chain
    
    try:
        logger.info("🔄 Starting RAG system initialization...")
        
        logger.info("📄 Loading PDF...")
        loader = PyPDFLoader("Global Research Hub.pdf")
        documents = loader.load()
        logger.info(f"Loaded {len(documents)} pages from PDF")
        
        logger.info("Splitting documents...")
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
        )
        chunks = text_splitter.split_documents(documents)
        logger.info(f"✅ Created {len(chunks)} chunks")
        
        logger.info("Loading embeddings model...")
        embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={'device': 'cpu'},
            encode_kwargs={'normalize_embeddings': True}
        )
        logger.info("Embeddings model loaded")
        
        logger.info("Creating vector store...")
        db = FAISS.from_documents(chunks, embeddings)
        logger.info("Vector store created successfully")
        
        logger.info("Initializing LLM...")
        groq_api_key = os.getenv("GROQ_API_KEY")
        
        llm = ChatGroq(
            groq_api_key=groq_api_key,
            model="llama-3.3-70b-versatile",
            temperature=0,
            max_tokens=1024
        )
        logger.info("LLM initialized")
        
        prompt = ChatPromptTemplate.from_template("""You are a helpful assistant for Global Research Hub (GRH). Answer questions based on the provided context.

If the answer is not in the context, politely say you don't have that information and suggest contacting GRH directly.

Context: {context}

Question: {input}

Answer (be concise and helpful):""")
        
        logger.info("Building retrieval chain...")
        retriever = db.as_retriever(
            search_type="similarity",
            search_kwargs={"k": 4}
        )
        
        retrieval_chain = (
            {
                "context": retriever | format_docs,
                "input": RunnablePassthrough()
            }
            | prompt
            | llm
            | StrOutputParser()
        )
        logger.info("Retrieval chain created successfully!")
        logger.info("🎉 RAG system fully initialized and ready!")
        
        return True
        
    except Exception as e:
        logger.error(f"Error during RAG initialization: {str(e)}")
        raise

@app.on_event("startup")
async def startup_event():
    try:
        initialize_rag_system()
    except Exception as e:
        logger.error(f"Failed to initialize RAG system: {str(e)}")

@app.get("/")
async def root():
    return {
        "message": "GRH Chatbot API",
        "version": "1.0.0",
        "status": "active",
        "endpoints": {
            "ask": "/api/ask",
            "health": "/api/health",
            "quiz_start": "/api/quiz/start",
            "quiz_answer": "/api/quiz/answer",
            "quiz_results": "/api/quiz/results"
        }
    }

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "components": {
            "vector_store": db is not None,
            "retrieval_chain": retrieval_chain is not None,
            "ready": db is not None and retrieval_chain is not None
        }
    }

@app.post("/api/ask", response_model=AnswerResponse)
async def ask_question(request: QuestionRequest):
    global retrieval_chain
    
    if retrieval_chain is None:
        raise HTTPException(
            status_code=503,
            detail="RAG system is still initializing. Please try again in a moment."
        )
    
    if not request.question.strip():
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty"
        )
    
    try:
        logger.info(f"Processing question: {request.question[:100]}...")
        
        answer = retrieval_chain.invoke(request.question)
        
        logger.info(f"Answer generated successfully")
        
        return AnswerResponse(
            question=request.question,
            answer=answer,
            status="success"
        )
    
    except Exception as e:
        logger.error(f"Error processing question: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while processing your question. Please try again."
        )

# ============= PSYCHOMETRIC QUIZ ROUTES =============

def get_session_id(request: Request) -> str:
    """Get session ID from request cookies"""
    session_id = request.cookies.get("session_id")
    if session_id:
        logger.info(f"Found session in cookie: {session_id}")
    return session_id

@app.post('/api/quiz/start')
async def start_quiz(quiz_request: QuizStartRequest, request: Request):
    """Initialize quiz session"""
    try:
        age = quiz_request.age
        education = quiz_request.education
        domain = quiz_request.domain
        
        logger.info(f"Starting quiz: age={age}, education={education}, domain={domain}")
        
        # Determine difficulty
        difficulty_info = determine_difficulty_level(age, education)
        logger.info(f"Difficulty determined: {difficulty_info}")
        
        # Generate questions
        questions = generate_questions(domain, difficulty_info, num_questions=10)
        
        if not questions:
            logger.error("Failed to generate questions")
            return {
                'success': False,
                'message': 'Failed to generate questions'
            }
        
        logger.info(f"Generated {len(questions)} questions")
        
        # Create session ID
        session_id = str(uuid.uuid4())
        logger.info(f"Created quiz session: {session_id}")
        
        # Store in session
        quiz_sessions[session_id] = {
            'questions': questions,
            'user_meta': {'age': age, 'education': education, 'domain': domain},
            'difficulty_info': difficulty_info,
            'answers': [],
            'start_time': time.time()
        }
        
        logger.info(f"Quiz session stored with {len(questions)} questions")
        
        response = JSONResponse({
            'success': True,
            'session_id': session_id,
            'total_questions': len(questions),
            'difficulty': difficulty_info['level'],
            'first_question': {
                'question_num': 1,
                'stem': questions[0]['stem'],
                'options': questions[0]['options']
            }
        })
        
        # Set session cookie
        response.set_cookie(
            key="session_id",
            value=session_id,
            max_age=3600,
            secure=False,
            httponly=False,
            samesite="lax",
            path="/"
        )
        
        logger.info(f"Setting session cookie: {session_id}")
        logger.info(f"Response headers: {response.headers}")
        return response
        
    except Exception as e:
        logger.error(f"Error starting quiz: {str(e)}", exc_info=True)
        return {
            'success': False,
            'message': str(e)
        }


@app.post('/api/quiz/answer')
async def submit_quiz_answer(answer_request: QuizAnswerRequest, request: Request):
    """Submit answer and get next question"""
    try:
        answer = answer_request.answer
        question_num = answer_request.question_num
        session_id = answer_request.session_id
        
        logger.info(f"Answer submission - Session: {session_id}, Question: {question_num}, Answer: {answer}")
        
        if not session_id or session_id not in quiz_sessions:
            logger.error(f"No quiz session found for {session_id}")
            return {
                'success': False,
                'message': f'No active quiz session for {session_id}',
                'completed': False
            }
        
        quiz_data = quiz_sessions[session_id]
        quiz_data['answers'].append(answer)
        
        logger.info(f"Answer stored. Total answers so far: {len(quiz_data['answers'])}")
        logger.info(f"Total questions: {len(quiz_data['questions'])}")
        
        # Check if more questions
        total_questions = len(quiz_data['questions'])
        
        if question_num < total_questions:
            # More questions exist
            next_question_idx = question_num
            next_q = quiz_data['questions'][next_question_idx]
            
            logger.info(f"Sending next question: {question_num + 1}/{total_questions}")
            
            return {
                'success': True,
                'completed': False,
                'next_question': {
                    'question_num': question_num + 1,
                    'stem': next_q['stem'],
                    'options': next_q['options']
                }
            }
        else:
            # Quiz completed
            logger.info(f"Quiz completed! All {total_questions} answers submitted")
            return {
                'success': True,
                'completed': True
            }
            
    except Exception as e:
        logger.error(f"Error submitting answer: {str(e)}", exc_info=True)
        return {
            'success': False,
            'message': str(e),
            'completed': False
        }


@app.get('/api/quiz/results')
async def get_quiz_results(session_id: str, request: Request):
    """Calculate and return results"""
    try:
        logger.info(f"Results request - Session: {session_id}")
        
        if not session_id or session_id not in quiz_sessions:
            logger.error(f"No quiz session found for {session_id}")
            return {
                'success': False,
                'message': f'No quiz session found for {session_id}'
            }
        
        quiz_data = quiz_sessions[session_id]
        questions = quiz_data['questions']
        answers = quiz_data['answers']
        user_meta = quiz_data['user_meta']
        difficulty_info = quiz_data['difficulty_info']
        
        logger.info(f"Calculating results: {len(answers)} answers for {len(questions)} questions")
        
        # Calculate score
        time_taken = time.time() - quiz_data['start_time']
        correct = sum(1 for i, ans in enumerate(answers) if ans == questions[i]['answer'])
        
        logger.info(f"Calculating score: {correct}/{len(questions)} correct, Time: {time_taken}s")
        
        score_data = calculate_score(
            correct,
            len(questions),
            time_taken,
            difficulty_info['score']
        )
        
        logger.info(f"Score calculated: {score_data['aptitude_score']}/100")
        
        # Generate feedback
        logger.info("Generating feedback...")
        feedback = generate_feedback(user_meta, score_data, questions, answers)
        
        logger.info("Feedback generated successfully")
        
        # Clear session
        del quiz_sessions[session_id]
        logger.info(f"Session cleared: {session_id}")
        
        return {
            'success': True,
            'score_data': score_data,
            'feedback': feedback
        }
        
    except Exception as e:
        logger.error(f"Error getting results: {str(e)}", exc_info=True)
        return {
            'success': False,
            'message': str(e)
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_level="info"
    )