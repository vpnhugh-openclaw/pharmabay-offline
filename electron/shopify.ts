/**
 * Shopify Admin API client for Electron main process.
 * Authenticates via Client ID + Client Secret (client_credentials grant),
 * caches the short-lived token in local SQLite settings, and throttles
 * to stay under the 2-per-second leaky-bucket rate limit.
 */

import { db } from './db.js';

// ─── helpers ────────────────────────────────────────────────────────────────

function getSetting(key: string): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
  return row?.value ?? '';
}

function setSetting(key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

function cleanStore(url: string): string {
  return url.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Normalise a SKU or barcode for index lookups:
 * strip leading/trailing quotes and whitespace, remove spaces,
 * strip trailing ".0" on numeric values, uppercase.
 */
export function normalizeKey(value: unknown): string {
  let text = String(value ?? '').trim().replace(/^'+|'+$/g, '').trim();
  text = text.replace(/\s+/g, '');
  if (text.endsWith('.0') && /^\d+$/.test(text.slice(0, -2))) {
    text = text.slice(0, -2);
  }
  return text.toUpperCase();
}

// ─── Shopify Admin API client ────────────────────────────────────────────────

export class ShopifyAdminClient {
  private lastCallTime = 0;
  public apiCallCount = 0;

  get store(): string {
    return cleanStore(getSetting('shopify_store_url'));
  }

  get version(): string {
    return getSetting('shopify_api_version') || '2024-10';
  }

  get baseUrl(): string {
    return `https://${this.store}/admin/api/${this.version}`;
  }

  // ── token management ──────────────────────────────────────────────────────

  async ensureToken(force = false): Promise<string> {
    const token = getSetting('shopify_access_token');
    const expiresAt = parseFloat(getSetting('shopify_token_expires_at') || '0');
    if (token && !force && Date.now() / 1000 < expiresAt - 300) {
      return token;
    }

    const clientId = getSetting('shopify_client_id').trim();
    const clientSecret = getSetting('shopify_client_secret').trim();
    if (!this.store || !clientId || !clientSecret) {
      throw new Error('Enter Shopify Store URL, Client ID, and Client Secret in Settings.');
    }

    const url = `https://${this.store}/admin/oauth/access_token`;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (res.status === 401) {
      throw new Error('Shopify rejected the Client ID/Secret. Check Settings and confirm the app is installed.');
    }
    if (res.status === 403) {
      throw new Error('Shopify refused token access. Confirm the app is installed and scopes are released.');
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Token request failed — HTTP ${res.status}: ${text.substring(0, 400)}`);
    }

    const data = await res.json() as any;
    const newToken = data.access_token as string;
    if (!newToken) throw new Error('Shopify token response did not include access_token.');

    const expiresIn = parseInt(data.expires_in as string) || 86399;
    setSetting('shopify_access_token', newToken);
    setSetting('shopify_token_expires_at', String(Math.floor(Date.now() / 1000) + expiresIn));
    return newToken;
  }

  // ── HTTP helpers ──────────────────────────────────────────────────────────

  private async getHeaders(): Promise<Record<string, string>> {
    return {
      'X-Shopify-Access-Token': await this.ensureToken(),
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  private async waitRate(): Promise<void> {
    const elapsed = Date.now() - this.lastCallTime;
    if (elapsed < 550) await sleep(550 - elapsed);
  }

  async request(method: string, pathOrUrl: string, body?: unknown): Promise<Response> {
    const url = pathOrUrl.startsWith('http') ? pathOrUrl : this.baseUrl + pathOrUrl;

    for (let attempt = 0; attempt < 3; attempt++) {
      await this.waitRate();
      const res = await fetch(url, {
        method,
        headers: await this.getHeaders(),
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      this.lastCallTime = Date.now();
      this.apiCallCount++;

      if (res.status === 401 && attempt === 0) {
        setSetting('shopify_access_token', '');
        setSetting('shopify_token_expires_at', '0');
        continue;
      }
      if (res.status === 429) {
        const retryAfter = parseFloat(res.headers.get('Retry-After') ?? '2') + 1;
        await sleep(retryAfter * 1000);
        continue;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.substring(0, 500)}`);
      }
      return res;
    }
    throw new Error('Shopify API: max retries exceeded');
  }

  private nextLink(linkHeader: string | null): string | null {
    if (!linkHeader) return null;
    for (const part of linkHeader.split(',')) {
      if (part.includes('rel="next"')) {
        const match = part.match(/<([^>]+)>/);
        if (match) return match[1];
      }
    }
    return null;
  }

  async pagedGet(path: string, root: string): Promise<any[]> {
    const results: any[] = [];
    let url: string | null = this.baseUrl + path;
    while (url) {
      const res = await this.request('GET', url);
      const data = await res.json() as any;
      results.push(...(data[root] ?? []));
      url = this.nextLink(res.headers.get('Link'));
    }
    return results;
  }

  // ── Admin API endpoints ───────────────────────────────────────────────────

  async fetchAllProducts(): Promise<any[]> {
    return this.pagedGet('/products.json?limit=250', 'products');
  }

  async fetchLocations(): Promise<any[]> {
    const res = await this.request('GET', '/locations.json');
    const data = await res.json() as any;
    return data.locations ?? [];
  }

  async getProduct(productId: number | string): Promise<any> {
    const res = await this.request('GET', `/products/${productId}.json`);
    const data = await res.json() as any;
    return data.product;
  }

  async updateVariant(variantId: number | string, payload: any): Promise<any> {
    const res = await this.request('PUT', `/variants/${variantId}.json`, { variant: payload });
    const data = await res.json() as any;
    return data.variant;
  }

  async updateProduct(productId: number | string, payload: any): Promise<any> {
    const res = await this.request('PUT', `/products/${productId}.json`, { product: { id: productId, ...payload } });
    const data = await res.json() as any;
    return data.product;
  }

  async createProduct(payload: any): Promise<any> {
    const res = await this.request('POST', '/products.json', { product: payload });
    const data = await res.json() as any;
    return data.product;
  }

  async deleteProduct(productId: number | string): Promise<void> {
    await this.request('DELETE', `/products/${productId}.json`);
  }

  async setInventory(locationId: number | string, inventoryItemId: number | string, available: number): Promise<any> {
    const res = await this.request('POST', '/inventory_levels/set.json', {
      location_id: Number(locationId),
      inventory_item_id: Number(inventoryItemId),
      available,
    });
    return res.json();
  }
}
