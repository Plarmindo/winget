import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as tauriBridge from './tauriBridge';
import {
  validateGitHubToken,
  validateStoredGitHubToken,
  getCurrentUser,
  getUserRepos,
  getRepoDetails,
  forkRepo,
  starRepo,
  unstarRepo,
  isRepoStarred,
  getRepoBranches,
  getRepoCommits,
  getStarredRepos,
  watchRepo,
  unwatchRepo,
  isRepoWatched,
  getRepoIssues,
  getRepoPRs,
  getLatestRelease,
  detectReleaseType,
  getInstallableAssets,
  getRepoReadme,
  createRepo,
  deleteRepo,
  getRepoContents,
  getRepoLanguages,
  getGitignoreTemplates,
  getLicenseTemplates,
  searchGitHubRepos,
  GitHubRepo,
  GitHubRelease,
  GitHubUser,
} from './githubService';

vi.mock('./tauriBridge', () => ({
  loadGitHubToken: vi.fn(),
}));

const fetchMock = vi.fn();

const jsonResponse = (data: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => data,
    text: async () => (typeof data === 'string' ? data : JSON.stringify(data)),
  }) as unknown as Response;

const repo = (name: string): GitHubRepo => ({
  id: 1,
  name,
  full_name: `octo/${name}`,
  description: 'A repo',
  private: false,
  html_url: `https://github.com/octo/${name}`,
  clone_url: `https://github.com/octo/${name}.git`,
  ssh_url: `git@github.com:octo/${name}.git`,
  stargazers_count: 10,
  forks_count: 2,
  open_issues_count: 1,
  language: 'TypeScript',
  default_branch: 'main',
  updated_at: '2024-01-01T00:00:00Z',
  pushed_at: '2024-01-01T00:00:00Z',
  owner: { login: 'octo', avatar_url: 'https://avatars/x.png' },
});

const release = (assets: { name: string; download_url: string; size: number }[] = []): GitHubRelease => ({
  id: 1,
  tag_name: 'v1.0.0',
  name: 'v1.0.0',
  html_url: 'https://github.com/octo/r/releases/v1.0.0',
  published_at: '2024-01-01T00:00:00Z',
  body: 'Release notes',
  assets,
});

