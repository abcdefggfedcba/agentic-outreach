from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel
import uvicorn
import os
import asyncio
import dotenv
import hashlib
import uuid
from pymongo import MongoClient

dotenv.load_dotenv()

from realtime_ux_pipeline import build_pipeline

app = FastAPI()

# Serve React production build assets
REACT_BUILD_DIR = os.path.join(os.path.dirname(__file__), "frontend", "dist")
app.mount("/assets", StaticFiles(directory=os.path.join(REACT_BUILD_DIR, "assets")), name="assets")

# Initialize global pipeline (in-memory execution)
pipeline = build_pipeline()

# MongoDB Setup for Users
mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
mongo_client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
db = mongo_client["agentic_leads_db"]
users_collection = db["users"]

def hash_password(password: str, salt: str = None):
    if not salt:
        salt = uuid.uuid4().hex
    hashed = hashlib.sha256((password + salt).encode('utf-8')).hexdigest()
    return hashed, salt

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class UpdateProfileRequest(BaseModel):
    user_id: str
    name: str
    company: str
    services: str

class StartRequest(BaseModel):
    url: str
    context: str
    thread_id: str
    user_id: str
    user_name: str
    user_company: str
    user_services: str = ""
    gmail_access_token: str = ""

class SaveDraftRequest(BaseModel):
    subject: str
    body: str

class ActionRequest(BaseModel):
    thread_id: str
    action: str  # "approve", "edit", "regenerate_email", "new_ux_issue"
    edited_email: str = ""
    gmail_access_token: str = ""

def get_state_response(state):
    if state.next and state.next[0] == "approval_node":
        return {
            "status": "pending_approval",
            "issue": state.values.get("selected_issue", {}),
            "email": state.values.get("email_output", {})
        }
    else:
        return {
            "status": "completed",
            "message": "Pipeline finished successfully and stored in the database!"
        }

@app.post("/api/signup")
async def signup(req: SignupRequest):
    try:
        if users_collection.find_one({"email": req.email}):
            return {"status": "error", "message": "Email already exists."}
        
        hashed_pw, salt = hash_password(req.password)
        user_id = str(uuid.uuid4())
        
        users_collection.insert_one({
            "user_id": user_id,
            "name": req.name,
            "email": req.email,
            "password": hashed_pw,
            "salt": salt,
            "company": "",
            "services": ""
        })
        return {"status": "success", "user_id": user_id, "name": req.name, "company": "", "services": ""}
    except Exception as e:
        return {"status": "error", "message": "Database connection failed. Please whitelist your IP in MongoDB Atlas."}

@app.post("/api/login")
async def login(req: LoginRequest):
    try:
        user = users_collection.find_one({"email": req.email})
    except Exception as e:
        return {"status": "error", "message": "Database connection failed. Please whitelist your IP in MongoDB Atlas."}
        
    if not user:
        return {"status": "error", "message": "Invalid email or password."}
        
    if user.get("auth_provider") == "google":
        return {"status": "error", "message": "Please sign in with Google."}
        
    hashed_pw, _ = hash_password(req.password, user["salt"])
    if hashed_pw != user["password"]:
        return {"status": "error", "message": "Invalid email or password."}
        
    return {"status": "success", "user_id": user["user_id"], "name": user.get("name", ""), "company": user.get("company", ""), "services": user.get("services", "")}

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

@app.post("/api/google-login")
async def google_login(req: Request):
    body = await req.json()
    token = body.get("credential")
    client_id = "842703581435-jn55ranuqnu5r872qqq57va435bi91tm.apps.googleusercontent.com"
    
    try:
        idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), client_id)
        email = idinfo['email']
        name = idinfo.get('name', '')
        picture = idinfo.get('picture', '')
        
        try:
            user = users_collection.find_one({"email": email})
            if not user:
                user_id = str(uuid.uuid4())
                user = {
                    "user_id": user_id,
                    "name": name,
                    "email": email,
                    "picture": picture,
                    "auth_provider": "google",
                    "company": "",
                    "role": "",
                    "services": ""
                }
                users_collection.insert_one(user)
                
            return {"status": "success", "user_id": user["user_id"], "name": user.get("name", ""), "picture": user.get("picture", ""), "company": user.get("company", ""), "services": user.get("services", "")}
        except Exception as e:
            return {"status": "error", "message": "Database connection failed. Please whitelist your IP in MongoDB Atlas."}
    except ValueError:
        return {"status": "error", "message": "Invalid Google token."}

