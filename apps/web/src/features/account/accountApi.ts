import { apiFetch } from '../../lib/api';

export interface Profile {
  ageGroup: string | null;
  climate: string | null;
  sunExposure: string | null;
  budgetTier: number | null;
  regionCountry: string;
  fragrancePreference: string;
  routineComplexity: string;
}

export interface MeResponse {
  user: { id: string; email: string; createdAt: string };
  profile: Profile | null;
}

export type ProfileUpdate = Partial<Omit<Profile, 'regionCountry'>>;

export const getMe = () => apiFetch<MeResponse>('/api/v1/me');
export const saveProfile = (update: ProfileUpdate) =>
  apiFetch<{ profile: Profile }>('/api/v1/me/profile', { method: 'PATCH', body: JSON.stringify(update) });
export const exportData = () => apiFetch<unknown>('/api/v1/me/export');
export const deleteAccount = () =>
  apiFetch<void>('/api/v1/me', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }) });
