from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
import os
import logging
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="GRH Chatbot API",
    description="AI-powered chatbot for Global Research Hub",
    version="2.0.0"
)

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
)

class QuestionRequest(BaseModel):
    question: str

class AnswerResponse(BaseModel):
    question: str
    answer: str
    status: str

vector_store = None
qa_chain = None

def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

def initialize_rag():
    global vector_store, qa_chain
    
    try:
        logger.info("Initializing RAG system...")
        
        openai_key = os.getenv("OPENAI_API_KEY")
        if not openai_key:
            raise ValueError("OPENAI_API_KEY not found")
        
        loader = PyPDFLoader("Global Research Hub.pdf")
        documents = loader.load()
        logger.info(f"Loaded {len(documents)} pages")
        
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
        )
        chunks = splitter.split_documents(documents)
        logger.info(f"Created {len(chunks)} chunks")
        
        embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={'device': 'cpu'},
            encode_kwargs={'normalize_embeddings': True}
        )
        
        vector_store = FAISS.from_documents(chunks, embeddings)
        
        llm = ChatOpenAI(
            api_key=openai_key,
            model="gpt-4o",
            temperature=0.3,
            max_tokens=1024
        )
        
        prompt = ChatPromptTemplate.from_template("""You are a helpful assistant for Global Research Hub.
Answer questions based on the provided context. If the answer is not available, say you don't have that information.

Context: {context}

Question: {input}

Answer:""")
        
        retriever = vector_store.as_retriever(
            search_type="similarity",
            search_kwargs={"k": 4}
        )
        
        qa_chain = (
            {
                "context": retriever | format_docs,
                "input": RunnablePassthrough()
            }
            | prompt
            | llm
            | StrOutputParser()
        )
        
        logger.info("RAG system initialized successfully")
        
    except Exception as e:
        logger.error(f"Error initializing RAG: {str(e)}")
        raise

@app.on_event("startup")
async def startup():
    try:
        initialize_rag()
    except Exception as e:
        logger.error(f"Startup failed: {str(e)}")

@app.get("/")
async def root():
    return {
        "message": "GRH Chatbot API",
        "version": "2.0.0",
        "status": "active",
        "model": "gpt-4o"
    }

@app.get("/api/health")
async def health():
    return {
        "status": "healthy" if vector_store and qa_chain else "initializing",
        "ready": vector_store is not None and qa_chain is not None
    }

@app.post("/api/ask", response_model=AnswerResponse)
async def ask(request: QuestionRequest):
    if qa_chain is None:
        raise HTTPException(
            status_code=503,
            detail="RAG system initializing. Try again soon."
        )
    
    if not request.question.strip():
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty"
        )
    
    try:
        logger.info(f"Processing: {request.question[:80]}...")
        answer = qa_chain.invoke(request.question)
        return AnswerResponse(
            question=request.question,
            answer=answer,
            status="success"
        )
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Error processing question")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")