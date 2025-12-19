/**
 * OpenQode Theme Engine (Vibe Upgrade)
 * Defines color palettes for TUI theming
 */

export const THEMES = {
    dracula: {
        name: 'Dracula',
        description: 'Classic dark purple theme',
        primary: 'magenta',
        secondary: 'cyan',
        accent: 'green',
        text: 'white',
        muted: 'gray',
        background: 'black',
        success: 'green',
        warning: 'yellow',
        error: 'red',
        border: 'gray'
    },
    monokai: {
        name: 'Monokai',
        description: 'Warm orange and green',
        primary: 'yellow',
        secondary: 'green',
        accent: 'magenta',
        text: 'white',
        muted: 'gray',
        background: 'black',
        success: 'green',
        warning: 'yellow',
        error: 'red',
        border: 'yellow'
    },
    nord: {
        name: 'Nord',
        description: 'Cool blue arctic palette',
        primary: 'blue',
        secondary: 'cyan',
        accent: 'white',
        text: 'white',
        muted: 'gray',
        background: 'black',
        success: 'cyan',
        warning: 'yellow',
        error: 'red',
        border: 'blue'
    },
    matrix: {
        name: 'Matrix',
        description: 'Hacker green on black',
        primary: 'green',
        secondary: 'green',
        accent: 'green',
        text: 'green',
        muted: 'gray',
        background: 'black',
        success: 'green',
        warning: 'green',
        error: 'red',
        border: 'green'
    }
};

/** Get theme by ID */
export const getTheme = (themeId) => {
    return THEMES[themeId] || THEMES.dracula;
};

/** Get all theme names for picker */
export const getThemeNames = () => {
    return Object.entries(THEMES).map(([id, theme]) => ({
        id,
        name: theme.name,
        description: theme.description
    }));
};
