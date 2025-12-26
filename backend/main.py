from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
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

# CORS Configuration
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
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

# ============= GLOBAL VARIABLES =============

db = None
retrieval_chain = None

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_level="info"
    )