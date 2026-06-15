/* global AUTH_CONFIG, SUPABASE_CONFIG, DataStore, showToast */

const AUTH_SESSION_KEY = 'bucket_auth_session';

const Auth = {
  _client: null,

  usesSupabaseAuth() {
    return typeof DataStore !== 'undefined' && DataStore.isCloud && DataStore.isCloud();
  },

  async getClient() {
    if (!this.usesSupabaseAuth()) return null;
    if (!this._client) {
      await DataStore.init();
      this._client = DataStore._client;
    }
    return this._client;
  },

  toEmail(username) {
    const u = username.trim().toLowerCase();
    if (u.includes('@')) return u;
    const domain = (AUTH_CONFIG && AUTH_CONFIG.emailDomain) || '@bucket.ith';
    return u + domain;
  },

  async hashPassword(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  _saveSimpleSession(username) {
    const hours = (AUTH_CONFIG && AUTH_CONFIG.sessionHours) || 12;
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({
      type: 'simple',
      user: username,
      expires: Date.now() + hours * 3600000
    }));
  },

  _getSimpleSession() {
    try {
      const raw = sessionStorage.getItem(AUTH_SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (s.expires < Date.now()) {
        sessionStorage.removeItem(AUTH_SESSION_KEY);
        return null;
      }
      return s;
    } catch {
      return null;
    }
  },

  async isLoggedIn() {
    if (this.usesSupabaseAuth()) {
      const client = await this.getClient();
      if (!client) return false;
      const { data } = await client.auth.getSession();
      return !!data.session;
    }
    const cfg = AUTH_CONFIG && AUTH_CONFIG.simpleAuth;
    if (!cfg || !cfg.enabled) return true;
    return !!this._getSimpleSession();
  },

  getUsername() {
    if (this.usesSupabaseAuth()) {
      return sessionStorage.getItem('bucket_auth_user') || 'User';
    }
    const s = this._getSimpleSession();
    return s ? s.user : null;
  },

  async login(username, password) {
    const user = username.trim();
    if (!user || !password) throw new Error('กรุณากรอก Username และ Password');

    if (this.usesSupabaseAuth()) {
      const client = await this.getClient();
      const email = this.toEmail(user);
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw new Error('Username หรือ Password ไม่ถูกต้อง');
      sessionStorage.setItem('bucket_auth_user', data.user.email.split('@')[0]);
      return { user: data.user.email };
    }

    const cfg = AUTH_CONFIG && AUTH_CONFIG.simpleAuth;
    if (!cfg || !cfg.enabled) throw new Error('ระบบ Login ปิดอยู่');

    const hash = await this.hashPassword(password);
    if (user.toLowerCase() !== cfg.username.toLowerCase() || hash !== cfg.passwordHash) {
      throw new Error('Username หรือ Password ไม่ถูกต้อง');
    }
    this._saveSimpleSession(user);
    return { user };
  },

  async logout() {
    if (this.usesSupabaseAuth()) {
      const client = await this.getClient();
      if (client) await client.auth.signOut();
    }
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    sessionStorage.removeItem('bucket_auth_user');
    window.location.href = 'login.html';
  },

  async requireAuth() {
    if (window.location.pathname.includes('login.html')) return;
    if (await this.isLoggedIn()) return;
    const page = window.location.pathname.split('/').pop() || 'index.html';
    const next = page + window.location.search;
    window.location.replace('login.html?next=' + encodeURIComponent(next));
    await new Promise(() => {});
  }
};

window.authReady = Auth.requireAuth();

async function handleLoginSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type=submit]');
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  btn.disabled = true;
  try {
    await Auth.login(form.username.value, form.password.value);
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next') || 'index.html';
    window.location.href = next;
  } catch (err) {
    errEl.textContent = err.message || 'เข้าสู่ระบบไม่สำเร็จ';
    btn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('loginForm');
  if (form) {
    await DataStore.init();
    const sub = document.getElementById('loginSubtitle');
    if (sub && DataStore.isCloud()) {
      sub.textContent = 'เข้าสู่ระบบด้วยบัญชี Supabase (Username ที่สร้างไว้ใน Dashboard)';
    }
    if (await Auth.isLoggedIn()) {
      const params = new URLSearchParams(window.location.search);
      window.location.replace(params.get('next') || 'index.html');
      return;
    }
    form.addEventListener('submit', handleLoginSubmit);
  }
});
