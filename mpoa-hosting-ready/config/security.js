const MIN_SECRET_LENGTH = 32;

function validateSecurityConfig() {
  const secret = process.env.JWT_SECRET || '';
  const production = process.env.NODE_ENV === 'production';
  const knownWeakSecrets = new Set([
    'secret',
    'supersecret',
    'supersecret12345',
    'changeme',
    'replace-with-at-least-32-random-characters',
  ]);

  if (!secret) {
    throw new Error('JWT_SECRET is required. Generate a long random value and store it in .env.');
  }

  const weak = secret.length < MIN_SECRET_LENGTH || knownWeakSecrets.has(secret.toLowerCase());
  if (production && weak) {
    throw new Error(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} random characters in production.`);
  }
  if (!production && weak) {
    console.warn(`[security] JWT_SECRET is weak. Use at least ${MIN_SECRET_LENGTH} random characters before deployment.`);
  }
}

module.exports = { validateSecurityConfig };

