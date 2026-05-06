import os
import sys
import urllib.request
import urllib.parse
import concurrent.futures
from html.parser import HTMLParser

# Ensure stdout supports emoji characters in Windows terminals
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from typing import Dict, List, Literal, TypedDict
from pydantic import BaseModel, Field
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.prompts import ChatPromptTemplate
# Using NVIDIA AI Endpoints for the LLM
from langchain_nvidia_ai_endpoints import ChatNVIDIA

# =======================================================================
# SCRAPING LOGIC
# =======================================================================

class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text = []
        self.in_script_or_style = False

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.in_script_or_style = True

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.in_script_or_style = False

    def handle_data(self, data):
        if not self.in_script_or_style:
            text = data.strip()
            if text:
                self.text.append(text)

    def get_text(self):
        return ' '.join(self.text)

class LinkExtractor(HTMLParser):
    def __init__(self, base_url):
        super().__init__()
        self.base_url = base_url
        self.links = set()

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            for attr, value in attrs:
                if attr == 'href':
                    # Normalize URL and check domain
                    full_url = urllib.parse.urljoin(self.base_url, value)
                    if full_url.startswith('http') and urllib.parse.urlparse(full_url).netloc == urllib.parse.urlparse(self.base_url).netloc:
                        # Remove fragment
                        full_url = urllib.parse.urlunparse(urllib.parse.urlparse(full_url)._replace(fragment=""))
                        # Ensure no trailing slash mismatch causing duplicates
                        self.links.add(full_url.rstrip('/'))

def scrape_url_text(url: str) -> tuple[str, list]:
    """Scrapes a single URL returning its text (up to 2500 chars) and a list of internal links."""
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            html = response.read().decode('utf-8', errors='ignore')
            
            # Extract text
            extractor = TextExtractor()
            extractor.feed(html)
            text = extractor.get_text()
            
            # Extract internal links
            link_extractor = LinkExtractor(url)
            link_extractor.feed(html)
            
            return text[:2500], list(link_extractor.links)
    except Exception as e:
        return f"Could not scrape {url}: {e}", []

def crawl_website(start_url: str, max_pages: int = 5) -> str:
    """Crawls the start_url and up to max_pages - 1 internal links in parallel."""
    print(f"  ↳ Starting deep site crawl at {start_url} (max {max_pages} pages)")
    start_url = start_url.rstrip('/')
    
    base_text, internal_links = scrape_url_text(start_url)
    crawled_data = [f"--- PAGE: {start_url} ---\n{base_text}"]
    
    # Prioritize important pages (about, pricing, services, features, contact)
    prioritized_links = []
    for link in internal_links:
        if link != start_url:
            lower_link = link.lower()
            if any(kw in lower_link for kw in ['about', 'pricing', 'service', 'feature', 'contact', 'product']):
                prioritized_links.insert(0, link)
            else:
                prioritized_links.append(link)
                
    # Select unique links to crawl
    seen = set([start_url])
    to_crawl = []
    for link in prioritized_links:
        if link not in seen:
            seen.add(link)
            to_crawl.append(link)
            if len(to_crawl) >= max_pages - 1:
                break
                
    if to_crawl:
        print(f"  ↳ Scraping internal pages in parallel: {to_crawl}")
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(to_crawl)) as executor:
            future_to_url = {executor.submit(scrape_url_text, url): url for url in to_crawl}
            for future in concurrent.futures.as_completed(future_to_url):
                url = future_to_url[future]
                try:
                    text, _ = future.result()
                    crawled_data.append(f"--- PAGE: {url} ---\n{text}")
                except Exception as exc:
                    crawled_data.append(f"--- PAGE: {url} ---\n[Failed to load: {exc}]")
                    
    combined_data = "\n\n".join(crawled_data)
    print(f"  ↳ Crawl complete. Total pages: {len(crawled_data)}, Total chars: {len(combined_data)}")
    return combined_data

# =======================================================================
# 1. STATE DEFINITION
# =======================================================================

class GraphState(TypedDict):
    """
    Shared state object for the multi-agent pipeline.
    """
    input_url: str
    ideation_context: str
    realtime_website_data: str
    business_data: dict
    ux_issues: list
    selected_issue: dict
    email_output: dict
    leads: dict
    user_approval: bool
    edited_email: str
    status: str
    regeneration_mode: str  # Options: 'edit', 'regenerate_email', 'new_ux_issue', ''
    user_id: str
    user_name: str
    user_company: str
    gmail_access_token: str  # User's Gmail OAuth access token (from frontend sign-in)

