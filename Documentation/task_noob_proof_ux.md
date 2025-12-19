# Gen5 TUI - Noob-Proof Automation UX Implementation

> Credits: sst/opencode, CursorTouch/Windows-Use, AmberSahdev/Open-Interface, browser-use/browser-use, MiniMax-AI/Mini-Agent

## Implementation Checklist

### Phase 1: Core Data Model
- [ ] `bin/ui/run-events.mjs` - Run + RunEvent append-only model

### Phase 2: Primary UI Components  
- [x] `RunStrip.mjs` - Single state surface
- [ ] `FlowRibbon.mjs` - Ask → Preview → Run → Verify → Done
- [ ] `PreviewPlan.mjs` - Numbered steps + risk labels

### Phase 3: Tool & Automation Rendering
- [x] `ToolRegistry.mjs` - Collapsed summaries
- [ ] `AutomationTimeline.mjs` - Observe/Intent/Actions/Verify

### Phase 4: Clean Components
- [x] `Toast.mjs` - Confirmations
- [ ] `TodoChecklist.mjs` - Clean [ ]/[x] 
- [ ] `SnippetBlock.mjs` - Code blocks

### Phase 5: Inspectors
- [ ] `DesktopInspector.mjs`
- [ ] `BrowserInspector.mjs`
- [ ] `ServerInspector.mjs`

## Already Implemented (20 files)
terminal-profile, icons, tui-theme, tui-layout, tui-stream-buffer,
terminal-theme-detect, PremiumSidebar, PremiumMessage, RunStrip,
ChannelLanes, CodeCard, IntentTrace, Toast, HeaderStrip, FooterStrip,
ToolRegistry, GettingStartedCard, CleanTodoList, PartModel

## Wired into Main App
HeaderStrip, RunStrip, IntentTrace, FooterStrip, PremiumSidebar
