import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from '../constants';
import { ViHost, ViCredential, ViRunbook } from '../types';

interface ActionProposal {
    id: string;
    title: string;
    description: string;
    steps: string[];
    script: string;
    risk: 'low' | 'medium' | 'high';
    targets: string[];
    rollback?: string;
}

export const ViControlView = () => {
    const [activeSection, setActiveSection] = useState<'computer' | 'browser' | 'vision' | 'local' | 'remote' | 'vault' | 'logs'>('computer');
    const [hosts, setHosts] = useState<ViHost[]>([]);
    const [creds, setCreds] = useState<ViCredential[]>([]);
    const [logs, setLogs] = useState<any[]>([]);

    const [pendingProposal, setPendingProposal] = useState<ActionProposal | null>(null);
    const [isExecuting, setIsExecuting] = useState(false);
    const [output, setOutput] = useState<string[]>([]);

    // Computer Use State
    const [computerTask, setComputerTask] = useState('');
    const [taskChain, setTaskChain] = useState<{ id: string; task: string; status: 'pending' | 'running' | 'done' | 'error' }[]>([]);
    const [isCapturing, setIsCapturing] = useState(false);

    // Browser Use State
    const [browserUrl, setBrowserUrl] = useState('');
    const [browserTask, setBrowserTask] = useState('');
    const [browserActions, setBrowserActions] = useState<{ action: string; selector?: string; value?: string }[]>([]);

    // Vision State
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [visionAnalysis, setVisionAnalysis] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Modals
    const [showAddHost, setShowAddHost] = useState(false);
    const [showAddSecret, setShowAddSecret] = useState(false);
    const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
    const [passwordForHost, setPasswordForHost] = useState('');
    const [pendingSSHHost, setPendingSSHHost] = useState<ViHost | null>(null);
    const [newHost, setNewHost] = useState<Partial<ViHost>>({ protocol: 'ssh', port: 22, osHint: 'linux', tags: [], credId: '' });
    const [newSecret, setNewSecret] = useState({ label: '', type: 'password', value: '' });

    const electron = (window as any).electron;

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        if (!electron?.vi) return;
        const h = await electron.vi.getHosts();
        const c = await electron.vi.getCredentials();
        setHosts(h || []);
        setCreds(c || []);
    };

    const handleAddHost = async () => {
        if (!newHost.label || !newHost.hostname) return;
        const hostWithId = {
            ...newHost,
            hostId: `host_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            createdAt: Date.now()
        };
        await electron.vi.addHost(hostWithId);
        setShowAddHost(false);
        setNewHost({ protocol: 'ssh', port: 22, osHint: 'linux', tags: [] }); // Reset form
        loadData();
    };

    const handleAddSecret = async () => {
        if (!newSecret.label || !newSecret.value) return;
        await electron.vi.saveCredential(newSecret.label, newSecret.type, newSecret.value);
        setShowAddSecret(false);
        setNewSecret({ label: '', type: 'password', value: '' }); // Reset form
        loadData();
    };

    const handleDeleteSecret = async (id: string) => {
        if (confirm('Delete this credential?')) {
            await electron.vi.deleteCredential(id);
            loadData();
        }
    };

    const handleDeleteHost = async (hostId: string) => {
        if (confirm('Delete this host? This cannot be undone.')) {
            await electron.vi.deleteHost(hostId);
            loadData();
            setLogs(prev => [{ type: 'SUCCESS', title: 'Host deleted', timestamp: new Date().toISOString() }, ...prev]);
        }
    };

    const handleSSHConnect = async (host: ViHost) => {
        // Verify credential integrity: Check if host has a linked credential AND it exists in our loaded list
        const isValidCred = host.credId && creds.some(c => c.credentialId === host.credId);

        if (!isValidCred) {
            // No valid credential found (or it was deleted) - show password prompt
            setPendingSSHHost(host);
            setPasswordForHost('');
            setShowPasswordPrompt(true);
            return;
        }

        // Has valid credential - connect directly
        executeSSHWithCredential(host);
    };

    const executeSSHWithCredential = (host: ViHost) => {
        setOutput([`[SSH] Connecting to ${host.username}@${host.hostname}:${host.port}...`]);

        const sessionId = `ssh-${Date.now()}`;
        electron.removeExecListeners();
        electron.onExecChunk((data: any) => {
            setOutput(prev => [...prev, data.text]);
        });
        electron.onExecComplete(() => {
            setOutput(prev => [...prev, '[SSH] Connection closed.']);
            setLogs(prev => [{ type: 'SUCCESS', title: `SSH to ${host.label} completed`, timestamp: new Date().toISOString() }, ...prev]);
        });
        electron.onExecError((data: any) => {
            if (data.message && data.message.includes('No credentials found')) {
                // FALLBACK: Metadata exists but Vault is empty/corrupt. Prompt for password.
                setOutput(prev => [...prev, '[SSH WARN] stored credential missing from vault. Switching to manual password entry...']);
                setPendingSSHHost(host);
                setPasswordForHost('');
                setShowPasswordPrompt(true);
                return;
            }
            setOutput(prev => [...prev, `[SSH ERROR] ${data.message}`]);
            setLogs(prev => [{ type: 'ERROR', title: `SSH to ${host.label} failed`, timestamp: new Date().toISOString() }, ...prev]);
        });

        electron.vi.runSSH(sessionId, host.hostId, 'uname -a && uptime', host.credId);
    };

    const executeSSHWithPassword = async () => {
        if (!pendingSSHHost || !passwordForHost) return;

        setShowPasswordPrompt(false);
        const host = pendingSSHHost;
        const sessionId = `ssh-${Date.now()}`;
        const currentPassword = passwordForHost; // Capture current value

        // Setup listeners
        setOutput([`[SSH] Connecting to ${host.username}@${host.hostname}:${host.port}...`]);
        electron.removeExecListeners();
        electron.onExecChunk((data: any) => {
            setOutput(prev => [...prev, data.text]);
        });
        electron.onExecComplete(() => {
            setOutput(prev => [...prev, '[SSH] Connection closed.']);
            setLogs(prev => [{ type: 'SUCCESS', title: `SSH to ${host.label} completed`, timestamp: new Date().toISOString() }, ...prev]);
        });
        electron.onExecError((data: any) => {
            setOutput(prev => [...prev, `[SSH ERROR] ${data.message}`]);
            setLogs(prev => [{ type: 'ERROR', title: `SSH to ${host.label} failed`, timestamp: new Date().toISOString() }, ...prev]);
        });

        // 1. Save credential for FUTURE use (async, non-blocking)
        const credLabel = `${host.label} Password`;
        electron.vi.saveCredential(credLabel, 'password', currentPassword).then(async (result: any) => {
            if (result?.credentialId) {
                const updatedHost = { ...host, credId: result.credentialId };
                await electron.vi.updateHost(updatedHost);
                loadData();
                setLogs(prev => [{ type: 'SUCCESS', title: `Credential saved for ${host.label}`, timestamp: new Date().toISOString() }, ...prev]);
            }
        }).catch((err: any) => {
            console.error('Failed to save credential:', err);
        });

        // 2. Connect IMMEDIATELY using the password in memory (Bypasses Vault issues)
        electron.vi.runSSHWithPassword(sessionId, host.hostId, 'uname -a && uptime', currentPassword);

        setPendingSSHHost(null);
        setPasswordForHost('');
    };

    // === COMPUTER USE HANDLERS ===
    const handleCaptureScreen = async (mode: 'desktop' | 'window' = 'desktop') => {
        setIsCapturing(true);
        try {
            const result = await electron.vi.captureScreen(mode);
            if (result?.success && result?.image) {
                setScreenshot(result.image);
                setLogs(prev => [{ type: 'SUCCESS', title: `Screen captured (${mode})`, timestamp: new Date().toISOString() }, ...prev]);
            }
        } catch (e) {
            console.error('[ViControl] Capture error:', e);
        }
        setIsCapturing(false);
    };

    const handleAnalyzeScreenshot = async () => {
        if (!screenshot) return;
        setIsAnalyzing(true);
        setVisionAnalysis(null);
        try {
            const result = await electron.vi.analyzeScreenshot(screenshot);
            if (result?.success) {
                setVisionAnalysis(JSON.stringify(result.analysis || result.raw, null, 2));
                setLogs(prev => [{ type: 'SUCCESS', title: 'Vision Analysis Complete', timestamp: new Date().toISOString() }, ...prev]);
            } else {
                setVisionAnalysis(`Error: ${result?.error || 'Unknown error'}`);
            }
        } catch (e: any) {
            setVisionAnalysis(`Error: ${e.message}`);
        }
        setIsAnalyzing(false);
    };

    const handleExecuteChain = async () => {
        if (taskChain.length === 0) return;

        // Create proposal for approval
        const proposal: ActionProposal = {
            id: `chain-${Date.now()}`,
            title: `Execute Task Chain (${taskChain.length} steps)`,
            description: `This will execute the following tasks on your computer:\n${taskChain.map((t, i) => `${i + 1}. ${t.task}`).join('\n')}`,
            steps: taskChain.map(t => t.task),
            script: taskChain.map(t => t.task).join('\n'),
            risk: 'medium',
            targets: ['local'],
        };
        setPendingProposal(proposal);
    };

    const executeApprovedChain = async () => {
        setPendingProposal(null);
        setIsExecuting(true);
        setOutput(['[SYSTEM] Starting task chain execution...']);

        // Setup progress listeners
        electron.vi.removeChainListeners();
        electron.vi.onChainProgress((progress: any) => {
            setOutput(prev => [...prev, `[${progress.status.toUpperCase()}] Task ${progress.taskIndex + 1}: ${progress.status}`]);
            if (progress.status === 'done' || progress.status === 'error') {
                setTaskChain(prev => prev.map((t, i) =>
                    i === progress.taskIndex ? { ...t, status: progress.status } : t
                ));
            } else if (progress.status === 'running') {
                setTaskChain(prev => prev.map((t, i) =>
                    i === progress.taskIndex ? { ...t, status: 'running' } : t
                ));
            }
        });
        electron.vi.onChainComplete((results: any) => {
            setIsExecuting(false);
            setOutput(prev => [...prev, `[COMPLETE] Chain finished with ${results.filter((r: any) => r.success).length}/${results.length} successful`]);
            setLogs(prev => [{ type: 'SUCCESS', title: 'Task Chain Complete', timestamp: new Date().toISOString() }, ...prev]);
        });

        electron.vi.executeChain(taskChain);
    };

    // === BROWSER USE HANDLERS ===
    const handleOpenBrowser = async () => {
        if (!browserUrl) return;
        await electron.vi.openBrowser(browserUrl);
        setLogs(prev => [{ type: 'SUCCESS', title: `Opened: ${browserUrl}`, timestamp: new Date().toISOString() }, ...prev]);
    };

    const handleAnalyzeBrowser = async () => {
        setIsAnalyzing(true);
        setOutput(['[BROWSER] Capturing screen for analysis...']);

        try {
            // 1. Capture Screen
            const capture = await electron.vi.captureScreen('desktop');
            if (capture?.success && capture?.image) {
                setScreenshot(capture.image);

                // 2. Analyze
                setOutput(prev => [...prev, '[BROWSER] Analyzing page structure...']);
                const result = await electron.vi.analyzeScreenshot(capture.image);

                if (result?.success && result?.analysis) {
                    setVisionAnalysis(JSON.stringify(result.analysis, null, 2));

                    // 3. Propose Actions (if analysis suggests them)
                    if (result.analysis.possibleActions) {
                        // Convert analysis actions to our ActionProposal format
                        const proposedActions = result.analysis.possibleActions.map((action: string) => ({
                            cmd: 'CLICK', // simplified for demo
                            value: action
                        }));

                        const proposal: ActionProposal = {
                            id: `browser-${Date.now()}`,
                            title: `Browser Actions: ${browserUrl.substring(0, 30)}...`,
                            description: `Analysis detected the following possible actions:\n${result.analysis.possibleActions.join('\n')}`,
                            steps: result.analysis.possibleActions,
                            script: `Analysis completed. Suggested actions found.`,
                            risk: 'low',
                            targets: ['local']
                        };
                        setPendingProposal(proposal);
                    }

                    setLogs(prev => [{ type: 'SUCCESS', title: 'Browser Analysis Complete', timestamp: new Date().toISOString() }, ...prev]);
                    setOutput(prev => [...prev, '[BROWSER] Analysis complete. Proposal generated.']);
                } else {
                    setOutput(prev => [...prev, `[BROWSER ERROR] Analysis failed or no structure found.`]);
                }
            } else {
                setOutput(prev => [...prev, `[BROWSER ERROR] Screen capture failed.`]);
            }
        } catch (e: any) {
            console.error(e);
            setOutput(prev => [...prev, `[BROWSER ERROR] ${e.message}`]);
        }
        setIsAnalyzing(false);
    };

    const handleExecute = async (proposal: ActionProposal) => {
        // Check if this is a chain execution
        if (proposal.targets.includes('local') && proposal.id.startsWith('chain-')) {
            executeApprovedChain();
            return;
        }

        setPendingProposal(null);
        setIsExecuting(true);
        setOutput([`[SYSTEM] Starting execution: ${proposal.title}`]);

        const sessionId = `vi-${Date.now()}`;

        electron.removeExecListeners();
        electron.onExecChunk((data: any) => {
            setOutput(prev => [...prev, data.text]);
        });
        electron.onExecComplete(() => {
            setIsExecuting(false);
            setLogs(prev => [{ type: 'SUCCESS', title: proposal.title, timestamp: new Date().toISOString() }, ...prev]);
        });

        // For each target, run the script
        for (const hostId of proposal.targets) {
            const host = hosts.find(h => h.hostId === hostId);
            if (host?.protocol === 'ssh') {
                electron.vi.runSSH(sessionId, hostId, proposal.script, host.credId);
            } else {
                // Local or other
                electron.runPowerShell(sessionId, proposal.script, true);
            }
        }
    };


    return (
        <div className="h-full w-full flex bg-[#050505] overflow-hidden">
            {/* Sidebar Navigation */}
            <div className="w-64 border-r border-white/5 bg-[#09090b] flex flex-col p-4 gap-2">
                <div className="mb-6 px-2">
                    <h2 className="text-xl font-black text-white tracking-widest uppercase flex items-center gap-2">
                        <Icons.ShieldCheck className="text-emerald-500 w-5 h-5" />
                        Vi Control
                    </h2>
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter">Complete Automation Suite v6</p>
                </div>

                <div className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest px-2 pt-4 pb-1">Automation</div>
                <NavButton
                    active={activeSection === 'computer'}
                    onClick={() => setActiveSection('computer')}
                    icon={<Icons.Monitor size={16} />}
                    label="Computer Use"
                />
                <NavButton
                    active={activeSection === 'browser'}
                    onClick={() => setActiveSection('browser')}
                    icon={<Icons.Globe size={16} />}
                    label="Browser Use"
                />
                <NavButton
                    active={activeSection === 'vision'}
                    onClick={() => setActiveSection('vision')}
                    icon={<Icons.Eye size={16} />}
                    label="Vision Analysis"
                />

                <div className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest px-2 pt-4 pb-1">Infrastructure</div>
                <NavButton
                    active={activeSection === 'local'}
                    onClick={() => setActiveSection('local')}
                    icon={<Icons.Terminal size={16} />}
                    label="Local Engine"
                />
                <NavButton
                    active={activeSection === 'remote'}
                    onClick={() => setActiveSection('remote')}
                    icon={<Icons.Server size={16} />}
                    label="Remote Hosts"
                />
                <NavButton
                    active={activeSection === 'vault'}
                    onClick={() => setActiveSection('vault')}
                    icon={<Icons.Lock size={16} />}
                    label="Credential Vault"
                />
                <NavButton
                    active={activeSection === 'logs'}
                    onClick={() => setActiveSection('logs')}
                    icon={<Icons.ClipboardList size={16} />}
                    label="Audit Logs"
                />

                <div className="mt-auto p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black text-emerald-500 uppercase">System Armed</span>
                    </div>
                    <p className="text-[8px] text-zinc-500 leading-tight">All executions require manual approval gate. Entropy keys active.</p>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 relative">
                <header className="h-16 border-b border-white/5 flex items-center px-8 justify-between bg-black/20 backdrop-blur-xl">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-zinc-400">
                            <span className="text-xs font-mono uppercase tracking-widest">{activeSection}</span>
                            <span className="opacity-20">/</span>
                            <span className="text-xs text-zinc-600">Active Session</span>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={() => { setActiveSection('remote'); setShowAddHost(true); }}
                            className="px-3 py-1.5 bg-emerald-500 text-black rounded-lg text-[10px] font-black uppercase hover:bg-emerald-400 transition-all flex items-center gap-2"
                        >
                            <Icons.Plus size={14} /> New Deployment
                        </button>
                    </div>
                </header>

                <main className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                    {/* COMPUTER USE - Multi-chain Task Automation */}
                    {activeSection === 'computer' && (
                        <div className="max-w-5xl space-y-6">
                            <div className="p-8 bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-blue-500/10 rounded-[2rem]">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400">
                                        <Icons.Monitor size={28} />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Computer Use</h3>
                                        <p className="text-xs text-zinc-500">AI-powered Windows automation with vision support</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[9px] font-black text-zinc-500 uppercase mb-2 block">Describe Task (Natural Language)</label>
                                        <textarea
                                            value={computerTask}
                                            onChange={e => setComputerTask(e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white h-24 resize-none"
                                            placeholder="e.g., Open Chrome, go to gmail.com, compose a new email to john@example.com..."
                                        />
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => {
                                                if (!computerTask.trim()) return;
                                                setTaskChain(prev => [...prev, { id: Date.now().toString(), task: computerTask, status: 'pending' }]);
                                                setComputerTask('');
                                            }}
                                            className="flex-1 py-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl text-[10px] font-black uppercase hover:bg-blue-500/20 transition-all flex items-center justify-center gap-2"
                                        >
                                            <Icons.Plus size={14} /> Add to Chain
                                        </button>
                                        <button
                                            onClick={() => handleCaptureScreen('desktop')}
                                            disabled={isCapturing}
                                            className="py-3 px-6 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl text-[10px] font-black uppercase hover:bg-purple-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {isCapturing ? <Icons.RefreshCw size={14} className="animate-spin" /> : <Icons.Eye size={14} />} Capture Screen
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Task Chain */}
                            {taskChain.length > 0 && (
                                <div className="p-6 bg-zinc-900/30 border border-white/5 rounded-[2rem]">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-sm font-black text-white uppercase">Task Chain ({taskChain.length} steps)</h4>
                                        <button onClick={() => setTaskChain([])} className="text-[10px] text-zinc-500 hover:text-white">Clear All</button>
                                    </div>
                                    <div className="space-y-2">
                                        {taskChain.map((t, i) => (
                                            <div key={t.id} className="flex items-center gap-3 p-3 bg-black/30 rounded-xl border border-white/5">
                                                <span className="text-emerald-500 font-mono text-xs font-bold w-6">{String(i + 1).padStart(2, '0')}</span>
                                                <span className="flex-1 text-xs text-zinc-300">{t.task}</span>
                                                <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${t.status === 'done' ? 'bg-emerald-500/10 text-emerald-400' :
                                                    t.status === 'running' ? 'bg-blue-500/10 text-blue-400 animate-pulse' :
                                                        t.status === 'error' ? 'bg-red-500/10 text-red-400' :
                                                            'bg-zinc-800 text-zinc-500'
                                                    }`}>{t.status}</span>
                                                <button onClick={() => setTaskChain(prev => prev.filter(x => x.id !== t.id))} className="text-zinc-600 hover:text-red-400">
                                                    <Icons.X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={handleExecuteChain}
                                        disabled={isExecuting}
                                        className="w-full mt-4 py-4 bg-emerald-500 text-black rounded-2xl text-xs font-black uppercase hover:bg-emerald-400 transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                                    >
                                        {isExecuting ? 'Executing...' : 'Execute Chain (Requires Approval)'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* BROWSER USE - Web Automation */}
                    {activeSection === 'browser' && (
                        <div className="max-w-5xl space-y-6">
                            <div className="p-8 bg-gradient-to-br from-orange-500/5 to-red-500/5 border border-orange-500/10 rounded-[2rem]">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-14 h-14 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-400">
                                        <Icons.Globe size={28} />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Browser Use</h3>
                                        <p className="text-xs text-zinc-500">AI-powered web automation and form filling</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="text-[9px] font-black text-zinc-500 uppercase mb-2 block">Target URL</label>
                                        <input
                                            value={browserUrl}
                                            onChange={e => setBrowserUrl(e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white"
                                            placeholder="https://example.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-zinc-500 uppercase mb-2 block">Task Description (Optional)</label>
                                        <input
                                            value={browserTask}
                                            onChange={e => setBrowserTask(e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white"
                                            placeholder="e.g., Analyze page logic..."
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={handleOpenBrowser}
                                        disabled={!browserUrl}
                                        className="flex-1 py-4 bg-orange-500 text-black rounded-xl text-[10px] font-black uppercase hover:bg-orange-400 transition-all disabled:opacity-50"
                                    >
                                        Open in Browser
                                    </button>
                                    <button
                                        onClick={handleAnalyzeBrowser}
                                        disabled={isAnalyzing}
                                        className="flex-1 py-4 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-xl text-[10px] font-black uppercase hover:bg-orange-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isAnalyzing ? <Icons.RefreshCw size={14} className="animate-spin" /> : <Icons.Search size={14} />} Analyze Page & Generate Actions
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* VISION - Screenshot Analysis */}
                    {activeSection === 'vision' && (
                        <div className="max-w-5xl space-y-6">
                            <div className="p-8 bg-gradient-to-br from-cyan-500/5 to-teal-500/5 border border-cyan-500/10 rounded-[2rem]">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-14 h-14 bg-cyan-500/10 rounded-2xl flex items-center justify-center text-cyan-400">
                                        <Icons.Eye size={28} />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Vision Analysis</h3>
                                        <p className="text-xs text-zinc-500">Screenshot to JSON translation with AI understanding</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="aspect-video bg-black/40 border-2 border-dashed border-white/10 rounded-2xl flex items-center justify-center">
                                        {screenshot ? (
                                            <img src={screenshot} alt="Screenshot" className="w-full h-full object-contain rounded-2xl" />
                                        ) : (
                                            <div className="text-center">
                                                <Icons.Eye className="w-12 h-12 text-zinc-700 mx-auto mb-2" />
                                                <p className="text-xs text-zinc-600">No screenshot captured</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-black/40 border border-white/10 rounded-2xl p-4 overflow-auto max-h-64">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[9px] font-black text-zinc-500 uppercase">Analysis Result (JSON)</span>
                                            {isAnalyzing && <span className="text-[9px] text-cyan-400 animate-pulse">Analyzing...</span>}
                                        </div>
                                        <pre className="text-[10px] text-cyan-400 font-mono whitespace-pre-wrap">
                                            {visionAnalysis || '// Capture a screenshot and analyze to see results'}
                                        </pre>
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-4">
                                    <button
                                        onClick={() => handleCaptureScreen('desktop')}
                                        disabled={isCapturing}
                                        className="flex-1 py-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl text-[10px] font-black uppercase hover:bg-cyan-500/20 transition-all disabled:opacity-50"
                                    >
                                        {isCapturing ? 'Capturing...' : 'Capture Desktop'}
                                    </button>
                                    <button
                                        onClick={() => handleCaptureScreen('window')}
                                        disabled={isCapturing}
                                        className="flex-1 py-3 bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-xl text-[10px] font-black uppercase hover:bg-teal-500/20 transition-all disabled:opacity-50"
                                    >
                                        {isCapturing ? 'Capturing...' : 'Capture Active Window'}
                                    </button>
                                    <button
                                        onClick={handleAnalyzeScreenshot}
                                        disabled={!screenshot || isAnalyzing}
                                        className="flex-1 py-3 bg-emerald-500 text-black rounded-xl text-[10px] font-black uppercase hover:bg-emerald-400 transition-all disabled:opacity-30"
                                    >
                                        {isAnalyzing ? 'Analyzing...' : 'Analyze with AI'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'remote' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                            {hosts.map(host => (
                                <HostCard
                                    key={host.hostId}
                                    host={host}
                                    onRDP={() => electron.vi.launchRDP(host.hostId)}
                                    onDelete={() => handleDeleteHost(host.hostId)}
                                    onSSH={() => handleSSHConnect(host)}
                                />
                            ))}
                            <AddCard onClick={() => setShowAddHost(true)} label="Add Remote Host" />
                        </div>
                    )}

                    {activeSection === 'local' && (
                        <div className="max-w-4xl space-y-6">
                            <div className="p-8 bg-zinc-900/30 border border-white/5 rounded-[2rem] flex flex-col gap-4">
                                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Native Execution Engine</h3>
                                <p className="text-sm text-zinc-500 max-w-xl">
                                    Directly execute PowerShell commands on the host machine.
                                    <span className="text-orange-500 block mt-1 text-xs">⚠️ Warning: Commands run with full user privileges.</span>
                                </p>

                                {/* Local Command Input */}
                                <div className="mt-4">
                                    <label className="text-[9px] font-black text-zinc-500 uppercase mb-2 block">Command Line</label>
                                    <div className="flex gap-3">
                                        <input
                                            type="text"
                                            placeholder="e.g., Get-Service | Where-Object Status -eq 'Running'"
                                            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && e.currentTarget.value) {
                                                    const cmd = e.currentTarget.value;
                                                    const sessionId = `local-${Date.now()}`;
                                                    setOutput([`[LOCAL] Executing: ${cmd}`]);
                                                    electron.removeExecListeners();
                                                    electron.onExecChunk((data: any) => setOutput(prev => [...prev, data.text]));
                                                    electron.onExecComplete(() => {
                                                        setOutput(prev => [...prev, '[LOCAL] Command completed.']);
                                                        setLogs(prev => [{ type: 'SUCCESS', title: `Local: ${cmd.substring(0, 30)}...`, timestamp: new Date().toISOString() }, ...prev]);
                                                    });
                                                    electron.runPowerShell(sessionId, cmd, true);
                                                    e.currentTarget.value = '';
                                                }
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="mt-6">
                                    <label className="text-[9px] font-black text-zinc-500 uppercase mb-3 block">Quick Diagnostics</label>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {[
                                            { label: 'System Info', cmd: 'systeminfo | Select-Object -First 20', bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', hover: 'hover:bg-blue-500/20' },
                                            { label: 'Top Processes', cmd: 'Get-Process | Sort-Object CPU -Descending | Select-Object -First 10 Name, CPU, WorkingSet', bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400', hover: 'hover:bg-purple-500/20' },
                                            { label: 'Disk Space', cmd: 'Get-PSDrive -PSProvider FileSystem | Format-Table Name, Used, Free, @{n="Size(GB)";e={[math]::Round(($_.Used+$_.Free)/1GB,2)}} -AutoSize', bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-400', hover: 'hover:bg-orange-500/20' },
                                            { label: 'Network Config', cmd: 'Get-NetIPAddress | Where-Object AddressFamily -eq IPv4 | Format-Table InterfaceAlias, IPAddress', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-400', hover: 'hover:bg-cyan-500/20' },
                                            { label: 'Active Services', cmd: 'Get-Service | Where-Object Status -eq "Running" | Select-Object -First 20', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', hover: 'hover:bg-emerald-500/20' },
                                            { label: 'Environment Vars', cmd: 'Get-ChildItem Env: | Select-Object -First 20', bg: 'bg-pink-500/10', border: 'border-pink-500/20', text: 'text-pink-400', hover: 'hover:bg-pink-500/20' }
                                        ].map((action) => (
                                            <button
                                                key={action.label}
                                                onClick={() => {
                                                    const sessionId = `local-${Date.now()}`;
                                                    setOutput([`[LOCAL] Running ${action.label}...`]);
                                                    electron.removeExecListeners();
                                                    electron.onExecChunk((data: any) => setOutput(prev => [...prev, data.text]));
                                                    electron.onExecComplete(() => setOutput(prev => [...prev, '', `[DONE] ${action.label} completed.`]));
                                                    electron.runPowerShell(sessionId, action.cmd, true);
                                                    setLogs(prev => [{ type: 'SUCCESS', title: action.label, timestamp: new Date().toISOString() }, ...prev]);
                                                }}
                                                className={`px-4 py-3 ${action.bg} border ${action.border} ${action.text} rounded-xl text-[10px] font-black uppercase ${action.hover} transition-all text-left flex flex-col justify-between h-20 group`}
                                            >
                                                <Icons.Terminal size={16} className={`mb-auto opacity-50 group-hover:opacity-100`} />
                                                <span>{action.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'logs' && (
                        <div className="max-w-6xl space-y-2">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Audit Trail v5</h3>
                                <button className="text-[10px] text-zinc-500 hover:text-white uppercase font-black">Export JSONL</button>
                            </div>
                            {logs.length === 0 ? (
                                <div className="p-20 text-center border-2 border-dashed border-zinc-900 rounded-[2rem] text-zinc-700">No activity logged in current session.</div>
                            ) : (
                                logs.map((log, i) => (
                                    <div key={i} className="p-4 bg-zinc-900/30 border border-white/5 rounded-2xl flex items-center justify-between group hover:border-emerald-500/20 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${log.type === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                                <Icons.ShieldCheck size={14} />
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold text-white uppercase">{log.title}</div>
                                                <div className="text-[9px] text-zinc-600 font-mono tracking-tighter">{log.timestamp}</div>
                                            </div>
                                        </div>
                                        <button className="opacity-0 group-hover:opacity-100 text-[9px] font-black text-emerald-500 uppercase tracking-widest">View Payload</button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeSection === 'vault' && (
                        <div className="max-w-4xl space-y-4">
                            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-start gap-4 mb-8">
                                <Icons.AlertTriangle className="text-amber-500 shrink-0 mt-1" size={20} />
                                <div>
                                    <h4 className="text-amber-500 font-black text-xs uppercase mb-1">Encrypted Vault Active</h4>
                                    <p className="text-[10px] text-amber-500/70">Passwords and keys are stored in the OS Keychain (Keytar). Goose Ultra never stores cleartext secrets on disk.</p>
                                </div>
                            </div>
                            {/* Cred List */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {creds.map(c => (
                                    <div key={c.credentialId} className="p-4 bg-zinc-900/50 border border-white/5 rounded-2xl flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Icons.Key className="text-zinc-500" size={18} />
                                            <div>
                                                <div className="text-xs font-bold text-white">{c.label}</div>
                                                <div className="text-[9px] text-zinc-600 font-mono uppercase">{c.type}</div>
                                            </div>
                                        </div>
                                        <button onClick={() => handleDeleteSecret(c.credentialId)} className="text-zinc-700 hover:text-red-500"><Icons.X size={14} /></button>
                                    </div>
                                ))}
                                <AddCard onClick={() => setShowAddSecret(true)} label="Save New Secret" sm />
                            </div>
                        </div>
                    )}
                </main>

                {/* Execution Console Overlay */}
                <AnimatePresence>
                    {(isExecuting || output.length > 0) && (
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            className="absolute bottom-0 left-0 right-0 h-1/3 bg-[#0b0b0c] border-t border-emerald-500/30 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] z-20 flex flex-col"
                        >
                            <div className="h-10 border-b border-white/5 flex items-center px-4 justify-between bg-black/40">
                                <div className="flex items-center gap-2">
                                    <Icons.Terminal className="text-emerald-500" size={14} />
                                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Global Output Stream</span>
                                </div>
                                <div className="flex gap-4">
                                    {isExecuting && <div className="text-[10px] text-emerald-500 font-black animate-pulse uppercase">Execution In-Flight...</div>}
                                    <button onClick={() => setOutput([])} className="text-zinc-600 hover:text-white"><Icons.X size={16} /></button>
                                </div>
                            </div>
                            <div className="flex-1 font-mono text-[11px] p-4 overflow-y-auto custom-scrollbar bg-black/20">
                                {output.map((line, i) => (
                                    <div key={i} className="text-zinc-400 mb-0.5 leading-relaxed">{line}</div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* MODAL: Proposal Card (GOVERNANCE GATE) */}
                <AnimatePresence>
                    {pendingProposal && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6">
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="bg-[#0b0b0c] border-2 border-emerald-500/20 w-full max-w-2xl rounded-[2rem] overflow-hidden shadow-[0_0_100px_rgba(16,185,129,0.1)]"
                            >
                                <div className="p-8">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500">
                                            <Icons.FileText size={28} />
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-emerald-500 font-mono font-black uppercase tracking-widest">Approval Requested</span>
                                            <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{pendingProposal.title}</h3>
                                        </div>
                                        <div className={`ml-auto px-4 py-1 rounded-full text-[10px] font-black uppercase border ${pendingProposal.risk === 'high' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                            pendingProposal.risk === 'medium' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                                'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                            }`}>
                                            Risk: {pendingProposal.risk}
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div>
                                            <h4 className="text-[10px] text-zinc-500 font-black uppercase mb-2">Intent & Impact</h4>
                                            <p className="text-sm text-zinc-300 leading-relaxed font-medium">{pendingProposal.description}</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <h4 className="text-[10px] text-zinc-500 font-black uppercase mb-3">Planned Sequence</h4>
                                                <ul className="space-y-2">
                                                    {pendingProposal.steps.map((s, i) => (
                                                        <li key={i} className="flex gap-3 text-[11px] text-zinc-400 font-bold">
                                                            <span className="text-emerald-500 font-mono">0{i + 1}.</span> {s}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div>
                                                <h4 className="text-[10px] text-zinc-500 font-black uppercase mb-3">Target Infrastructure</h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {pendingProposal.targets.map(t => (
                                                        <span key={t} className="px-2 py-1 bg-white/5 rounded-lg border border-white/10 text-[10px] text-zinc-300 font-mono">@{t}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-4 bg-black border border-white/5 rounded-2xl">
                                            <h4 className="text-[10px] text-zinc-600 font-black uppercase mb-2 font-mono">Script Payload</h4>
                                            <pre className="text-[11px] text-emerald-400/80 font-mono overflow-x-auto">{pendingProposal.script}</pre>
                                        </div>
                                    </div>

                                    <div className="mt-8 flex gap-4">
                                        <button
                                            onClick={() => setPendingProposal(null)}
                                            className="flex-1 py-4 bg-zinc-900 text-zinc-500 rounded-2xl text-xs font-black uppercase hover:text-white transition-colors"
                                        >
                                            Deny Operation
                                        </button>
                                        <button
                                            onClick={() => handleExecute(pendingProposal)}
                                            className="flex-[2] py-4 bg-emerald-500 text-black rounded-2xl text-xs font-black uppercase hover:bg-emerald-400 transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)] active:scale-95"
                                        >
                                            Authorize Execution
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* MODAL: Add Host */}
                <AnimatePresence>
                    {showAddHost && (
                        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[110] flex items-center justify-center p-6">
                            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#0b0b0c] border border-white/10 w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl">
                                <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-8">Register <span className="text-emerald-500">Target</span></h3>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-zinc-500 uppercase">Label</label>
                                            <input value={newHost.label || ''} onChange={e => setNewHost({ ...newHost, label: e.target.value })} className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 text-xs text-white" placeholder="Production DB" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-zinc-500 uppercase">OS Type</label>
                                            <select value={newHost.osHint} onChange={e => setNewHost({ ...newHost, osHint: e.target.value as any })} className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 text-xs text-white">
                                                <option value="linux">Linux / Unix</option>
                                                <option value="windows">Windows Server</option>
                                                <option value="mac">macOS</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="col-span-2 space-y-1">
                                            <label className="text-[9px] font-black text-zinc-500 uppercase">Hostname / IP</label>
                                            <input value={newHost.hostname || ''} onChange={e => setNewHost({ ...newHost, hostname: e.target.value })} className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 text-xs text-white" placeholder="10.0.0.45" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-zinc-500 uppercase">Port</label>
                                            <input type="number" value={newHost.port} onChange={e => setNewHost({ ...newHost, port: parseInt(e.target.value) })} className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 text-xs text-white" placeholder="22" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-zinc-500 uppercase">SSH User</label>
                                            <input value={newHost.username || ''} onChange={e => setNewHost({ ...newHost, username: e.target.value })} className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 text-xs text-white" placeholder="root" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-zinc-500 uppercase">Linked Secret</label>
                                            <select value={newHost.credId} onChange={e => setNewHost({ ...newHost, credId: e.target.value })} className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 text-xs text-white">
                                                <option value="">None (Ask on Connect)</option>
                                                {creds.map(c => <option key={c.credentialId} value={c.credentialId}>{c.label}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-10 flex gap-4">
                                    <button onClick={() => setShowAddHost(false)} className="flex-1 py-4 bg-zinc-900 text-zinc-500 rounded-2xl text-[10px] font-black uppercase hover:text-white transition-all">Cancel</button>
                                    <button onClick={handleAddHost} className="flex-[2] py-4 bg-emerald-500 text-black rounded-2xl text-[10px] font-black uppercase hover:bg-emerald-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]">Deploy Node</button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* MODAL: Add Secret */}
                <AnimatePresence>
                    {showAddSecret && (
                        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[110] flex items-center justify-center p-6">
                            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#0b0b0c] border border-white/10 w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl">
                                <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-8">Lock <span className="text-emerald-500">Secret</span></h3>
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-zinc-500 uppercase">Secret Title</label>
                                        <input value={newSecret.label} onChange={e => setNewSecret({ ...newSecret, label: e.target.value })} className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 text-xs text-white" placeholder="Production SSH Key" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-zinc-500 uppercase">Type</label>
                                        <select value={newSecret.type} onChange={e => setNewSecret({ ...newSecret, type: e.target.value as any })} className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 text-xs text-white">
                                            <option value="password">Password</option>
                                            <option value="ssh_key">Private Key (OpenSSH)</option>
                                            <option value="token">API Token</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-zinc-500 uppercase">Value</label>
                                        <textarea value={newSecret.value} onChange={e => setNewSecret({ ...newSecret, value: e.target.value })} className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 text-xs text-white min-h-[100px] font-mono" placeholder="Paste secret here..." />
                                    </div>
                                </div>
                                <div className="mt-10 flex gap-4">
                                    <button onClick={() => setShowAddSecret(false)} className="flex-1 py-4 bg-zinc-900 text-zinc-500 rounded-2xl text-[10px] font-black uppercase hover:text-white transition-all">Cancel</button>
                                    <button onClick={handleAddSecret} className="flex-[2] py-4 bg-emerald-500 text-black rounded-2xl text-[10px] font-black uppercase hover:bg-emerald-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]">Vault It</button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* MODAL: SSH Password Prompt */}
                <AnimatePresence>
                    {showPasswordPrompt && pendingSSHHost && (
                        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[120] flex items-center justify-center p-6">
                            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#0b0b0c] border border-emerald-500/20 w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500">
                                        <Icons.Terminal size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-white uppercase tracking-tighter">SSH <span className="text-emerald-500">Login</span></h3>
                                        <p className="text-[10px] text-zinc-500 font-mono">{pendingSSHHost.username}@{pendingSSHHost.hostname}</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
                                        <p className="text-[10px] text-amber-500">Password will be securely saved to vault for future connections.</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-zinc-500 uppercase">Root Password</label>
                                        <input
                                            type="password"
                                            value={passwordForHost}
                                            onChange={e => setPasswordForHost(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && executeSSHWithPassword()}
                                            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono focus:border-emerald-500/50 focus:outline-none"
                                            placeholder="Enter password..."
                                            autoFocus
                                        />
                                    </div>
                                </div>
                                <div className="mt-8 flex gap-4">
                                    <button onClick={() => { setShowPasswordPrompt(false); setPendingSSHHost(null); }} className="flex-1 py-4 bg-zinc-900 text-zinc-500 rounded-2xl text-[10px] font-black uppercase hover:text-white transition-all">Cancel</button>
                                    <button onClick={executeSSHWithPassword} disabled={!passwordForHost} className="flex-[2] py-4 bg-emerald-500 text-black rounded-2xl text-[10px] font-black uppercase hover:bg-emerald-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:cursor-not-allowed">Connect & Save</button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

const NavButton = ({ active, onClick, icon, label }: any) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all relative overflow-hidden group ${active ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-zinc-500 hover:text-white'
            }`}
    >
        {icon}
        <span className="uppercase tracking-tighter">{label}</span>
        {active && (
            <motion.div
                layoutId="nav-active"
                className="absolute inset-0 bg-white/10"
            />
        )}
    </button>
);

const HostCard = ({ host, onRDP, onDelete, onSSH }: { host: ViHost, onRDP: () => void, onDelete: () => void, onSSH: () => void }) => (
    <motion.div
        whileHover={{ y: -4 }}
        className="p-6 bg-[#0b0b0c] border border-white/5 rounded-[2rem] hover:border-emerald-500/30 transition-all group relative overflow-hidden"
    >
        <div className="absolute -top-12 -right-12 w-24 h-24 bg-emerald-500/5 blur-3xl group-hover:bg-emerald-500/10 transition-colors" />

        <div className="flex justify-between items-start mb-6">
            <div className={`p-3 rounded-2xl bg-black ${host.osHint === 'windows' ? 'text-blue-400' : 'text-orange-400'}`}>
                {host.osHint === 'windows' ? <Icons.Monitor size={20} /> : <Icons.Terminal size={20} />}
            </div>
            <div className="flex gap-2">
                <button onClick={onSSH} className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl text-emerald-400 transition-all" title="Connect SSH">
                    <Icons.Terminal size={14} />
                </button>
                {host.osHint === 'windows' && (
                    <button onClick={onRDP} className="p-2 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl text-blue-400 transition-all" title="Launch RDP">
                        <Icons.ExternalLink size={14} />
                    </button>
                )}
                <button onClick={onDelete} className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-red-400 transition-all" title="Delete Host">
                    <Icons.Trash size={14} />
                </button>
            </div>
        </div>

        <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-1">{host.label}</h3>
        <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono mb-6">
            <span className="text-emerald-500/80">{host.protocol.toUpperCase()}</span>
            <span>{host.username}@{host.hostname}:{host.port}</span>
        </div>

        <div className="flex flex-wrap gap-2">
            {host.tags?.map(tag => (
                <span key={tag} className="px-2 py-0.5 bg-black rounded-lg border border-white/10 text-[8px] font-black text-zinc-600 uppercase tracking-widest">{tag}</span>
            ))}
        </div>
    </motion.div>
);

const AddCard = ({ onClick, label, sm }: any) => (
    <div
        onClick={onClick}
        className={`border-2 border-dashed border-zinc-900 rounded-[2rem] flex flex-col items-center justify-center gap-4 text-zinc-700 hover:text-emerald-500 hover:border-emerald-500/30 hover:bg-emerald-500/5 cursor-pointer transition-all group ${sm ? 'p-6' : 'p-12'}`}
    >
        <div className="p-4 bg-zinc-900 group-hover:bg-emerald-500/10 rounded-2xl transition-all">
            <Icons.Plus size={sm ? 20 : 32} />
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </div>
);
