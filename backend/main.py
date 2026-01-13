from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableLambda
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage
import os
import logging
from dotenv import load_dotenv
from datetime import datetime
from typing import Optional, List

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global variables
vector_store = None
qa_chain = None
llm = None
retriever = None
conversation_memories = {}

SYSTEM_PROMPT = """You are a knowledgeable and helpful assistant for Global Research Hub (R-Hub), an elite research training initiative.

CRITICAL INSTRUCTIONS - FOLLOW EXACTLY:

1. ANSWER WITH GOOD DETAIL - BUT STAY FOCUSED
   - Provide helpful, informative answers
   - Give enough context to fully answer the question
   - Add a bit more description to be informative
   - But keep it focused and relevant - no extra fluff
   - Don't go overboard, keep it readable and digestible

2. FORMATTING RULES - ABSOLUTELY NO EXCEPTIONS
   - NO markdown formatting (*, #, **, --, etc.)
   - NO special symbols or bullet points
   - Write in plain text only
   - Use natural sentences and paragraphs

3. CONVERSATION MEMORY & CONTEXT TRACKING
   - Remember everything mentioned in this conversation
   - Track what information you've already provided
   - Build on previous context instead of repeating
   - If something was already explained, don't explain it again

4. PRICING RULE - CRITICAL
   ✓ ONLY mention pricing when user explicitly asks:
     - "What is the price?"
     - "How much does it cost?"
     - "What's the pricing?"
   ✗ NEVER add pricing to answers unless directly asked
   ✗ When asked, provide: "Program name is ₹[amount] (INR) or USD [amount]. Add 18% GST for Indian students."

5. CONTACT INFORMATION RULE - CRITICAL
   Full Contact Details to use:
   "Executive - Nitu Sharma, Global Research Hub
   Phone: +91 62021 31262
   Email: nitu.sharma@globuslearn.com"
   
   ✓ ALWAYS include FULL contact details when mentioning Nitu Sharma
   ✓ Only provide contact in these situations:
     a) User asks "How do I enroll?" → Give short answer + contact
     b) User asks "How do I get more info?" → Give contact
     c) User asks domain/topic NOT in knowledge base → Say "We can help with that" + contact
     d) User explicitly asks for contact details
   
   ✓ If you've ALREADY given contact in this conversation, NEVER repeat it again
   ✓ Simply answer subsequent questions without mentioning contact
   
   ✗ NEVER say "refer to contact details already provided"
   ✗ NEVER mention Nitu without full contact information
   ✗ NEVER add "contact us" at the end of every response

6. ENROLLMENT & ACTION QUESTIONS - KEEP IT SIMPLE
   Example - "How do I enroll?"
   Answer: "You can submit your application on our website or contact Executive - Nitu Sharma, Global Research Hub. Phone: +91 62021 31262 | Email: nitu.sharma@globuslearn.com to guide you through the process."
   
   Example - "What do I need to apply?"
   Answer: "You'll need academic transcripts, a statement of your research interests, and optionally a resume. Submit these through our website or contact Nitu Sharma."

7. PROGRAM DETAILS - FIRST MENTION ONLY
   First question about programs: Provide good detail (structure, duration, what they'll learn, time commitment)
   Follow-up questions about same program: Add new relevant details
   Questions about specific domains: Provide details about those research areas

8. DOMAIN/TOPIC QUESTIONS
   If domain IS in knowledge base: Answer directly with research areas
   If domain is NOT in knowledge base: "We can help with [domain] research. For details, contact Executive - Nitu Sharma, Global Research Hub. Phone: +91 62021 31262 | Email: nitu.sharma@globuslearn.com"

9. TONE & PERSONALITY
   - Professional yet friendly and welcoming
   - Action-focused and helpful
   - Make enrollment sound easy and accessible
   - Conversational, like helping a friend
   - Short and to the point
   - Don't overwhelm with information

10. WHAT NOT TO DO
    ✗ Don't repeat contact info multiple times in same conversation
    ✗ Don't add pricing unless explicitly asked
    ✗ Don't repeat program details when already mentioned
    ✗ Don't use markdown or special characters
    ✗ Don't provide lengthy step-by-step lists
    ✗ Don't scare people away with unnecessary details
    ✗ Don't say "the context doesn't mention" - be helpful instead

About Global Research Hub (R-Hub):
- Elite research training initiative under Globus Learn Corp
- 1-on-1 mentorship with PhD-qualified mentors
- Publication-ready research outcomes
- Available globally with remote-first model
- Programs: Young Scholar (6-8), High School Scholar (9-12), Undergraduate, Graduate
- Available domains: Finance, Marketing, Business Strategy, Technology, Management, HR, Operations, Data Science, Economics, Sustainability, and more
- Primary contact: Executive - Nitu Sharma"""

