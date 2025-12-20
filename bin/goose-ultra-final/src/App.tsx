import React from 'react';
import { OrchestratorProvider, useOrchestrator } from './orchestrator';
import { TopBar, Sidebar, ChatPanel, MemoryPanel } from './components/LayoutComponents';
import { TabNav, StartView, PlanView, PreviewView, EditorView, DiscoverView, ComputerUseView } from './components/Views';
import { ViControlView } from './components/ViControlView';
import { TabId, OrchestratorState, GlobalMode } from './types';
import { ErrorBoundary } from './ErrorBoundary';
import { LoginGate } from './components/UserAuth';

const MainLayout = () => {
  const { state } = useOrchestrator();
  const inPreviewMax = state.previewMaxMode && state.activeTab === TabId.Preview;
  const inComputerUseMode = state.globalMode === GlobalMode.ComputerUse;

  const renderContent = () => {
    // Computer Use Mode: Dedicated full-screen UI
    if (inComputerUseMode) {
      return <ComputerUseView />;
    }

    // Top-level routing based on strictly strictly State + Tab
    if (state.state === OrchestratorState.NoProject) {
      if (state.globalMode === 'Discover') return <DiscoverView />;
      return <StartView />;
    }

    // Tab Router
    switch (state.activeTab) {
      case TabId.Start: return <StartView />;
      case TabId.Discover: return <DiscoverView />;
      case TabId.Plan: return <PlanView />;
      case TabId.Editor: return <EditorView />;
      case TabId.Preview: return <PreviewView />;
      case TabId.ViControl: return <ViControlView />;
      default: return <div className="p-10">Tab content not found: {state.activeTab}</div>;
    }
  };

  // Computer Use Mode: Simplified layout without sidebar/chat
  if (inComputerUseMode) {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-text">
        <TopBar />
        <div className="flex-1 flex overflow-hidden">
          {renderContent()}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-text">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        {!inPreviewMax && <Sidebar />}
        <div className="flex-1 flex flex-col min-w-0 bg-zinc-950/50">
          {state.state !== OrchestratorState.NoProject && !inPreviewMax && <TabNav />}
          {renderContent()}
        </div>
        {!inPreviewMax && state.chatDocked === 'right' && <ChatPanel />}
      </div>
      {!inPreviewMax && state.chatDocked === 'bottom' && <ChatPanel />}
      {!inPreviewMax && <MemoryPanel />}
    </div>
  );
};

export default function App() {
  return (
    <LoginGate>
      <OrchestratorProvider>
        <ErrorBoundary>
          <MainLayout />
        </ErrorBoundary>
      </OrchestratorProvider>
    </LoginGate>
  );
}

