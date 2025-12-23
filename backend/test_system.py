"""
Test script to verify the system is working correctly.
Run this after starting both backend and frontend.
"""

import asyncio
import httpx
from pathlib import Path


async def test_system():
    """Run a series of tests to verify the system."""
    base_url = "http://localhost:8000"
    
    print("🧪 Testing Context-Aware Meeting Assistant\n")
    
    # Test 1: Health Check
    print("1️⃣  Testing API health...")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{base_url}/health")
            assert response.status_code == 200
            print("   ✅ API is healthy\n")
        except Exception as e:
            print(f"   ❌ API health check failed: {e}")
            print("   Make sure backend is running on port 8000\n")
            return
    
    # Test 2: Create Session
    print("2️⃣  Creating test session...")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{base_url}/sessions",
                json={"name": "Test Session"}
            )
            assert response.status_code == 200
            session = response.json()
            session_id = session["id"]
            print(f"   ✅ Session created (ID: {session_id})\n")
        except Exception as e:
            print(f"   ❌ Failed to create session: {e}\n")
            return
    
    # Test 3: List Sessions
    print("3️⃣  Listing sessions...")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{base_url}/sessions")
            assert response.status_code == 200
            sessions = response.json()
            print(f"   ✅ Found {len(sessions)} session(s)\n")
        except Exception as e:
            print(f"   ❌ Failed to list sessions: {e}\n")
            return
    
    # Test 4: Get Session Details
    print("4️⃣  Getting session details...")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{base_url}/sessions/{session_id}")
            assert response.status_code == 200
            session = response.json()
            print(f"   ✅ Session name: {session['name']}")
            print(f"   ✅ Created: {session['created_at']}\n")
        except Exception as e:
            print(f"   ❌ Failed to get session details: {e}\n")
            return
    
    print("🎉 All tests passed! System is ready to use.")
    print("\n📝 Next steps:")
    print("   1. Open http://localhost:3000 in your browser")
    print("   2. Click the test session you just created")
    print("   3. Upload a PDF file")
    print("   4. Ask questions about the document")
    print("\n💡 Tips:")
    print("   - The system works best with PDFs that have clear text")
    print("   - Try uploading research papers or articles first")
    print("   - Ask specific questions about the content")


if __name__ == "__main__":
    asyncio.run(test_system())
