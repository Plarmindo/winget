import React, { useState, useEffect } from 'react';
import {
    Github, Star,
    Loader2, RefreshCw,
    AlertCircle, X, GitBranch, GitCommit, AlertTriangle, GitPullRequest, Tag,
    Plus, FolderOpen, FileText, Copy, Lock, Unlock, Folder, File
} from 'lucide-react';
import {
    starRepo, unstarRepo, forkRepo,
    watchRepo, unwatchRepo,
    getRepoBranches, getRepoCommits, getRepoIssues, getRepoPRs, getLatestRelease,
    getRepoReadme, getRepoContents, getRepoLanguages, createRepo,
    GitHubRepo, GitHubBranch, GitHubCommit, GitHubIssue, GitHubPR, GitHubRelease, GitHubContent, CreateRepoOptions,
    detectReleaseType
} from '../services/githubService';
import { useGitHubData } from '../hooks/useGitHubData';
import { openUrl } from '../services/tauriBridge';
import { WingetPackage, GitHubAction } from '../types';
import { logger } from '../utils/logger';
import { PackageGrid } from './PackageGrid';
import { GitHubDetailsSkeleton } from './skeletons/GitHubDetailsSkeleton';

interface GitHubPanelProps {
    token: string;
    query: string;
    onClone?: (repoUrl: string, repoName: string) => void;
    onDirectInstall?: (repoId: string) => void;
    onFetchDetails?: (pkg: WingetPackage) => Promise<string>;
}