describe('githubService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    vi.mocked(tauriBridge.loadGitHubToken).mockResolvedValue(null);
  });

  describe('validateGitHubToken', () => {
    it('rejects empty tokens', async () => {
      await expect(validateGitHubToken('')).resolves.toBe(false);
      await expect(validateGitHubToken('   ')).resolves.toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('accepts a valid bearer token', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ login: 'octo' }));
      await expect(validateGitHubToken('github_pat_abc')).resolves.toBe(true);
      const url = fetchMock.mock.calls[0][0] as string;
      const init = fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
      expect(url).toBe('https://api.github.com/user');
      expect(init.headers.Authorization).toBe('Bearer github_pat_abc');
    });

    it('falls back to the token scheme for classic PATs', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'nope' }, 401));
      fetchMock.mockResolvedValueOnce(jsonResponse({ login: 'octo' }));
      await expect(validateGitHubToken('ghp_classic')).resolves.toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const secondInit = fetchMock.mock.calls[1][1] as { headers: Record<string, string> };
      expect(secondInit.headers.Authorization).toBe('token ghp_classic');
    });

    it('returns false when both auth schemes fail', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ message: 'unauthorized' }, 401));
      await expect(validateGitHubToken('ghp_bad')).resolves.toBe(false);
    });

    it('returns false on network errors', async () => {
      fetchMock.mockRejectedValue(new Error('offline'));
      await expect(validateGitHubToken('ghp_x')).resolves.toBe(false);
    });
  });

  describe('validateStoredGitHubToken', () => {
    it('returns false when no token is stored', async () => {
      vi.mocked(tauriBridge.loadGitHubToken).mockResolvedValue(null);
      await expect(validateStoredGitHubToken()).resolves.toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('validates the stored token', async () => {
      vi.mocked(tauriBridge.loadGitHubToken).mockResolvedValue('ghp_stored');
      fetchMock.mockResolvedValue(jsonResponse({ login: 'octo' }));
      await expect(validateStoredGitHubToken()).resolves.toBe(true);
    });
  });

  describe('getCurrentUser', () => {
    it('returns null without a token', async () => {
      await expect(getCurrentUser()).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns the user when authenticated', async () => {
      const user: GitHubUser = {
        login: 'octo',
        id: 1,
        avatar_url: 'https://avatars/x.png',
        name: 'Octo',
        email: null,
        bio: null,
        public_repos: 10,
        followers: 5,
        following: 3,
      };
      fetchMock.mockResolvedValue(jsonResponse(user));
      await expect(getCurrentUser('ghp_x')).resolves.toEqual(user);
    });

    it('returns null on failure responses and errors', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, 401));
      await expect(getCurrentUser('ghp_x')).resolves.toBeNull();
      fetchMock.mockRejectedValue(new Error('offline'));
      await expect(getCurrentUser('ghp_x')).resolves.toBeNull();
    });
  });

  describe('getUserRepos', () => {
    it('throws when no token is configured', async () => {
      await expect(getUserRepos()).rejects.toThrow('GitHub token not configured');
    });

    it('fetches repositories sorted by the requested key', async () => {
      vi.mocked(tauriBridge.loadGitHubToken).mockResolvedValue('ghp_x');
      fetchMock.mockResolvedValue(jsonResponse([repo('Alpha')]));
      const result = await getUserRepos('created');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.github.com/user/repos?sort=created&per_page=100',
        expect.anything()
      );
      expect(result).toHaveLength(1);
    });

    it('maps 401 responses to an invalid token error', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, 401));
      await expect(getUserRepos('updated', 'ghp_bad')).rejects.toThrow('Invalid GitHub token');
    });

    it('throws on other failure responses', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, 500));
      await expect(getUserRepos('updated', 'ghp_x')).rejects.toThrow('Failed to fetch repos: Error');
    });
  });

  describe('repo details and actions', () => {
    it('fetches repo details', async () => {
      fetchMock.mockResolvedValue(jsonResponse(repo('Alpha')));
      await expect(getRepoDetails('octo', 'Alpha', 'ghp_x')).resolves.toMatchObject({ name: 'Alpha' });
    });

    it('throws when a repo is not found', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, 404));
      await expect(getRepoDetails('octo', 'Nope')).rejects.toThrow('Repo not found: octo/Nope');
    });

    it('forks a repository', async () => {
      fetchMock.mockResolvedValue(jsonResponse(repo('Fork')));
      await expect(forkRepo('octo', 'Alpha', 'ghp_x')).resolves.toMatchObject({ name: 'Fork' });
      const init = fetchMock.mock.calls[0][1] as { method: string };
      expect(init.method).toBe('POST');
    });

    it('requires a token to fork', async () => {
      await expect(forkRepo('octo', 'Alpha')).rejects.toThrow('GitHub token not configured');
    });

    it('stars and unstars repositories', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, 204));
      await expect(starRepo('octo', 'Alpha', 'ghp_x')).resolves.toBeUndefined();
      const starInit = fetchMock.mock.calls[0][1] as { method: string };
      expect(starInit.method).toBe('PUT');
      await expect(unstarRepo('octo', 'Alpha', 'ghp_x')).resolves.toBeUndefined();
      const unstarInit = fetchMock.mock.calls[1][1] as { method: string };
      expect(unstarInit.method).toBe('DELETE');
    });

    it('throws when starring fails', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, 500));
      await expect(starRepo('octo', 'Alpha', 'ghp_x')).rejects.toThrow('Failed to star');
    });

    it('checks whether a repo is starred via 204', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, 204));
      await expect(isRepoStarred('octo', 'Alpha', 'ghp_x')).resolves.toBe(true);
      fetchMock.mockResolvedValue(jsonResponse({}, 404));
      await expect(isRepoStarred('octo', 'Alpha', 'ghp_x')).resolves.toBe(false);
    });
  });

  describe('branches, commits and starred repos', () => {
    it('fetches branches', async () => {
      fetchMock.mockResolvedValue(jsonResponse([{ name: 'main', commit: { sha: 'abc' }, protected: false }]));
      await expect(getRepoBranches('octo', 'Alpha', 'ghp_x')).resolves.toHaveLength(1);
    });

    it('fetches commits with an optional branch', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse([
          { sha: 'abc', commit: { message: 'm', author: { name: 'x', date: 'd' } }, author: null, html_url: 'u' },
        ])
      );
      const result = await getRepoCommits('octo', 'Alpha', 'main', 'ghp_x');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.github.com/repos/octo/Alpha/commits?per_page=20&sha=main',
        expect.anything()
      );
      expect(result).toHaveLength(1);
      const noBranch = await getRepoCommits('octo', 'Alpha', undefined, 'ghp_x');
      expect(noBranch).toHaveLength(1);
    });

    it('fetches starred repos', async () => {
      fetchMock.mockResolvedValue(jsonResponse([repo('Star')]));
      await expect(getStarredRepos('ghp_x')).resolves.toHaveLength(1);
    });
  });

  describe('watching repositories', () => {
    it('watches, unwatches and checks subscription state', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, 200));
      await expect(watchRepo('octo', 'Alpha', 'ghp_x')).resolves.toBeUndefined();
      const watchInit = fetchMock.mock.calls[0][1] as { method: string; body: string };
      expect(watchInit.method).toBe('PUT');
      expect(JSON.parse(watchInit.body)).toEqual({ subscribed: true });
      await expect(unwatchRepo('octo', 'Alpha', 'ghp_x')).resolves.toBeUndefined();
      const unwatchInit = fetchMock.mock.calls[1][1] as { method: string };
      expect(unwatchInit.method).toBe('DELETE');
      await expect(isRepoWatched('octo', 'Alpha', 'ghp_x')).resolves.toBe(true);
      fetchMock.mockResolvedValue(jsonResponse({}, 404));
      await expect(isRepoWatched('octo', 'Alpha', 'ghp_x')).resolves.toBe(false);
    });

    it('throws when watching fails', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, 500));
      await expect(watchRepo('octo', 'Alpha', 'ghp_x')).rejects.toThrow('Failed to watch');
      await expect(unwatchRepo('octo', 'Alpha', 'ghp_x')).rejects.toThrow('Failed to unwatch');
    });
  });

  describe('issues, PRs and releases', () => {
    it('fetches open issues and pull requests', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse([
          {
            id: 1,
            number: 1,
            title: 't',
            state: 'open',
            html_url: 'u',
            user: { login: 'x', avatar_url: 'a' },
            created_at: 'd',
            labels: [],
          },
        ])
      );
      await expect(getRepoIssues('octo', 'Alpha', 'ghp_x')).resolves.toHaveLength(1);
      await expect(getRepoPRs('octo', 'Alpha', 'ghp_x')).resolves.toHaveLength(1);
      fetchMock.mockResolvedValue(jsonResponse({}, 500));
      await expect(getRepoIssues('octo', 'Alpha', 'ghp_x')).rejects.toThrow('Failed to fetch issues');
    });

    it('returns null for missing latest releases', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, 404));
      await expect(getLatestRelease('octo', 'Alpha', 'ghp_x')).resolves.toBeNull();
      fetchMock.mockRejectedValue(new Error('offline'));
      await expect(getLatestRelease('octo', 'Alpha', 'ghp_x')).resolves.toBeNull();
    });

    it('detects release types from assets', () => {
      expect(detectReleaseType(null)).toBe('none');
      expect(detectReleaseType(release())).toBe('none');
      expect(detectReleaseType(release([{ name: 'Setup.exe', download_url: 'u', size: 1 }]))).toBe('binary');
      expect(detectReleaseType(release([{ name: 'source.zip', download_url: 'u', size: 1 }]))).toBe('source');
    });

    it('lists installable asset names', () => {
      expect(getInstallableAssets(null)).toEqual([]);
      expect(
        getInstallableAssets(
          release([
            { name: 'app.msi', download_url: 'u', size: 1 },
            { name: 'app.deb', download_url: 'u', size: 1 },
            { name: 'docs.pdf', download_url: 'u', size: 1 },
          ])
        )
      ).toEqual(['app.msi', 'app.deb']);
    });
  });

  describe('readme and repo management', () => {
    it('fetches the repo readme', async () => {
      fetchMock.mockResolvedValue(jsonResponse('# Readme'));
      await expect(getRepoReadme('octo', 'Alpha', 'ghp_x')).resolves.toBe('# Readme');
      fetchMock.mockResolvedValue(jsonResponse({}, 404));
      await expect(getRepoReadme('octo', 'Alpha', 'ghp_x')).resolves.toBeNull();
      fetchMock.mockRejectedValue(new Error('offline'));
      await expect(getRepoReadme('octo', 'Alpha', 'ghp_x')).resolves.toBeNull();
    });

    it('creates and deletes repositories', async () => {
      fetchMock.mockResolvedValue(jsonResponse(repo('New')));
      await expect(createRepo({ name: 'New' }, 'ghp_x')).resolves.toMatchObject({ name: 'New' });
      const createInit = fetchMock.mock.calls[0][1] as { method: string; body: string };
      expect(createInit.method).toBe('POST');
      expect(JSON.parse(createInit.body)).toEqual({ name: 'New' });

      fetchMock.mockResolvedValue(jsonResponse({ message: 'name taken' }, 422));
      await expect(createRepo({ name: 'Taken' }, 'ghp_x')).rejects.toThrow('name taken');

      fetchMock.mockResolvedValue(jsonResponse({}, 204));
      await expect(deleteRepo('octo', 'Alpha', 'ghp_x')).resolves.toBeUndefined();
      const deleteInit = fetchMock.mock.calls[2][1] as { method: string };
      expect(deleteInit.method).toBe('DELETE');

      fetchMock.mockResolvedValue(jsonResponse({}, 500));
      await expect(deleteRepo('octo', 'Alpha', 'ghp_x')).rejects.toThrow('Failed to delete repo');
    });
  });

  describe('contents, languages and templates', () => {
    it('fetches repo contents and normalizes single entries', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse([{ name: 'a', path: 'a', sha: 's', size: 1, type: 'file', html_url: 'u', download_url: 'd' }])
      );
      await expect(getRepoContents('octo', 'Alpha', 'src', 'ghp_x')).resolves.toHaveLength(1);
      fetchMock.mockResolvedValue(
        jsonResponse({ name: 'b', path: 'b', sha: 's', size: 1, type: 'file', html_url: 'u', download_url: 'd' })
      );
      await expect(getRepoContents('octo', 'Alpha', 'b.txt', 'ghp_x')).resolves.toHaveLength(1);
      fetchMock.mockResolvedValue(jsonResponse({}, 500));
      await expect(getRepoContents('octo', 'Alpha', 'x', 'ghp_x')).rejects.toThrow('Failed to fetch contents');
    });

    it('fetches languages, gitignore and license templates', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ TypeScript: 100 }));
      await expect(getRepoLanguages('octo', 'Alpha', 'ghp_x')).resolves.toEqual({ TypeScript: 100 });
      fetchMock.mockResolvedValue(jsonResponse({}, 500));
      await expect(getRepoLanguages('octo', 'Alpha', 'ghp_x')).resolves.toEqual({});

      fetchMock.mockResolvedValue(jsonResponse(['Node', 'Python']));
      await expect(getGitignoreTemplates()).resolves.toEqual(['Node', 'Python']);
      fetchMock.mockResolvedValue(jsonResponse([{ key: 'mit', name: 'MIT License' }]));
      await expect(getLicenseTemplates()).resolves.toEqual([{ key: 'mit', name: 'MIT License' }]);
      fetchMock.mockResolvedValue(jsonResponse({}, 500));
      await expect(getGitignoreTemplates()).resolves.toEqual([]);
      await expect(getLicenseTemplates()).resolves.toEqual([]);
    });
  });

  describe('searchGitHubRepos', () => {
    const searchItem = { ...repo('Alpha'), description: null, private: false };

    it('maps POPULAR_ESSENTIALS to a high-star query', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ items: [] }));
      await searchGitHubRepos('POPULAR_ESSENTIALS');
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('stars%3A%3E20000');
    });

    it('throws a friendly error on network failures', async () => {
      fetchMock.mockRejectedValue(new Error('offline'));
      await expect(searchGitHubRepos('anything')).rejects.toThrow('Unable to connect to GitHub');
    });

    it('throws a rate limit error on 403', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, 403));
      await expect(searchGitHubRepos('anything')).rejects.toThrow('GitHub API Rate Limit Exceeded');
    });

    it('maps search results to WingetPackage entries with release detection', async () => {
      const items = Array.from({ length: 20 }, (_, i) => ({
        ...searchItem,
        id: i,
        name: `Repo${i}`,
        full_name: `octo/Repo${i}`,
      }));
      fetchMock.mockImplementation((url: string) => {
        if (url.includes('/releases/latest')) {
          return Promise.resolve(jsonResponse(release([{ name: 'setup.exe', download_url: 'u', size: 1 }])));
        }
        return Promise.resolve(jsonResponse({ items }));
      });

      const results = await searchGitHubRepos('repo');
      expect(results).toHaveLength(20);
      expect(results[0]).toMatchObject({ id: 'octo/Repo0', source: 'github', releaseType: 'binary' });
      // Beyond the first 15, releases are not fetched
      expect(results[19].releaseType).toBe('none');
      // 1 search call + 15 release calls
      expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes('/releases/latest'))).toHaveLength(15);
    });

    it('falls back to no description when missing', async () => {
      fetchMock.mockImplementation((url: string) => {
        if (url.includes('/releases/latest')) return Promise.resolve(jsonResponse(null, 404));
        return Promise.resolve(jsonResponse({ items: [{ ...searchItem, description: null }] }));
      });
      const results = await searchGitHubRepos('repo');
      expect(results[0].description).toBe('No description provided.');
    });
  });
});
