import { describe, it, expect } from 'vitest';
import { getErrorDetails } from './errorUtils';

describe('getErrorDetails', () => {
  it('handles structured insufficient-privileges errors', () => {
    const details = getErrorDetails({ code: 'INSUFFICIENT_PRIVILEGES', details: {} });
    expect(details.title).toBe('Administrator Privileges Required');
    expect(details.description).toBe('This operation requires administrator rights.');
    expect(details.action).toBe('admin');
  });

  it('uses the help text when provided for privilege errors', () => {
    const details = getErrorDetails({
      code: 'INSUFFICIENT_PRIVILEGES',
      details: { help: 'Run as admin please' },
    });
    expect(details.description).toBe('Run as admin please');
  });

  it('handles package-not-found errors with suggestions', () => {
    const details = getErrorDetails({
      code: 'PACKAGE_NOT_FOUND',
      details: { query: 'chrom', suggestions: ['Google.Chrome', 'Chromium'] },
    });
    expect(details.title).toBe('Package Not Found');
    expect(details.description).toBe("Could not find package 'chrom'.");
    expect(details.hint).toBe('Did you mean: Google.Chrome, Chromium?');
    expect(details.action).toBe('retry');
  });

  it('handles package-not-found errors without suggestions', () => {
    const details = getErrorDetails({ code: 'PACKAGE_NOT_FOUND', details: {} });
    expect(details.description).toBe("Could not find package 'requested'.");
    expect(details.hint).toBe('Check the package ID and try again.');
  });

  it('handles network errors', () => {
    const details = getErrorDetails({ code: 'NETWORK_ERROR', details: { message: 'Connection refused' } });
    expect(details.title).toBe('Network Error');
    expect(details.description).toBe('Connection refused');
    const fallback = getErrorDetails({ code: 'NETWORK_ERROR', details: {} });
    expect(fallback.description).toBe('Unable to connect to package source.');
  });

  it('handles command-failed errors', () => {
    const details = getErrorDetails({
      code: 'COMMAND_FAILED',
      details: { exit_code: 1, stderr_preview: 'winget: not found' },
    });
    expect(details.title).toBe('Command Failed');
    expect(details.description).toBe('The operation failed with exit code 1.');
    expect(details.hint).toBe('Error output: winget: not found');
    const fallback = getErrorDetails({ code: 'COMMAND_FAILED', details: {} });
    expect(fallback.hint).toBe('Check the logs for more details.');
  });

  it('matches quota errors from message strings', () => {
    expect(getErrorDetails('429 Too Many Requests').title).toBe('API Quota Exceeded');
    expect(getErrorDetails('Quota exceeded for model').title).toBe('API Quota Exceeded');
    expect(getErrorDetails('RESOURCE_EXHAUSTED').action).toBe('settings');
    expect(getErrorDetails(new Error('API returned 429')).title).toBe('API Quota Exceeded');
  });

  it('falls back to a generic failure for unknown errors', () => {
    const details = getErrorDetails(new Error('something broke'));
    expect(details.title).toBe('Operation Failed');
    expect(details.description).toBe('something broke');
    expect(details.action).toBe('none');
  });

  it('falls back for non-object and null errors', () => {
    const nullDetails = getErrorDetails(null);
    expect(nullDetails.description).toBe('Unknown error');
    const stringDetails = getErrorDetails('plain string');
    expect(stringDetails.description).toBe('plain string');
    const numberDetails = getErrorDetails(42);
    expect(numberDetails.description).toBe('Unknown error');
  });
});
