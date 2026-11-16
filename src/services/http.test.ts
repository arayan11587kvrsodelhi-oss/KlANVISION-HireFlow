import { describe, it, expect } from 'vitest';
import { buildApiUrl, extractApiPath, isAbsoluteUrl } from './http';

describe('extractApiPath', () => {
  it('extracts path from full URL', () => {
    expect(extractApiPath('https://api.example.com/api/v1')).toBe('/api/v1');
    expect(extractApiPath('https://api.example.com/api/v1/')).toBe('/api/v1');
    expect(extractApiPath('https://api.example.com/api/v2')).toBe('/api/v2');
  });

  it('handles root-relative paths', () => {
    expect(extractApiPath('/api/v1')).toBe('/api/v1');
    expect(extractApiPath('/api/v1/')).toBe('/api/v1');
    expect(extractApiPath('/api/v2')).toBe('/api/v2');
  });
});

describe('isAbsoluteUrl', () => {
  it('detects absolute URLs', () => {
    expect(isAbsoluteUrl('https://example.com')).toBe(true);
    expect(isAbsoluteUrl('http://example.com')).toBe(true);
    expect(isAbsoluteUrl('HTTPS://EXAMPLE.COM')).toBe(true);
  });

  it('rejects relative paths', () => {
    expect(isAbsoluteUrl('/api/v1')).toBe(false);
    expect(isAbsoluteUrl('api/v1')).toBe(false);
    expect(isAbsoluteUrl('')).toBe(false);
  });
});