@app.post("/api/update-profile")
async def update_profile(req: UpdateProfileRequest):
    try:
        users_collection.update_one(
            {"user_id": req.user_id},
            {"$set": {"name": req.name, "company": req.company, "services": req.services}}
        )
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/ping")
async def ping():
    """Lightweight keep-alive endpoint to prevent Render free tier cold starts."""
    return {"status": "ok"}

@app.post("/api/start")
async def start_pipeline(req: StartRequest):
    config = {"configurable": {"thread_id": req.thread_id}}
    initial_state = {
        "input_url": req.url,
        "ideation_context": f"Company Context: {req.user_company}\nMain Services: {req.user_services}\nUser Note: {req.context}",
        "user_id": req.user_id,
        "user_name": req.user_name,
        "user_company": req.user_company,
        "user_approval": False,
        "regeneration_mode": "",
        "edited_email": "",
        "gmail_access_token": req.gmail_access_token
    }

    def run_pipeline():
        for event in pipeline.stream(initial_state, config=config):
            pass
        return pipeline.get_state(config)

    # Run the blocking pipeline in a thread pool to avoid blocking FastAPI
    state = await asyncio.to_thread(run_pipeline)
    return get_state_response(state)

@app.post("/api/action")
async def take_action(req: ActionRequest):
    config = {"configurable": {"thread_id": req.thread_id}}

    # Map the frontend action to state updates
    if req.action == "approve":
        pipeline.update_state(config, {"user_approval": True, "regeneration_mode": "", "edited_email": "", "gmail_access_token": req.gmail_access_token})
    elif req.action == "edit":
        pipeline.update_state(config, {"user_approval": False, "regeneration_mode": "edit", "edited_email": req.edited_email, "gmail_access_token": req.gmail_access_token})
    elif req.action == "regenerate_email":
        pipeline.update_state(config, {"user_approval": False, "regeneration_mode": "regenerate_email", "edited_email": ""})
    elif req.action == "new_ux_issue":
        pipeline.update_state(config, {"user_approval": False, "regeneration_mode": "new_ux_issue", "edited_email": ""})
    elif req.action == "save_history_only":
        pipeline.update_state(config, {"user_approval": True, "regeneration_mode": "save_history_only", "edited_email": ""})

    def resume_pipeline():
        for event in pipeline.stream(None, config=config):
            pass
        return pipeline.get_state(config)

    # Run the blocking pipeline in a thread pool
    state = await asyncio.to_thread(resume_pipeline)
    return get_state_response(state)

@app.get("/api/history/{user_id}")
async def get_history(user_id: str):
    try:
        campaigns = list(db["outreach_campaigns"].find({"user_id": user_id}, {"_id": 0}))
        campaigns.reverse()
        return {"status": "success", "campaigns": campaigns}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/save_draft_to_gmail")
async def save_draft_to_gmail(req: SaveDraftRequest):
    import base64
    import os
    from email.message import EmailMessage
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build

    try:
        SCOPES = ['https://www.googleapis.com/auth/gmail.compose']
        creds = None
        
        if os.path.exists('token.json'):
            creds = Credentials.from_authorized_user_file('token.json', SCOPES)
            
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                if not os.path.exists('credentials.json'):
                    return {"status": "error", "message": "credentials.json not found."}
                flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
                creds = flow.run_local_server(port=0)
            with open('token.json', 'w') as token:
                token.write(creds.to_json())

        service = build('gmail', 'v1', credentials=creds)

        message = EmailMessage()
        message.set_content(req.body)
        message['To'] = ""
        message['From'] = 'me'
        message['Subject'] = req.subject

        encoded_message = base64.urlsafe_b64encode(message.as_bytes()).decode()

        create_message = {
            'message': {
                'raw': encoded_message
            }
        }

        draft = service.users().drafts().create(userId="me", body=create_message).execute()
        return {"status": "success", "draft_id": draft['id']}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# Serve React app for all non-API routes (SPA catch-all)
@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(REACT_BUILD_DIR, "index.html"))

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    # Let API routes pass through; serve React app for everything else
    file_path = os.path.join(REACT_BUILD_DIR, full_path)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    return FileResponse(os.path.join(REACT_BUILD_DIR, "index.html"))

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting Agentic Outreach Server on http://localhost:{port}")
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)
