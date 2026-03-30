import type { Profile } from '../_types/profile';

type ApiLikeError = {
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
};

export function parseProfileError(error: unknown, fallback: string) {
  const apiError = error as ApiLikeError;
  return apiError?.response?.data?.message || apiError?.message || fallback;
}

export function getProfileInitials(firstName: string, lastName: string) {
  const source = `${firstName} ${lastName}`.trim();
  if (!source) return '??';
  return source
    .split(' ')
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase())
    .join('')
    .slice(0, 2);
}

export function getProfileDisplayName(params: {
  firstName: string;
  lastName: string;
  email: string;
  profile: Profile | null;
  storedUser: Profile | null;
}) {
  const { firstName, lastName, email, profile, storedUser } = params;
  const raw = `${firstName} ${lastName}`.trim();
  const fallback =
    `${profile?.firstName || storedUser?.firstName || ''} ${profile?.lastName || storedUser?.lastName || ''}`.trim();
  const name = raw || fallback || '';
  if (!name) return email || 'Your Name';
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