describe('buildApiUrl', () => {
  it('handles root-relative /api/v1 base with relative path', () => {
    const base = '/api/v1';

    // Relative path (frontend style)
    expect(buildApiUrl(base, '/candidates/me/resume/123')).toBe('/api/v1/candidates/me/resume/123');
    expect(buildApiUrl(base, 'candidates/me/resume/123')).toBe('/api/v1/candidates/me/resume/123');
    expect(buildApiUrl(base, '/auth/me')).toBe('/api/v1/auth/me');
  });

  it('handles root-relative /api/v1 base with absolute path from backend', () => {
    const base = '/api/v1';

    // Absolute path already containing /api/v1 (backend style)
    expect(buildApiUrl(base, '/api/v1/candidates/me/resume/123')).toBe('/api/v1/candidates/me/resume/123');
    expect(buildApiUrl(base, '/api/v1/auth/me')).toBe('/api/v1/auth/me');
  });

  it('handles full URL API base with relative path', () => {
    const base = 'https://api.example.com/api/v1';

    expect(buildApiUrl(base, '/candidates/me/resume/123')).toBe('https://api.example.com/api/v1/candidates/me/resume/123');
    expect(buildApiUrl(base, 'candidates/me/resume/123')).toBe('https://api.example.com/api/v1/candidates/me/resume/123');
  });

  it('handles full URL API base with absolute path from backend', () => {
    const base = 'https://api.example.com/api/v1';

    // Absolute path already containing /api/v1 (backend style)
    expect(buildApiUrl(base, '/api/v1/candidates/me/resume/123')).toBe('https://api.example.com/api/v1/candidates/me/resume/123');
  });

  it('preserves already-absolute HTTP URLs', () => {
    const base = '/api/v1';

    expect(buildApiUrl(base, 'https://cdn.example.com/file.pdf')).toBe('https://cdn.example.com/file.pdf');
    expect(buildApiUrl(base, 'http://localhost:8000/api/v1/file.pdf')).toBe('http://localhost:8000/api/v1/file.pdf');
  });

  it('handles different API path prefixes', () => {
    const base = '/api/v2';

    expect(buildApiUrl(base, '/jobs')).toBe('/api/v2/jobs');
    expect(buildApiUrl(base, '/api/v2/jobs')).toBe('/api/v2/jobs');
  });

  it('handles trailing slash in API base', () => {
    const base = '/api/v1/';

    expect(buildApiUrl(base, '/candidates/me/resume/123')).toBe('/api/v1/candidates/me/resume/123');
    expect(buildApiUrl(base, '/api/v1/candidates/me/resume/123')).toBe('/api/v1/candidates/me/resume/123');
  });

  it('handles full URL with trailing slash', () => {
    const base = 'https://api.example.com/api/v1/';

    expect(buildApiUrl(base, '/candidates/me/resume/123')).toBe('https://api.example.com/api/v1/candidates/me/resume/123');
    expect(buildApiUrl(base, '/api/v1/candidates/me/resume/123')).toBe('https://api.example.com/api/v1/candidates/me/resume/123');
  });

  // ==== New test cases for required fixes ====

  it('handles exact API prefix without trailing slash', () => {
    const base = '/api/v1';

    // Exact prefix match - URL does NOT add trailing slash
    expect(buildApiUrl(base, '/api/v1')).toBe('/api/v1');
    expect(buildApiUrl(base, '/api/v1/')).toBe('/api/v1/');
  });

  it('handles exact API prefix with trailing slash in base', () => {
    const base = '/api/v1/';

    // Exact prefix match - URL does NOT add trailing slash
    expect(buildApiUrl(base, '/api/v1')).toBe('/api/v1');
    expect(buildApiUrl(base, '/api/v1/')).toBe('/api/v1/');
  });

  it('handles prefix boundary - /api/v10 must not match /api/v1', () => {
    const base = '/api/v1';

    // Path starting with /api/v10 should NOT be treated as having /api/v1 prefix
    expect(buildApiUrl(base, '/api/v10/other')).toBe('/api/v1/api/v10/other');
    expect(buildApiUrl(base, '/api/v10')).toBe('/api/v1/api/v10');
    expect(buildApiUrl(base, '/api/v10/')).toBe('/api/v1/api/v10/');
  });

  it('handles prefix boundary - /api/v10 must not match /api/v1 with trailing slash', () => {
    const base = '/api/v1/';

    // Path starting with /api/v10 should NOT be treated as having /api/v1 prefix
    expect(buildApiUrl(base, '/api/v10/other')).toBe('/api/v1/api/v10/other');
    expect(buildApiUrl(base, '/api/v10')).toBe('/api/v1/api/v10');
  });

  it('handles custom absolute API base', () => {
    const base = 'https://custom-api.internal/v3';

    expect(buildApiUrl(base, '/users')).toBe('https://custom-api.internal/v3/users');
    expect(buildApiUrl(base, '/v3/users')).toBe('https://custom-api.internal/v3/users');
    expect(buildApiUrl(base, 'users')).toBe('https://custom-api.internal/v3/users');
  });

  it('handles absolute external URLs with custom absolute API base', () => {
    const base = 'https://custom-api.internal/v3';

    // Absolute URLs should be preserved
    expect(buildApiUrl(base, 'https://cdn.example.com/file.pdf')).toBe('https://cdn.example.com/file.pdf');
    expect(buildApiUrl(base, 'http://other.example.com/api/resource')).toBe('http://other.example.com/api/resource');
  });

  it('handles exact prefix with full URL base', () => {
    const base = 'https://api.example.com/api/v1';

    // URL does not add trailing slash
    expect(buildApiUrl(base, '/api/v1')).toBe('https://api.example.com/api/v1');
    expect(buildApiUrl(base, '/api/v1/')).toBe('https://api.example.com/api/v1/');
  });

  it('handles prefix boundary with full URL base', () => {
    const base = 'https://api.example.com/api/v1';

    // /api/v10 should NOT match /api/v1 prefix
    expect(buildApiUrl(base, '/api/v10/other')).toBe('https://api.example.com/api/v1/api/v10/other');
  });

  it('handles root-relative base with relative path that looks like prefix', () => {
    const base = '/api/v1';

    // Path that has the prefix as a prefix but with more path
    expect(buildApiUrl(base, '/api/v1/extra')).toBe('/api/v1/extra');
    expect(buildApiUrl(base, '/api/v1/extra/')).toBe('/api/v1/extra/');
  });

  it('handles paths with query strings', () => {
    const base = '/api/v1';

    // Query strings - URL parses ? as search, so /api/v1?foo=bar has pathname /api/v1
    expect(buildApiUrl(base, '/api/v1?foo=bar')).toBe('/api/v1?foo=bar');
  });
});