export const GitHubPanel: React.FC<GitHubPanelProps> = ({ token, query, onClone, onDirectInstall, onFetchDetails }) => {
    const {
        user, repos, starredRepoObjects, starredRepos,
        activeTab, setActiveTab, loading, error,
        loadData, toggleStar
    } = useGitHubData(token, query);

    const [watchedRepos, setWatchedRepos] = useState<Set<string>>(new Set());

    // Mapped packages with release types
    const [mappedPackages, setMappedPackages] = useState<WingetPackage[]>([]);

    // Details Modal State
    const [detailsModal, setDetailsModal] = useState<{
        open: boolean;
        repoId: string;
        loading: boolean;
        branches: GitHubBranch[];
        commits: GitHubCommit[];
        issues: GitHubIssue[];
        prs: GitHubPR[];
        release: GitHubRelease | null;
        readme: string | null;
        contents: GitHubContent[];
        currentPath: string;
        languages: Record<string, number>;
    }>({ open: false, repoId: '', loading: false, branches: [], commits: [], issues: [], prs: [], release: null, readme: null, contents: [], currentPath: '', languages: {} });

    // Create Repo Modal State
    const [createModal, setCreateModal] = useState<{
        open: boolean;
        loading: boolean;
        name: string;
        description: string;
        isPrivate: boolean;
        autoInit: boolean;
    }>({ open: false, loading: false, name: '', description: '', isPrivate: false, autoInit: true });

    // Map repos to packages with release types
    useEffect(() => {
        const mapRepos = async () => {
            if (repos.length === 0 && starredRepoObjects.length === 0) {
                setMappedPackages([]);
                return;
            }

            const safeQuery = (query || '').toLowerCase();
            const reposToMap = activeTab === 'repos'
                ? repos.filter(repo => (repo.name || '').toLowerCase().includes(safeQuery) || (repo.description || '').toLowerCase().includes(safeQuery))
                : starredRepoObjects.filter(r => (r.name || '').toLowerCase().includes(safeQuery) || ((r.description || '').toLowerCase().includes(safeQuery)));

            // Map all repos in parallel
            const mapped = await Promise.all(reposToMap.map(mapToPackage));
            setMappedPackages(mapped);
        };

        mapRepos();
    }, [repos, starredRepoObjects, activeTab, query]);



    const mapToPackage = async (repo: GitHubRepo): Promise<WingetPackage> => {
        // Fetch latest release to detect type
        const release = await getLatestRelease(repo.owner.login, repo.name, token).catch(() => null);
        const releaseType = detectReleaseType(release);

        return {
            id: repo.full_name,
            name: repo.name,
            description: repo.description || 'No description',
            version: 'latest',
            source: 'github',
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            isFree: true,
            publisher: repo.owner?.login,
            releaseType
        };
    };

    const handleGitHubAction = async (id: string, action: GitHubAction) => {
        logger.debug('[GitHubPanel] handleGitHubAction called with:', { id, action });
        const [owner, repo] = id.split('/');
        try {
            switch (action) {
                case 'star':
                    if (starredRepos.has(id)) {
                        await unstarRepo(owner, repo, token);
                        toggleStar(id, true);
                        alert(`Unstarred ${repo}`);
                    } else {
                        await starRepo(owner, repo, token);
                        toggleStar(id, false);
                        alert(`Starred ${repo}`);
                    }
                    break;
                case 'fork':
                    await forkRepo(owner, repo, token);
                    alert(`Forked ${repo} to your account!`);
                    loadData();
                    break;
                case 'watch':
                    if (watchedRepos.has(id)) {
                        await unwatchRepo(owner, repo, token);
                        setWatchedRepos(prev => { const next = new Set(prev); next.delete(id); return next; });
                        alert(`Stopped watching ${repo}`);
                    } else {
                        await watchRepo(owner, repo, token);
                        setWatchedRepos(prev => new Set(prev).add(id));
                        alert(`Now watching ${repo}`);
                    }
                    break;
                case 'details':
                    setDetailsModal({ open: true, repoId: id, loading: true, branches: [], commits: [], issues: [], prs: [], release: null, readme: null, contents: [], currentPath: '', languages: {} });
                    try {
                        const [branches, commits, issues, prs, release, readme, contents, languages] = await Promise.all([
                            getRepoBranches(owner, repo, token).catch(() => []),
                            getRepoCommits(owner, repo, undefined, token).catch(() => []),
                            getRepoIssues(owner, repo, token).catch(() => []),
                            getRepoPRs(owner, repo, token).catch(() => []),
                            getLatestRelease(owner, repo, token),
                            getRepoReadme(owner, repo, token),
                            getRepoContents(owner, repo, '', token).catch(() => []),
                            getRepoLanguages(owner, repo, token)
                        ]);
                        setDetailsModal(prev => ({ ...prev, loading: false, branches, commits: commits.slice(0, 5), issues, prs, release, readme, contents, languages }));
                    } catch {
                        setDetailsModal(prev => ({ ...prev, loading: false }));
                    }
                    break;
                case 'open':
                    logger.debug('[GitHubPanel] Opening URL:', `https://github.com/${id}`);
                    openUrl(`https://github.com/${id}`);
                    break;
            }
        } catch (e: any) {
            alert(`Action failed: ${e.message}`);
        }
    };

    // Navigate to folder in details modal
    const navigateToFolder = async (path: string) => {
        const [owner, repo] = detailsModal.repoId.split('/');
        setDetailsModal(prev => ({ ...prev, currentPath: path }));
        try {
            const contents = await getRepoContents(owner, repo, path, token);
            setDetailsModal(prev => ({ ...prev, contents }));
        } catch {
            alert('Failed to load folder contents');
        }
    };

    // Create new repository
    const handleCreateRepo = async () => {
        if (!createModal.name.trim()) {
            alert('Repository name is required');
            return;
        }
        setCreateModal(prev => ({ ...prev, loading: true }));
        try {
            const options: CreateRepoOptions = {
                name: createModal.name.trim(),
                description: createModal.description,
                private: createModal.isPrivate,
                auto_init: createModal.autoInit
            };
            await createRepo(options, token);
            alert(`Repository "${createModal.name}" created successfully!`);
            setCreateModal({ open: false, loading: false, name: '', description: '', isPrivate: false, autoInit: true });
            loadData();
        } catch (e: any) {
            alert(`Failed to create repo: ${e.message}`);
            setCreateModal(prev => ({ ...prev, loading: false }));
        }
    };

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-center p-4">
                <AlertCircle size={48} className="text-red-500 mb-4" />
                <p className="text-red-500 font-bold">{error}</p>
                <p className="text-sm text-[var(--app-text-muted)] mt-2">
                    Please check your internet connection and ensure your VPN is connected if required.
                </p>
                <button
                    onClick={loadData}
                    className="mt-4 px-4 py-2 bg-[var(--app-primary)] text-white rounded-lg flex items-center gap-2"
                >
                    <RefreshCw size={16} /> Retry
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4">
            {/* User Header */}
            {user && (
                <div className="flex items-center gap-4 p-4 bg-[var(--app-surface)] rounded-xl border border-[var(--app-border)]">
                    <img src={user.avatar_url} alt={user.login} className="w-12 h-12 rounded-full" />
                    <div>
                        <h2 className="font-bold text-lg">{user.name || user.login}</h2>
                        <p className="text-sm text-[var(--app-text-muted)]">
                            {user.public_repos} repos · {user.followers} followers
                        </p>
                    </div>
                    <button
                        onClick={loadData}
                        className="ml-auto p-2 hover:bg-[var(--app-bg)] rounded-lg transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 flex-wrap">
                <button
                    onClick={() => setActiveTab('repos')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'repos'
                        ? 'bg-[var(--app-primary)] text-white'
                        : 'bg-[var(--app-surface)] hover:bg-[var(--app-bg)]'
                        }`}
                >
                    <Github size={16} className="inline mr-2" />
                    My Repos ({repos.length})
                </button>
                <button
                    onClick={() => setActiveTab('starred')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'starred'
                        ? 'bg-[var(--app-primary)] text-white'
                        : 'bg-[var(--app-surface)] hover:bg-[var(--app-bg)]'
                        }`}
                >
                    <Star size={16} className="inline mr-2" />
                    Starred ({starredRepos.size})
                </button>
                <button
                    onClick={() => setCreateModal({ open: true, loading: false, name: '', description: '', isPrivate: false, autoInit: true })}
                    className="ml-auto px-4 py-2 rounded-lg font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition-colors flex items-center gap-2"
                >
                    <Plus size={16} />
                    New Repo
                </button>
            </div>

            <PackageGrid
                packages={mappedPackages}
                handleSearch={() => { }}
                onExecute={(id) => onClone?.(`https://github.com/${id}.git`, id.split('/')[1])}
                onDirectInstall={onDirectInstall}
                onFetchDetails={onFetchDetails}
                onGitHubAction={handleGitHubAction}
                isDesktop={true}
                loading={loading}
            />

            {/* Details Modal */}
            {detailsModal.open && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDetailsModal(prev => ({ ...prev, open: false }))}>
                    <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-[var(--app-border)]">
                            <h2 className="font-bold text-lg flex items-center gap-2">
                                <Github size={20} />
                                {detailsModal.repoId}
                            </h2>
                            <button onClick={() => setDetailsModal(prev => ({ ...prev, open: false }))} className="p-2 hover:bg-[var(--app-bg)] rounded-lg">
                                <X size={18} />
                            </button>
                        </div>

                        {detailsModal.loading ? (
                            <GitHubDetailsSkeleton />
                        ) : (
                            <div className="p-4 overflow-y-auto space-y-4">
                                {/* Latest Release */}
                                {detailsModal.release && (
                                    <div className="bg-[var(--app-bg)] rounded-lg p-3 border border-[var(--app-border)]">
                                        <h3 className="font-semibold flex items-center gap-2 mb-2"><Tag size={16} className="text-emerald-500" /> Latest Release</h3>
                                        <a href={detailsModal.release.html_url} target="_blank" rel="noopener noreferrer" className="text-[var(--app-primary)] hover:underline font-mono text-sm">
                                            {detailsModal.release.tag_name} - {detailsModal.release.name || 'Release'}
                                        </a>
                                    </div>
                                )}

                                {/* Branches */}
                                <div className="bg-[var(--app-bg)] rounded-lg p-3 border border-[var(--app-border)]">
                                    <h3 className="font-semibold flex items-center gap-2 mb-2"><GitBranch size={16} className="text-purple-500" /> Branches ({detailsModal.branches.length})</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {detailsModal.branches.slice(0, 10).map(b => (
                                            <span key={b.name} className="px-2 py-1 bg-[var(--app-surface)] rounded text-xs font-mono">{b.name}</span>
                                        ))}
                                        {detailsModal.branches.length > 10 && <span className="px-2 py-1 text-xs text-[var(--app-text-muted)]">+{detailsModal.branches.length - 10} more</span>}
                                    </div>
                                </div>

                                {/* Recent Commits */}
                                <div className="bg-[var(--app-bg)] rounded-lg p-3 border border-[var(--app-border)]">
                                    <h3 className="font-semibold flex items-center gap-2 mb-2"><GitCommit size={16} className="text-blue-500" /> Recent Commits</h3>
                                    <div className="space-y-2">
                                        {detailsModal.commits.map(c => (
                                            <a key={c.sha} href={c.html_url} target="_blank" rel="noopener noreferrer" className="block p-2 hover:bg-[var(--app-surface)] rounded text-sm">
                                                <span className="font-mono text-xs text-[var(--app-text-muted)]">{c.sha.slice(0, 7)}</span>
                                                <span className="ml-2 truncate">{c.commit.message.split('\n')[0]}</span>
                                            </a>
                                        ))}
                                    </div>
                                </div>

                                {/* Issues & PRs */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-[var(--app-bg)] rounded-lg p-3 border border-[var(--app-border)]">
                                        <h3 className="font-semibold flex items-center gap-2 mb-2"><AlertTriangle size={16} className="text-amber-500" /> Open Issues ({detailsModal.issues.length})</h3>
                                        <div className="space-y-1">
                                            {detailsModal.issues.slice(0, 5).map(i => (
                                                <a key={i.id} href={i.html_url} target="_blank" rel="noopener noreferrer" className="block text-xs truncate hover:text-[var(--app-primary)]">
                                                    #{i.number} {i.title}
                                                </a>
                                            ))}
                                            {detailsModal.issues.length === 0 && <span className="text-xs text-[var(--app-text-muted)]">No open issues</span>}
                                        </div>
                                    </div>
                                    <div className="bg-[var(--app-bg)] rounded-lg p-3 border border-[var(--app-border)]">
                                        <h3 className="font-semibold flex items-center gap-2 mb-2"><GitPullRequest size={16} className="text-green-500" /> Open PRs ({detailsModal.prs.length})</h3>
                                        <div className="space-y-1">
                                            {detailsModal.prs.slice(0, 5).map(p => (
                                                <a key={p.id} href={p.html_url} target="_blank" rel="noopener noreferrer" className="block text-xs truncate hover:text-[var(--app-primary)]">
                                                    #{p.number} {p.title}
                                                </a>
                                            ))}
                                            {detailsModal.prs.length === 0 && <span className="text-xs text-[var(--app-text-muted)]">No open PRs</span>}
                                        </div>
                                    </div>
                                </div>

                                {/* README Preview */}
                                {detailsModal.readme && (
                                    <div className="bg-[var(--app-bg)] rounded-lg p-3 border border-[var(--app-border)]">
                                        <h3 className="font-semibold flex items-center gap-2 mb-2"><FileText size={16} className="text-blue-400" /> README</h3>
                                        <div className="prose prose-sm prose-invert max-h-48 overflow-y-auto text-xs whitespace-pre-wrap font-mono bg-[var(--app-surface)] p-2 rounded">
                                            {detailsModal.readme.slice(0, 2000)}
                                            {detailsModal.readme.length > 2000 && '...'}
                                        </div>
                                    </div>
                                )}

                                {/* File Browser */}
                                <div className="bg-[var(--app-bg)] rounded-lg p-3 border border-[var(--app-border)]">
                                    <h3 className="font-semibold flex items-center gap-2 mb-2">
                                        <FolderOpen size={16} className="text-amber-500" /> Files
                                        {detailsModal.currentPath && (
                                            <button onClick={() => navigateToFolder(detailsModal.currentPath.split('/').slice(0, -1).join('/'))} className="text-xs text-[var(--app-primary)] ml-2">← Back</button>
                                        )}
                                    </h3>
                                    <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto">
                                        {detailsModal.contents.slice(0, 20).map(item => (
                                            <button
                                                key={item.path}
                                                onClick={() => item.type === 'dir' ? navigateToFolder(item.path) : openUrl(item.html_url)}
                                                className="flex items-center gap-2 p-1.5 text-xs hover:bg-[var(--app-surface)] rounded text-left"
                                            >
                                                {item.type === 'dir' ? <Folder size={14} className="text-amber-400" /> : <File size={14} className="text-[var(--app-text-muted)]" />}
                                                <span className="truncate">{item.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Clone URLs */}
                                <div className="bg-[var(--app-bg)] rounded-lg p-3 border border-[var(--app-border)]">
                                    <h3 className="font-semibold flex items-center gap-2 mb-2"><Copy size={16} className="text-purple-500" /> Clone URLs</h3>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-[var(--app-text-muted)] w-12">HTTPS</span>
                                            <code className="flex-1 text-xs bg-[var(--app-surface)] px-2 py-1 rounded font-mono truncate">https://github.com/{detailsModal.repoId}.git</code>
                                            <button onClick={() => { navigator.clipboard.writeText(`https://github.com/${detailsModal.repoId}.git`); alert('Copied!'); }} className="text-xs text-[var(--app-primary)]"><Copy size={12} /></button>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-[var(--app-text-muted)] w-12">SSH</span>
                                            <code className="flex-1 text-xs bg-[var(--app-surface)] px-2 py-1 rounded font-mono truncate">git@github.com:{detailsModal.repoId}.git</code>
                                            <button onClick={() => { navigator.clipboard.writeText(`git@github.com:${detailsModal.repoId}.git`); alert('Copied!'); }} className="text-xs text-[var(--app-primary)]"><Copy size={12} /></button>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-[var(--app-text-muted)] w-12">CLI</span>
                                            <code className="flex-1 text-xs bg-[var(--app-surface)] px-2 py-1 rounded font-mono truncate">gh repo clone {detailsModal.repoId}</code>
                                            <button onClick={() => { navigator.clipboard.writeText(`gh repo clone ${detailsModal.repoId}`); alert('Copied!'); }} className="text-xs text-[var(--app-primary)]"><Copy size={12} /></button>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-2 pt-2">
                                    <button onClick={() => openUrl(`https://github.com/${detailsModal.repoId}`)} className="flex-1 py-2 bg-[var(--app-primary)] text-white rounded-lg text-center font-medium hover:opacity-90">
                                        View on GitHub
                                    </button>
                                    <button onClick={() => openUrl(`https://github.com/${detailsModal.repoId}/issues`)} className="flex-1 py-2 bg-[var(--app-bg)] border border-[var(--app-border)] rounded-lg text-center font-medium hover:bg-[var(--app-surface)]">
                                        Issues
                                    </button>
                                    <button onClick={() => openUrl(`https://github.com/${detailsModal.repoId}/pulls`)} className="flex-1 py-2 bg-[var(--app-bg)] border border-[var(--app-border)] rounded-lg text-center font-medium hover:bg-[var(--app-surface)]">
                                        PRs
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Create Repo Modal */}
            {createModal.open && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setCreateModal(prev => ({ ...prev, open: false }))}>
                    <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-[var(--app-border)]">
                            <h2 className="font-bold text-lg flex items-center gap-2">
                                <Plus size={20} />
                                Create New Repository
                            </h2>
                            <button onClick={() => setCreateModal(prev => ({ ...prev, open: false }))} className="p-2 hover:bg-[var(--app-bg)] rounded-lg">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Repository Name *</label>
                                <input
                                    type="text"
                                    value={createModal.name}
                                    onChange={e => setCreateModal(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="my-new-repo"
                                    className="w-full px-3 py-2 bg-[var(--app-bg)] border border-[var(--app-border)] rounded-lg text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Description</label>
                                <textarea
                                    value={createModal.description}
                                    onChange={e => setCreateModal(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="A short description..."
                                    rows={2}
                                    className="w-full px-3 py-2 bg-[var(--app-bg)] border border-[var(--app-border)] rounded-lg text-sm resize-none"
                                />
                            </div>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={createModal.isPrivate} onChange={e => setCreateModal(prev => ({ ...prev, isPrivate: e.target.checked }))} className="rounded" />
                                    <span className="text-sm flex items-center gap-1">
                                        {createModal.isPrivate ? <Lock size={14} /> : <Unlock size={14} />}
                                        Private
                                    </span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={createModal.autoInit} onChange={e => setCreateModal(prev => ({ ...prev, autoInit: e.target.checked }))} className="rounded" />
                                    <span className="text-sm">Add README</span>
                                </label>
                            </div>
                            <button
                                onClick={handleCreateRepo}
                                disabled={createModal.loading || !createModal.name.trim()}
                                className="w-full py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {createModal.loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                {createModal.loading ? 'Creating...' : 'Create Repository'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
