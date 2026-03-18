import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export interface Tab {
  id: string;
  title: string;
  agentId: string;
  createdAt: number;
}

interface StoredSession {
  tabs: Tab[];
  activeTabId: string | null;
  historyTabs: Tab[];
}

const SESSION_KEY = 'ccremote-terminal-session';
const MAX_HISTORY = 10;

// Key sender function type
type KeySender = (key: string) => void;

function loadSession(): StoredSession | null {
  try {
    const data = sessionStorage.getItem(SESSION_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load session:', e);
  }
  return null;
}

function saveSession(data: StoredSession): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save session:', e);
  }
}

function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch (e) {
    console.error('Failed to clear session:', e);
  }
}

export const useTerminalStore = defineStore('terminal', () => {
  const tabs = ref<Tab[]>([]);
  const activeTabId = ref<string | null>(null);
  const agents = ref<{ agentId: string; name: string; online: boolean }[]>([]);
  const historyTabs = ref<Tab[]>([]);

  // Registry for key senders (tabId -> sendKey function)
  const keySenders = new Map<string, KeySender>();

  // Load saved session on init
  const savedSession = loadSession();
  if (savedSession) {
    historyTabs.value = savedSession.historyTabs || [];
  }

  // Watch for changes and auto-save
  watch(
    [tabs, activeTabId],
    () => {
      if (tabs.value.length > 0) {
        saveSession({
          tabs: tabs.value,
          activeTabId: activeTabId.value,
          historyTabs: historyTabs.value,
        });
      }
    },
    { deep: true }
  );

  function addTab(tab: Tab) {
    tabs.value.push(tab);
    activeTabId.value = tab.id;

    // Add to history (avoid duplicates, keep most recent first)
    const existingIndex = historyTabs.value.findIndex(t => t.agentId === tab.agentId);
    if (existingIndex !== -1) {
      historyTabs.value.splice(existingIndex, 1);
    }
    historyTabs.value.unshift(tab);
    // Keep only MAX_HISTORY items
    if (historyTabs.value.length > MAX_HISTORY) {
      historyTabs.value = historyTabs.value.slice(0, MAX_HISTORY);
    }
  }

  function removeTab(id: string) {
    const index = tabs.value.findIndex(t => t.id === id);
    if (index !== -1) {
      tabs.value.splice(index, 1);
      keySenders.delete(id);
      if (activeTabId.value === id) {
        activeTabId.value = tabs.value[0]?.id || null;
      }
    }

    // Update session storage
    if (tabs.value.length === 0) {
      clearSession();
    }
  }

  function setActiveTab(id: string) {
    activeTabId.value = id;
  }

  function setAgents(list: typeof agents.value) {
    agents.value = list;
  }

  // Register a key sender for a tab
  function registerKeySender(tabId: string, sender: KeySender) {
    keySenders.set(tabId, sender);
  }

  // Unregister a key sender
  function unregisterKeySender(tabId: string) {
    keySenders.delete(tabId);
  }

  // Send a key to the active tab
  function sendKeyToActive(key: string) {
    if (activeTabId.value) {
      const sender = keySenders.get(activeTabId.value);
      if (sender) {
        sender(key);
      }
    }
  }

  // Get the last active tab from saved session
  function getLastActiveTab(): Tab | null {
    const session = loadSession();
    if (session && session.activeTabId) {
      return session.tabs.find(t => t.id === session.activeTabId) || null;
    }
    return null;
  }

  // Clear all session data (used on logout)
  function clearAll() {
    tabs.value = [];
    activeTabId.value = null;
    historyTabs.value = [];
    keySenders.clear();
    clearSession();
  }

  return {
    tabs,
    activeTabId,
    agents,
    historyTabs,
    addTab,
    removeTab,
    setActiveTab,
    setAgents,
    registerKeySender,
    unregisterKeySender,
    sendKeyToActive,
    getLastActiveTab,
    clearAll,
  };
});