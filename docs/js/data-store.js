/* global SUPABASE_CONFIG, genId, getDataUrl */

const LOCAL_KEY = 'bucket_dashboard_local';
const TARGETS_LOCAL_KEY = 'bucket_daily_targets';

const DataStore = {
  _client: null,
  _jsonCache: null,
  _listeners: [],
  _channel: null,

  isCloud() {
    const c = window.SUPABASE_CONFIG || {};
    return c.enabled && c.url && c.anonKey &&
      !c.url.includes('YOUR_PROJECT') && !c.anonKey.includes('YOUR_ANON');
  },

  async init() {
    if (!this.isCloud()) return;
    if (typeof supabase === 'undefined') {
      console.warn('Supabase JS not loaded');
      return;
    }
    this._client = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  },

  onChange(fn) {
    this._listeners.push(fn);
  },

  _notify() {
    this._listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  },

  subscribeRealtime() {
    if (!this.isCloud() || !this._client || this._channel) return;
    const reload = () => this._notify();
    this._channel = this._client
      .channel('bucket-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'downtime' }, reload)
      .subscribe();
  },

  async _loadJson() {
    if (this._jsonCache) return this._jsonCache;
    const res = await fetch(getDataUrl());
    if (!res.ok) throw new Error('Failed to load data/records.json');
    this._jsonCache = await res.json();
    return this._jsonCache;
  },

  _loadLocal() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      return raw ? JSON.parse(raw) : { production: [], downtime: [] };
    } catch {
      return { production: [], downtime: [] };
    }
  },

  _saveLocal(local) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify({
      production: local.production,
      downtime: local.downtime
    }));
  },

  _mapProduction(row) {
    return {
      id: row.id,
      date: row.date,
      shift: row.shift,
      bucketId: row.bucket_id,
      operatorName: row.operator_name,
      startTime: row.start_time,
      endTime: row.end_time,
      volumeBCM: Number(row.volume_bcm),
      location: row.location || '',
      note: row.note || '',
      createdAt: row.created_at
    };
  },

  _mapDowntime(row) {
    return {
      id: row.id,
      date: row.date,
      shift: row.shift,
      bucketId: row.bucket_id,
      startTime: row.start_time,
      endTime: row.end_time || '',
      type: row.type,
      description: row.description,
      ongoing: row.ongoing,
      createdAt: row.created_at
    };
  },

  _toProductionRow(data) {
    return {
      date: data.date,
      shift: data.shift,
      bucket_id: data.bucketId,
      operator_name: data.operatorName,
      start_time: data.startTime,
      end_time: data.endTime,
      volume_bcm: data.volumeBCM,
      location: data.location || '',
      note: data.note || ''
    };
  },

  _toDowntimeRow(data) {
    return {
      date: data.date,
      shift: data.shift,
      bucket_id: data.bucketId,
      start_time: data.startTime,
      end_time: data.endTime || '',
      type: data.type,
      description: data.description,
      ongoing: !!data.ongoing
    };
  },

  async _fetchCloudProduction() {
    const { data, error } = await this._client.from('production').select('*').order('created_at');
    if (error) throw error;
    return (data || []).map(r => this._mapProduction(r));
  },

  async _fetchCloudDowntime() {
    const { data, error } = await this._client.from('downtime').select('*').order('created_at');
    if (error) throw error;
    return (data || []).map(r => this._mapDowntime(r));
  },

  async getData() {
    const json = await this._loadJson();
    const config = json.config || {};

    if (this.isCloud()) {
      const [production, downtime] = await Promise.all([
        this._fetchCloudProduction(),
        this._fetchCloudDowntime()
      ]);
      return { config, production, downtime };
    }

    const local = this._loadLocal();
    return {
      config,
      production: [...(json.production || []), ...(local.production || [])],
      downtime: [...(json.downtime || []), ...(local.downtime || [])]
    };
  },

  async getByDate(date) {
    const all = await this.getData();
    const targets = await this.getTargets(date, all.config || {});
    return {
      config: { ...all.config, dailyTarget: targets.dailyTarget, hourlyTarget: targets.hourlyTarget },
      production: all.production.filter(r => r.date === date),
      downtime: all.downtime.filter(r => r.date === date)
    };
  },

  async getTargets(date, defaultCfg = {}) {
    const fallback = {
      dailyTarget: Number(defaultCfg.dailyTarget) || 5000,
      hourlyTarget: Number(defaultCfg.hourlyTarget) || 400
    };
    if (this.isCloud() && this._client) {
      try {
        const { data, error } = await this._client
          .from('daily_targets')
          .select('daily_target, hourly_target')
          .eq('date', date)
          .maybeSingle();
        if (!error && data) {
          return {
            dailyTarget: Number(data.daily_target),
            hourlyTarget: Number(data.hourly_target)
          };
        }
      } catch { /* table อาจยังไม่ได้สร้าง */ }
    }
    try {
      const all = JSON.parse(localStorage.getItem(TARGETS_LOCAL_KEY) || '{}');
      if (all[date]) return all[date];
    } catch { /* ignore */ }
    return fallback;
  },

  async saveTargets(date, dailyTarget, hourlyTarget) {
    const payload = {
      dailyTarget: Number(dailyTarget),
      hourlyTarget: Number(hourlyTarget)
    };
    if (this.isCloud() && this._client) {
      try {
        await this._client.from('daily_targets').upsert({
          date,
          daily_target: payload.dailyTarget,
          hourly_target: payload.hourlyTarget,
          updated_at: new Date().toISOString()
        });
      } catch { /* fallback local */ }
    }
    const all = JSON.parse(localStorage.getItem(TARGETS_LOCAL_KEY) || '{}');
    all[date] = payload;
    localStorage.setItem(TARGETS_LOCAL_KEY, JSON.stringify(all));
    return payload;
  },

  async addProduction(data) {
    if (this.isCloud()) {
      const { data: row, error } = await this._client
        .from('production')
        .insert(this._toProductionRow(data))
        .select()
        .single();
      if (error) throw error;
      return this._mapProduction(row);
    }

    const local = this._loadLocal();
    const record = { id: genId(), createdAt: new Date().toISOString(), ...data };
    local.production.push(record);
    this._saveLocal(local);
    return record;
  },

  async addDowntime(data) {
    if (this.isCloud()) {
      const { data: row, error } = await this._client
        .from('downtime')
        .insert(this._toDowntimeRow(data))
        .select()
        .single();
      if (error) throw error;
      return this._mapDowntime(row);
    }

    const local = this._loadLocal();
    const record = { id: genId(), createdAt: new Date().toISOString(), ...data };
    local.downtime.push(record);
    this._saveLocal(local);
    return record;
  },

  async exportMergedJson() {
    const data = await this.getData();
    return JSON.stringify({
      config: data.config,
      production: data.production,
      downtime: data.downtime
    }, null, 2);
  },

  getLocalCount() {
    if (this.isCloud()) return 0;
    const local = this._loadLocal();
    return (local.production?.length || 0) + (local.downtime?.length || 0);
  },

  clearLocal() {
    localStorage.removeItem(LOCAL_KEY);
    this._jsonCache = null;
  },

  getModeLabel() {
    return this.isCloud() ? 'cloud' : 'local';
  }
};

const API = DataStore;
