import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from '../constants';
import { vibeServerService, VibeNode, ServerAction } from '../services/vibeServerService';

export const ServerNodesView = () => {
    const [nodes, setNodes] = useState<VibeNode[]>(vibeServerService.getNodes());

    const [logs, setLogs] = useState<string[]>(["AI Architect initialized.", "Global Orchestration Link: Active."]);
    const [input, setInput] = useState("");
    const [isThinking, setIsThinking] = useState(false);
    const [showProvisionModal, setShowProvisionModal] = useState(false);

    // Provisioning Form State
    const [newNode, setNewNode] = useState<Partial<VibeNode>>({
        name: '', ip: '', user: 'root', os: 'Linux', authType: 'password'
    });

    // Metrics Simulation
    useEffect(() => {
        const interval = setInterval(() => {
            setNodes(prev => prev.map(node => {
                if (node.status === 'offline') return node;
                return {
                    ...node,
                    cpu: Math.max(2, Math.min(99, (node.cpu || 0) + (Math.random() * 10 - 5))),
                    ram: Math.max(10, Math.min(95, (node.ram || 0) + (Math.random() * 2 - 1))),
                    latency: Math.max(1, Math.min(500, (node.latency || 0) + (Math.random() * 4 - 2)))
                };
            }));
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const handleAction = async () => {
        if (!input.trim() || isThinking) return;

        setIsThinking(true);
        const userPrompt = input;
        setInput("");
        setLogs(prev => [`> ${userPrompt}`, ...prev]);

        try {
            // 1. Translate English to Vibe-JSON
            const action = await vibeServerService.translateEnglishToJSON(userPrompt, { nodes });
            setLogs(prev => [
                `[AI Reasoning] Intent: ${action.type}`,
                `[Action] Target: ${action.targetId} // ${action.description}`,
                ...prev
            ]);

            // 2. Execute with live streaming logs
            const result = await vibeServerService.runCommand(action.targetId, action.command, (chunk) => {
                // Potential live stream update could go here
            });

            setLogs(prev => [`[SUCCESS] Output Summary: ${result.substring(0, 500)}${result.length > 500 ? '...' : ''}`, ...prev]);
        } catch (err: any) {
            setLogs(prev => [`[ERROR] ${err.message}`, ...prev]);
        } finally {
            setIsThinking(false);
        }
    };

    const clearTerminal = () => {
        setLogs(["Architect Console initialized.", "Buffer cleared."]);
    };

    const handleProvision = () => {
        const id = `node_${Date.now()}`;
        const nodeToAdd = { ...newNode, id, status: 'online', cpu: 0, ram: 0, latency: 100 } as VibeNode;
        vibeServerService.addNode(nodeToAdd);
        setNodes([...vibeServerService.getNodes()]);
        setLogs(prev => [`[SYSTEM] New node provisioned: ${nodeToAdd.name} (${nodeToAdd.ip})`, ...prev]);
        setShowProvisionModal(false);
        setNewNode({ name: '', ip: '', user: 'root', os: 'Linux', authType: 'password' });
    };

    const removeNode = (id: string) => {
        if (id === 'local') return;
        // In a real app we'd have a service method to remove
        const updated = vibeServerService.getNodes().filter(n => n.id !== id);
        (vibeServerService as any).nodes = updated; // Force update for demo
        setNodes([...updated]);
        setLogs(prev => [`[SYSTEM] Node removed from orchestration.`, ...prev]);
    };

    const secureNode = async (node: VibeNode) => {
        setLogs(prev => [`[SECURITY] Injecting SSH Key into ${node.name}...`, ...prev]);
        try {
            await vibeServerService.provisionKey(node.id, node.password);
            setNodes([...vibeServerService.getNodes()]);
            setLogs(prev => [`[SUCCESS] ${node.name} is now secured with Ed25519 key.`, ...prev]);
        } catch (err: any) {
            setLogs(prev => [`[SECURITY_FAIL] Key injection failed: ${err.message}`, ...prev]);
        }
    };

    return (
        <div className="h-full w-full flex flex-col bg-[#050505] p-6 gap-6 overflow-hidden relative">
            {/* Header / Stats */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
                            <Icons.Server className="text-emerald-500 w-6 h-6" />
                            Vibe Server <span className="text-emerald-500 italic">Management</span>
                        </h2>
                        <p className="text-[10px] text-zinc-500 font-mono mt-1 uppercase tracking-widest font-bold">Infrastructure Orchestrator // PRO_v3.0.1</p>
                    </div>
                    <div className="h-10 w-px bg-white/10 mx-2" />
                    <div className="flex gap-6">
                        <div className="flex flex-col">
                            <span className="text-[9px] text-zinc-600 font-black uppercase">Active Nodes</span>
                            <span className="text-lg font-mono text-emerald-500 font-black">{nodes.filter(n => n.status === 'online').length}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] text-zinc-600 font-black uppercase">Security Patch</span>
                            <span className="text-lg font-mono text-emerald-500 font-black tracking-tighter">UP-TO-DATE</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={() => setShowProvisionModal(true)}
                        className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-500/20 transition-all flex items-center gap-2"
                    >
                        <Icons.Plus size={14} /> Add Server
                    </button>
                    <div className="px-4 py-2 bg-zinc-900/50 border border-white/5 rounded-xl flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                        <span className="text-[11px] font-bold text-zinc-200">SIGNAL: STRONG</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex gap-6 min-h-0">
                {/* Left Side: Node Grid */}
                <div className="flex-1 grid grid-cols-2 gap-4 content-start overflow-y-auto pr-2 custom-scrollbar">
                    {nodes.map(node => (
                        <motion.div
                            key={node.id}
                            whileHover={{ scale: 1.01, y: -2 }}
                            className={`p-5 rounded-3xl border transition-all relative overflow-hidden group ${node.status === 'online' ? 'bg-[#0b0b0c] border-white/5 hover:border-emerald-500/30' : 'bg-black/40 border-red-500/20 grayscale opacity-60'
                                }`}
                        >
                            {/* Glow Effect */}
                            <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/5 blur-[80px] pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />

                            <div className="flex justify-between items-start mb-4 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2.5 rounded-2xl bg-black ${node.os === 'Windows' ? 'text-blue-400' : node.os === 'Linux' ? 'text-orange-400' : 'text-zinc-300'}`}>
                                        {node.os === 'Windows' ? <Icons.Monitor size={18} /> : <Icons.Terminal size={18} />}
                                    </div>
                                    <div>
                                        <div className="text-sm font-black text-zinc-100 tracking-tight uppercase">{node.name}</div>
                                        <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-2">
                                            {node.ip}
                                            <span className={`px-1 rounded bg-black/50 ${node.authType === 'key' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                {node.authType === 'key' ? 'ENC:RSA' : 'PW:AUTH'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <div className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${node.status === 'online' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                                        }`}>{node.status}</div>
                                    <div className="flex gap-2 items-center">
                                        {node.authType === 'password' && node.status === 'online' && (
                                            <button
                                                onClick={() => secureNode(node)}
                                                className="text-[8px] font-black text-amber-500 hover:text-emerald-500 underline transition-colors"
                                            >
                                                INJECT_KEY
                                            </button>
                                        )}
                                        {node.id !== 'local' && (
                                            <button
                                                onClick={() => removeNode(node.id)}
                                                className="text-zinc-700 hover:text-red-500 p-1 transition-colors"
                                            >
                                                <Icons.X size={12} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 mt-6 relative z-10">
                                <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
                                    <div className="text-[8px] text-zinc-600 font-black uppercase mb-1">CPU_LOAD</div>
                                    <div className="text-xs font-mono text-zinc-300 font-bold">{node.cpu?.toFixed(1)}%</div>
                                </div>
                                <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
                                    <div className="text-[8px] text-zinc-600 font-black uppercase mb-1">MEM_USE</div>
                                    <div className="text-xs font-mono text-zinc-300 font-bold">{node.ram?.toFixed(1)}%</div>
                                </div>
                                <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
                                    <div className="text-[8px] text-zinc-600 font-black uppercase mb-1">P_LATENCY</div>
                                    <div className="text-xs font-mono text-emerald-500 font-bold">{node.latency?.toFixed(0)}ms</div>
                                </div>
                            </div>
                        </motion.div>
                    ))}

                    {/* Add New Node Button */}
                    <motion.div
                        whileHover={{ scale: 1.01 }}
                        onClick={() => setShowProvisionModal(true)}
                        className="p-5 rounded-3xl border border-dashed border-zinc-800 flex flex-col items-center justify-center gap-3 text-zinc-600 hover:text-emerald-500 hover:border-emerald-500/50 hover:bg-emerald-500/5 cursor-pointer transition-all min-h-[160px]"
                    >
                        <div className="p-3 bg-zinc-900/50 rounded-2xl">
                            <Icons.Plus size={24} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest">ADD_REMOTE_INFRASTRUCTURE</span>
                    </motion.div>
                </div>

                {/* Right Side: AI Architect Log */}
                <div className="w-[450px] flex flex-col gap-4">
                    <div className="flex-1 bg-[#0b0b0c] border border-white/10 rounded-3xl flex flex-col overflow-hidden shadow-2xl relative">
                        {/* Static / Noise Overlay */}
                        <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />

                        <div className="h-12 border-b border-white/5 flex items-center px-4 justify-between bg-zinc-900/40 backdrop-blur-xl z-10">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest font-mono">ARCHITECT_CONSOLE_v3</span>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={clearTerminal} className="px-2 py-0.5 rounded bg-black/50 border border-white/5 text-[8px] font-mono text-zinc-600 hover:text-zinc-400">CLEAR_BUF</button>
                                <div className="px-2 py-0.5 rounded bg-black border border-white/10 text-[8px] font-mono text-zinc-500">TTY: /dev/pts/0</div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 font-mono text-[11px] space-y-3 flex flex-col-reverse custom-scrollbar relative z-10">
                            <AnimatePresence>
                                {logs.map((log, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -5 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className={`leading-relaxed ${log.startsWith('>') ? 'text-emerald-400 font-black' :
                                            log.includes('[AI Reasoning]') ? 'text-purple-400' :
                                                log.includes('[Action]') ? 'text-blue-400' :
                                                    log.includes('[ERROR]') ? 'text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20' :
                                                        log.includes('[SUCCESS]') ? 'text-emerald-400 bg-emerald-500/5 p-2 rounded border border-emerald-500/10' :
                                                            'text-zinc-500'}`}
                                    >
                                        <span className="opacity-30 mr-2">[{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                                        {log}
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        <div className="p-4 bg-zinc-900/20 border-t border-white/5 z-10">
                            <div className="flex gap-3">
                                <div className="flex-1 relative group">
                                    <div className="absolute inset-0 bg-emerald-500/5 blur-xl group-focus-within:bg-emerald-500/10 transition-colors" />
                                    <input
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAction()}
                                        placeholder="Issue infrastructure command..."
                                        className="w-full bg-black border border-white/10 rounded-2xl px-5 py-3 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-emerald-500/50 relative z-10 transition-all font-mono"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-zinc-800 pointer-events-none z-10 uppercase tracking-tighter">CMD_INPUT</div>
                                </div>
                                <button
                                    onClick={handleAction}
                                    disabled={isThinking || !input.trim()}
                                    className="px-5 bg-emerald-500 text-black rounded-2xl hover:bg-emerald-400 transition-all disabled:opacity-30 disabled:grayscale font-black text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                                >
                                    {isThinking ? <Icons.RefreshCw className="w-4 h-4 animate-spin" /> : <>EXECUTE <Icons.Play className="w-4 h-4" /></>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Provisioning Modal */}
            <AnimatePresence>
                {showProvisionModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="bg-[#0b0b0c] border border-white/10 w-full max-w-lg rounded-[2rem] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]"
                        >
                            <div className="p-8">
                                <div className="flex justify-between items-center mb-8">
                                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">Provision <span className="text-emerald-500">New Node</span></h3>
                                    <button onClick={() => setShowProvisionModal(false)} className="text-zinc-500 hover:text-white"><Icons.X size={20} /></button>
                                </div>

                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-zinc-500 uppercase ml-1">Node Identifier</label>
                                            <input
                                                value={newNode.name}
                                                onChange={e => setNewNode({ ...newNode, name: e.target.value })}
                                                placeholder="e.g. GPU_CLOUD_01"
                                                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-zinc-500 uppercase ml-1">IP Address / Host</label>
                                            <input
                                                value={newNode.ip}
                                                onChange={e => setNewNode({ ...newNode, ip: e.target.value })}
                                                placeholder="10.0.0.x"
                                                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-zinc-500 uppercase ml-1">Shell Context</label>
                                            <select
                                                value={newNode.os}
                                                onChange={e => setNewNode({ ...newNode, os: e.target.value as any })}
                                                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                                            >
                                                <option value="Linux">Linux (Bash)</option>
                                                <option value="Windows">Windows (PS)</option>
                                                <option value="OSX">OSX (Zsh)</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-zinc-500 uppercase ml-1">SSH Username</label>
                                            <input
                                                value={newNode.user}
                                                onChange={e => setNewNode({ ...newNode, user: e.target.value })}
                                                placeholder="root"
                                                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-zinc-500 uppercase ml-1">Root Password (Optional)</label>
                                            <input
                                                type="password"
                                                value={newNode.password || ''}
                                                onChange={e => setNewNode({ ...newNode, password: e.target.value })}
                                                placeholder="••••••••"
                                                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                                            />
                                        </div>
                                    </div>

                                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center gap-4">
                                        <Icons.ShieldCheck className="text-emerald-500 w-8 h-8 shrink-0" />
                                        <div className="text-[10px] text-zinc-400 leading-relaxed font-bold">
                                            Vibe Server will bridge the connection via persistent SSH tunnels. Encryption: RSA/Ed25519 (Configurable Post-Provision).
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 flex gap-3">
                                    <button
                                        onClick={() => setShowProvisionModal(false)}
                                        className="flex-1 py-3 bg-zinc-900 text-zinc-400 rounded-2xl text-[10px] font-black uppercase hover:text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleProvision}
                                        className="flex-[2] py-3 bg-emerald-500 text-black rounded-2xl text-[10px] font-black uppercase hover:bg-emerald-400 transition-colors shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                                    >
                                        Initialize Orchestration
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
