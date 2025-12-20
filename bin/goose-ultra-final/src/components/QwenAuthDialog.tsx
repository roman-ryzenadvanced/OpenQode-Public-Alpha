/**
 * Qwen OAuth Dialog for Goose Ultra
 * 
 * Provides an inline OAuth flow using the Device Authorization Grant.
 * Eliminates the need for external Qwen CLI.
 */

import React, { useState, useEffect } from 'react';

// ===== TYPES =====

interface AuthProgress {
    status: 'awaiting_auth' | 'polling';
    url?: string;
    userCode?: string;
    expiresIn?: number;
    attempt?: number;
    maxAttempts?: number;
}

type AuthStatus = 'idle' | 'starting' | 'awaiting' | 'polling' | 'success' | 'error';

interface QwenAuthDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

// ===== ICONS =====

const Icons = {
    Globe: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" x2="22" y1="12" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
    ),
    Check: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
    ),
    X: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" x2="6" y1="6" y2="18"></line>
            <line x1="6" x2="18" y1="6" y2="18"></line>
        </svg>
    ),
    Loader: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
            <line x1="12" x2="12" y1="2" y2="6"></line>
            <line x1="12" x2="12" y1="18" y2="22"></line>
            <line x1="4.93" x2="7.76" y1="4.93" y2="7.76"></line>
            <line x1="16.24" x2="19.07" y1="16.24" y2="19.07"></line>
            <line x1="2" x2="6" y1="12" y2="12"></line>
            <line x1="18" x2="22" y1="12" y2="12"></line>
            <line x1="4.93" x2="7.76" y1="19.07" y2="16.24"></line>
            <line x1="16.24" x2="19.07" y1="7.76" y2="4.93"></line>
        </svg>
    ),
    Copy: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
        </svg>
    ),
    ExternalLink: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" x2="21" y1="14" y2="3"></line>
        </svg>
    )
};

// ===== STYLES =====

const styles = {
    overlay: {
        position: 'fixed' as const,
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
    },
    dialog: {
        background: 'linear-gradient(180deg, rgba(28, 28, 35, 0.98) 0%, rgba(18, 18, 22, 0.98) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '20px',
        padding: '32px',
        maxWidth: '440px',
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
        position: 'relative' as const
    },
    closeButton: {
        position: 'absolute' as const,
        top: '16px',
        right: '16px',
        background: 'rgba(255, 255, 255, 0.05)',
        border: 'none',
        borderRadius: '8px',
        padding: '8px',
        color: '#71717a',
        cursor: 'pointer',
        transition: 'all 0.2s'
    },
    title: {
        fontSize: '22px',
        fontWeight: 700,
        color: '#fff',
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
    },
    subtitle: {
        fontSize: '14px',
        color: '#71717a',
        marginBottom: '24px'
    },
    codeBox: {
        background: 'rgba(0, 0, 0, 0.5)',
        border: '2px solid rgba(34, 211, 238, 0.4)',
        borderRadius: '16px',
        padding: '24px',
        textAlign: 'center' as const,
        marginBottom: '20px'
    },
    userCode: {
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: '36px',
        fontWeight: 700,
        color: '#22d3ee',
        letterSpacing: '4px',
        marginBottom: '12px'
    },
    copyButton: {
        background: 'rgba(255, 255, 255, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '8px',
        padding: '8px 16px',
        color: '#fff',
        fontSize: '13px',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'all 0.2s'
    },
    linkButton: {
        width: '100%',
        padding: '14px',
        background: 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)',
        border: 'none',
        borderRadius: '12px',
        color: '#000',
        fontSize: '15px',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        marginBottom: '16px',
        transition: 'all 0.2s'
    },
    secondaryButton: {
        width: '100%',
        padding: '12px',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '10px',
        color: '#a1a1aa',
        fontSize: '14px',
        cursor: 'pointer',
        transition: 'all 0.2s'
    },
    spinner: {
        width: '48px',
        height: '48px',
        margin: '0 auto 20px',
        border: '3px solid rgba(34, 211, 238, 0.2)',
        borderTopColor: '#22d3ee',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
    },
    pollingInfo: {
        background: 'rgba(34, 211, 238, 0.1)',
        border: '1px solid rgba(34, 211, 238, 0.2)',
        borderRadius: '10px',
        padding: '12px 16px',
        fontSize: '13px',
        color: '#22d3ee',
        textAlign: 'center' as const,
        marginTop: '16px'
    },
    successIcon: {
        width: '64px',
        height: '64px',
        margin: '0 auto 16px',
        background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff'
    },
    errorBox: {
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '12px',
        padding: '16px',
        color: '#ef4444',
        fontSize: '14px',
        marginBottom: '20px',
        textAlign: 'center' as const
    }
};

