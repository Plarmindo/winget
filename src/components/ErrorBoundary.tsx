import { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../utils/logger';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            error,
            errorInfo: null
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        logger.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({
            error,
            errorInfo
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: '40px',
                    backgroundColor: '#1a1a1a',
                    color: 'white',
                    minHeight: '100vh',
                    fontFamily: 'system-ui'
                }}>
                    <h1 style={{ color: '#ef4444' }}>Something went wrong</h1>
                    <details style={{ whiteSpace: 'pre-wrap', marginTop: '20px' }}>
                        <summary style={{ cursor: 'pointer', marginBottom: '10px' }}>
                            Click for error details
                        </summary>
                        <div style={{
                            backgroundColor: '#0a0a0a',
                            padding: '15px',
                            borderRadius: '8px',
                            fontSize: '14px',
                            overflowX: 'auto'
                        }}>
                            <p><strong>Error:</strong> {this.state.error?.toString()}</p>
                            <p><strong>Stack:</strong></p>
                            <pre>{this.state.error?.stack}</pre>
                            {this.state.errorInfo && (
                                <>
                                    <p><strong>Component Stack:</strong></p>
                                    <pre>{this.state.errorInfo.componentStack}</pre>
                                </>
                            )}
                        </div>
                    </details>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            marginTop: '20px',
                            padding: '10px 20px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        Reload Application
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
