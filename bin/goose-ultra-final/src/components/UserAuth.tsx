/**
 * User Authentication Components for Goose Ultra
 * 
 * Components:
 * - LoginGate: Full-screen wrapper that enforces authentication
 * - UserOnboarding: Name + secret question wizard
 * - SecretCodeReveal: Shows code once with copy button
 * - LogoutDialog: Confirmation with clean data option
 */

import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';

// ===== TYPES =====

interface GooseUser {
    userId: string;
    displayName: string;
    secretQuestionId: string;
    createdAt: number;
    lastLoginAt: number;
}

interface UserSession {
    userId: string;
    displayName: string;
    loginAt: number;
}

interface SecretQuestion {
    id: string;
    question: string;
}

interface UserContextType {
    session: UserSession | null;
    user: GooseUser | null;
    isLoading: boolean;
    logout: (cleanData?: boolean) => Promise<void>;
    refreshSession: () => Promise<void>;
}

// ===== CONTEXT =====

const UserContext = createContext<UserContextType>({
    session: null,
    user: null,
    isLoading: true,
    logout: async () => { },
    refreshSession: async () => { }
});

export const useUser = () => useContext(UserContext);

// ===== ICONS =====

const Icons = {
    User: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
        </svg>
    ),
    Key: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
        </svg>
    ),
    Check: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
    ),
    Copy: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
        </svg>
    ),
    Alert: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
            <path d="M12 9v4"></path>
            <path d="M12 17h.01"></path>
        </svg>
    ),
    Logout: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" x2="9" y1="12" y2="12"></line>
        </svg>
    ),
    Trash: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18"></path>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
        </svg>
    ),
    ArrowRight: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14"></path>
            <path d="m12 5 7 7-7 7"></path>
        </svg>
    )
};

// ===== STYLES =====

const styles = {
    container: {
        position: 'fixed' as const,
        inset: 0,
        background: 'linear-gradient(135deg, #030304 0%, #0a0a0f 50%, #030304 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
    },
    card: {
        background: 'rgba(20, 20, 25, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
        padding: '48px',
        maxWidth: '480px',
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(20px)'
    },
    logo: {
        width: '80px',
        height: '80px',
        margin: '0 auto 24px',
        display: 'block',
        borderRadius: '20px',
        background: 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)',
        padding: '16px'
    },
    title: {
        fontSize: '28px',
        fontWeight: 700,
        textAlign: 'center' as const,
        marginBottom: '8px',
        background: 'linear-gradient(135deg, #fff 0%, #a1a1aa 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent'
    },
    subtitle: {
        fontSize: '15px',
        color: '#71717a',
        textAlign: 'center' as const,
        marginBottom: '32px'
    },
    input: {
        width: '100%',
        padding: '14px 16px',
        background: 'rgba(0, 0, 0, 0.4)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        color: '#fff',
        fontSize: '16px',
        outline: 'none',
        transition: 'all 0.2s',
        marginBottom: '16px',
        boxSizing: 'border-box' as const
    },
    select: {
        width: '100%',
        padding: '14px 16px',
        background: 'rgba(0, 0, 0, 0.4)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        color: '#fff',
        fontSize: '16px',
        outline: 'none',
        marginBottom: '16px',
        cursor: 'pointer',
        boxSizing: 'border-box' as const
    },
    button: {
        width: '100%',
        padding: '16px',
        background: 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)',
        border: 'none',
        borderRadius: '12px',
        color: '#000',
        fontSize: '16px',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        transition: 'all 0.2s'
    },
    buttonSecondary: {
        width: '100%',
        padding: '16px',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        color: '#fff',
        fontSize: '16px',
        fontWeight: 500,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        transition: 'all 0.2s',
        marginTop: '12px'
    },
    codeBox: {
        background: 'rgba(0, 0, 0, 0.6)',
        border: '2px solid rgba(34, 211, 238, 0.3)',
        borderRadius: '16px',
        padding: '24px',
        textAlign: 'center' as const,
        marginBottom: '24px'
    },
    code: {
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: '28px',
        fontWeight: 700,
        color: '#22d3ee',
        letterSpacing: '2px'
    },
    warning: {
        background: 'rgba(234, 179, 8, 0.1)',
        border: '1px solid rgba(234, 179, 8, 0.3)',
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
        marginBottom: '24px',
        color: '#eab308'
    },
    checkbox: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '24px',
        cursor: 'pointer',
        color: '#a1a1aa'
    },
    error: {
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '12px',
        padding: '12px 16px',
        color: '#ef4444',
        fontSize: '14px',
        marginBottom: '16px',
        textAlign: 'center' as const
    }
};

