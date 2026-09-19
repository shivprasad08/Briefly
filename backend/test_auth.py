import pytest
from httpx import AsyncClient
import asyncio
from datetime import datetime, timedelta, timezone

# Assuming pytest configuration provides an initialized db session and test app client
# For this audit, we will just write the test logic assuming the client is available

def test_signup_password_length(client):
    """Test that passwords shorter than 8 characters are rejected."""
    response = client.post("/auth/signup", json={"email": "test@test.com", "password": "short"})
    assert response.status_code == 400
    assert "Password must be at least 8 characters" in response.json()["detail"]

def test_signup_success(client):
    """Test successful signup."""
    response = client.post("/auth/signup", json={"email": "test2@test.com", "password": "long_password123"})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    
def test_login_success(client, test_user):
    """Test successful login."""
    response = client.post("/auth/login", json={"email": test_user.email, "password": test_user.password})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data

def test_login_failure(client, test_user):
    """Test login with wrong password."""
    response = client.post("/auth/login", json={"email": test_user.email, "password": "wrong"})
    assert response.status_code == 401

def test_refresh_token_flow(client, test_user):
    """Test refreshing an access token."""
    # 1. Login
    login_resp = client.post("/auth/login", json={"email": test_user.email, "password": test_user.password})
    refresh_token = login_resp.json()["refresh_token"]
    
    # 2. Refresh
    refresh_resp = client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_resp.status_code == 200
    data = refresh_resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["refresh_token"] != refresh_token  # Ensure token rotated

def test_logout(client, test_user):
    """Test revoking a refresh token."""
    # 1. Login
    login_resp = client.post("/auth/login", json={"email": test_user.email, "password": test_user.password})
    refresh_token = login_resp.json()["refresh_token"]
    
    # 2. Logout
    logout_resp = client.post("/auth/logout", json={"refresh_token": refresh_token})
    assert logout_resp.status_code == 200
    
    # 3. Try to use revoked refresh token
    refresh_resp = client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_resp.status_code == 401
    assert "revoked" in refresh_resp.json()["detail"].lower()
