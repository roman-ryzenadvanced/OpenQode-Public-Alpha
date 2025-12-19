/**
 * Image Generation API Bridge for Goose Ultra
 * 
 * Implements multimodal image generation for Chat Mode.
 * Supports multiple providers: Pollinations.ai (free), DALL-E, Stability AI
 */

import https from 'https';
import http from 'http';
import crypto from 'crypto';

// Provider: Pollinations.ai (Free, no API key required)
// Generates images from text prompts using Stable Diffusion XL
const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt/';

// Image cache directory
import path from 'path';
import fs from 'fs';
import os from 'os';

const getCacheDir = () => {
    const dir = path.join(os.homedir(), '.goose-ultra', 'image-cache');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
};

/**
 * Generate an image from a text prompt using Pollinations.ai (free)
 * @param {string} prompt - The image description
 * @param {object} options - Optional settings
 * @returns {Promise<{url: string, localPath: string, prompt: string}>}
 */
export async function generateImage(prompt, options = {}) {
    const {
        width = 1024,
        height = 1024,
        seed = Math.floor(Math.random() * 1000000),
        model = 'flux', // 'flux' or 'turbo'
        nologo = true
    } = options;

    console.log('[ImageAPI] Generating image for prompt:', prompt.substring(0, 100) + '...');

    // Build Pollinations URL
    const encodedPrompt = encodeURIComponent(prompt);
    const params = new URLSearchParams({
        width: String(width),
        height: String(height),
        seed: String(seed),
        model: model,
        nologo: String(nologo)
    });

    const imageUrl = `${POLLINATIONS_BASE}${encodedPrompt}?${params.toString()}`;

    // Download and cache image
    const imageId = crypto.createHash('md5').update(prompt + seed).digest('hex');
    const localPath = path.join(getCacheDir(), `${imageId}.png`);

    try {
        await downloadImage(imageUrl, localPath);
        console.log('[ImageAPI] Image saved to:', localPath);

        return {
            url: imageUrl,
            localPath: localPath,
            prompt: prompt,
            width,
            height,
            seed
        };
    } catch (error) {
        console.error('[ImageAPI] Generation failed:', error.message);
        throw error;
    }
}

/**
 * Download an image from URL to local path
 */
function downloadImage(url, destPath) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const client = urlObj.protocol === 'https:' ? https : http;

        const file = fs.createWriteStream(destPath);

        const request = client.get(url, { timeout: 60000 }, (response) => {
            // Handle redirects
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                file.close();
                fs.unlinkSync(destPath);
                return downloadImage(response.headers.location, destPath).then(resolve).catch(reject);
            }

            if (response.statusCode !== 200) {
                file.close();
                fs.unlinkSync(destPath);
                reject(new Error(`HTTP ${response.statusCode}: Failed to download image`));
                return;
            }

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                resolve(destPath);
            });
        });

        request.on('error', (err) => {
            file.close();
            if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
            reject(err);
        });

        request.on('timeout', () => {
            request.destroy();
            file.close();
            if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
            reject(new Error('Image download timeout'));
        });
    });
}

/**
 * Detect if a user message is requesting image generation
 * @param {string} message - User message
 * @returns {{isImageRequest: boolean, prompt: string | null}}
 */
export function detectImageRequest(message) {
    const lower = message.toLowerCase();

    // Common image generation patterns
    const patterns = [
        /^(generate|create|make|draw|design|paint|illustrate|render|produce)\s+(an?\s+)?(image|picture|photo|illustration|artwork|art|graphic|visual|drawing|painting)\s+(of|showing|depicting|with|about|for)?\s*/i,
        /^(show me|give me|i want|can you (make|create|generate)|please (make|create|generate))\s+(an?\s+)?(image|picture|photo|illustration|artwork)\s+(of|showing|depicting|with|about|for)?\s*/i,
        /image\s+of\s+/i,
        /picture\s+of\s+/i,
        /draw\s+(me\s+)?(a|an)\s+/i,
        /visualize\s+/i,
        /create\s+art\s+(of|for|showing)\s*/i
    ];

    for (const pattern of patterns) {
        if (pattern.test(lower)) {
            // Extract the actual image description
            let prompt = message;

            // Remove the command prefix to get just the description
            prompt = prompt.replace(/^(generate|create|make|draw|design|paint|illustrate|render|produce)\s+(an?\s+)?(image|picture|photo|illustration|artwork|art|graphic|visual|drawing|painting)\s+(of|showing|depicting|with|about|for)?\s*/i, '');
            prompt = prompt.replace(/^(show me|give me|i want|can you (make|create|generate)|please (make|create|generate))\s+(an?\s+)?(image|picture|photo|illustration|artwork)\s+(of|showing|depicting|with|about|for)?\s*/i, '');
            prompt = prompt.replace(/^image\s+of\s+/i, '');
            prompt = prompt.replace(/^picture\s+of\s+/i, '');
            prompt = prompt.replace(/^draw\s+(me\s+)?(a|an)\s+/i, '');
            prompt = prompt.replace(/^visualize\s+/i, '');
            prompt = prompt.replace(/^create\s+art\s+(of|for|showing)\s*/i, '');

            prompt = prompt.trim();

            // If we couldn't extract a clean prompt, use original
            if (prompt.length < 3) prompt = message;

            return { isImageRequest: true, prompt: prompt };
        }
    }

    // Check for explicit "image:" prefix
    if (lower.startsWith('image:') || lower.startsWith('/image ') || lower.startsWith('/imagine ')) {
        const prompt = message.replace(/^(image:|\/image\s+|\/imagine\s+)/i, '').trim();
        return { isImageRequest: true, prompt };
    }

    return { isImageRequest: false, prompt: null };
}

/**
 * Get a list of cached images
 */
export function getCachedImages() {
    const cacheDir = getCacheDir();
    try {
        const files = fs.readdirSync(cacheDir);
        return files.filter(f => f.endsWith('.png')).map(f => path.join(cacheDir, f));
    } catch (e) {
        return [];
    }
}

/**
 * Clear old cached images (older than 7 days)
 */
export function cleanupCache(maxAgeDays = 7) {
    const cacheDir = getCacheDir();
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
    const now = Date.now();

    try {
        const files = fs.readdirSync(cacheDir);
        for (const file of files) {
            const filePath = path.join(cacheDir, file);
            const stat = fs.statSync(filePath);
            if (now - stat.mtimeMs > maxAge) {
                fs.unlinkSync(filePath);
                console.log('[ImageAPI] Cleaned up:', file);
            }
        }
    } catch (e) {
        console.error('[ImageAPI] Cache cleanup error:', e.message);
    }
}
