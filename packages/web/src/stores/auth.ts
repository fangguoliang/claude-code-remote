import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(localStorage.getItem('accessToken'));
  const refreshToken = ref<string | null>(localStorage.getItem('refreshToken'));
  const userId = ref<number | null>(null);
  const username = ref<string | null>(null);

  const isAuthenticated = computed(() => !!accessToken.value);

  function setTokens(access: string, refresh: string, uid?: number, user?: string) {
    accessToken.value = access;
    refreshToken.value = refresh;
    if (uid) userId.value = uid;
    if (user) username.value = user;
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
  }

  function clearTokens() {
    accessToken.value = null;
    refreshToken.value = null;
    userId.value = null;
    username.value = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  async function login(user: string, pass: string, apiUrl: string) {
    const response = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password: pass }),
    });
    const data = await response.json();
    if (data.success) {
      setTokens(data.accessToken, data.refreshToken, data.userId, data.username);
      return true;
    }
    throw new Error(data.error || 'Login failed');
  }

  async function refresh(apiUrl: string) {
    if (!refreshToken.value || !userId.value) return false;
    try {
      const response = await fetch(`${apiUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refreshToken.value, userId: userId.value }),
      });
      const data = await response.json();
      if (data.success) {
        setTokens(data.accessToken, data.refreshToken);
        return true;
      }
    } catch {}
    clearTokens();
    return false;
  }

  return { accessToken, refreshToken, userId, username, isAuthenticated, setTokens, clearTokens, login, refresh };
});