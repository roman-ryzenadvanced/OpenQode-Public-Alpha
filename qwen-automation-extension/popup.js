// Popup UI Logic
document.addEventListener('DOMContentLoaded', function() {
  const authStatus = document.getElementById('authStatus');
  const authBtn = document.getElementById('authBtn');
  const taskSection = document.getElementById('taskSection');
  const taskInput = document.getElementById('taskInput');
  const executeBtn = document.getElementById('executeBtn');
  const loading = document.getElementById('loading');
  const historyList = document.getElementById('historyList');

  // Check authentication status
  checkAuthStatus();

  // Auth button click handler
  authBtn.addEventListener('click', async function() {
    try {
      // Open authentication flow
      await chrome.runtime.sendMessage({ action: 'openAuth' });
    } catch (error) {
      console.error('Auth error:', error);
    }
  });

  // Execute button click handler
  executeBtn.addEventListener('click', async function() {
    const task = taskInput.value.trim();
    if (!task) return;

    // Show loading
    executeBtn.disabled = true;
    loading.style.display = 'block';

    try {
      // Send task to background script
      const result = await chrome.runtime.sendMessage({
        action: 'executeTask',
        task: task
      });

      // Add to history
      addToHistory(task, result);
      taskInput.value = '';
    } catch (error) {
      console.error('Execution error:', error);
      addToHistory(task, `Error: ${error.message}`);
    } finally {
      // Hide loading
      executeBtn.disabled = false;
      loading.style.display = 'none';
    }
  });

  async function checkAuthStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'checkAuth' });
      if (response.authenticated) {
        authStatus.textContent = '✅ Authenticated with Qwen';
        authStatus.className = 'auth-status authenticated';
        taskSection.style.display = 'block';
      } else {
        authStatus.textContent = '❌ Not authenticated with Qwen';
        authStatus.className = 'auth-status not-authenticated';
        taskSection.style.display = 'none';
      }
    } catch (error) {
      console.error('Auth check error:', error);
    }
  }

  function addToHistory(task, result) {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.innerHTML = `
      <strong>Task:</strong> ${task}<br>
      <strong>Result:</strong> ${result}
    `;
    historyList.insertBefore(historyItem, historyList.firstChild);
    
    // Limit to 5 items
    if (historyList.children.length > 5) {
      historyList.removeChild(historyList.lastChild);
    }
  }

  // Listen for auth status updates
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'authStatusUpdated') {
      checkAuthStatus();
    }
  });
});