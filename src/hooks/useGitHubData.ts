import { useState, useCallback } from 'react';
import { getCurrentUser, getUserRepos, getStarredRepos, GitHubUser, GitHubRepo } from '../services/githubService';

export const useGitHubData = (token: string, query: string) => {
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [starredRepoObjects, setStarredRepoObjects] = useState<GitHubRepo[]>([]);
  const [starredRepos, setStarredRepos] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'repos' | 'starred'>('repos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!token) {
      setError('No GitHub token configured. Add one in Settings → Connections.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [userData, reposData, starredData] = await Promise.all([
        getCurrentUser(token),
        getUserRepos('updated', token),
        getStarredRepos(token).catch(() => []),
      ]);

      setUser(userData);
      setRepos(reposData);
      setStarredRepoObjects(starredData);
      setStarredRepos(new Set(starredData.map((r) => r.full_name)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [token]);

  const safeQuery = (query || '').toLowerCase();
  const filteredRepos = repos.filter(
    (repo) =>
      (repo.name || '').toLowerCase().includes(safeQuery) || (repo.description || '').toLowerCase().includes(safeQuery)
  );

  const filteredStarred = starredRepoObjects.filter(
    (r) => (r.name || '').toLowerCase().includes(safeQuery) || (r.description || '').toLowerCase().includes(safeQuery)
  );

  const toggleStar = (repoId: string, isStarred: boolean) => {
    setStarredRepos((prev) => {
      const next = new Set(prev);
      if (isStarred) {
        next.delete(repoId);
      } else {
        next.add(repoId);
      }
      return next;
    });
  };

  return {
    user,
    repos,
    starredRepoObjects,
    starredRepos,
    activeTab,
    setActiveTab,
    loading,
    error,
    filteredRepos,
    filteredStarred,
    loadData,
    toggleStar,
    setStarredRepos,
  };
};
