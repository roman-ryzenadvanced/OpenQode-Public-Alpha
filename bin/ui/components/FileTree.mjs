import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import fs from 'fs';
import path from 'path';

const h = React.createElement;

// Helper to sort: folders first
const sortFiles = (files, dirPath) => {
    return files.sort((a, b) => {
        const pathA = path.join(dirPath, a);
        const pathB = path.join(dirPath, b);
        try {
            const statA = fs.statSync(pathA);
            const statB = fs.statSync(pathB);
            if (statA.isDirectory() && !statB.isDirectory()) return -1;
            if (!statA.isDirectory() && statB.isDirectory()) return 1;
            return a.localeCompare(b);
        } catch (e) {
            return 0;
        }
    });
};

const FileTree = ({
    rootPath,
    onSelect,
    onOpen,
    selectedFiles = new Set(),
    isActive = false,
    height = 20,
    width = 30
}) => {
    const [expanded, setExpanded] = useState(new Set([rootPath])); // Expanded folders
    const [cursor, setCursor] = useState(rootPath); // Currently highlighted path
    const [flatList, setFlatList] = useState([]); // Computed flat list for rendering (calc'd from expanded)

    // Ignore list
    const IGNORE_DIRS = new Set(['.git', 'node_modules', '.opencode', 'dist', 'build', 'coverage']);

    // Rebuild flat list when expanded changes
    // Returns array of { path, name, isDir, depth, isExpanded, hasChildren }
    const buildFlatList = useCallback(() => {
        const list = [];

        const traverse = (currentPath, depth) => {
            if (depth > 10) return; // Safety

            const name = path.basename(currentPath) || (currentPath === rootPath ? '/' : currentPath);
            let isDir = false;
            try {
                isDir = fs.statSync(currentPath).isDirectory();
            } catch (e) { return; }

            const isExpanded = expanded.has(currentPath);

            list.push({
                path: currentPath,
                name: name,
                isDir: isDir,
                depth: depth,
                isExpanded: isExpanded
            });

            if (isDir && isExpanded) {
                try {
                    const children = fs.readdirSync(currentPath).filter(f => !IGNORE_DIRS.has(f) && !f.startsWith('.'));
                    const sorted = sortFiles(children, currentPath);
                    for (const child of sorted) {
                        traverse(path.join(currentPath, child), depth + 1);
                    }
                } catch (e) {
                    // Permission error or file delete race condition
                }
            }
        };

        traverse(rootPath, 0);
        return list;
    }, [expanded, rootPath]);

    useEffect(() => {
        setFlatList(buildFlatList());
    }, [buildFlatList]);

    useInput((input, key) => {
        if (!isActive) return;

        const currentIndex = flatList.findIndex(item => item.path === cursor);

        if (key.downArrow) {
            const nextIndex = Math.min(flatList.length - 1, currentIndex + 1);
            setCursor(flatList[nextIndex].path);
        }

        if (key.upArrow) {
            const prevIndex = Math.max(0, currentIndex - 1);
            setCursor(flatList[prevIndex].path);
        }

        if (key.rightArrow || key.return) {
            const item = flatList[currentIndex];
            if (item && item.isDir) {
                if (!expanded.has(item.path)) {
                    setExpanded(prev => new Set([...prev, item.path]));
                }
            } else if (key.return) {
                const selectedItem = flatList[currentIndex];
                if (selectedItem && !selectedItem.isDir && typeof onOpen === 'function') {
                    onOpen(selectedItem.path);
                }
            }
        }

        if (key.leftArrow) {
            const item = flatList[currentIndex];
            if (item && item.isDir && expanded.has(item.path)) {
                const newExpanded = new Set(expanded);
                newExpanded.delete(item.path);
                setExpanded(newExpanded);
            } else {
                // Determine parent path to jump up
                const parentPath = path.dirname(item.path);
                if (parentPath && parentPath.length >= rootPath.length) {
                    setCursor(parentPath);
                }
            }
        }

        if (input === ' ') {
            const item = flatList[currentIndex];
            if (item && !item.isDir) {
                // Toggle selection
                if (onSelect) {
                    onSelect(item.path);
                }
            }
        }
    });

    // Calculate viewport based on cursor
    const cursorIndex = flatList.findIndex(item => item.path === cursor);
    // Ensure height is valid number
    const safeHeight = Math.max(5, height || 20);
    const renderStart = Math.max(0, Math.min(cursorIndex - Math.floor(safeHeight / 2), flatList.length - safeHeight));
    const renderEnd = Math.min(flatList.length, renderStart + safeHeight);

    const visibleItems = flatList.slice(renderStart, renderEnd);

    return h(Box, { flexDirection: 'column', width: width, height: safeHeight },
        visibleItems.map((item) => {
            const isSelected = selectedFiles.has(item.path);
            const isCursor = item.path === cursor;

            // Indentation
            const indent = '  '.repeat(Math.max(0, item.depth));

            // Icon
            let icon = item.isDir
                ? (item.isExpanded ? '▼ ' : '▶ ')
                : (isSelected ? '[x] ' : '[ ] ');

            // Color logic
            let color = 'white';
            if (item.isDir) color = 'cyan';
            if (isSelected) color = 'green';

            // Cursor style
            const bg = isCursor ? 'blue' : undefined;
            const textColor = isCursor ? 'white' : color;

            return h(Box, { key: item.path, width: '100%' },
                h(Text, {
                    backgroundColor: bg,
                    color: textColor,
                    wrap: 'truncate'
                }, `${indent}${icon}${item.name}`)
            );
        })
    );
};

export default FileTree;
