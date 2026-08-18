import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsModal, SettingsTab } from './SettingsModal';

// Stub the tab panels so the test focuses on tab selection logic only
vi.mock('./settings/AppearanceTab', () => ({ AppearanceTab: () => <div data-testid="tab-general">Appearance</div> }));
const { AiTabMock } = vi.hoisted(() => ({
  AiTabMock: vi.fn((_props: { focusOnMount?: boolean }) => <div data-testid="tab-ai">AI</div>),
}));
vi.mock('./settings/AiTab', () => ({ AiTab: (props: { focusOnMount?: boolean }) => AiTabMock(props) }));
vi.mock('./settings/ConnectionsTab', () => ({
  ConnectionsTab: () => <div data-testid="tab-connections">Connections</div>,
}));
vi.mock('./settings/DataTab', () => ({ DataTab: () => <div data-testid="tab-data">Data</div> }));
vi.mock('./settings/AboutTab', () => ({ AboutTab: () => <div data-testid="tab-about">About</div> }));

const renderModal = (props: {
  isOpen: boolean;
  initialTab?: SettingsTab;
  onTabChange?: (tab: SettingsTab) => void;
  focusOnOpen?: boolean;
}) =>
  render(
    <SettingsModal
      isOpen={props.isOpen}
      onClose={() => {}}
      onClearData={() => {}}
      initialTab={props.initialTab}
      onTabChange={props.onTabChange}
      focusOnOpen={props.focusOnOpen}
    />
  );

describe('SettingsModal initialTab', () => {
  it('lands on the AI tab when initialTab is "ai"', () => {
    renderModal({ isOpen: true, initialTab: 'ai' });

    expect(screen.getByTestId('tab-ai')).toBeInTheDocument();
    expect(screen.queryByTestId('tab-general')).not.toBeInTheDocument();
  });

  it('defaults to the general tab when no initialTab is given', () => {
    renderModal({ isOpen: true });

    expect(screen.getByTestId('tab-general')).toBeInTheDocument();
    expect(screen.queryByTestId('tab-ai')).not.toBeInTheDocument();
  });
  it('re-applies the requested tab when the modal reopens', () => {
    const { rerender } = render(
      <SettingsModal isOpen={false} onClose={() => {}} onClearData={() => {}} initialTab="general" />
    );
    // Nothing renders while closed
    expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument();

    rerender(<SettingsModal isOpen={true} onClose={() => {}} onClearData={() => {}} initialTab="ai" />);
    expect(screen.getByTestId('tab-ai')).toBeInTheDocument();
  });
});

describe('SettingsModal onTabChange', () => {
  it('reports the clicked tab so callers can persist it', () => {
    const onTabChange = vi.fn();
    renderModal({ isOpen: true, onTabChange });

    // Click the Data tab
    screen.getByText('Data').click();

    expect(onTabChange).toHaveBeenCalledWith('data');
  });

  it('does not fire onTabChange for the initialTab itself', () => {
    const onTabChange = vi.fn();
    renderModal({ isOpen: true, initialTab: 'ai', onTabChange });

    expect(screen.getByTestId('tab-ai')).toBeInTheDocument();
    expect(onTabChange).not.toHaveBeenCalled();
  });
});

describe('SettingsModal deep-link focus', () => {
  beforeEach(() => {
    AiTabMock.mockClear();
  });

  it('requests focus on the AI tab when opened via a deep link', () => {
    renderModal({ isOpen: true, initialTab: 'ai', focusOnOpen: true });

    expect(AiTabMock).toHaveBeenCalledWith(expect.objectContaining({ focusOnMount: true }));
  });

  it('does not request focus when the AI tab is reached by a manual click', () => {
    renderModal({ isOpen: true, initialTab: 'ai', focusOnOpen: true });
    AiTabMock.mockClear();

    // Manually navigate away and back to the Intelligence tab
    fireEvent.click(screen.getByText('Data'));
    fireEvent.click(screen.getByText('Intelligence'));

    expect(AiTabMock).toHaveBeenLastCalledWith(expect.objectContaining({ focusOnMount: false }));
  });

  it('does not request focus on a generic open that lands on the AI tab (remembered tab)', () => {
    renderModal({ isOpen: true, initialTab: 'ai' });

    expect(AiTabMock).toHaveBeenCalledWith(expect.objectContaining({ focusOnMount: false }));
  });
});
