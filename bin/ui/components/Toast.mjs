/**
 * Toast Component - Minimal confirmations
 * 
 * DESIGN:
 * - Copy/applied/saved/reverted appear as brief toasts
 * - Don't add to transcript (displayed separately)
 * - Auto-dismiss after timeout
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { colors } from '../../tui-theme.mjs';
import { icon } from '../../icons.mjs';
import { getCapabilities } from '../../terminal-profile.mjs';

const h = React.createElement;

/**
 * Toast - Single toast notification
 */
const Toast = ({
    message,
    type = 'info', // info, success, warning, error
    duration = 3000,
    onDismiss = null
}) => {
    const caps = getCapabilities();
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setVisible(false);
            onDismiss?.();
        }, duration);
        return () => clearTimeout(timer);
    }, [duration, onDismiss]);

    if (!visible) return null;

    const typeConfig = {
        info: { color: colors.accent, icon: caps.unicodeOK ? 'ℹ' : 'i' },
        success: { color: colors.success, icon: caps.unicodeOK ? '✓' : '+' },
        warning: { color: colors.warning, icon: caps.unicodeOK ? '⚠' : '!' },
        error: { color: colors.error, icon: caps.unicodeOK ? '✗' : 'X' }
    };

    const config = typeConfig[type] || typeConfig.info;

    return h(Box, {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingX: 1
    },
        h(Text, { color: config.color }, config.icon + ' '),
        h(Text, { color: config.color }, message)
    );
};

/**
 * ToastContainer - Manages multiple toasts
 */
const ToastContainer = ({ toasts = [], onDismiss }) => {
    if (toasts.length === 0) return null;

    return h(Box, {
        flexDirection: 'column',
        position: 'absolute',
        right: 0,
        top: 0
    },
        ...toasts.map((toast, i) =>
            h(Toast, {
                key: toast.id || i,
                message: toast.message,
                type: toast.type,
                duration: toast.duration,
                onDismiss: () => onDismiss?.(toast.id || i)
            })
        )
    );
};

/**
 * useToasts - Hook for managing toasts
 */
const createToastManager = () => {
    let toasts = [];
    let listeners = [];
    let nextId = 0;

    const subscribe = (listener) => {
        listeners.push(listener);
        return () => {
            listeners = listeners.filter(l => l !== listener);
        };
    };

    const notify = () => {
        listeners.forEach(l => l(toasts));
    };

    const add = (message, type = 'info', duration = 3000) => {
        const id = nextId++;
        toasts = [...toasts, { id, message, type, duration }];
        notify();

        setTimeout(() => {
            toasts = toasts.filter(t => t.id !== id);
            notify();
        }, duration);

        return id;
    };

    const dismiss = (id) => {
        toasts = toasts.filter(t => t.id !== id);
        notify();
    };

    return { subscribe, add, dismiss, get: () => toasts };
};

// Global toast manager (singleton)
const toastManager = createToastManager();

// Convenience methods
const showToast = (message, type, duration) => toastManager.add(message, type, duration);
const showSuccess = (message) => showToast(message, 'success', 2000);
const showError = (message) => showToast(message, 'error', 4000);
const showInfo = (message) => showToast(message, 'info', 3000);

export default Toast;
export {
    Toast,
    ToastContainer,
    toastManager,
    showToast,
    showSuccess,
    showError,
    showInfo
};
