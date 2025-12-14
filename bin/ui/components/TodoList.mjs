import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

const h = React.createElement;

const TodoList = ({ tasks = [], onAddTask, onCompleteTask, onDeleteTask, width = 60 }) => {
    const [newTask, setNewTask] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [showCompleted, setShowCompleted] = useState(false); // Toggle to show/hide completed tasks

    const handleAddTask = () => {
        if (newTask.trim()) {
            onAddTask && onAddTask(newTask.trim());
            setNewTask('');
            setIsAdding(false);
        }
    };

    const pendingTasks = tasks.filter(t => t.status !== 'completed');
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const progress = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

    return h(Box, { 
        flexDirection: 'column', 
        width: width, 
        borderStyle: 'double',  // Professional double border
        borderColor: 'cyan',    // Professional accent color
        paddingX: 1,
        paddingY: 1,
        backgroundColor: '#1e1e1e' // Dark theme like professional IDEs
    },
        // Header with title, progress, and stats
        h(Box, { 
            flexDirection: 'row', 
            justifyContent: 'space-between', 
            marginBottom: 1,
            paddingBottom: 0.5,
            borderBottom: true,
            borderColor: 'gray'
        },
            h(Text, { bold: true, color: 'cyan' }, '📋 TASK MANAGER'),
            h(Box, { flexDirection: 'row', gap: 1 },
                h(Text, { color: 'green' }, `${completedTasks.length}`),
                h(Text, { color: 'gray' }, '/'),
                h(Text, { color: 'white' }, `${tasks.length}`),
                h(Text, { color: 'cyan' }, `(${progress}%)`)
            )
        ),

        // Progress bar with professional styling
        h(Box, { marginBottom: 1 },
            h(Box, { 
                width: width - 4, 
                height: 1, 
                borderStyle: 'single', 
                borderColor: 'gray',
                flexDirection: 'row',
                backgroundColor: '#333333'  // Dark background for progress bar
            },
                h(Box, { 
                    width: Math.max(1, Math.floor((width - 6) * progress / 100)), 
                    height: 1, 
                    backgroundColor: progress === 100 ? 'green' : 'cyan'  // Color based on completion
                })
            )
        ),

        // Add new task with enhanced UI
        h(Box, { 
            marginBottom: 1,
            paddingX: 0.5,
            backgroundColor: '#2a2a2a',
            borderStyle: 'round',
            borderColor: 'gray'
        },
            isAdding 
                ? h(Box, { flexDirection: 'row', alignItems: 'center' },
                    h(Text, { color: 'green', marginRight: 1 }, '✓'),
                    h(Box, { flexGrow: 1 },
                        h(TextInput, {
                            value: newTask,
                            onChange: setNewTask,
                            onSubmit: handleAddTask,
                            placeholder: 'Enter new task...',
                            backgroundColor: '#333333'
                        })
                    )
                  )
                : h(Box, { 
                    flexDirection: 'row', 
                    alignItems: 'center',
                    onClick: () => setIsAdding(true)
                },
                    h(Text, { color: 'green', marginRight: 1 }, '✚'),
                    h(Text, { color: 'gray', dimColor: false }, 'Add new task (click to add)')
                  )
        ),

        // Tasks list with enhanced styling
        h(Box, { flexDirection: 'column', flexGrow: 1 },
            // Pending tasks section
            pendingTasks.length > 0 
                ? h(Box, { marginBottom: 1 },
                    h(Text, { color: 'yellow', bold: true, marginBottom: 0.5 }, `⚡ ${pendingTasks.length} PENDING`),
                    ...pendingTasks.map((task, index) => 
                        h(Box, { 
                            key: task.id || index, 
                            flexDirection: 'row', 
                            alignItems: 'center', 
                            marginBottom: 0.5,
                            paddingX: 1,
                            backgroundColor: '#252525',
                            borderStyle: 'single',
                            borderColor: 'gray'
                        },
                            // Complete button
                            h(Box, { 
                                width: 3, 
                                height: 1, 
                                marginRight: 1,
                                alignItems: 'center',
                                justifyContent: 'center',
                                onClick: () => onCompleteTask && onCompleteTask(task.id),
                                backgroundColor: 'transparent'
                            },
                                h(Text, { color: 'yellow' }, '○')
                            ),
                            // Task content
                            h(Box, { flexGrow: 1 },
                                h(Text, { color: 'white' }, task.content)
                            ),
                            // Delete button
                            h(Box, { 
                                width: 3,
                                alignItems: 'center',
                                justifyContent: 'center',
                                onClick: () => onDeleteTask && onDeleteTask(task.id)
                            },
                                h(Text, { color: 'red' }, '✕')
                            )
                        )
                    )
                )
                : h(Text, { color: 'gray', italic: true, marginBottom: 1, marginLeft: 1 }, 'No pending tasks'),

            // Completed tasks section with toggle
            completedTasks.length > 0 && h(Box, { marginTop: 1 },
                h(Box, { 
                    flexDirection: 'row', 
                    justifyContent: 'space-between',
                    onClick: () => setShowCompleted(!showCompleted)
                },
                    h(Text, { 
                        color: showCompleted ? 'green' : 'gray', 
                        bold: true 
                    }, `✓ ${completedTasks.length} COMPLETED ${showCompleted ? '−' : '+'}`),
                    h(Text, { color: 'gray', dimColor: true }, showCompleted ? 'click to collapse' : 'click to expand')
                ),
                showCompleted && h(Box, { marginTop: 0.5 },
                    ...completedTasks.map((task, index) => 
                        h(Box, { 
                            key: `completed-${task.id || index}`, 
                            flexDirection: 'row', 
                            alignItems: 'center', 
                            marginBottom: 0.5,
                            paddingX: 1,
                            backgroundColor: '#2a2a2a',
                            borderStyle: 'single',
                            borderColor: 'green'
                        },
                            // Completed indicator
                            h(Box, { 
                                width: 3, 
                                height: 1, 
                                marginRight: 1,
                                alignItems: 'center',
                                justifyContent: 'center'
                            },
                                h(Text, { color: 'green', bold: true }, '✓')
                            ),
                            // Task content
                            h(Box, { flexGrow: 1 },
                                h(Text, { 
                                    color: 'gray', 
                                    strikethrough: true,
                                    dimColor: true
                                }, task.content)
                            ),
                            // Delete button
                            h(Box, { 
                                width: 3,
                                alignItems: 'center',
                                justifyContent: 'center',
                                onClick: () => onDeleteTask && onDeleteTask(task.id)
                            },
                                h(Text, { color: 'red' }, '✕')
                            )
                        )
                    )
                )
            )
        ),

        // Footer with instructions
        h(Box, { 
            marginTop: 1,
            paddingTop: 0.5,
            borderTop: true,
            borderColor: 'gray'
        },
            h(Text, { color: 'gray', dimColor: true, size: 'small' },
                'Click ○ to complete • Click ✕ to delete'
            )
        )
    );
};

export default TodoList;