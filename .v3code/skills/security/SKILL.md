---
name: security
description: Security best practices and vulnerability prevention
keywords:
  - security
  - vulnerable
  - injection
  - XSS
  - CSRF
  - auth
  - authentication
  - authorization
  - secret
  - password
  - token
  - encrypt
  - sanitize
alwaysApply: false
---

# Security Skill

## Hard Rules (NEVER violate)

1. NEVER hardcode secrets, API keys, passwords, or tokens in source code
2. NEVER log sensitive data (passwords, tokens, PII)
3. NEVER use `eval()` or dynamic code execution with user input
4. NEVER trust user input — validate and sanitize everything
5. NEVER commit .env files or credentials

## Input Validation

- Validate type, length, format, and range
- Use allowlists over denylists
- Sanitize HTML output (prevent XSS)
- Parameterize SQL queries (prevent injection)
- Validate file paths (prevent path traversal)

## Authentication & Authorization

- Use established libraries (passport, next-auth, etc.)
- Hash passwords with bcrypt/argon2 (never MD5/SHA1)
- Use short-lived tokens (JWT with expiry)
- Implement rate limiting on auth endpoints
- Check authorization on EVERY request, not just the frontend

## Common Vulnerabilities

### Cross-Site Scripting (XSS)
- Escape user-provided content before rendering
- Use frameworks' built-in sanitization (React's JSX, etc.)
- Set Content-Security-Policy headers

### SQL Injection
- ALWAYS use parameterized queries
- Never concatenate user input into SQL strings
- Use an ORM with query builders

### Path Traversal
- Never use user input directly in file paths
- Use path.resolve and validate against a base directory
- Reject inputs containing `..`

## When Writing Code That Handles Secrets

```
✓ Use environment variables
✓ Use secret management services (Vault, AWS Secrets Manager)
✓ Add sensitive files to .gitignore
✗ Don't hardcode even "temporary" secrets
✗ Don't log request bodies that may contain tokens
```
