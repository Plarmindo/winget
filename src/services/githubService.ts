
import { WingetPackage } from '../types';

// Helper function to get auth headers
const getAuthHeaders = (token?: string): HeadersInit => {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json'
  };
  if (token) {
    const authScheme = token.startsWith('github_pat_') ? 'Bearer' : 'token';
    headers['Authorization'] = `${authScheme} ${token}`;
  }
  return headers;
};

export const validateGitHubToken = async (token: string): Promise<boolean> => {
  if (!token || token.trim().length === 0) {
    console.error('GitHub token validation: Empty token');
    return false;
  }

  console.log('Validating token starting with:', token.substring(0, 10) + '...');

  // Try Bearer first (works for fine-grained PATs and some classic PATs)
  try {
    let res = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    console.log('GitHub Bearer auth result:', res.status, res.statusText);

    if (res.ok) return true;

    // If Bearer fails, try token scheme (classic PATs)
    if (res.status === 401) {
      res = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      console.log('GitHub token auth result:', res.status, res.statusText);

      if (res.ok) return true;
    }

    // Log the error response for debugging
    const errorText = await res.text();
    console.error('GitHub API error response:', errorText);
    return false;
  } catch (e) {
    console.error('GitHub token validation network error:', e);
    return false;
  }
};


// Get current authenticated user info
export const getCurrentUser = async (token: string): Promise<GitHubUser | null> => {
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: getAuthHeaders(token)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

// Get user's repositories
export const getUserRepos = async (token: string, sort: 'updated' | 'created' | 'pushed' | 'full_name' = 'updated'): Promise<GitHubRepo[]> => {
  const res = await fetch(`https://api.github.com/user/repos?sort=${sort}&per_page=100`, {
    headers: getAuthHeaders(token)
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Invalid GitHub token. Please check your PAT.');
    throw new Error(`Failed to fetch repos: ${res.statusText}`);
  }
  return await res.json();
};

// Get repository details
export const getRepoDetails = async (owner: string, repo: string, token?: string): Promise<GitHubRepo> => {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: getAuthHeaders(token)
  });
  if (!res.ok) throw new Error(`Repo not found: ${owner}/${repo}`);
  return await res.json();
};

// Fork a repository
export const forkRepo = async (owner: string, repo: string, token: string): Promise<GitHubRepo> => {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/forks`, {
    method: 'POST',
    headers: getAuthHeaders(token)
  });
  if (!res.ok) throw new Error(`Failed to fork: ${res.statusText}`);
  return await res.json();
};

// Star a repository
export const starRepo = async (owner: string, repo: string, token: string): Promise<void> => {
  const res = await fetch(`https://api.github.com/user/starred/${owner}/${repo}`, {
    method: 'PUT',
    headers: getAuthHeaders(token)
  });
  if (!res.ok && res.status !== 204) throw new Error(`Failed to star: ${res.statusText}`);
};

// Unstar a repository
export const unstarRepo = async (owner: string, repo: string, token: string): Promise<void> => {
  const res = await fetch(`https://api.github.com/user/starred/${owner}/${repo}`, {
    method: 'DELETE',
    headers: getAuthHeaders(token)
  });
  if (!res.ok && res.status !== 204) throw new Error(`Failed to unstar: ${res.statusText}`);
};

// Check if repo is starred
export const isRepoStarred = async (owner: string, repo: string, token: string): Promise<boolean> => {
  const res = await fetch(`https://api.github.com/user/starred/${owner}/${repo}`, {
    headers: getAuthHeaders(token)
  });
  return res.status === 204;
};

// Get repo branches
export const getRepoBranches = async (owner: string, repo: string, token?: string): Promise<GitHubBranch[]> => {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`, {
    headers: getAuthHeaders(token)
  });
  if (!res.ok) throw new Error(`Failed to fetch branches: ${res.statusText}`);
  return await res.json();
};

// Get repo commits
export const getRepoCommits = async (owner: string, repo: string, branch?: string, token?: string): Promise<GitHubCommit[]> => {
  const branchParam = branch ? `&sha=${branch}` : '';
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=20${branchParam}`, {
    headers: getAuthHeaders(token)
  });
  if (!res.ok) throw new Error(`Failed to fetch commits: ${res.statusText}`);
  return await res.json();
};

// Get user's starred repos
export const getStarredRepos = async (token: string): Promise<GitHubRepo[]> => {
  const res = await fetch('https://api.github.com/user/starred?per_page=100', {
    headers: getAuthHeaders(token)
  });
  if (!res.ok) throw new Error(`Failed to fetch starred repos: ${res.statusText}`);
  return await res.json();
};

// Watch a repository
export const watchRepo = async (owner: string, repo: string, token: string): Promise<void> => {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/subscription`, {
    method: 'PUT',
    headers: { ...getAuthHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscribed: true })
  });
  if (!res.ok) throw new Error(`Failed to watch: ${res.statusText}`);
};

// Unwatch a repository
export const unwatchRepo = async (owner: string, repo: string, token: string): Promise<void> => {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/subscription`, {
    method: 'DELETE',
    headers: getAuthHeaders(token)
  });
  if (!res.ok && res.status !== 204) throw new Error(`Failed to unwatch: ${res.statusText}`);
};

