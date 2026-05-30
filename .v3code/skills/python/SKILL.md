---
name: python
description: Python patterns, idioms, and best practices
globs:
  - "*.py"
keywords:
  - python
  - pip
  - venv
  - django
  - flask
  - fastapi
  - pytest
  - type hint
alwaysApply: false
---

# Python Skill

## Modern Python Patterns

### Type Hints (3.10+)
```python
def process_items(items: list[str], limit: int = 10) -> dict[str, int]:
    return {item: len(item) for item in items[:limit]}

# Union types
def find(query: str) -> User | None:
    ...

# TypedDict
from typing import TypedDict

class Config(TypedDict):
    host: str
    port: int
    debug: bool
```

### Dataclasses
```python
from dataclasses import dataclass, field

@dataclass
class User:
    name: str
    email: str
    tags: list[str] = field(default_factory=list)
    
    @property
    def display_name(self) -> str:
        return self.name.title()
```

### Context Managers
```python
from contextlib import contextmanager

@contextmanager
def timer(label: str):
    start = time.time()
    yield
    elapsed = time.time() - start
    print(f"{label}: {elapsed:.2f}s")

with timer("database query"):
    results = db.execute(query)
```

### Async/Await
```python
import asyncio
import aiohttp

async def fetch_all(urls: list[str]) -> list[str]:
    async with aiohttp.ClientSession() as session:
        tasks = [fetch_one(session, url) for url in urls]
        return await asyncio.gather(*tasks)
```

## Project Structure

```
myproject/
├── src/myproject/
│   ├── __init__.py
│   ├── main.py
│   ├── models.py
│   ├── services/
│   └── utils/
├── tests/
│   ├── conftest.py
│   └── test_main.py
├── pyproject.toml
├── requirements.txt
└── .env
```

## Virtual Environment

```bash
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
.venv\Scripts\activate     # Windows
pip install -r requirements.txt
```

## Testing (pytest)

```python
import pytest

def test_add():
    assert add(2, 3) == 5

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_endpoint(client):
    response = client.get('/api/users')
    assert response.status_code == 200
```

## Common Idioms

```python
# List comprehension (prefer over map/filter)
squares = [x**2 for x in range(10) if x % 2 == 0]

# Dictionary merge (3.9+)
merged = defaults | overrides

# Walrus operator (3.8+)
if (n := len(items)) > 10:
    print(f"Too many: {n}")

# Match statement (3.10+)
match command:
    case "quit": sys.exit()
    case "help": show_help()
    case _: print("Unknown")
```