def initialize_rag():
    """Initialize RAG system on startup"""
    global vector_store, qa_chain, llm, retriever
    
    try:
        logger.info("Initializing Global Research Hub Chatbot RAG system...")
        
        # Check for API key
        openai_key = os.getenv("OPENAI_API_KEY")
        if not openai_key:
            raise ValueError("OPENAI_API_KEY not found in environment variables")
        
        # Load PDF documents
        logger.info("Loading PDF documents...")
        loader = PyPDFLoader("Global Research Hub.pdf")
        documents = loader.load()
        logger.info(f"Loaded {len(documents)} pages from PDF")
        
        # Split documents into chunks with optimal settings
        logger.info("Chunking documents...")
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=1500,
            chunk_overlap=300,
            length_function=len,
            separators=["\n\n", "\n", ". ", " ", ""]
        )
        chunks = splitter.split_documents(documents)
        logger.info(f"Created {len(chunks)} chunks")
        
        # Add metadata to chunks
        for i, chunk in enumerate(chunks):
            chunk.metadata["chunk_id"] = i
            chunk.metadata["timestamp"] = datetime.now().isoformat()
        
        # Initialize embeddings
        logger.info("Initializing embeddings model...")
        embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={'device': 'cpu'},
            encode_kwargs={'normalize_embeddings': True}
        )
        
        # Create vector store
        logger.info("Creating FAISS vector store...")
        vector_store = FAISS.from_documents(chunks, embeddings)
        logger.info(f"Vector store created with {len(chunks)} documents")
        
        # Initialize LLM
        logger.info("Initializing OpenAI LLM...")
        llm = ChatOpenAI(
            api_key=openai_key,
            model="gpt-4o",
            temperature=0.3,
            max_tokens=2048
        )
        
        # Create retriever
        retriever = vector_store.as_retriever(
            search_type="similarity",
            search_kwargs={"k": 8}
        )
        
        # Create prompt template with chat history
        prompt = ChatPromptTemplate.from_messages([
            ("system", SYSTEM_PROMPT),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", """Based on the conversation history above, answer this question using the knowledge base context provided below.

Knowledge Base Context:
{context}

Question: {input}

Remember: Answer ONLY what is asked. Be concise. No markdown. Track conversation context."""),
        ])
        
        # Format documents function
        def format_docs(docs):
            formatted = []
            for i, doc in enumerate(docs, 1):
                formatted.append(f"[Source {i}]\n{doc.page_content}")
            return "\n\n---\n\n".join(formatted)
        
        # Create the chain
        qa_chain = prompt | llm | StrOutputParser()
        
        logger.info("✅ Global Research Hub Chatbot RAG system initialized successfully!")
        
    except Exception as e:
        logger.error(f"❌ Error initializing RAG: {str(e)}")
        raise

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events"""
    # Startup
    try:
        initialize_rag()
    except Exception as e:
        logger.error(f"Startup failed: {str(e)}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Global Research Hub Chatbot...")
    conversation_memories.clear()

# Initialize FastAPI app with lifespan
app = FastAPI(
    title="Global Research Hub Chatbot API",
    description="AI-powered contextual chatbot for Global Research Hub (R-Hub)",
    version="3.0.0",
    lifespan=lifespan
)

# Add CORS middleware
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Pydantic models
class QuestionRequest(BaseModel):
    question: str
    session_id: Optional[str] = None

class AnswerResponse(BaseModel):
    question: str
    answer: str
    status: str
    sources_used: int = 8

# Helper functions
def get_or_create_memory(session_id: str):
    """Get or create conversation memory for a session"""
    if session_id not in conversation_memories:
        conversation_memories[session_id] = {
            "messages": [],
            "created_at": datetime.now().isoformat()
        }
    return conversation_memories[session_id]

def build_chat_history(messages: List[dict]) -> List[BaseMessage]:
    """Convert stored messages to LangChain message objects"""
    chat_history = []
    for msg in messages[-6:]:  # Keep last 3 exchanges for context
        if msg["type"] == "human":
            chat_history.append(HumanMessage(content=msg["question"]))
        elif msg["type"] == "ai":
            chat_history.append(AIMessage(content=msg["answer"]))
    return chat_history

# API Endpoints
@app.get("/")
async def root():
    return {
        "message": "Global Research Hub Chatbot API",
        "version": "3.0.0",
        "status": "active",
        "model": "gpt-4o",
        "features": [
            "Conversation Memory",
            "Context Awareness",
            "Smart Contact Management",
            "Multi-turn Conversations",
            "No Unnecessary Repetition",
            "Action-Focused Responses"
        ],
        "primary_contact": {
            "title": "Executive",
            "name": "Nitu Sharma",
            "organization": "Global Research Hub",
            "phone": "+91 62021 31262",
            "email": "nitu.sharma@globuslearn.com"
        }
    }

@app.get("/api/health")
async def health():
    return {
        "status": "healthy" if vector_store and qa_chain else "initializing",
        "ready": vector_store is not None and qa_chain is not None,
        "active_sessions": len(conversation_memories),
        "vector_store": "ready" if vector_store else "not ready",
        "llm": "ready" if llm else "not ready"
    }

@app.post("/api/ask", response_model=AnswerResponse)
async def ask(request: QuestionRequest):
    """
    Ask a question with conversation memory and context awareness
    """
    # Validate system readiness
    if qa_chain is None or vector_store is None or retriever is None:
        raise HTTPException(
            status_code=503,
            detail="Chatbot system initializing. Please try again in a moment."
        )
    
    # Validate input
    if not request.question.strip():
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty. Please provide a valid question."
        )
    
    session_id = request.session_id or "default"
    memory = get_or_create_memory(session_id)
    
    try:
        logger.info(f"📨 Processing [Session: {session_id}]: {request.question[:80]}...")
        
        # Build chat history for context
        chat_history = build_chat_history(memory["messages"])
        
        # Get relevant documents
        relevant_docs = retriever.invoke(request.question)
        context = "\n\n---\n\n".join([f"[Source {i+1}]\n{doc.page_content}" for i, doc in enumerate(relevant_docs)])
        
        # Invoke the chain with proper inputs
        answer = qa_chain.invoke({
            "context": context,
            "input": request.question,
            "chat_history": chat_history
        })
        
        # Store conversation in memory
        memory["messages"].append({
            "type": "human",
            "question": request.question,
            "timestamp": datetime.now().isoformat()
        })
        
        memory["messages"].append({
            "type": "ai",
            "answer": answer,
            "timestamp": datetime.now().isoformat()
        })
        
        # Keep memory manageable (max 40 messages = 20 exchanges)
        if len(memory["messages"]) > 40:
            memory["messages"] = memory["messages"][-40:]
        
        logger.info(f"✅ Response generated successfully for session: {session_id}")
        
        return AnswerResponse(
            question=request.question,
            answer=answer,
            status="success",
            sources_used=8
        )
        
    except Exception as e:
        logger.error(f"❌ Error processing question: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing your question. Please try again."
        )

@app.get("/api/conversation/{session_id}")
async def get_conversation(session_id: str):
    """Get complete conversation history for a session"""
    if session_id not in conversation_memories:
        raise HTTPException(
            status_code=404,
            detail=f"Session '{session_id}' not found"
        )
    
    memory = conversation_memories[session_id]
    return {
        "session_id": session_id,
        "created_at": memory["created_at"],
        "messages": memory["messages"],
        "message_count": len(memory["messages"]),
        "exchange_count": len(memory["messages"]) // 2
    }

@app.post("/api/clear-session/{session_id}")
async def clear_session(session_id: str):
    """Clear conversation history for a specific session"""
    if session_id in conversation_memories:
        del conversation_memories[session_id]
        logger.info(f"🗑️ Session {session_id} cleared")
        return {
            "status": "success",
            "message": f"Session '{session_id}' has been cleared"
        }
    return {
        "status": "info",
        "message": f"Session '{session_id}' not found"
    }

@app.get("/api/sessions")
async def get_sessions():
    """Get all active sessions"""
    sessions_info = []
    for session_id, data in conversation_memories.items():
        sessions_info.append({
            "session_id": session_id,
            "created_at": data["created_at"],
            "message_count": len(data["messages"]),
            "exchange_count": len(data["messages"]) // 2
        })
    
    return {
        "active_sessions": len(conversation_memories),
        "sessions": sessions_info
    }

@app.post("/api/clear-all-sessions")
async def clear_all_sessions():
    """Clear all conversation histories"""
    count = len(conversation_memories)
    conversation_memories.clear()
    logger.info(f"🗑️ All {count} sessions cleared")
    return {
        "status": "success",
        "message": f"All {count} sessions have been cleared"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_level="info"
    )