// ===== COMPONENTS =====

/**
 * Welcome Screen - First screen user sees
 */
const WelcomeScreen: React.FC<{
    onNewUser: () => void;
    onHasCode: () => void;
}> = ({ onNewUser, onHasCode }) => (
    <div style={styles.card}>
        <div style={styles.logo}>
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M24 4L4 14v20l20 10 20-10V14L24 4z" fill="#000" fillOpacity="0.3" />
                <path d="M24 8L8 16v16l16 8 16-8V16L24 8z" stroke="#fff" strokeWidth="2" />
                <circle cx="24" cy="24" r="8" fill="#fff" />
            </svg>
        </div>
        <h1 style={styles.title}>Welcome to Goose Ultra</h1>
        <p style={styles.subtitle}>Your personal AI-powered development environment</p>

        <button style={styles.button} onClick={onNewUser}>
            <Icons.User />
            I'm new here
        </button>

        <button style={styles.buttonSecondary} onClick={onHasCode}>
            <Icons.Key />
            I have a secret code
        </button>
    </div>
);

/**
 * Login Screen - Enter secret code
 */
const LoginScreen: React.FC<{
    onLogin: (code: string) => Promise<boolean>;
    onBack: () => void;
}> = ({ onLogin, onBack }) => {
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code.trim()) return;

        setLoading(true);
        setError('');

        const success = await onLogin(code.trim());
        if (!success) {
            setError('Invalid secret code. Please check and try again.');
        }
        setLoading(false);
    };

    return (
        <div style={styles.card}>
            <h1 style={styles.title}>Welcome Back</h1>
            <p style={styles.subtitle}>Enter your secret code to continue</p>

            {error && <div style={styles.error}>{error}</div>}

            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    placeholder="GU-XXXX-XXXX-XXXX"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    style={{
                        ...styles.input,
                        fontFamily: "'JetBrains Mono', monospace",
                        letterSpacing: '1px',
                        textAlign: 'center',
                        fontSize: '18px'
                    }}
                    autoFocus
                />

                <button
                    type="submit"
                    style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}
                    disabled={loading}
                >
                    {loading ? 'Verifying...' : 'Login'}
                    <Icons.ArrowRight />
                </button>
            </form>

            <button style={styles.buttonSecondary} onClick={onBack}>
                Back
            </button>
        </div>
    );
};

/**
 * Onboarding Step 1 - Enter Name
 */
const OnboardingName: React.FC<{
    onNext: (name: string) => void;
    onBack: () => void;
}> = ({ onNext, onBack }) => {
    const [name, setName] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim().length >= 2) {
            onNext(name.trim());
        }
    };

    return (
        <div style={styles.card}>
            <h1 style={styles.title}>What's your name?</h1>
            <p style={styles.subtitle}>This will be displayed in your profile</p>

            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    placeholder="Enter your display name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={styles.input}
                    autoFocus
                    minLength={2}
                    maxLength={50}
                />

                <button
                    type="submit"
                    style={{ ...styles.button, opacity: name.length < 2 ? 0.5 : 1 }}
                    disabled={name.length < 2}
                >
                    Continue
                    <Icons.ArrowRight />
                </button>
            </form>

            <button style={styles.buttonSecondary} onClick={onBack}>
                Back
            </button>
        </div>
    );
};

/**
 * Onboarding Step 2 - Secret Question
 */
