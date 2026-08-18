import { describe, it, expect } from 'vitest';
import { generateScript } from './scriptUtils';
import { WingetPackage } from '../types';

const pkg = (id: string, availableVersion?: string): WingetPackage => ({
  id,
  name: id,
  version: '1.0.0',
  description: 'A package',
  publisher: 'Tester',
  category: 'Utilities',
  isFree: true,
  source: 'winget',
  availableVersion,
});

describe('generateScript', () => {
  it('returns a message when no packages are selected', () => {
    expect(generateScript([], 'install', 'winget')).toBe('# No packages selected for script generation.');
  });

  it('generates git clone commands for github installs', () => {
    const script = generateScript([pkg('octo/repo')], 'install', 'github');
    expect(script).toContain('git clone https://github.com/octo/repo.git');
    expect(script).toContain('Github Install Script');
  });

  it('skips invalid package ids in github installs', () => {
    const script = generateScript([pkg('octo/repo'), pkg('-bad/../evil')], 'install', 'github');
    expect(script).toContain('git clone https://github.com/octo/repo.git');
    expect(script).toContain('# Skipped invalid package ID');
  });

  it('notes that github upgrades and uninstalls need manual git operations', () => {
    const script = generateScript([pkg('octo/repo')], 'upgrade', 'github');
    expect(script).toContain('GitHub mode mostly supports cloning');
    const uninstall = generateScript([pkg('octo/repo')], 'uninstall', 'github');
    expect(uninstall).toContain('GitHub mode mostly supports cloning');
  });

  it('generates a PowerShell winget uninstall script', () => {
    const script = generateScript([pkg('App.One'), pkg('App.Two')], 'uninstall', 'winget');
    expect(script).toContain('$packages = @(');
    expect(script).toContain('"App.One"');
    expect(script).toContain('"App.Two"');
    expect(script).toContain('winget uninstall --id $id -e');
  });

  it('skips invalid ids in winget uninstall scripts', () => {
    const script = generateScript([pkg('-evil'), pkg('App.One')], 'uninstall', 'winget');
    expect(script).toContain('# Skipped invalid package ID: -evil');
    expect(script).toContain('"App.One"');
  });

  it('generates uninstall commands for the other managers', () => {
    expect(generateScript([pkg('App.One')], 'uninstall', 'chocolatey')).toContain('choco uninstall App.One -y');
    expect(generateScript([pkg('App.One')], 'uninstall', 'scoop')).toContain('scoop uninstall App.One');
    expect(generateScript([pkg('App.One')], 'uninstall', 'brew')).toContain('brew uninstall App.One');
    expect(generateScript([pkg('App.One')], 'uninstall', 'apt')).toContain('sudo apt remove App.One -y');
  });

  it('reports when all packages are up to date', () => {
    const script = generateScript([pkg('App.One')], 'upgrade', 'winget');
    expect(script).toContain('# All selected packages are up to date.');
  });

  it('generates upgrade commands only for upgradable packages', () => {
    const script = generateScript([pkg('App.One', '2.0.0'), pkg('App.Two')], 'upgrade', 'winget');
    expect(script).toContain('winget upgrade --id App.One -e --source winget');
    expect(script).not.toContain('App.Two');
    expect(generateScript([pkg('App.One', '2.0.0')], 'upgrade', 'chocolatey')).toContain('choco upgrade App.One -y');
    expect(generateScript([pkg('App.One', '2.0.0')], 'upgrade', 'scoop')).toContain('scoop update App.One');
    expect(generateScript([pkg('App.One', '2.0.0')], 'upgrade', 'brew')).toContain('brew upgrade App.One');
    expect(generateScript([pkg('App.One', '2.0.0')], 'upgrade', 'apt')).toContain('sudo apt upgrade App.One -y');
  });

  it('generates install commands for every manager', () => {
    expect(generateScript([pkg('App.One')], 'install', 'winget')).toContain(
      'winget install --id App.One -e --source winget'
    );
    expect(generateScript([pkg('App.One')], 'install', 'chocolatey')).toContain('choco install App.One -y');
    expect(generateScript([pkg('App.One')], 'install', 'scoop')).toContain('scoop install App.One');
    expect(generateScript([pkg('App.One')], 'install', 'brew')).toContain('brew install App.One');
    expect(generateScript([pkg('App.One')], 'install', 'apt')).toContain('sudo apt install App.One -y');
  });

  it('sanitizes ids and limits their length', () => {
    const longId = `${'a'.repeat(300)}.App`;
    const script = generateScript([pkg(longId)], 'install', 'apt');
    expect(script).toContain('sudo apt install');
    expect(script).toContain('a'.repeat(256)); // truncated to 256 chars
    expect(script).not.toContain('a'.repeat(300));
  });
});
