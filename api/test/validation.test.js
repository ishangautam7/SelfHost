const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAppInput, validateCredentials } = require('../dist/validation');
const { extractSubdomain, getLinkedBackendPath } = require('../dist/proxy');

test('rejects unsafe account and app input', () => {
  assert.equal(validateCredentials('ab', 'password'), 'Username must be 3-32 characters using letters, numbers, underscores, or hyphens');
  assert.equal(validateCredentials('valid_user', 'password'), null);
  assert.equal(validateAppInput('App', '-bad', 3000), 'Subdomain must be 1-63 lowercase letters, numbers, or hyphens, and cannot start or end with a hyphen');
  assert.equal(validateAppInput('App', 'valid-app', 65536), 'Local port must be an integer from 1 to 65535');
  assert.equal(validateAppInput('App', 'valid-app', 3000), null);
});

test('extracts subdomains case-insensitively and rejects lookalike hosts', () => {
  assert.equal(extractSubdomain('My-App.Example.com:443', 'example.com'), 'my-app');
  assert.equal(extractSubdomain('example.com.attacker.test', 'example.com'), null);
});

test('maps only the reserved linked-backend path', () => {
  assert.equal(getLinkedBackendPath('/_backend/api/users?q=1', '/_backend/api/users'), '/api/users?q=1');
  assert.equal(getLinkedBackendPath('/_backend?q=1', '/_backend'), '/?q=1');
  assert.equal(getLinkedBackendPath('/api/users', '/api/users'), null);
});