const OnboardingQuestion: React.FC<{
    questions: SecretQuestion[];
    onNext: (questionId: string, answer: string) => void;
    onBack: () => void;
}> = ({ questions, onNext, onBack }) => {
    const [questionId, setQuestionId] = useState('');
    const [answer, setAnswer] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (questionId && answer.trim().length >= 2) {
            onNext(questionId, answer.trim());
        }
    };

    return (
        <div style={styles.card}>
            <h1 style={styles.title}>Set a Security Question</h1>
            <p style={styles.subtitle}>This helps generate your unique secret code</p>

            <form onSubmit={handleSubmit}>
                <select
                    value={questionId}
                    onChange={(e) => setQuestionId(e.target.value)}
                    style={styles.select}
                >
                    <option value="">Select a question...</option>
                    {questions.map(q => (
                        <option key={q.id} value={q.id}>{q.question}</option>
                    ))}
                </select>

                <input
                    type="text"
                    placeholder="Your answer"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    style={styles.input}
                    minLength={2}
                />

                <button
                    type="submit"
                    style={{ ...styles.button, opacity: (!questionId || answer.length < 2) ? 0.5 : 1 }}
                    disabled={!questionId || answer.length < 2}
                >
                    Generate Secret Code
                    <Icons.Key />
                </button>
            </form>

            <button style={styles.buttonSecondary} onClick={onBack}>
                Back
            </button>
        </div>
    );
};

/**
 * Secret Code Reveal
 */
const SecretCodeReveal: React.FC<{
    code: string;
    userName: string;
    onContinue: () => void;
}> = ({ code, userName, onContinue }) => {
    const [copied, setCopied] = useState(false);
    const [confirmed, setConfirmed] = useState(false);

    const copyCode = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            console.error('Failed to copy:', e);
        }
    };

    return (
        <div style={styles.card}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '48px' }}>🎉</span>
            </div>
            <h1 style={styles.title}>Welcome, {userName}!</h1>
            <p style={styles.subtitle}>Your secret code is ready</p>

            <div style={styles.codeBox}>
                <div style={styles.code}>{code}</div>
                <button
                    onClick={copyCode}
                    style={{
                        marginTop: '16px',
                        padding: '10px 20px',
                        background: copied ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                        border: `1px solid ${copied ? '#22c55e' : 'rgba(255, 255, 255, 0.2)'}`,
                        borderRadius: '8px',
                        color: copied ? '#22c55e' : '#fff',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '14px',
                        transition: 'all 0.2s'
                    }}
                >
                    {copied ? <Icons.Check /> : <Icons.Copy />}
                    {copied ? 'Copied!' : 'Copy to Clipboard'}
                </button>
            </div>

            <div style={styles.warning}>
                <Icons.Alert />
                <div>
                    <strong style={{ display: 'block', marginBottom: '4px' }}>SAVE THIS CODE OFFLINE!</strong>
                    <span style={{ fontSize: '13px', opacity: 0.9 }}>
                        This is the ONLY way to log back in. We cannot recover it if you lose it.
                    </span>
                </div>
            </div>

            <label style={styles.checkbox} onClick={() => setConfirmed(!confirmed)}>
                <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span>I have saved my code securely</span>
            </label>

            <button
                style={{ ...styles.button, opacity: confirmed ? 1 : 0.5 }}
                onClick={onContinue}
                disabled={!confirmed}
            >
                Continue to Goose Ultra
                <Icons.ArrowRight />
            </button>
        </div>
    );
};

/**
 * Logout Dialog
 */
export const LogoutDialog: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onLogout: (cleanData: boolean) => void;
    userName: string;
    stats: { projectCount: number; chatCount: number; totalSizeBytes: number };
}> = ({ isOpen, onClose, onLogout, userName, stats }) => {
    if (!isOpen) return null;

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
        }}>
            <div style={{ ...styles.card, maxWidth: '420px' }}>
                <h2 style={{ ...styles.title, fontSize: '22px' }}>Logging Out</h2>
                <p style={{ ...styles.subtitle, marginBottom: '24px' }}>
                    Goodbye, {userName}!
                </p>

                <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '24px'
                }}>
                    <div style={{ fontSize: '13px', color: '#a1a1aa', marginBottom: '12px' }}>
                        Your data on this device:
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fff', fontSize: '14px', marginBottom: '8px' }}>
                        <span>Projects</span>
                        <span>{stats.projectCount}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fff', fontSize: '14px', marginBottom: '8px' }}>
                        <span>Chat History</span>
                        <span>{stats.chatCount}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fff', fontSize: '14px' }}>
                        <span>Total Size</span>
                        <span>{formatSize(stats.totalSizeBytes)}</span>
                    </div>
                </div>

                <button
                    style={styles.button}
                    onClick={() => onLogout(false)}
                >
                    <Icons.Logout />
                    Keep Data & Logout
                </button>

                <button
                    style={{
                        ...styles.buttonSecondary,
                        borderColor: 'rgba(239, 68, 68, 0.3)',
                        color: '#ef4444'
                    }}
                    onClick={() => onLogout(true)}
                >
                    <Icons.Trash />
                    Clean Data & Logout
                </button>

                <button
                    style={{ ...styles.buttonSecondary, marginTop: '8px' }}
                    onClick={onClose}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
};