# =======================================================================
# 2. OUTPUT SCHEMAS (STRUCTURED JSON RESPONSES)
# =======================================================================

class BusinessData(BaseModel):
    business_type: str = Field(description="The primary business type (e.g., E-commerce, B2B SaaS)")
    target_audience: str = Field(description="The primary target demographic or customer profile")
    primary_cta: str = Field(description="The main call-to-action on the website")
    key_pages: List[str] = Field(description="List of critical pages identified (e.g., Pricing, Features)")
    summary: str = Field(description="A brief summary of what the business does")

class UXIssue(BaseModel):
    problem: str = Field(description="The specific problem or opportunity identified (avoid generic statements, make it highly specific to the user's services)")
    business_impact: str = Field(description="Tied to revenue/conversion loss")
    suggested_fix: str = Field(description="Actionable suggested fix")
    opportunity_angle: str = Field(description="How to pitch this as a high-value opportunity")

class UXIntelligenceOutput(BaseModel):
    issues: List[UXIssue]

class EmailOutput(BaseModel):
    subject_line: str = Field(description="Catchy, relevant subject line")
    email_body: str = Field(description="Personalized email body (Max 120 words)")

class LeadOutput(BaseModel):
    emails: List[str] = Field(description="List of actual contact emails extracted from the text. Empty list if none found.")
    validation_status: str = Field(description="Status of email validation (e.g., 'Valid', 'Catch-All')")

# =======================================================================
# 3. HELPER FUNCTIONS
# =======================================================================

def get_llm(temperature=0.5, model="meta/llama-3.1-8b-instruct"):
    """
    Initialize the LLM. 
    Ensure NVIDIA_API_KEY is set in your environment variables.
    """
    return ChatNVIDIA(model=model, temperature=temperature)

def safe_invoke(chain, input_data, max_retries=3):
    import time

    for attempt in range(max_retries):
        try:
            return chain.invoke(input_data)
        except Exception as e:
            if attempt == max_retries - 1:
                raise e
            print(f"  ⚠️ API Error: {e}. Retrying ({attempt+1}/{max_retries})...")
            time.sleep(2)

# =======================================================================
# 4. AGENT NODES
# =======================================================================

def input_agent(state: GraphState) -> Dict:
    """
    Purpose: Extract structured business insights from the URL.
    """
    print("▶ [INPUT AGENT] Deep Crawling Website in Real-Time...")
    
    realtime_data = crawl_website(state["input_url"])
    
    llm = get_llm(0.0, "meta/llama-3.1-8b-instruct").with_structured_output(BusinessData)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an expert business analyst. Extract structured business insights ONLY from the given URL's real-time scraped website data. "
                   "STRICT RULE: Ban guessing, predicting, hallucinating, and assuming. Base your entire analysis ONLY on explicit facts from the real-time data.\n"
                   "IMPORTANT: Respond ONLY with a valid JSON object matching the requested schema. Do not include any conversational text or markdown formatting."),
        ("user", "URL: {url}\nIdeation Context: {context}\nReal-Time Website Content:\n{realtime_data}")
    ])
    
    chain = prompt | llm
    
    business_data = safe_invoke(chain, {
        "url": state["input_url"], 
        "context": state["ideation_context"],
        "realtime_data": realtime_data
    })
    
    business_dict = business_data.model_dump() if business_data else {
        "business_type": "Unknown", "target_audience": "Unknown", "primary_cta": "Unknown", "key_pages": [], "summary": "Failed to extract business data."
    }
    
    return {"business_data": business_dict, "realtime_website_data": realtime_data, "status": "business_analyzed"}

