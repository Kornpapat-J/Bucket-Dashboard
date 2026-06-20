/* global SUPABASE_CONFIG, genId, getDataUrl, getCutTargets */

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
    this._client = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
  },

  async _ensureSession() {
    if (!this._client) throw new Error('NO_CLIENT');
    const { data: { session }, error } = await this._client.auth.getSession();
    if (error) throw error;
    if (!session) throw new Error('NOT_LOGGED_IN');
    return session;
  },

  async _cloudDelete(table, id) {
    await this._ensureSession();
    const { data, error } = await this._client
      .from(table)
      .delete()
      .eq('id', id)
      .select('id');
    if (error) {
      const err = new Error(error.message || 'DELETE_FAILED');
      err.code = error.code;
      throw err;
    }
    if (!data?.length) {
      const err = new Error('DELETE_BLOCKED');
      err.code = '42501';
      throw err;
    }
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
    const cutTargets = getCutTargets({ ...all.config, ...targets });
    return {
      config: {
        ...all.config,
        ...targets,
        ...cutTargets,
        dailyTarget: cutTargets.highCutTarget + cutTargets.dropCutTarget
      },
      production: all.production.filter(r => r.date === date),
      downtime: all.downtime.filter(r => r.date === date)
    };
  },

  async getTargets(date, defaultCfg = {}) {
    const cutDefaults = getCutTargets(defaultCfg);
    const fallback = {
      highCutTarget: cutDefaults.highCutTarget,
      dropCutTarget: cutDefaults.dropCutTarget,
      dailyTarget: cutDefaults.highCutTarget + cutDefaults.dropCutTarget,
      hourlyTarget: Number(defaultCfg.hourlyTarget) || 400
    };
    if (this.isCloud() && this._client) {
      try {
        const { data, error } = await this._client
          .from('daily_targets')
          .select('daily_target, hourly_target, high_cut_target, drop_cut_target')
          .eq('date', date)
          .maybeSingle();
        if (!error && data) {
          const high = Number(data.high_cut_target);
          const drop = Number(data.drop_cut_target);
          if (high > 0 || drop > 0) {
            return {
              highCutTarget: high > 0 ? high : 0,
              dropCutTarget: drop > 0 ? drop : 0,
              dailyTarget: (high > 0 ? high : 0) + (drop > 0 ? drop : 0),
              hourlyTarget: Number(data.hourly_target) || fallback.hourlyTarget
            };
          }
          const daily = Number(data.daily_target) || fallback.dailyTarget;
          const half = Math.round(daily / 2);
          return {
            highCutTarget: half,
            dropCutTarget: daily - half,
            dailyTarget: daily,
            hourlyTarget: Number(data.hourly_target) || fallback.hourlyTarget
          };
        }
      } catch { /* table อาจยังไม่ได้สร้าง */ }
    }
    try {
      const all = JSON.parse(localStorage.getItem(TARGETS_LOCAL_KEY) || '{}');
      if (all[date]) {
        const stored = all[date];
        const cut = getCutTargets(stored);
        return {
          ...stored,
          ...cut,
          dailyTarget: cut.highCutTarget + cut.dropCutTarget,
          hourlyTarget: Number(stored.hourlyTarget) || fallback.hourlyTarget
        };
      }
    } catch { /* ignore */ }
    return fallback;
  },

  async saveTargets(date, highCutTarget, dropCutTarget) {
    const existing = await this.getTargets(date, {});
    const high = Number(highCutTarget);
    const drop = Number(dropCutTarget);
    const payload = {
      highCutTarget: high,
      dropCutTarget: drop,
      dailyTarget: high + drop,
      hourlyTarget: Number(existing.hourlyTarget) || 400
    };
    if (this.isCloud() && this._client) {
      try {
        await this._client.from('daily_targets').upsert({
          date,
          daily_target: payload.dailyTarget,
          hourly_target: payload.hourlyTarget,
          high_cut_target: payload.highCutTarget,
          drop_cut_target: payload.dropCutTarget,
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

  async updateProduction(id, data) {
    if (this.isCloud()) {
      const { data: row, error } = await this._client
        .from('production')
        .update(this._toProductionRow(data))
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      this._notify();
      return this._mapProduction(row);
    }

    const local = this._loadLocal();
    const idx = local.production.findIndex(r => r.id === id);
    if (idx < 0) throw new Error('Record not found');
    local.production[idx] = { ...local.production[idx], ...data };
    this._saveLocal(local);
    return local.production[idx];
  },

  async deleteProduction(id) {
    if (this.isCloud()) {
      await this._cloudDelete('production', id);
      this._notify();
      return;
    }

    const local = this._loadLocal();
    const before = local.production.length;
    local.production = local.production.filter(r => r.id !== id);
    if (local.production.length === before) throw new Error('Record not found');
    this._saveLocal(local);
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

  async updateDowntime(id, data) {
    if (this.isCloud()) {
      const { data: row, error } = await this._client
        .from('downtime')
        .update(this._toDowntimeRow(data))
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      this._notify();
      return this._mapDowntime(row);
    }

    const local = this._loadLocal();
    const idx = local.downtime.findIndex(r => r.id === id);
    if (idx < 0) throw new Error('Record not found');
    local.downtime[idx] = { ...local.downtime[idx], ...data };
    this._saveLocal(local);
    return local.downtime[idx];
  },

  async deleteDowntime(id) {
    if (this.isCloud()) {
      await this._cloudDelete('downtime', id);
      this._notify();
      return;
    }

    const local = this._loadLocal();
    const before = local.downtime.length;
    local.downtime = local.downtime.filter(r => r.id !== id);
    if (local.downtime.length === before) throw new Error('Record not found');
    this._saveLocal(local);
  },

  canMutateRecord(id, kind) {
    if (this.isCloud()) return true;
    const local = this._loadLocal();
    const list = kind === 'production' ? local.production : local.downtime;
    return list.some(r => r.id === id);
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