// Add keyframes for spinner animation
const spinnerKeyframes = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

// ===== COMPONENT =====

export const QwenAuthDialog: React.FC<QwenAuthDialogProps> = ({ isOpen, onClose, onSuccess }) => {
    const [status, setStatus] = useState<AuthStatus>('idle');
    const [authUrl, setAuthUrl] = useState('');
    const [userCode, setUserCode] = useState('');
    const [error, setError] = useState('');
    const [pollAttempt, setPollAttempt] = useState(0);
    const [maxAttempts, setMaxAttempts] = useState(0);
    const [copied, setCopied] = useState(false);

    // Setup listeners on mount
    useEffect(() => {
        const electron = (window as any).electron;
        if (!electron?.qwenAuth) return;

        electron.qwenAuth.onProgress((data: AuthProgress) => {
            if (data.status === 'awaiting_auth') {
                setStatus('awaiting');
                setAuthUrl(data.url || '');
                setUserCode(data.userCode || '');
                if (data.expiresIn) {
                    setMaxAttempts(Math.ceil(data.expiresIn / 2)); // 2 second intervals
                }
            } else if (data.status === 'polling') {
                setStatus('polling');
                setPollAttempt(data.attempt || 0);
                setMaxAttempts(data.maxAttempts || 0);
            }
        });

        electron.qwenAuth.onSuccess(() => {
            setStatus('success');
            setTimeout(() => {
                onSuccess?.();
                onClose();
            }, 1500);
        });

        electron.qwenAuth.onError((err: string) => {
            setStatus('error');
            setError(err);
        });

        return () => {
            electron.qwenAuth.removeListeners();
        };
    }, [onClose, onSuccess]);

    // Reset state when dialog opens
    useEffect(() => {
        if (isOpen) {
            setStatus('idle');
            setAuthUrl('');
            setUserCode('');
            setError('');
            setPollAttempt(0);
            setMaxAttempts(0);
        }
    }, [isOpen]);

    const startAuth = () => {
        const electron = (window as any).electron;
        if (!electron?.qwenAuth) return;

        setStatus('starting');
        setError('');
        electron.qwenAuth.start();
    };

    const cancelAuth = () => {
        const electron = (window as any).electron;
        if (electron?.qwenAuth) {
            electron.qwenAuth.cancel();
        }
        onClose();
    };

    const copyCode = async () => {
        try {
            await navigator.clipboard.writeText(userCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            console.error('Failed to copy:', e);
        }
    };

    const openAuthUrl = () => {
        if (authUrl) {
            window.open(authUrl, '_blank');
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <style>{spinnerKeyframes}</style>
            <div style={styles.overlay}>
                <div style={styles.dialog}>
                    <button style={styles.closeButton} onClick={cancelAuth}>
                        <Icons.X />
                    </button>

                    {/* IDLE STATE - Start Auth */}
                    {status === 'idle' && (
                        <>
                            <div style={styles.title}>
                                <span style={{ fontSize: '28px' }}>🔐</span>
                                Connect to Qwen
                            </div>
                            <p style={styles.subtitle}>
                                Authenticate with your Qwen account to access powerful AI models.
                                No external tools required!
                            </p>

                            <button style={styles.linkButton} onClick={startAuth}>
                                <Icons.Globe />
                                Sign in with Qwen
                            </button>

                            <button style={styles.secondaryButton} onClick={onClose}>
                                Cancel
                            </button>
                        </>
                    )}

                    {/* STARTING STATE */}
                    {status === 'starting' && (
                        <>
                            <div style={styles.title}>Connecting...</div>
                            <div style={{ textAlign: 'center', padding: '32px 0' }}>
                                <div style={styles.spinner} />
                                <p style={{ color: '#71717a' }}>Initializing device authorization...</p>
                            </div>
                        </>
                    )}

                    {/* AWAITING AUTHORIZATION */}
                    {status === 'awaiting' && (
                        <>
                            <div style={styles.title}>Complete in Browser</div>
                            <p style={styles.subtitle}>
                                A browser window should have opened. Enter this code when prompted:
                            </p>

                            <div style={styles.codeBox}>
                                <div style={styles.userCode}>{userCode}</div>
                                <button
                                    style={{
                                        ...styles.copyButton,
                                        background: copied ? 'rgba(34, 197, 94, 0.2)' : styles.copyButton.background,
                                        borderColor: copied ? '#22c55e' : 'rgba(255, 255, 255, 0.2)'
                                    }}
                                    onClick={copyCode}
                                >
                                    {copied ? <Icons.Check /> : <Icons.Copy />}
                                    {copied ? 'Copied!' : 'Copy Code'}
                                </button>
                            </div>

                            <button style={styles.linkButton} onClick={openAuthUrl}>
                                <Icons.ExternalLink />
                                Open Authorization Page
                            </button>

                            <div style={styles.pollingInfo}>
                                Waiting for authorization...
                            </div>

                            <button
                                style={{ ...styles.secondaryButton, marginTop: '16px' }}
                                onClick={cancelAuth}
                            >
                                Cancel
                            </button>
                        </>
                    )}

                    {/* POLLING STATE */}
                    {status === 'polling' && (
                        <>
                            <div style={styles.title}>Waiting for Authorization...</div>
                            <div style={{ textAlign: 'center', padding: '24px 0' }}>
                                <div style={styles.spinner} />
                                <p style={{ color: '#71717a', marginBottom: '8px' }}>
                                    Complete the sign-in in your browser
                                </p>
                                <p style={{ color: '#52525b', fontSize: '13px' }}>
                                    Check {pollAttempt} / {maxAttempts}
                                </p>
                            </div>

                            {userCode && (
                                <div style={styles.codeBox}>
                                    <div style={{ ...styles.userCode, fontSize: '28px' }}>{userCode}</div>
                                </div>
                            )}

                            <button style={styles.secondaryButton} onClick={cancelAuth}>
                                Cancel
                            </button>
                        </>
                    )}

                    {/* SUCCESS STATE */}
                    {status === 'success' && (
                        <>
                            <div style={styles.successIcon}>
                                <Icons.Check />
                            </div>
                            <div style={{ ...styles.title, justifyContent: 'center' }}>
                                Connected!
                            </div>
                            <p style={{ ...styles.subtitle, textAlign: 'center' }}>
                                You're now authenticated with Qwen.
                            </p>
                        </>
                    )}

                    {/* ERROR STATE */}
                    {status === 'error' && (
                        <>
                            <div style={styles.title}>
                                <span style={{ fontSize: '28px' }}>❌</span>
                                Authentication Failed
                            </div>

                            <div style={styles.errorBox}>
                                {error || 'An unknown error occurred'}
                            </div>

                            <button style={styles.linkButton} onClick={startAuth}>
                                Try Again
                            </button>

                            <button style={styles.secondaryButton} onClick={onClose}>
                                Cancel
                            </button>
                        </>
                    )}
                </div>
            </div>
        </>
    );
};

export default QwenAuthDialog;
