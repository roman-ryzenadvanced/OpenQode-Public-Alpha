// Background script for Qwen AI Automation Extension
let isAuthenticated = false;
let qwenToken = null;

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Qwen AI Automation Extension installed');
});

// Handle messages from popup
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  switch (message.action) {
    case 'checkAuth':
      sendResponse({ authenticated: isAuthenticated });
      break;
      
    case 'openAuth':
      // Open Qwen authentication in a new tab
      try {
        await chrome.tabs.create({
          url: 'https://chat.qwen.ai'
        });
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      break;
      
    case 'executeTask':
      if (!isAuthenticated) {
        sendResponse({ error: 'Not authenticated with Qwen' });
        return true;
      }
      
      try {
        const result = await executeBrowserTask(message.task);
        sendResponse({ success: true, result: result });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      break;
      
    case 'updateAuthStatus':
      isAuthenticated = message.authenticated;
      qwenToken = message.token || null;
      
      // Notify popup about auth status change
      chrome.runtime.sendMessage({ action: 'authStatusUpdated' });
      sendResponse({ success: true });
      break;
  }
  
  return true; // Keep message channel open for async response
});

// Execute browser automation task
async function executeBrowserTask(task) {
  // Get current active tab
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });
  
  if (!activeTab) {
    throw new Error('No active tab found');
  }

  try {
    // Analyze the task and determine appropriate automation steps
    const automationSteps = await analyzeTaskWithQwen(task, activeTab.url);
    
    // Execute each step
    let results = [];
    for (const step of automationSteps) {
      const result = await executeAutomationStep(step, activeTab.id);
      results.push(result);
    }
    
    return `Task completed successfully. Performed ${automationSteps.length} steps.`;
  } catch (error) {
    throw new Error(`Task execution failed: ${error.message}`);
  }
}

// Analyze task with Qwen AI (simplified for this example)
async function analyzeTaskWithQwen(task, currentUrl) {
  // This would normally call the Qwen API
  // For now, we'll use a simple rule-based approach
  // In a real implementation, this would send the task to Qwen API
  
  console.log(`Analyzing task: ${task} on page: ${currentUrl}`);
  
  // Simple rule-based analysis (would be replaced with Qwen API call)
  if (task.toLowerCase().includes('search') || task.toLowerCase().includes('google')) {
    return [
      {
        action: 'fill',
        selector: 'textarea[name="q"], input[name="q"], [name="search"], #search',
        value: extractSearchQuery(task)
      },
      {
        action: 'press',
        key: 'Enter'
      }
    ];
  } else if (task.toLowerCase().includes('click') || task.toLowerCase().includes('click on')) {
    const element = extractElementFromTask(task);
    return [
      {
        action: 'click',
        selector: element
      }
    ];
  } else {
    // Default: just return the task as is for Qwen to process
    return [
      {
        action: 'analyze',
        task: task,
        url: currentUrl
      }
    ];
  }
}

// Extract search query from task
function extractSearchQuery(task) {
  const match = task.match(/search for ["']?([^"']+)["']?/i) || 
               task.match(/google ["']?([^"']+)["']?/i) ||
               task.match(/find ["']?([^"']+)["']?/i);
  return match ? match[1] : task.replace(/(search|google|find)\s*/i, '').trim();
}

// Extract element from task
function extractElementFromTask(task) {
  // Simple extraction - in reality would be more sophisticated
  const lowerTask = task.toLowerCase();
  if (lowerTask.includes('search') || lowerTask.includes('google')) return 'textarea[name="q"], input[name="q"]';
  if (lowerTask.includes('button')) return 'button';
  if (lowerTask.includes('link')) return 'a';
  return '*'; // generic selector
}

// Execute a single automation step
async function executeAutomationStep(step, tabId) {
  try {
    switch (step.action) {
      case 'click':
        return await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: clickElement,
          args: [step.selector]
        });
        
      case 'fill':
        return await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: fillElement,
          args: [step.selector, step.value]
        });
        
      case 'press':
        // For key press, we'll inject a script to simulate the key
        return await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: pressKey,
          args: [step.key]
        });
        
      default:
        console.log('Unknown action:', step.action);
        return { success: false, error: `Unknown action: ${step.action}` };
    }
  } catch (error) {
    console.error('Step execution error:', error);
    throw error;
  }
}

// Helper functions to be injected into the page
function clickElement(selector) {
  const element = document.querySelector(selector);
  if (element) {
    element.click();
    return { success: true, message: `Clicked element: ${selector}` };
  } else {
    return { success: false, error: `Element not found: ${selector}` };
  }
}

function fillElement(selector, value) {
  const element = document.querySelector(selector);
  if (element) {
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return { success: true, message: `Filled element: ${selector} with value: ${value}` };
  } else {
    return { success: false, error: `Element not found: ${selector}` };
  }
}

function pressKey(key) {
  const event = new KeyboardEvent('keydown', {
    key: key,
    code: key.toUpperCase(),
    bubbles: true
  });
  document.activeElement.dispatchEvent(event);
  return { success: true, message: `Pressed key: ${key}` };
}

// Listen for tab updates to manage state
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    // Tab loaded completely, extension is ready for new tasks
    console.log(`Tab ${tabId} loaded: ${tab.url}`);
  }
});