def ux_intelligence_agent(state: GraphState) -> Dict:
    """
    Purpose: Identify UX issues with business impact.
    """
    print("▶ [INTELLIGENCE AGENT] Identifying critical flaws & opportunities...")
    llm = get_llm(0.7).with_structured_output(UXIntelligenceOutput)
    
    business_data = state.get("business_data", {})
    existing_issues = state.get("ux_issues", [])
    
    is_regeneration = state.get("regeneration_mode") == "new_ux_issue"
    ideation_context = state.get("ideation_context", "")
    
    sys_prompt = (
        "You are an elite Consultant and Expert Auditor. Your persona and auditing focus must be strictly aligned with the following services and context:\n"
        "{ideation_context}\n\n"
        "Analyze ONLY the provided REAL-TIME scraped website content (which includes the homepage and key internal pages) and business data to identify ALL critical issues and growth opportunities related to your area of expertise "
        "that cause revenue/conversion loss for the target website.\n"
        "STRICT RULE: Ban guessing, predicting, hallucinating, and assuming. Every claim or issue must be 100% factual and directly proven by the real-time data provided.\n"
        "Identify site-wide issues by cross-referencing information across the multiple crawled pages if possible.\n"
        "List EVERY problem and opportunity you find that fits the criteria. Do not limit yourself to just one.\n"
        "IMPORTANT: Respond ONLY with a valid JSON object matching the requested schema. Do not include any conversational text or markdown formatting."
    )
    
    if is_regeneration:
        sys_prompt += "\n\nCRITICAL: Find a completely NEW issue different from these previously identified ones: {existing_issues}"
        
    prompt = ChatPromptTemplate.from_messages([
        ("system", sys_prompt),
        ("user", "Business Data: {business_data}\nReal-Time Website Content: {realtime_data}\nPrevious Issues Context: {existing_issues}")
    ])
    
    chain = prompt | llm
    response = safe_invoke(chain, {
        "ideation_context": ideation_context,
        "business_data": business_data, 
        "realtime_data": state.get("realtime_website_data", "No real-time data available."),
        "existing_issues": [issue['problem'] for issue in existing_issues] if existing_issues else "None"
    })
    
    if is_regeneration:
        new_issues = existing_issues + [issue.model_dump() for issue in response.issues] if response and hasattr(response, 'issues') else existing_issues
    else:
        new_issues = [issue.model_dump() for issue in response.issues] if response and hasattr(response, 'issues') else []
        
    if not new_issues:
        selected_issue = {}
    else:
        # Combine all issues into a single object so the UI and email agent can process them together
        combined_problem = "\n\n".join([f"• {i.problem}" for i in response.issues])
        combined_impact = "\n".join([f"• {i.business_impact}" for i in response.issues])
        combined_fix = "\n".join([f"• {i.suggested_fix}" for i in response.issues])
        combined_angle = "\n".join([f"• {i.opportunity_angle}" for i in response.issues])
        
        selected_issue = {
            "problem": combined_problem,
            "business_impact": combined_impact,
            "suggested_fix": combined_fix,
            "opportunity_angle": combined_angle
        }
        
    return {"ux_issues": new_issues, "selected_issue": selected_issue, "status": "ux_analyzed"}

def email_and_lead_agent(state: GraphState) -> Dict:
    """
    Purpose: Run email drafting and lead extraction IN PARALLEL to save time.
    """
    print("▶ [EMAIL + LEAD AGENTS] Running in parallel...")
    from concurrent.futures import ThreadPoolExecutor

    def run_email():
        llm = get_llm(0.8).with_structured_output(EmailOutput)
        sys_prompt = (
            "You are a sales expert. Write a cold outreach email based on the identified issues and website data.\n"
            "Rules: Max 120 words. Personalized. Hook in first line. Proper greeting and sign-off.\n"
            "Sign off using Sender Name and Sender Company. JSON only — no markdown."
        )
        prompt = ChatPromptTemplate.from_messages([
            ("system", sys_prompt),
            ("user", "Business: {business_data}\nWebsite: {realtime_data}\nIssue: {selected_issue}\nContext: {context}\nSender: {user_name}, {user_company}")
        ])
        result = safe_invoke(prompt | llm, {
            "business_data": state.get("business_data"),
            "realtime_data": state.get("realtime_website_data", "")[:1500],
            "selected_issue": state.get("selected_issue"),
            "context": state.get("ideation_context"),
            "user_name": state.get("user_name", "UX Expert"),
            "user_company": state.get("user_company", "Our Agency")
        })
        return result.model_dump() if result else {"subject_line": "Opportunity", "email_body": "Could not generate email."}

    def run_lead():
        llm = get_llm(0.0, "meta/llama-3.1-8b-instruct").with_structured_output(LeadOutput)
        sys_prompt = (
            "Extract ONLY explicitly listed email addresses from the website content. "
            "Do NOT guess or invent emails. Return empty list if none found. JSON only."
        )
        prompt = ChatPromptTemplate.from_messages([
            ("system", sys_prompt),
            ("user", "URL: {url}\nContent: {realtime_data}")
        ])
        result = safe_invoke(prompt | llm, {
            "url": state.get("input_url"),
            "realtime_data": state.get("realtime_website_data", "")[:1500]
        })
        return result.model_dump() if result else {"emails": [], "validation_status": "None found"}

    with ThreadPoolExecutor(max_workers=2) as executor:
        email_future = executor.submit(run_email)
        lead_future = executor.submit(run_lead)
        email_output = email_future.result()
        leads = lead_future.result()

    print("  ✓ Email drafted and leads sourced in parallel.")
    return {"email_output": email_output, "leads": leads, "status": "email_generated"}

