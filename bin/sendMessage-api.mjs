// NEW sendMessage function that uses Qwen Chat API directly
// This replaces the broken CLI-based approach

const QWEN_CHAT_API = 'https://chat.qwen.ai/api/chat/completions';

function randomUUID() {
    return crypto.randomUUID();
}

async sendMessage(message, model = 'qwen-coder-plus', imageData = null, onChunk = null, systemPrompt = null) {
    // If we have image data, use the Vision API
    if (imageData) {
        console.log('📷 Image data detected, using Vision API...');
        return await this.sendVisionMessage(message, imageData, 'qwen-vl-plus');
    }

    // Use Qwen Chat API directly with loaded tokens
    try {
        await this.loadTokens();

        if (!this.tokens || !this.tokens.access_token) {
            return {
                success: false,
                error: 'Not authenticated. Please authenticate first.',
                response: ''
            };
        }

        // Build messages array
        const messages = [];

        // Add system prompt if provided
        if (systemPrompt) {
            messages.push({
                role: 'system',
                content: systemPrompt
            });
        }

        // Add user message
        messages.push({
            role: 'user',
            content: message
        });

        const requestBody = {
            model: model,
            messages: messages,
            stream: !!onChunk  // Stream if callback provided
        };

        const response = await fetch(QWEN_CHAT_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.tokens.access_token}`,
                'x-request-id': randomUUID()
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            return {
                success: false,
                error: `API error: ${response.status} - ${errorText}`,
                response: ''
            };
        }

        // Handle streaming response
        if (onChunk && response.body) {
            let fullResponse = '';
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n').filter(line => line.trim().startsWith('data: '));

                    for (const line of lines) {
                        const data = line.replace(/^data: /, '').trim();
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content || '';
                            if (content) {
                                fullResponse += content;
                                onChunk(content);
                            }
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }
            } catch (error) {
                return {
                    success: false,
                    error: `Streaming error: ${error.message}`,
                    response: fullResponse
                };
            }

            return {
                success: true,
                response: fullResponse,
                usage: null
            };
        }

        // Handle non-streaming response
        const data = await response.json();
        const responseText = data.choices?.[0]?.message?.content || '';

        return {
            success: true,
            response: responseText,
            usage: data.usage
        };

    } catch (error) {
        console.error('Qwen API error:', error.message);
        return {
            success: false,
            error: error.message || 'API request failed',
            response: ''
        };
    }
}
