export function validateCredentials(username: unknown, password: unknown): string | null {
  if (typeof username !== 'string' || !/^[a-zA-Z0-9_-]{3,32}$/.test(username)) {
    return 'Username must be 3-32 characters using letters, numbers, underscores, or hyphens';
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return 'Password must be 8-128 characters';
  }
  return null;
}

export function validateAppInput(
  name: unknown,
  subdomain: unknown,
  localPort: unknown,
  requireSubdomain = true
): string | null {
  if (name !== undefined && (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 80)) {
    return 'App name must be 1-80 characters';
  }
  if (requireSubdomain && (typeof subdomain !== 'string' || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain))) {
    return 'Subdomain must be 1-63 lowercase letters, numbers, or hyphens, and cannot start or end with a hyphen';
  }
  if (localPort !== undefined && (typeof localPort !== 'number' || !Number.isInteger(localPort) || localPort < 1 || localPort > 65535)) {
    return 'Local port must be an integer from 1 to 65535';
  }
  return null;
}
