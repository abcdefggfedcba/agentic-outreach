# Agentic Outreach — AI-Powered UX Intelligence Pipeline

An AI multi-agent pipeline that analyzes any website for UX/CRO issues and automatically drafts personalized cold outreach emails.

## Tech Stack
- **Backend:** FastAPI + LangGraph + NVIDIA NIM LLMs
- **Frontend:** React (Vite)
- **Database:** MongoDB Atlas
- **Auth:** Google OAuth 2.0 + Email/Password

## Local Development

### 1. Backend (Python)
```bash
# Install dependencies
pip install -r requirements.txt

# Create a .env file with your keys
NVIDIA_API_KEY=your_key_here
MONGO_URI=your_mongodb_uri_here

# Run the server
python app.py
```

### 2. Frontend (React Dev Server)
```bash
cd frontend
npm install
npm run dev
```
> The React dev server runs on `http://localhost:5173` and proxies all `/api` calls to the Python backend on port `8000`.

## Production Build

To build the React app and serve everything through FastAPI:
```bash
cd frontend
npm run build
cd ..
python app.py
```

Open `http://localhost:8000` — FastAPI will serve the React app and all API endpoints.

## Deploy to Render.com
1. Push this repo to GitHub.
2. Connect the repo to Render.com.
3. Render will detect `render.yaml` and auto-configure the service.
4. Add `NVIDIA_API_KEY` and `MONGO_URI` as environment variables in the Render dashboard.

## Environment Variables
| Variable | Description |
|---|---|
| `NVIDIA_API_KEY` | Your NVIDIA NIM API key |
| `MONGO_URI` | MongoDB Atlas connection string |
| `PORT` | Port for the server (auto-set by cloud providers) |

## Gmail Integration
- Place your `credentials.json` (from Google Cloud Console) in the project root.
- Run the app once locally — it will open a browser for OAuth consent and save `token.json`.
- **Do not commit `token.json` or `credentials.json` to version control.**