def approval_node(state: GraphState) -> Dict:
    print(f"▶ [APPROVAL NODE] Current Approval Status: {state.get('user_approval')}")
    return {"status": "pending_approval"}

def edit_regenerate_flow(state: GraphState) -> Dict:
    print("▶ [EDIT/REGENERATE FLOW] Routing rejection based on user input...")
    if state.get("edited_email"):
        print("  ↳ User provided an edited email. Updating payload and skipping regeneration.")
        email_out = state.get("email_output", {})
        email_out["email_body"] = state["edited_email"]
        return {"email_output": email_out, "regeneration_mode": "edit", "status": "email_edited"}
    
    mode = state.get("regeneration_mode")
    if mode == "regenerate_email":
        print("  ↳ Option 1: Regenerating email for the SAME UX issue.")
        return {"status": "regenerating_email"}
    elif mode == "new_ux_issue":
        print("  ↳ Option 2: Re-running UX Intelligence Agent for a NEW issue.")
        return {"status": "finding_new_ux"}
        
    return {"regeneration_mode": "regenerate_email", "status": "fallback_regenerate_email"}

def send_email_agent(state: GraphState) -> Dict:
    print("▶ [SEND EMAIL AGENT] Processing email draft...")
    leads = state.get('leads', {}).get('emails', [])
    subject = state.get('email_output', {}).get('subject_line')
    body = state.get('email_output', {}).get('email_body')
    url = state.get('input_url')
    
    print(f"  ✉ Sending to: {', '.join(leads) if leads else 'No leads found'}")
    print(f"  ✉ Subject: {subject}")
    
    import os
    
    if state.get("regeneration_mode") != "save_history_only":
        gmail_access_token = state.get("gmail_access_token", "")
        if gmail_access_token:
            try:
                import base64
                from email.message import EmailMessage
                from google.oauth2.credentials import Credentials
                from googleapiclient.discovery import build

                print("  ✉ Authenticating with user Gmail access token...")
                creds = Credentials(token=gmail_access_token)
                service = build('gmail', 'v1', credentials=creds)

                message = EmailMessage()
                message.set_content(body)
                message['To'] = ", ".join(leads) if leads else ""
                message['From'] = 'me'
                message['Subject'] = subject

                encoded_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
                create_message = {'message': {'raw': encoded_message}}

                print("  ✉ Creating draft...")
                draft = service.users().drafts().create(userId="me", body=create_message).execute()
                print(f"  ✓ Draft saved to Gmail! (Draft ID: {draft['id']})")
            except Exception as e:
                print(f"  ❌ Failed to save draft to Gmail: {e}")
        else:
            print("  ⚠️ No Gmail access token provided — skipping Gmail draft save.")

    try:
        from pymongo import MongoClient
        mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
        client = MongoClient(mongo_uri)
        db = client["agentic_leads_db"]
        collection = db["outreach_campaigns"]
        
        document = {
            "user_id": state.get("user_id", "anonymous"),
            "target_url": url,
            "business_type": state.get("business_data", {}).get("business_type"),
            "ux_issue": state.get("selected_issue", {}).get("problem"),
            "leads": leads,
            "email_subject": subject,
            "email_body": body,
            "status": "Drafted"
        }
        
        result = collection.insert_one(document)
        print(f"  ✓ Status: Drafted. Stored in MongoDB (ID: {result.inserted_id}).")
        
    except ImportError:
        print("  ⚠️ pymongo is not installed. Run `pip install pymongo` to enable MongoDB storage.")
    except Exception as e:
        print(f"  ❌ Error storing in MongoDB: {e}")
    
    return {"status": "email_drafted_and_stored"}

# =======================================================================
# 5. GRAPH ROUTING & CONSTRUCTION
# =======================================================================