// ===== MAIN LOGIN GATE =====

type Screen = 'welcome' | 'login' | 'onboarding-name' | 'onboarding-question' | 'code-reveal';

export const LoginGate: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [screen, setScreen] = useState<Screen>('welcome');
    const [session, setSession] = useState<UserSession | null>(null);
    const [user, setUser] = useState<GooseUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [questions, setQuestions] = useState<SecretQuestion[]>([]);

    // Onboarding state
    const [onboardingName, setOnboardingName] = useState('');
    const [generatedCode, setGeneratedCode] = useState('');

    // Check for existing session on mount
    useEffect(() => {
        const checkSession = async () => {
            const electron = (window as any).electron;
            if (!electron?.user) {
                // No electron API (web mode) - skip auth
                setIsLoading(false);
                return;
            }

            try {
                const existingSession = await electron.user.getSession();
                if (existingSession) {
                    setSession(existingSession);
                }

                const questionsList = await electron.user.getSecretQuestions();
                setQuestions(questionsList || []);
            } catch (e) {
                console.error('Failed to check session:', e);
            }

            setIsLoading(false);
        };

        checkSession();
    }, []);

    // Login handler
    const handleLogin = async (code: string): Promise<boolean> => {
        const electron = (window as any).electron;
        if (!electron?.user) return false;

        const result = await electron.user.login(code);
        if (result.success) {
            setSession(result.session);
            setUser(result.user);
            return true;
        }
        return false;
    };

    // Create user handler
    const handleCreateUser = async (questionId: string, answer: string) => {
        const electron = (window as any).electron;
        if (!electron?.user) return;

        const result = await electron.user.create(onboardingName, questionId, answer);
        if (result.success) {
            setGeneratedCode(result.secretCode);
            setUser(result.user);
            setSession(result.session);
            setScreen('code-reveal');
        }
    };

    // Logout handler
    const handleLogout = async (cleanData = false) => {
        const electron = (window as any).electron;
        if (!electron?.user) return;

        await electron.user.logout(cleanData);
        setSession(null);
        setUser(null);
        setScreen('welcome');
    };

    // Refresh session
    const refreshSession = async () => {
        const electron = (window as any).electron;
        if (!electron?.user) return;

        const existingSession = await electron.user.getSession();
        setSession(existingSession);
    };

    // Loading state
    if (isLoading) {
        return (
            <div style={styles.container}>
                <div style={{ color: '#fff', fontSize: '18px' }}>Loading...</div>
            </div>
        );
    }

    // If no electron (web mode) or has session, render children
    const electron = (window as any).electron;
    if (!electron?.user || session) {
        return (
            <UserContext.Provider value={{ session, user, isLoading, logout: handleLogout, refreshSession }}>
                {children}
            </UserContext.Provider>
        );
    }

    // Render login/onboarding screens
    return (
        <div style={styles.container}>
            {screen === 'welcome' && (
                <WelcomeScreen
                    onNewUser={() => setScreen('onboarding-name')}
                    onHasCode={() => setScreen('login')}
                />
            )}

            {screen === 'login' && (
                <LoginScreen
                    onLogin={handleLogin}
                    onBack={() => setScreen('welcome')}
                />
            )}

            {screen === 'onboarding-name' && (
                <OnboardingName
                    onNext={(name) => {
                        setOnboardingName(name);
                        setScreen('onboarding-question');
                    }}
                    onBack={() => setScreen('welcome')}
                />
            )}

            {screen === 'onboarding-question' && (
                <OnboardingQuestion
                    questions={questions}
                    onNext={handleCreateUser}
                    onBack={() => setScreen('onboarding-name')}
                />
            )}

            {screen === 'code-reveal' && (
                <SecretCodeReveal
                    code={generatedCode}
                    userName={onboardingName}
                    onContinue={() => {
                        // Session already set, just clear screens
                        setScreen('welcome');
                    }}
                />
            )}
        </div>
    );
};

export default LoginGate;
