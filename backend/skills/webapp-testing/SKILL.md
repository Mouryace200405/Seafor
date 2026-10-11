---
name: webapp-testing
description: End-to-end web application testing strategies using Playwright, Puppeteer, or Cypress. Use when users need to test web applications, write test scripts, set up CI/CD testing pipelines, or debug test failures.
license: Complete terms in LICENSE.txt
---

# Web Application Testing

Comprehensive strategies for testing web applications at every level.

## Testing Pyramid

1. **Unit tests** (70%) - Fast, isolated, test individual functions/components
2. **Integration tests** (20%) - Test component interactions, API contracts
3. **E2E tests** (10%) - Critical user journeys, cross-browser

## Tool Selection

- **Playwright** - Best for modern apps, multi-browser, auto-waiting, trace viewer
- **Cypress** - Great developer experience, time-travel debugging
- **Puppeteer** - Chrome-only, low-level control, PDF generation

## Playwright Best Practices

```typescript
// playwright.config.ts
export default defineConfig({
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  retries: 2,
  trace: 'on-first-retry',
});
```

### Reliable Selectors

- Use `data-testid` attributes over CSS classes
- Prefer semantic queries: `getByRole`, `getByText`, `getByLabel`
- Avoid brittle XPath or nth-child selectors

### Test Patterns

- **Arrange-Act-Assert** structure
- One assertion per test (or related group)
- Independent tests - no shared state
- Seed test data before each test

### Common Patterns

- **Page Object Model** for reusable page interactions
- **Fixtures** for test data and authenticated contexts
- **Visual regression** with `toMatchSnapshot` for UI consistency
- **API mocking** with `page.route` for isolated tests

## CI/CD Integration

- Run tests in parallel with `parallel` option
- Upload traces on failure for debugging
- Separate fast unit tests from slow E2E runs
- Run critical path tests on every PR

## Debugging

- Use `page.pause()` for interactive debugging
- Trace viewer: `npx playwright show-trace trace.zip`
- `--headed` mode for visual debugging
- `DEBUG=pw:api` for protocol debugging