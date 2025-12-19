/**
 * File System API Bridge
 */
import fs from 'fs/promises';
import path from 'path';

export const fsApi = {
    async listFiles(dirPath) {
        try {
            const files = await fs.readdir(dirPath, { withFileTypes: true });
            return files.map(f => ({
                name: f.name,
                isDirectory: f.isDirectory(),
                path: path.join(dirPath, f.name)
            }));
        } catch (e) {
            console.error('List files error:', e);
            throw e;
        }
    },
    async readFile(filePath) {
        return fs.readFile(filePath, 'utf-8');
    },
    async writeFile(filePath, content) {
        // Ensure dir exists
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        return fs.writeFile(filePath, content, 'utf-8');
    },
    async deletePath(targetPath) {
        await fs.rm(targetPath, { recursive: true, force: true });
    }
};
