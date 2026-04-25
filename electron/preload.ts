import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  dbQuery: (sql: string, params: any[]) => ipcRenderer.invoke('db-query', sql, params),
  migrateData: (url: string, key: string) => ipcRenderer.invoke('migrate-data', url, key),
  pickSqliteFile: () => ipcRenderer.invoke('pick-sqlite-file'),
  importSqlite: (filePath: string) => ipcRenderer.invoke('import-sqlite', filePath),
  aiGenerateDescription: (body: any) => ipcRenderer.invoke('ai-generate-description', body),
  marketResearch: (body: any) => ipcRenderer.invoke('market-research', body),
  getSetting: (key: string) => ipcRenderer.invoke('get-setting', key),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('set-setting', key, value),

  // Shopify Admin API (direct, no Supabase)
  shopifyTestAuth: () => ipcRenderer.invoke('shopify-test-auth'),
  shopifyGetLocations: () => ipcRenderer.invoke('shopify-get-locations'),
  shopifyRefreshProducts: () => ipcRenderer.invoke('shopify-refresh-products'),
  shopifySyncPreview: () => ipcRenderer.invoke('shopify-sync-preview'),
  shopifySyncExecute: (body: any) => ipcRenderer.invoke('shopify-sync-execute', body),

  // Shopify Listings (full product editor)
  shopifyLoadListings: () => ipcRenderer.invoke('shopify-load-listings'),
  shopifyGetListings: (opts: any) => ipcRenderer.invoke('shopify-get-listings', opts),
  shopifySaveListing: (opts: any) => ipcRenderer.invoke('shopify-save-listing', opts),
  shopifyDiscardListingEdits: (opts: any) => ipcRenderer.invoke('shopify-discard-listing-edits', opts),
  shopifyPushListingEdits: () => ipcRenderer.invoke('shopify-push-listing-edits'),
  shopifyExportListingsCsv: (opts: any) => ipcRenderer.invoke('shopify-export-listings-csv', opts),
  shopifyBulkUpdateListings: (opts: any) => ipcRenderer.invoke('shopify-bulk-update-listings', opts),
  shopifySaveDialog: (opts: any) => ipcRenderer.invoke('shopify-save-dialog', opts),
});
