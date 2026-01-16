/**
 * IndexedDB Schema using Dexie
 * Defines the database structure for persisting bookmark data
 */

import Dexie, { Table } from 'dexie'
import type { BookmarkNode, DuplicateGroup } from '@/utils/wasmBridge'

/**
 * Stored file information
 */
export interface StoredFile {
  id: string
  name: string
  uploadDate: number
  rawHtml: string
  nodes: BookmarkNode[]
}

/**
 * Stored merged tree state
 */
export interface StoredMergedTree {
  id: string // Always 'current' for single merged tree
  nodes: BookmarkNode[]
  duplicates: DuplicateGroup[]
  createdAt: number
  updatedAt: number
}

/**
 * Stored history state for undo/redo
 */
export interface StoredHistory {
  id?: number // Auto-increment
  timestamp: number
  nodes: BookmarkNode[]
  type: 'undo' | 'redo'
}

/**
 * Tag metadata
 */
export interface StoredTag {
  name: string
  usageCount: number
  lastUsed: number
}

/**
 * Application settings
 */
export interface StoredSettings {
  key: string
  value: any
}

/**
 * Dexie Database Class
 */
export class BookmarkDatabase extends Dexie {
  // Tables
  files!: Table<StoredFile, string>
  mergedTree!: Table<StoredMergedTree, string>
  history!: Table<StoredHistory, number>
  tags!: Table<StoredTag, string>
  settings!: Table<StoredSettings, string>

  constructor() {
    super('BookmarkManagerDB')

    // Define schema
    this.version(1).stores({
      files: 'id, name, uploadDate',
      mergedTree: 'id, createdAt, updatedAt',
      history: '++id, timestamp, type',
      tags: 'name, usageCount, lastUsed',
      settings: 'key',
    })
  }
}

// Create and export database instance
export const db = new BookmarkDatabase()

// Export types
export type { Table }