def approval_router(state: GraphState) -> Literal["send_email_agent", "edit_regenerate_flow"]:
    if state.get("user_approval"):
        return "send_email_agent"
    return "edit_regenerate_flow"

def regeneration_router(state: GraphState) -> Literal["email_agent", "ux_intelligence_agent", "approval_node"]:
    mode = state.get("regeneration_mode")
    if mode == "edit":
        return "approval_node"
    elif mode == "regenerate_email":
        return "email_agent"
    elif mode == "new_ux_issue":
        return "ux_intelligence_agent"
    return "email_agent"

def build_pipeline():
    builder = StateGraph(GraphState)
    builder.add_node("input_agent", input_agent)
    builder.add_node("ux_intelligence_agent", ux_intelligence_agent)
    builder.add_node("email_and_lead_agent", email_and_lead_agent)
    builder.add_node("approval_node", approval_node)
    builder.add_node("edit_regenerate_flow", edit_regenerate_flow)
    builder.add_node("send_email_agent", send_email_agent)

    builder.add_edge("input_agent", "ux_intelligence_agent")
    builder.add_edge("ux_intelligence_agent", "email_and_lead_agent")
    builder.add_edge("email_and_lead_agent", "approval_node")
    
    builder.add_conditional_edges("approval_node", approval_router, {
        "send_email_agent": "send_email_agent",
        "edit_regenerate_flow": "edit_regenerate_flow"
    })
    builder.add_conditional_edges("edit_regenerate_flow", regeneration_router, {
        "approval_node": "approval_node",
        "email_agent": "email_and_lead_agent",
        "ux_intelligence_agent": "ux_intelligence_agent"
    })
    
    builder.add_edge("send_email_agent", END)
    
    builder.set_entry_point("input_agent")
    
    memory = MemorySaver()
    return builder.compile(checkpointer=memory, interrupt_before=["approval_node"])

# =======================================================================
# 6. EXECUTION EXAMPLE
# =======================================================================

if __name__ == "__main__":
    import dotenv
    dotenv.load_dotenv()
    
    pipeline = build_pipeline()
    config = {"configurable": {"thread_id": "user_test_1"}}
    
    print("\n" + "="*50)
    print("🚀 INTERACTIVE LEAD PIPELINE (REAL-TIME ENABLED)")
    print("="*50)
    
    url = input("\n🌐 Enter Target Website URL (e.g., https://stylic.ai/): ").strip()
    if not url: url = "https://stylic.ai/"
    
    context = input("🧠 Enter Ideation Context (e.g., 'We provide CRO services'): ").strip()
    if not context: context = "We provide premium UX optimization and CRO services for AI startups."
    
    initial_state = {
        "input_url": url,
        "ideation_context": context,
        "user_approval": False,
        "regeneration_mode": "",
        "edited_email": ""
    }
    
    print("\n[Running Pipeline...]")
    for event in pipeline.stream(initial_state, config=config):
        pass
        
    while True:
        state = pipeline.get_state(config)
        
        if state.next and state.next[0] == "approval_node":
            print("\n" + "-"*40)
            print("🛑 PENDING APPROVAL")
            print("-"*40)
            
            issue = state.values.get("selected_issue", {})
            print(f"\n[Issue Identified]: {issue.get('problem', 'N/A')}")
            
            email = state.values.get("email_output", {})
            print(f"\n[Subject]: {email.get('subject_line', 'N/A')}")
            print(f"[Body]:\n{email.get('email_body', 'N/A')}\n")
            
            choice = input("👉 Approve this email? (y = yes / n = no / edit = edit manually): ").strip().lower()
            
            if choice == 'y':
                pipeline.update_state(config, {"user_approval": True, "regeneration_mode": "", "edited_email": ""})
            elif choice == 'edit':
                new_text = input("\n✏️ Enter the new email body:\n")
                pipeline.update_state(config, {"user_approval": False, "regeneration_mode": "edit", "edited_email": new_text})
            else:
                regen_choice = input("\n♻️ Regenerate email for same issue (1) or Find NEW UX Issue (2)? [1/2]: ").strip()
                mode = "new_ux_issue" if regen_choice == '2' else "regenerate_email"
                pipeline.update_state(config, {"user_approval": False, "regeneration_mode": mode, "edited_email": ""})
            
            print("\n[Resuming Pipeline...]")
            for event in pipeline.stream(None, config=config):
                pass
        else:
            break
            
    print("\n✅ Pipeline execution complete!")
