# Multi-Session Restoration Design

**Date**: 2026-03-22
**Status**: Draft

## Problem Statement

Currently, after page refresh or re-login, only ONE active terminal session is restored. Users who have multiple active terminal sessions lose all but the most recent one. The requirement is to restore ALL active sessions that existed before refresh/login.

## Current Behavior

1. **Page refresh**: `sessionStorage` stores all tabs, but `getLastActiveTab()` returns only the active tab
2. **New login**: `localStorage` history stores recent tabs, but `getLastHistoryTab()` returns only the most recent one

## Proposed Solution

Modify the restoration logic to restore ALL tabs instead of just one.

## Changes

### 1. terminal.ts - Add new functions

Add two new functions to retrieve all restorable tabs:

```typescript
// Get all session tabs for multi-session restoration (page refresh)
function getAllSessionTabs(): Tab[] {
  const session = loadSessionData();
  return session?.tabs || [];
}

// Get all history tabs for multi-session restoration (login)
function getAllHistoryTabsForRestore(): Tab[] {
  return historyTabs.value;
}
```

Export these functions in the store's return statement.

### 2. TerminalView.vue - Modify restoreLastSession()

Replace the current single-tab restoration with multi-tab restoration:

```typescript
function restoreLastSession() {
  // Priority: 1) sessionStorage (page refresh), 2) localStorage history (login)
  let tabsToRestore = terminalStore.getAllSessionTabs();

  if (tabsToRestore.length === 0) {
    tabsToRestore = terminalStore.getAllHistoryTabsForRestore();
  }

  if (tabsToRestore.length === 0) return;

  for (const tab of tabsToRestore) {
    const agent = agents.value.find(a => a.agentId === tab.agentId);
    // Restore tab regardless of agent online status
    // TerminalTab will show "disconnected" state for offline agents
    terminalStore.restoreTab(tab);
  }
}
```

### 3. TerminalTab.vue - No changes needed

The existing implementation already handles offline agents:
- Shows "connecting" → "disconnected" status
- `session:resumed` failure triggers new session creation when agent comes online

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Agent offline | Tab is created, shows "disconnected" state, will connect when agent comes online |
| Session expired on server | `session:resumed` fails, new session is created automatically |
| Multiple tabs, some with same agent | All tabs restored independently |
| No previous sessions | Empty state shown, no restoration |

## Testing Checklist

- [ ] Refresh page with 2+ active sessions → all sessions restored
- [ ] Login with history of 2+ sessions → all sessions restored
- [ ] Refresh with offline agent → tab created in disconnected state
- [ ] Resume fails (session expired) → new session created
- [ ] Active tab is preserved after restoration

## Implementation Notes

- The `activeTabId` from sessionStorage is preserved, so the correct tab remains active after restoration
- `restoreTab()` already checks for duplicate tabs by `sessionId`, preventing duplicates
- History tabs are kept in localStorage (max 10), providing reasonable limit for restoration