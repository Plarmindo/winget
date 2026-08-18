import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PackageGrid } from './PackageGrid';
import { ConfirmDialog } from './ConfirmDialog';
import { useConfirmStore } from '../stores/confirmStore';
import { WingetPackage } from '../types';

describe('PackageGrid', () => {
  beforeEach(() => {
    useConfirmStore.setState({ isOpen: false, options: null, pending: null });
  });
  const mockPackage: WingetPackage = {
    id: 'Test.App',
    name: 'Test App',
    version: '1.0.0',
    description: 'A test application',
    publisher: 'Tester',
    category: 'Utilities',
    isFree: true,
  };

  const defaultProps = {
    packages: [mockPackage],
    onExecute: vi.fn(),
    handleSearch: vi.fn(),
    onFetchDetails: vi.fn(),
    isDesktop: true,
  };

  it('renders package cards correctly', () => {
    render(<PackageGrid {...defaultProps} />);

    expect(screen.getByText('Test App')).toBeDefined();
    expect(screen.getByText('1.0.0')).toBeDefined();
    expect(screen.getByText('Tester')).toBeDefined();
  });

  it('calls onExecute when install button is clicked and the confirmation is accepted', async () => {
    render(
      <>
        <PackageGrid {...defaultProps} />
        <ConfirmDialog />
      </>
    );

    const installButton = screen.getByText('Install Now');
    fireEvent.click(installButton);

    // A confirmation dialog is shown first; accept it.
    expect(await screen.findByText('Are you sure you want to install Test App immediately?')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Install' }));

    await waitFor(() => expect(defaultProps.onExecute).toHaveBeenCalledWith('Test.App', 'install'));
  });

  it('returns null when no packages provided (empty state handled by parent)', () => {
    const { container } = render(<PackageGrid {...defaultProps} packages={[]} />);

    expect(container.innerHTML).toBe('');
  });
});
