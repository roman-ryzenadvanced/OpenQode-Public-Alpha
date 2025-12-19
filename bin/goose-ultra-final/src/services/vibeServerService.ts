import { ActionProposal, TabId } from '../types';

export interface VibeNode {
    id: string;
    name: string;
    ip: string;
    user: string;
    os: 'Windows' | 'Linux' | 'OSX';
    authType: 'password' | 'key';
    password?: string;
    status: 'online' | 'busy' | 'offline';
    cpu?: number;
    ram?: number;
    latency?: number;
}

export interface ServerAction {
    type: 'RESEARCH' | 'TROUBLESHOOT' | 'OPTIMIZE' | 'CODE' | 'CONFIG' | 'PROVISION';
    targetId: string; // 'local' or node.id
    command: string;
    description: string;
    risk: 'low' | 'medium' | 'high';
}

class VibeServerService {
    private nodes: VibeNode[] = [
        { id: 'local', name: 'LOCAL_STATION', os: 'Windows', ip: '127.0.0.1', user: 'Admin', authType: 'key', status: 'online', cpu: 0, ram: 0, latency: 0 }
    ];

    getNodes() { return this.nodes; }

    addNode(node: VibeNode) {
        this.nodes.push(node);
    }

    updateNodeAuth(id: string, authType: 'key' | 'password') {
        const node = this.nodes.find(n => n.id === id);
        if (node) node.authType = authType;
    }

    /**
     * Translates natural language into a structured Vibe-JSON action using AI.
     */
    async translateEnglishToJSON(prompt: string, context: { nodes: VibeNode[] }): Promise<ServerAction> {
        const electron = (window as any).electron;
        if (!electron) throw new Error("AI Controller unavailable");

        const nodeContext = context.nodes.map(n => `[${n.id}] ${n.name} (${n.os} at ${n.ip}, user: ${n.user})`).join('\n');

        const systemPrompt = `You are the Vibe Server Architect (Senior System Engineer).
Translate the user's English request into a structured ServerAction JSON.

AVAILABLE NODES:
${nodeContext}

JSON SCHEMA (STRICT):
{
  "type": "RESEARCH" | "TROUBLESHOOT" | "OPTIMIZE" | "CODE" | "CONFIG" | "PROVISION",
  "targetId": "node_id",
  "command": "actual_shell_command",
  "description": "Short explanation of what the command does",
  "risk": "low" | "medium" | "high"
}

RULES:
1. If target is Windows, use PowerShell syntax.
2. If target is Linux/OSX, use Bash syntax.
3. For remote targets (not 'local'), provide the command as it would be run INSIDE the target.
4. If the user wants to "secure" or "setup keys", use "PROVISION" type.
5. ONLY RETURN THE JSON. NO CONVERSATION.`;

        return new Promise((resolve, reject) => {
            let buffer = '';
            electron.removeChatListeners();
            electron.onChatChunk((c: string) => buffer += c);
            electron.onChatComplete((response: string) => {
                try {
                    const text = (response || buffer).trim();
                    // Robust JSON extraction - find the last { and first } from that point
                    const firstBrace = text.indexOf('{');
                    const lastBrace = text.lastIndexOf('}');

                    if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
                        // FALLBACK: If it fails but looks like a simple command, auto-wrap it
                        if (prompt.length < 50 && !prompt.includes('\n')) {
                            console.warn("[Vibe AI] Parsing failed, using command fallback");
                            return resolve({
                                type: 'CONFIG',
                                targetId: context.nodes[0]?.id || 'local',
                                command: prompt,
                                description: `Manual command: ${prompt}`,
                                risk: 'medium'
                            });
                        }
                        throw new Error("No valid JSON block found in AI response.");
                    }

                    const jsonStr = text.substring(firstBrace, lastBrace + 1);
                    const cleanJson = JSON.parse(jsonStr.replace(/```json/gi, '').replace(/```/g, '').trim());
                    resolve(cleanJson);
                } catch (e) {
                    console.error("[Vibe AI Error]", e, "Text:", response || buffer);
                    reject(new Error("AI failed to generate valid action blueprint. Please ensure the model is reachable or try a simpler command."));
                }
            });
            electron.startChat([{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }], 'qwen-coder-plus');
        });
    }

    /**
     * Executes a command on a specific node.
     */
    async runCommand(nodeId: string, command: string, onOutput?: (text: string) => void): Promise<string> {
        const electron = (window as any).electron;
        if (!electron) return "Execution environment missing.";

        const node = this.nodes.find(n => n.id === nodeId) || this.nodes[0];
        let finalScript = command;

        // If remote, wrap in SSH
        if (node.id !== 'local') {
            // Check if we use key or password
            // SECURITY NOTE: In a production environment, we would use a proper SSH library.
            // For this version, we wrap the command in a PowerShell-friendly SSH call.
            const sshCommand = `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -o BatchMode=yes ${node.user}@${node.ip} "${command.replace(/"/g, '\"')}"`;
            finalScript = sshCommand;

            // If the user hasn't provisioned a key yet, this will likely fail.
            if (node.authType === 'password') {
                // If we don't have interactive TTY, we warn that key injection is required.
                // We'll return a special error message that the UI can catch.
                console.warn("[Vibe Server] Attempting remote command on password-auth node without interactive TTY.");
            }
        }

        return new Promise((resolve, reject) => {
            const sessionId = `server-${Date.now()}`;
            let fullOutput = '';

            electron.removeExecListeners();
            electron.onExecChunk((data: any) => {
                if (data.execSessionId === sessionId) {
                    fullOutput += data.text;
                    onOutput?.(data.text);
                }
            });
            electron.onExecComplete((data: any) => {
                if (data.execSessionId === sessionId) resolve(fullOutput || "Command executed (no output).");
            });
            electron.onExecError((data: any) => {
                if (data.execSessionId === sessionId) reject(new Error(data.message));
            });

            electron.runPowerShell(sessionId, finalScript, true);
        });
    }

    /**
     * Auto-generates and injects SSH keys into a remote server.
     */
    async provisionKey(nodeId: string, password?: string): Promise<string> {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) throw new Error("Node not found");

        // 1. Generate local key if not exists
        const genKeyCmd = `
        $sshDir = "$env:USERPROFILE\\.ssh"
        if (-not (Test-Path $sshDir)) { mkdir $sshDir }
        $keyPath = "$sshDir\\id_vibe_ed25519"
        if (-not (Test-Path $keyPath)) {
            ssh-keygen -t ed25519 -f $keyPath -N '""'
        }
        Get-Content "$keyPath.pub"
        `;

        const pubKeyRaw = await this.runCommand('local', genKeyCmd);
        const pubKey = pubKeyRaw.trim().split('\n').pop() || ''; // Get last line in case of debug output

        // 2. Inject into remote - WE USE A SCRIPT THAT TRIES TO DETECT IF IT NEEDS A PASSWORD
        const injectCmd = `mkdir -p ~/.ssh && echo '${pubKey}' >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys`;

        // If password is provided, we'd ideally use sshpass. If not, we tell the user.
        if (password) {
            // MOCKING the password injection for now as we don't have sshpass guaranteed.
            // In a real scenario, this would use a Node SSH library.
            const passCmd = `echo "INFO: Manual password entry may be required in the terminal window if not using a key."`;
            await this.runCommand('local', passCmd);
        }

        const result = await this.runCommand(node.id, injectCmd);
        this.updateNodeAuth(node.id, 'key');
        return result;
    }
}

export const vibeServerService = new VibeServerService();
