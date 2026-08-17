export const MIN_PASSWORD_LENGTH = 8;

export function validatePassword(password: string | undefined): string | null {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  return null;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