// Check if repo is watched
export const isRepoWatched = async (owner: string, repo: string, token: string): Promise<boolean> => {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/subscription`, {
    headers: getAuthHeaders(token)
  });
  return res.ok;
};

// Get repo issues count
export const getRepoIssues = async (owner: string, repo: string, token?: string): Promise<GitHubIssue[]> => {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=10`, {
    headers: getAuthHeaders(token)
  });
  if (!res.ok) throw new Error(`Failed to fetch issues: ${res.statusText}`);
  return await res.json();
};

// Get repo pull requests
export const getRepoPRs = async (owner: string, repo: string, token?: string): Promise<GitHubPR[]> => {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=10`, {
    headers: getAuthHeaders(token)
  });
  if (!res.ok) throw new Error(`Failed to fetch PRs: ${res.statusText}`);
  return await res.json();
};

// Get latest release
export const getLatestRelease = async (owner: string, repo: string, token?: string): Promise<GitHubRelease | null> => {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
      headers: getAuthHeaders(token)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

// Get repo README
export const getRepoReadme = async (owner: string, repo: string, token?: string): Promise<string | null> => {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
      headers: { ...getAuthHeaders(token), 'Accept': 'application/vnd.github.v3.raw' }
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
};

// Create a new repository
export interface CreateRepoOptions {
  name: string;
  description?: string;
  private?: boolean;
  auto_init?: boolean;
  gitignore_template?: string;
  license_template?: string;
}

export const createRepo = async (options: CreateRepoOptions, token: string): Promise<GitHubRepo> => {
  const res = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers: { ...getAuthHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(options)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || `Failed to create repo: ${res.statusText}`);
  }
  return await res.json();
};

// Delete a repository
export const deleteRepo = async (owner: string, repo: string, token: string): Promise<void> => {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    method: 'DELETE',
    headers: getAuthHeaders(token)
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to delete repo: ${res.statusText}`);
  }
};

// Get repository contents (files/folders)
export const getRepoContents = async (owner: string, repo: string, path: string = '', token?: string): Promise<GitHubContent[]> => {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    headers: getAuthHeaders(token)
  });
  if (!res.ok) throw new Error(`Failed to fetch contents: ${res.statusText}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [data];
};

// Get repository languages
export const getRepoLanguages = async (owner: string, repo: string, token?: string): Promise<Record<string, number>> => {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, {
    headers: getAuthHeaders(token)
  });
  if (!res.ok) return {};
  return await res.json();
};

// Get gitignore templates
export const getGitignoreTemplates = async (): Promise<string[]> => {
  const res = await fetch('https://api.github.com/gitignore/templates');
  if (!res.ok) return [];
  return await res.json();
};

// Get license templates
export const getLicenseTemplates = async (): Promise<{ key: string; name: string }[]> => {
  const res = await fetch('https://api.github.com/licenses');
  if (!res.ok) return [];
  return await res.json();
};

export const searchGitHubRepos = async (query: string, token?: string): Promise<WingetPackage[]> => {
  const headers = getAuthHeaders(token);

  try {
    // If "POPULAR_ESSENTIALS" is passed, we search for highly starred repos
    const q = query === "POPULAR_ESSENTIALS" ? "stars:>20000" : query;

    let res;
    try {
      res = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&per_page=30`, { headers });
    } catch (networkError) {
      throw new Error("Unable to connect to GitHub. Please check your internet connection.");
    }

    if (!res.ok) {
      if (res.status === 403) throw new Error("GitHub API Rate Limit Exceeded. Please add a Token in Settings.");
      throw new Error(`GitHub API Error: ${res.statusText}`);
    }

    const data = await res.json();

    return data.items.map((repo: any) => ({
      id: repo.full_name,
      name: repo.name,
      description: repo.description || "No description provided.",
      publisher: repo.owner.login,
      category: 'Repository',
      version: 'HEAD',
      isFree: !repo.private,
      stars: repo.stargazers_count,
      forks: repo.forks_count
    }));
  } catch (e: any) {
    console.error("GitHub Search Failed", e);
    throw new Error(e.message || "Failed to search GitHub");
  }
};

// TypeScript interfaces for GitHub API responses
export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
  email: string | null;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  default_branch: string;
  updated_at: string;
  pushed_at: string;
  owner: {
    login: string;
    avatar_url: string;
  };
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
  };
  protected: boolean;
}

export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
  author: {
    login: string;
    avatar_url: string;
  } | null;
  html_url: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  labels: { name: string; color: string }[];
}

export interface GitHubPR {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  draft: boolean;
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  html_url: string;
  published_at: string;
  body: string;
  assets: {
    name: string;
    download_url: string;
    size: number;
  }[];
}

export interface GitHubContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  html_url: string;
  download_url: string | null;
}
