import requests
import time

# Give server time to start
time.sleep(1)

try:
    response = requests.get("http://localhost:8000/sessions", timeout=5)
    print(f"Status Code: {response.status_code}")
    print(f"Sessions: {response.json()}")
except Exception as e:
    print(f"Error: {e}")
