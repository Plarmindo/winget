import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PackageGrid } from './PackageGrid';
import { WingetPackage } from '../types';

describe('PackageGrid', () => {
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

    it('calls onExecute when install button is clicked', () => {
        render(<PackageGrid {...defaultProps} />);

        const installButton = screen.getByTitle('Install Test App');
        fireEvent.click(installButton);

        expect(defaultProps.onExecute).toHaveBeenCalledWith('Test.App', 'install');
    });

    it('shows empty state when no packages provided', () => {
        render(<PackageGrid {...defaultProps} packages={[]} />);

        expect(screen.getByText(/No packages found/i)).toBeDefined();
    });
});
