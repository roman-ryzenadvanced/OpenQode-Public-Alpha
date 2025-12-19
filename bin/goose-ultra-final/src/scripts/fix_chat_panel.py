import os

file_path = r"e:\TRAE Playground\Test Ideas\OpenQode-v1.01-Preview\bin\goose-ultra-final\src\components\LayoutComponents.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Marker for the Orphan Block
start_marker = "  // Auto-create project if missing so we have a stable ID for disk paths + preview URL"
end_marker = 'alert("CRITICAL ERROR: Electron Bridge not found.\\nThis likely means preload.js failed to load.");\n    }\n  };'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    end_idx += len(end_marker)
    print(f"Found orphan block: {start_idx} to {end_idx}")
    # Remove the block
    new_content = content[:start_idx] + content[end_idx:]
    
    # Also fix Empty State Double Wrapping
    # Look for {state.timeline.length === 0 && !isThinking && ( appearing twice
    double_wrap = "{state.timeline.length === 0 && !isThinking && (\n          {/* Empty State: Idea Seeds */ }\n          {state.timeline.length === 0 && !isThinking && ("
    
    # We might need to be fuzzy with whitespace or newlines
    # Let's try simple replacement first
    if double_wrap in new_content:
        print("Found double wrapper")
        # Replace with single
        single_wrap = "{/* Empty State: Idea Seeds */}\n          {state.timeline.length === 0 && !isThinking && ("
        new_content = new_content.replace(double_wrap, single_wrap)
        
        # And remove the trailing )} )} found later?
        # The logic is complex for regex, but let's see if we can just fix the header.
        # If we fix the header, we have an extra )} at the end.
        # We should probably use a simpler approach for the UI: just string replace the known bad blocks.
    
    # Actually, let's just create the file with the deletion first.
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Orphan block removed.")

else:
    print("Markers not found.")
    print(f"Start found: {start_idx}")
    print(f"End found: {end_idx}")
