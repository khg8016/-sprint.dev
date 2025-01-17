import { useState, useCallback } from 'react';
import { supabase } from '~/lib/persistence/supabaseClient';
import type { Project, CreateProjectParams, SupabaseToken, ErrorResponse, Organization } from '~/types/supabase';

const SUPABASE_FUNCTION_URL =
  import.meta.env.VITE_SUPABASE_FUNCTION_URL || 'https://cxwwczwjdevjxnfcxsja.supabase.co/functions/v1';

export function useSupabaseManagement(userId: string | undefined) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 토큰 가져오기 (DB에서)
  const fetchToken = useCallback(async () => {
    if (!userId) {
      return null;
    }

    const { data: token, error } = await supabase
      .from('supabase_tokens')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      throw error;
    }

    return token as SupabaseToken;
  }, [userId]);

  // 토큰 유효성 확인 및 필요시 리프레시
  const ensureValidToken = useCallback(async () => {
    try {
      const token = await fetchToken();

      if (!token) {
        throw new Error('No token found');
      }

      // Check if token is expired
      const now = new Date();
      const expiresAt = new Date(token.expires_at);

      if (now >= expiresAt) {
        // Token is expired, refresh it
        const response = await fetch(`${SUPABASE_FUNCTION_URL}/connect-supabase/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ user_id: userId }),
        });

        if (!response.ok) {
          const errorData = (await response.json()) as ErrorResponse;
          throw new Error(errorData.error || 'Failed to refresh token');
        }

        // Get the new token
        const newToken = await fetchToken();

        if (!newToken) {
          throw new Error('Failed to get refreshed token');
        }

        return newToken.access_token;
      }

      return token.access_token;
    } catch (error) {
      console.error('Token validation failed:', error);
      throw error;
    }
  }, [fetchToken, userId]);

  // 프로젝트 생성
  const createProject = useCallback(
    async (params: CreateProjectParams): Promise<Project> => {
      setLoading(true);

      try {
        const accessToken = await ensureValidToken();
        const response = await fetch(`${SUPABASE_FUNCTION_URL}/projects`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'x-access-token': accessToken,
          },
          body: JSON.stringify(params),
        });

        if (!response.ok) {
          const errorData = (await response.json()) as ErrorResponse;
          throw new Error(errorData.error || 'Failed to create project');
        }

        const project = (await response.json()) as Project;

        return project;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [ensureValidToken],
  );

  // 프로젝트 목록 조회
  const getProjects = useCallback(async (): Promise<Project[]> => {
    setLoading(true);

    try {
      const accessToken = await ensureValidToken();
      const response = await fetch(`${SUPABASE_FUNCTION_URL}/projects`, {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'x-access-token': accessToken,
        },
      });

      if (!response.ok) {
        const errorData = (await response.json()) as ErrorResponse;
        throw new Error(errorData.error || 'Failed to fetch projects');
      }

      const projects = (await response.json()) as Project[];

      return projects;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [ensureValidToken]);

  // 조직 목록 조회
  const getOrganizations = useCallback(async (): Promise<Organization[]> => {
    setLoading(true);

    try {
      const accessToken = await ensureValidToken();
      const response = await fetch(`${SUPABASE_FUNCTION_URL}/projects/organizations`, {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'x-access-token': accessToken,
        },
      });

      if (!response.ok) {
        const errorData = (await response.json()) as ErrorResponse;
        throw new Error(errorData.error || 'Failed to fetch organizations');
      }

      const organizations = (await response.json()) as Organization[];

      return organizations;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [ensureValidToken]);

  return {
    loading,
    error,
    createProject,
    getProjects,
    getOrganizations,
  };
}
