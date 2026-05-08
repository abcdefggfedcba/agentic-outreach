import sys
import os

sys.path.append(r'C:\Users\Admin\Desktop\Agentic_Outreach\Agentic_AI')
os.environ["NVIDIA_API_KEY"] = "fake_key_just_for_import" # just in case

import realtime_ux_pipeline
from langgraph.graph import StateGraph, END

print("Testing Pipeline...")
pipeline = realtime_ux_pipeline.build_pipeline()
initial_state = {
    "input_url": "https://labs.google/",
    "ideation_context": "Test",
    "user_approval": False,
    "regeneration_mode": "",
    "edited_email": ""
}

try:
    for event in pipeline.stream(initial_state, config={"configurable": {"thread_id": "test"}}):
        print("Event:", event)
except Exception as e:
    import traceback
    traceback.print_exc()
