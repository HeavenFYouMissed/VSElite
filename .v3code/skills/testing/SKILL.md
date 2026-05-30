---
name: testing
description: Writing and running tests
keywords:
  - test
  - spec
  - unit test
  - integration test
  - coverage
  - assert
  - expect
  - jest
  - vitest
  - mocha
alwaysApply: false
---

# Testing Skill

## Test Writing Principles

1. **Test behavior, not implementation** — test what the function DOES, not HOW
2. **One assertion per test** (ideally) — each test verifies one thing
3. **Descriptive names** — test name should read like a requirement
4. **Arrange-Act-Assert** pattern — setup, execute, verify

## Test Structure

```typescript
describe('FunctionName', () => {
  it('should return X when given Y', () => {
    // Arrange
    const input = createInput();
    
    // Act
    const result = functionUnderTest(input);
    
    // Assert
    expect(result).toBe(expectedValue);
  });
  
  it('should throw when given invalid input', () => {
    expect(() => functionUnderTest(null)).toThrow();
  });
});
```

## What to Test

- Happy path (normal usage)
- Edge cases (empty input, boundary values, max/min)
- Error cases (invalid input, network failures)
- Integration points (API calls, DB queries)

## What NOT to Test

- Third-party library internals
- Trivial getters/setters
- Framework behavior (React rendering mechanics, etc.)
- Implementation details that might change

## Running Tests

- Always check if the project has a test script: `npm test`, `yarn test`, etc.
- Run only affected tests during development
- Run full suite before committing

## When Asked to Write Tests

1. Read the function/module being tested
2. Identify the testing framework in use (check package.json)
3. Write tests for happy path first
4. Add edge cases and error paths
5. Run tests to verify they pass
