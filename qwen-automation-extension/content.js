// Content script for Qwen AI Automation Extension
console.log('Qwen AI Automation content script loaded');

// Store extension state
let extensionState = {
  isActive: false,
  currentTask: null,
  qwenToken: null
};

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'getPageContent':
      sendResponse(getPageContent());
      break;
      
    case 'getElementInfo':
      sendResponse(getElementInfo(message.selector));
      break;
      
    case 'executeAction':
      sendResponse(executeAction(message.action, message.params));
      break;
      
    default:
      console.log('Unknown message action:', message.action);
  }
  
  return true; // Keep message channel open for async response
});

// Get page content for AI analysis
function getPageContent() {
  return {
    url: window.location.href,
    title: document.title,
    content: document.body.innerText.substring(0, 2000), // First 2000 chars
    elements: Array.from(document.querySelectorAll('input, button, a, textarea, select'))
      .map(el => ({
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        className: el.className || null,
        text: el.textContent?.substring(0, 100) || el.value || null,
        name: el.name || null,
        placeholder: el.placeholder || null,
        role: el.getAttribute('role') || null
      }))
  };
}

// Get specific element information
function getElementInfo(selector) {
  const element = document.querySelector(selector);
  if (element) {
    return {
      exists: true,
      tag: element.tagName.toLowerCase(),
      id: element.id || null,
      className: element.className || null,
      text: element.textContent?.substring(0, 100) || element.value || null,
      name: element.name || null,
      placeholder: element.placeholder || null,
      role: element.getAttribute('role') || null,
      rect: element.getBoundingClientRect(),
      isVisible: !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
    };
  } else {
    return { exists: false };
  }
}

// Execute an action on the page
function executeAction(action, params) {
  try {
    switch (action) {
      case 'click':
        return clickElement(params.selector);
        
      case 'fill':
        return fillElement(params.selector, params.value);
        
      case 'clickText':
        return clickElementByText(params.text);
        
      case 'waitForElement':
        return waitForElement(params.selector, params.timeout || 5000);
        
      case 'scrollToElement':
        return scrollToElement(params.selector);
        
      case 'extractText':
        return extractTextFromElement(params.selector);
        
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Helper functions
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
    element.dispatchEvent(new Event('blur', { bubbles: true })); // Trigger any blur events
    return { success: true, message: `Filled element: ${selector} with value: ${value}` };
  } else {
    return { success: false, error: `Element not found: ${selector}` };
  }
}

function clickElementByText(text) {
  const elements = Array.from(document.querySelectorAll('button, a, input, textarea, span, div'));
  const element = elements.find(el => 
    el.textContent?.trim().toLowerCase().includes(text.toLowerCase()) ||
    el.value?.toLowerCase().includes(text.toLowerCase()) ||
    el.placeholder?.toLowerCase().includes(text.toLowerCase())
  );
  
  if (element) {
    element.click();
    return { success: true, message: `Clicked element with text: ${text}` };
  } else {
    return { success: false, error: `Element with text not found: ${text}` };
  }
}

function waitForElement(selector, timeout) {
  return new Promise((resolve) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve({ success: true, message: `Element found immediately: ${selector}` });
      return;
    }
    
    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve({ success: true, message: `Element found after waiting: ${selector}` });
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    setTimeout(() => {
      observer.disconnect();
      resolve({ success: false, error: `Element not found within timeout: ${selector}` });
    }, timeout);
  });
}

function scrollToElement(selector) {
  const element = document.querySelector(selector);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return { success: true, message: `Scrolled to element: ${selector}` };
  } else {
    return { success: false, error: `Element not found: ${selector}` };
  }
}

function extractTextFromElement(selector) {
  const element = document.querySelector(selector);
  if (element) {
    return { 
      success: true, 
      text: element.textContent || element.value || '', 
      message: `Extracted text from element: ${selector}` 
    };
  } else {
    return { success: false, error: `Element not found: ${selector}` };
  }
}

// Expose functions to window for advanced usage if needed
window.qwenAutomation = {
  getPageContent,
  getElementInfo,
  executeAction,
  clickElement,
  fillElement
};