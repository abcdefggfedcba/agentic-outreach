import sys
sys.path.append(r'C:\Users\Admin\Desktop\Agentic_Outreach\Agentic_AI')
import realtime_ux_pipeline

try:
    print("Testing Jina crawler...")
    data = realtime_ux_pipeline.crawl_website("https://labs.google/", max_pages=10)
    print("Length:", len(data))
    print(data[:500])
except Exception as e:
    print("Error:", e)
