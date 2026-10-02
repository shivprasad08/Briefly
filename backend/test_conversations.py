from datetime import datetime
from uuid import uuid4

import pytest

from main import conversation_title, get_owned_conversation
from models import Conversation


class FakeResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class FakeSession:
    def __init__(self, conversation):
        self.conversation = conversation

    async def execute(self, query):
        return FakeResult(self.conversation)


@pytest.mark.parametrize(
    ("content", "expected"),
    [
        ("Explain the quarterly revenue trend for our product", "Explain the quarterly revenue trend for"),
        ("   ", "New conversation"),
    ],
)
def test_conversation_title(content, expected):
    assert conversation_title(content) == expected


@pytest.mark.asyncio
async def test_owned_conversation_is_returned():
    conversation = Conversation(id=uuid4(), user_id=7, created_at=datetime.utcnow(), updated_at=datetime.utcnow())
    owner = type("User", (), {"id": 7})()

    result = await get_owned_conversation(str(conversation.id), owner, FakeSession(conversation))

    assert result.id == conversation.id


@pytest.mark.asyncio
async def test_foreign_conversation_is_forbidden():
    conversation = Conversation(id=uuid4(), user_id=8, created_at=datetime.utcnow(), updated_at=datetime.utcnow())
    owner = type("User", (), {"id": 7})()

    with pytest.raises(Exception) as error:
        await get_owned_conversation(str(conversation.id), owner, FakeSession(conversation))

    assert error.value.status_code == 403
