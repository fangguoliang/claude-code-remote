import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface Tab {
  id: string;
  title: string;
  agentId: string;
}

export const useTerminalStore = defineStore('terminal', () => {
  const tabs = ref<Tab[]>([]);
  const activeTabId = ref<string | null>(null);
  const agents = ref<{ agentId: string; name: string; online: boolean }[]>([]);

  function addTab(tab: Tab) {
    tabs.value.push(tab);
    activeTabId.value = tab.id;
  }

  function removeTab(id: string) {
    const index = tabs.value.findIndex(t => t.id === id);
    if (index !== -1) {
      tabs.value.splice(index, 1);
      if (activeTabId.value === id) {
        activeTabId.value = tabs.value[0]?.id || null;
      }
    }
  }

  function setActiveTab(id: string) {
    activeTabId.value = id;
  }

  function setAgents(list: typeof agents.value) {
    agents.value = list;
  }

  return { tabs, activeTabId, agents, addTab, removeTab, setActiveTab, setAgents };
});