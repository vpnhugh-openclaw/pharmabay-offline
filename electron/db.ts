import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

// Store DB in the user data directory
const dbPath = path.join(app.getPath('userData'), 'pharmabay.sqlite');
const db = new Database(dbPath, { verbose: process.env.NODE_ENV === 'development' ? console.log : undefined });

// Basic initialization
export function initDB() {
  db.pragma('journal_mode = WAL');

  const schema = `
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      source_product_name TEXT,
      normalized_product_name TEXT,
      barcode TEXT,
      sku TEXT,
      brand TEXT,
      supplier TEXT,
      department TEXT,
      z_category TEXT,
      internal_category TEXT,
      product_type TEXT,
      product_form TEXT,
      strength TEXT,
      size_value TEXT,
      pack_size TEXT,
      flavour TEXT,
      variant TEXT,
      ingredients_summary TEXT,
      directions_summary TEXT,
      warnings_summary TEXT,
      claims_summary TEXT,
      artg_number TEXT,
      cost_price REAL,
      sell_price REAL,
      stock_on_hand REAL,
      stock_value REAL,
      units_sold_12m INTEGER,
      units_purchased_12m INTEGER,
      total_sales_value_12m REAL,
      total_cogs_12m REAL,
      gross_profit_percent REAL,
      last_purchased_at TEXT,
      last_sold_at TEXT,
      weight_grams INTEGER DEFAULT 200,
      quantity_reserved_for_store INTEGER DEFAULT 0,
      quantity_available_for_ebay INTEGER,
      quantity_available_for_shopify INTEGER,
      compliance_status TEXT,
      enrichment_status TEXT,
      enrichment_confidence TEXT,
      enrichment_summary TEXT,
      source_links TEXT,
      notes_internal TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inventory_snapshots (
      id TEXT PRIMARY KEY,
      product_id TEXT,
      snapshot_date TEXT,
      stock_on_hand REAL,
      sell_price REAL,
      cost_price REAL,
      stock_value REAL,
      units_sold_12m INTEGER,
      source_batch_id TEXT,
      FOREIGN KEY(product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS import_batches (
      id TEXT PRIMARY KEY,
      filename TEXT,
      imported_at TEXT DEFAULT CURRENT_TIMESTAMP,
      imported_by TEXT,
      row_count INTEGER,
      new_count INTEGER,
      updated_count INTEGER,
      skipped_count INTEGER,
      error_count INTEGER,
      import_notes TEXT,
      raw_file_path TEXT
    );

    CREATE TABLE IF NOT EXISTS product_images (
      id TEXT PRIMARY KEY,
      product_id TEXT,
      source_type TEXT,
      source_page_url TEXT,
      original_url TEXT,
      local_storage_url TEXT,
      local_storage_path TEXT,
      width INTEGER,
      height INTEGER,
      alt_text TEXT,
      image_status TEXT,
      is_primary INTEGER DEFAULT 0,
      sort_order INTEGER,
      ebay_approved INTEGER DEFAULT 0,
      shopify_approved INTEGER DEFAULT 0,
      shopify_media_gid TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS ebay_drafts (
      id TEXT PRIMARY KEY,
      product_id TEXT,
      title TEXT,
      subtitle TEXT,
      description_html TEXT,
      description_plain TEXT,
      category_id TEXT,
      category_name TEXT,
      condition_id TEXT DEFAULT '1000',
      brand TEXT,
      mpn TEXT,
      epid TEXT,
      upc TEXT,
      ean TEXT,
      item_specifics TEXT,
      image_urls TEXT,
      quantity INTEGER,
      pricing_mode TEXT,
      start_price REAL,
      buy_it_now_price REAL,
      shipping_profile TEXT,
      return_profile TEXT,
      payment_profile TEXT,
      channel_status TEXT,
      validation_status TEXT,
      validation_errors TEXT,
      published_listing_id TEXT,
      created_by TEXT,
      approved_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS shopify_drafts (
      id TEXT PRIMARY KEY,
      product_id TEXT,
      shopify_product_gid TEXT,
      handle TEXT,
      title TEXT,
      description_html TEXT,
      vendor TEXT,
      product_category TEXT,
      product_type TEXT,
      tags TEXT,
      published_online_store INTEGER,
      status TEXT,
      seo_title TEXT,
      seo_description TEXT,
      google_product_category TEXT,
      google_gender TEXT,
      google_age_group TEXT,
      google_mpn TEXT,
      google_ad_group_name TEXT,
      google_ads_labels TEXT,
      google_condition TEXT,
      google_custom_product INTEGER,
      google_custom_label_0 TEXT,
      google_custom_label_1 TEXT,
      google_custom_label_2 TEXT,
      google_custom_label_3 TEXT,
      google_custom_label_4 TEXT,
      channel_status TEXT,
      validation_status TEXT,
      validation_errors TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS shopify_products_cache (
      id TEXT PRIMARY KEY,
      shopify_product_id INTEGER,
      shopify_variant_id INTEGER,
      title TEXT,
      handle TEXT,
      status TEXT,
      vendor TEXT,
      product_type TEXT,
      sku TEXT,
      barcode TEXT,
      price TEXT,
      inventory_item_id INTEGER,
      inventory_quantity INTEGER,
      variant_title TEXT,
      body_html TEXT,
      tags TEXT,
      cached_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stock_sync_runs (
      id TEXT PRIMARY KEY,
      started_at TEXT DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'preview_complete',
      reserve_buffer INTEGER DEFAULT 0,
      inventory_sync_mode TEXT DEFAULT 'stock_minus_buffer',
      max_qty_cap INTEGER,
      total_items INTEGER DEFAULT 0,
      matched INTEGER DEFAULT 0,
      update_needed INTEGER DEFAULT 0,
      no_match INTEGER DEFAULT 0,
      synced INTEGER DEFAULT 0,
      failed INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS shopify_listings (
      id TEXT PRIMARY KEY,
      shopify_id INTEGER UNIQUE,
      data_json TEXT,
      edited_json TEXT,
      has_edits INTEGER DEFAULT 0,
      cached_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stock_sync_items (
      id TEXT PRIMARY KEY,
      sync_run_id TEXT,
      local_product_id TEXT,
      local_product_name TEXT,
      local_barcode TEXT,
      local_sku TEXT,
      local_stock_on_hand INTEGER,
      quantity_to_push INTEGER,
      shopify_product_id INTEGER,
      shopify_variant_id INTEGER,
      shopify_inventory_item_id INTEGER,
      shopify_product_title TEXT,
      shopify_variant_title TEXT,
      current_shopify_qty INTEGER,
      qty_difference INTEGER,
      match_type TEXT,
      match_confidence TEXT,
      sync_status TEXT DEFAULT 'pending',
      error_message TEXT,
      synced_at TEXT,
      FOREIGN KEY(sync_run_id) REFERENCES stock_sync_runs(id)
    );
  `;

  db.exec(schema);
}

export function query(sql: string, params: any[] = []) {
  if (sql.trim().toUpperCase().startsWith('SELECT')) {
    return db.prepare(sql).all(...params);
  } else {
    return db.prepare(sql).run(...params);
  }
}

export { db };
