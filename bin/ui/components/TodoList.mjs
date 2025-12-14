import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

const h = React.createElement;

const TodoList = ({ tasks = [], onAddTask, onCompleteTask, onDeleteTask, width = 60 }) => {
    const [newTask, setNewTask] = useState('');
    const [isAdding, setIsAdding] = useState(false);

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

    return h(Box, { flexDirection: 'column', width: width, borderStyle: 'round', borderColor: 'gray', padding: 1 },
        // Header with title and progress
        h(Box, { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1 },
            h(Text, { bold: true, color: 'white' }, '📋 Tasks'),
            h(Text, { color: 'cyan' }, `${progress}%`)
        ),

        // Progress bar
        h(Box, { marginBottom: 1 },
            h(Box, { 
                width: width - 4, // Account for padding
                height: 1, 
                borderStyle: 'single', 
                borderColor: 'gray',
                flexDirection: 'row' 
            },
                h(Box, { 
                    width: Math.max(1, Math.floor((width - 6) * progress / 100)), 
                    height: 1, 
                    backgroundColor: 'green' 
                })
            )
        ),

        // Add new task
        h(Box, { marginBottom: 1 },
            isAdding 
                ? h(Box, { flexDirection: 'row', alignItems: 'center' },
                    h(Text, { color: 'green', marginRight: 1 }, '●'),
                    h(Box, { flexGrow: 1 },
                        h(TextInput, {
                            value: newTask,
                            onChange: setNewTask,
                            onSubmit: handleAddTask,
                            placeholder: 'Add new task...'
                        })
                    )
                  )
                : h(Box, { flexDirection: 'row', alignItems: 'center' },
                    h(Text, { color: 'green', marginRight: 1 }, '➕'),
                    h(Text, { color: 'gray', dimColor: true, onClick: () => setIsAdding(true) }, 'Add task')
                  )
        ),

        // Tasks list
        h(Box, { flexDirection: 'column', flexGrow: 1 },
            // Pending tasks
            pendingTasks.map((task, index) => 
                h(Box, { 
                    key: task.id || index, 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    marginBottom: 0.5 
                },
                    h(Box, { 
                        width: 2, 
                        height: 1, 
                        borderStyle: 'round', 
                        borderColor: 'gray',
                        marginRight: 1,
                        onClick: () => onCompleteTask && onCompleteTask(task.id)
                    },
                        h(Text, { color: 'gray' }, '○')
                    ),
                    h(Box, { flexGrow: 1 },
                        h(Text, { color: 'white' }, task.content)
                    )
                )
            ),

            // Completed tasks (show collapsed by default)
            completedTasks.length > 0 && h(Box, { marginTop: 1 },
                h(Text, { color: 'gray', dimColor: true, bold: true }, `✓ ${completedTasks.length} completed`)
            )
        )
    );
};

export default TodoList;