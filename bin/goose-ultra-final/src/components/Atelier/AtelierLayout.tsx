import React, { useState } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Download, RefreshCw, Smartphone, Monitor, Layout,
    Palette, Type, Layers, ChevronRight, Zap, Pencil,
    ChevronLeft, Settings, Trash2, Camera, Share2
} from 'lucide-react';
import { useOrchestrator } from '../../orchestrator';

interface ArtboardProps {
    id: string;
    name: string;
    type: 'desktop' | 'mobile' | 'styleguide';
    content: string;
    onExport: (id: string) => void;
    onEdit: (id: string) => void;
}

const Artboard: React.FC<ArtboardProps> = ({ id, name, type, content, onExport, onEdit }) => {
    return (
        <motion.div
            layoutId={id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-zinc-900/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col group ${type === 'mobile' ? 'w-[375px] h-[812px]' : 'w-[1024px] h-[768px]'
                }`}
        >
            <div className="px-6 py-4 border-b border-white/5 bg-zinc-900/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{name}</span>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(id)} className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-all">
                        <Pencil size={14} />
                    </button>
                    <button onClick={() => onExport(id)} className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-all">
                        <Download size={14} />
                    </button>
                </div>
            </div>
            <div className="flex-1 overflow-hidden relative bg-white">
                {/* The generated UI is rendered here in an iframe or shadow DOM */}
                <iframe
                    title={name}
                    srcDoc={content}
                    className="w-full h-full border-none"
                    sandbox="allow-scripts"
                />
            </div>
        </motion.div>
    );
};

export const AtelierLayout: React.FC = () => {
    const { state, dispatch } = useOrchestrator();
    const [selectedArtboard, setSelectedArtboard] = useState<string | null>(null);

    // Mock artboards for initial render
    const [artboards, setArtboards] = useState([
        {
            id: 'at-1',
            name: 'Variant A: Glassmorphism',
            type: 'desktop' as const,
            content: '<html><body style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); height: 100vh; display: flex; align-items: center; justify-center; font-family: sans-serif; color: white;"><h1>Glassy UI</h1></body></html>'
        },
        {
            id: 'at-2',
            name: 'Variant B: Minimalist',
            type: 'desktop' as const,
            content: '<html><body style="background: #f8fafc; height: 100vh; display: flex; align-items: center; justify-center; font-family: sans-serif; color: #1e293b;"><h1>Clean UI</h1></body></html>'
        },
        {
            id: 'at-3',
            name: 'Style Guide',
            type: 'styleguide' as const,
            content: '<html><body style="background: #000; color: white; padding: 40px; font-family: sans-serif;"><h2>Design Tokens</h2><div style="display:flex; gap:10px;"><div style="width:40px; height:40px; background:#f43f5e; border-radius:8px;"></div><div style="width:40px; height:40px; background:#fbbf24; border-radius:8px;"></div></div></body></html>'
        }
    ]);

    return (
        <div className="flex-1 flex flex-col bg-[#030304] relative overflow-hidden">
            {/* Dot Grid Background */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
                backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
                backgroundSize: '30px 30px'
            }} />

            {/* Top Controls Overlay */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 p-1 bg-zinc-900/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl">
                <button className="px-4 py-2 bg-pink-500 text-white rounded-xl text-[10px] font-black uppercase tracking-tighter flex items-center gap-2 shadow-lg shadow-pink-500/20">
                    <Plus size={14} /> New Artboard
                </button>
                <div className="w-px h-4 bg-white/10 mx-2" />
                <button className="px-4 py-2 hover:bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-tighter text-zinc-400 hover:text-white transition-all flex items-center gap-2">
                    <RefreshCw size={14} /> Regenerate Colors
                </button>
                <button className="px-4 py-2 hover:bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-tighter text-zinc-400 hover:text-white transition-all flex items-center gap-2">
                    <Share2 size={14} /> Handover
                </button>
            </div>

            {/* Infinite Canvas */}
            <div className="flex-1 cursor-grab active:cursor-grabbing">
                <TransformWrapper
                    initialScale={0.5}
                    initialPositionX={200}
                    initialPositionY={100}
                    centerOnInit={false}
                    minScale={0.1}
                    maxScale={2}
                >
                    {({ zoomIn, zoomOut, resetTransform, ...rest }) => (
                        <>
                            {/* Zoom Controls Overlay */}
                            <div className="absolute bottom-10 right-10 z-20 flex flex-col gap-2">
                                <button onClick={() => zoomIn()} className="p-3 bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl text-zinc-400 hover:text-white hover:border-pink-500/30 transition-all shadow-xl">
                                    <Plus size={18} />
                                </button>
                                <button onClick={() => zoomOut()} className="p-3 bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl text-zinc-400 hover:text-white hover:border-pink-500/30 transition-all shadow-xl">
                                    <div className="w-4.5 h-0.5 bg-current rounded-full" />
                                </button>
                                <button onClick={() => resetTransform()} className="p-3 bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl text-zinc-400 hover:text-white hover:border-pink-500/30 transition-all shadow-xl">
                                    <RefreshCw size={18} />
                                </button>
                            </div>

                            <TransformComponent wrapperClass="w-full h-full" contentClass="p-[2000px] flex items-start gap-20">
                                {artboards.map((artboard) => (
                                    <Artboard
                                        key={artboard.id}
                                        {...artboard}
                                        onEdit={(id) => setSelectedArtboard(id)}
                                        onExport={(id) => console.log('Exporting', id)}
                                    />
                                ))}
                            </TransformComponent>
                        </>
                    )}
                </TransformWrapper>
            </div>

            {/* Dock Controls */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20">
                <div className="flex items-center gap-3 p-3 bg-zinc-900/60 backdrop-blur-3xl border border-white/5 rounded-[32px] shadow-2xl">
                    <button className="w-12 h-12 flex items-center justify-center bg-white text-black rounded-2xl shadow-xl hover:scale-110 transition-transform">
                        <Layout size={20} />
                    </button>
                    <button className="w-12 h-12 flex items-center justify-center bg-zinc-800 text-zinc-400 rounded-2xl hover:text-white hover:bg-zinc-700 transition-all">
                        <Palette size={20} />
                    </button>
                    <button className="w-12 h-12 flex items-center justify-center bg-zinc-800 text-zinc-400 rounded-2xl hover:text-white hover:bg-zinc-700 transition-all">
                        <Type size={20} />
                    </button>
                    <div className="w-px h-6 bg-white/5 mx-1" />
                    <button className="w-12 h-12 flex items-center justify-center bg-emerald-500 text-black rounded-2xl shadow-lg shadow-emerald-500/20 hover:scale-110 transition-transform">
                        <Download size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AtelierLayout;
