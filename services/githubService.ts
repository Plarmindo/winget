
import { WingetPackage } from '../types';

export const validateGitHubToken = async (token: string): Promise<boolean> => {
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `token ${token}` }
    });
    return res.ok;
  } catch {
    return false;
  }
};

export const searchGitHubRepos = async (query: string, token?: string): Promise<WingetPackage[]> => {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json'
  };
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  try {
    // If "POPULAR_ESSENTIALS" is passed, we search for highly starred repos
    const q = query === "POPULAR_ESSENTIALS" ? "stars:>20000" : query;
    const res = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&per_page=30`, { headers });
    
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
