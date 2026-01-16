/**
 * Repository Layer for IndexedDB Operations
 * Provides CRUD operations for bookmark data persistence
 */

import { db, type StoredFile, type StoredMergedTree, type StoredHistory, type StoredTag } from './schema'
import type { BookmarkNode, DuplicateGroup } from '@/utils/wasmBridge'

/**
 * File Repository
 */
export const fileRepository = {
  /**
   * Save a file to the database
   */
  async saveFile(file: StoredFile): Promise<void> {
    await db.files.put(file)
  },

  /**
   * Get a file by ID
   */
  async getFile(id: string): Promise<StoredFile | undefined> {
    return await db.files.get(id)
  },

  /**
   * Get all files
   */
  async getAllFiles(): Promise<StoredFile[]> {
    return await db.files.orderBy('uploadDate').reverse().toArray()
  },

  /**
   * Delete a file
   */
  async deleteFile(id: string): Promise<void> {
    await db.files.delete(id)
  },

  /**
   * Clear all files
   */
  async clearAllFiles(): Promise<void> {
    await db.files.clear()
  },

  /**
   * Get file count
   */
  async getFileCount(): Promise<number> {
    return await db.files.count()
  },
}

/**
 * Merged Tree Repository
 */
export const mergedTreeRepository = {
  /**
   * Save merged tree state
   */
  async saveMergedTree(nodes: BookmarkNode[], duplicates: DuplicateGroup[]): Promise<void> {
    const now = Date.now()
    const existing = await db.mergedTree.get('current')

    await db.mergedTree.put({
      id: 'current',
      nodes,
      duplicates,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    })
  },

  /**
   * Get merged tree state
   */
  async getMergedTree(): Promise<StoredMergedTree | undefined> {
    return await db.mergedTree.get('current')
  },

  /**
   * Clear merged tree
   */
  async clearMergedTree(): Promise<void> {
    await db.mergedTree.delete('current')
  },
}

/**
 * History Repository
 */
export const historyRepository = {
  /**
   * Save history state
   */
  async saveHistory(nodes: BookmarkNode[], type: 'undo' | 'redo'): Promise<void> {
    await db.history.add({
      timestamp: Date.now(),
      nodes,
      type,
    })

    // Keep only last 50 history entries
    const count = await db.history.count()
    if (count > 50) {
      const oldest = await db.history.orderBy('timestamp').first()
      if (oldest?.id) {
        await db.history.delete(oldest.id)
      }
    }
  },

  /**
   * Get all history entries
   */
  async getAllHistory(): Promise<StoredHistory[]> {
    return await db.history.orderBy('timestamp').toArray()
  },

  /**
   * Get recent history entries
   */
  async getRecentHistory(limit: number = 10): Promise<StoredHistory[]> {
    return await db.history.orderBy('timestamp').reverse().limit(limit).toArray()
  },

  /**
   * Clear all history
   */
  async clearHistory(): Promise<void> {
    await db.history.clear()
  },

  /**
   * Get history count
   */
  async getHistoryCount(): Promise<number> {
    return await db.history.count()
  },
}

/**
 * Tag Repository
 */
export const tagRepository = {
  /**
   * Update tag metadata
   */
  async updateTag(name: string, usageCount: number): Promise<void> {
    await db.tags.put({
      name,
      usageCount,
      lastUsed: Date.now(),
    })
  },

  /**
   * Update multiple tags
   */
  async updateTags(tags: Map<string, number>): Promise<void> {
    const now = Date.now()
    const tagArray = Array.from(tags.entries()).map(([name, usageCount]) => ({
      name,
      usageCount,
      lastUsed: now,
    }))

    await db.tags.bulkPut(tagArray)
  },

  /**
   * Get tag by name
   */
  async getTag(name: string): Promise<StoredTag | undefined> {
    return await db.tags.get(name)
  },

  /**
   * Get all tags
   */
  async getAllTags(): Promise<StoredTag[]> {
    return await db.tags.orderBy('usageCount').reverse().toArray()
  },

  /**
   * Get popular tags
   */
  async getPopularTags(limit: number = 10): Promise<StoredTag[]> {
    return await db.tags.orderBy('usageCount').reverse().limit(limit).toArray()
  },

  /**
   * Delete a tag
   */
  async deleteTag(name: string): Promise<void> {
    await db.tags.delete(name)
  },

  /**
   * Clear all tags
   */
  async clearAllTags(): Promise<void> {
    await db.tags.clear()
  },
}

/**
 * Settings Repository
 */
export const settingsRepository = {
  /**
   * Save a setting
   */
  async saveSetting(key: string, value: any): Promise<void> {
    await db.settings.put({ key, value })
  },

  /**
   * Get a setting
   */
  async getSetting<T = any>(key: string): Promise<T | undefined> {
    const setting = await db.settings.get(key)
    return setting?.value as T | undefined
  },

  /**
   * Delete a setting
   */
  async deleteSetting(key: string): Promise<void> {
    await db.settings.delete(key)
  },

  /**
   * Clear all settings
   */
  async clearAllSettings(): Promise<void> {
    await db.settings.clear()
  },
}

/**
 * Database Utilities
 */
export const dbUtils = {
  /**
   * Clear entire database
   */
  async clearDatabase(): Promise<void> {
    await db.files.clear()
    await db.mergedTree.clear()
    await db.history.clear()
    await db.tags.clear()
    await db.settings.clear()
  },

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    fileCount: number
    historyCount: number
    tagCount: number
    hasMergedTree: boolean
  }> {
    const [fileCount, historyCount, tagCount, mergedTree] = await Promise.all([
      db.files.count(),
      db.history.count(),
      db.tags.count(),
      db.mergedTree.get('current'),
    ])

    return {
      fileCount,
      historyCount,
      tagCount,
      hasMergedTree: !!mergedTree,
    }
  },

  /**
   * Export database to JSON
   */
  async exportToJSON(): Promise<string> {
    const [files, mergedTree, history, tags, settings] = await Promise.all([
      db.files.toArray(),
      db.mergedTree.toArray(),
      db.history.toArray(),
      db.tags.toArray(),
      db.settings.toArray(),
    ])

    return JSON.stringify(
      {
        version: 1,
        exportDate: new Date().toISOString(),
        data: {
          files,
          mergedTree,
          history,
          tags,
          settings,
        },
      },
      null,
      2
    )
  },

  /**
   * Import database from JSON
   */
  async importFromJSON(json: string): Promise<void> {
    const data = JSON.parse(json)

    if (data.version !== 1) {
      throw new Error('Unsupported database version')
    }

    // Clear existing data
    await this.clearDatabase()

    // Import data
    if (data.data.files) await db.files.bulkAdd(data.data.files)
    if (data.data.mergedTree) await db.mergedTree.bulkAdd(data.data.mergedTree)
    if (data.data.history) await db.history.bulkAdd(data.data.history)
    if (data.data.tags) await db.tags.bulkAdd(data.data.tags)
    if (data.data.settings) await db.settings.bulkAdd(data.data.settings)
  },
}

/**
 * Export all repositories
 */
export const repository = {
  files: fileRepository,
  mergedTree: mergedTreeRepository,
  history: historyRepository,
  tags: tagRepository,
  settings: settingsRepository,
  utils: dbUtils,
}
