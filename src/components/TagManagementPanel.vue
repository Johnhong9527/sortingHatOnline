<script setup lang="ts">
import { ref, computed } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import { useUiStore } from '@/stores/uiStore'
import { TagOutlined, EditOutlined, DeleteOutlined, FilterOutlined } from '@ant-design/icons-vue'

const bookmarkStore = useBookmarkStore()
const uiStore = useUiStore()

const editingTag = ref<string | null>(null)
const newTagName = ref('')

// Get all tags with usage counts
const tagList = computed(() => {
  const nodes = bookmarkStore.mergedNodes.length > 0
    ? bookmarkStore.mergedNodes
    : bookmarkStore.activeFile?.nodes || []

  const tagCounts = new Map<string, number>()

  nodes.forEach(node => {
    node.tags.forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
    })
  })

  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
})

const handleRename = (oldTag: string) => {
  editingTag.value = oldTag
  newTagName.value = oldTag
}

const handleSaveRename = async () => {
  if (!editingTag.value || !newTagName.value.trim()) {
    message.warning('Please enter a valid tag name')
    return
  }

  if (newTagName.value === editingTag.value) {
    editingTag.value = null
    return
  }

  try {
    await bookmarkStore.renameTag(editingTag.value, newTagName.value.trim())
    message.success(`Tag renamed from "${editingTag.value}" to "${newTagName.value}"`)
    editingTag.value = null
    newTagName.value = ''
  } catch (error) {
    message.error(`Failed to rename tag: ${error}`)
  }
}

const handleCancelRename = () => {
  editingTag.value = null
  newTagName.value = ''
}

const handleDelete = (tag: string) => {
  Modal.confirm({
    title: 'Delete Tag',
    content: `Are you sure you want to delete the tag "${tag}"? This will remove it from all bookmarks.`,
    okText: 'Delete',
    okType: 'danger',
    onOk: async () => {
      try {
        await bookmarkStore.deleteTag(tag)
        message.success(`Tag "${tag}" deleted successfully`)
      } catch (error) {
        message.error(`Failed to delete tag: ${error}`)
      }
    },
  })
}

const handleFilter = (tag: string) => {
  bookmarkStore.filterByTag(tag)
  message.info(`Filtering by tag: ${tag}`)
  handleClose()
}

const handleClose = () => {
  uiStore.showTagPanel = false
  editingTag.value = null
  newTagName.value = ''
}
</script>

<template>
  <a-drawer
    v-model:open="uiStore.showTagPanel"
    title="Tag Management"
    placement="right"
    width="400"
    @close="handleClose"
  >
    <div class="tag-management-panel">
      <a-alert
        v-if="tagList.length === 0"
        message="No tags found"
        description="Tags will appear here once you add them to bookmarks."
        type="info"
        show-icon
        style="margin-bottom: 16px"
      />

      <a-list
        v-else
        :data-source="tagList"
        size="small"
      >
        <template #renderItem="{ item }">
          <a-list-item>
            <template #actions>
              <a-tooltip title="Filter by tag">
                <a-button
                  type="text"
                  size="small"
                  @click="handleFilter(item.tag)"
                >
                  <template #icon><filter-outlined /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="Rename tag">
                <a-button
                  type="text"
                  size="small"
                  @click="handleRename(item.tag)"
                >
                  <template #icon><edit-outlined /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="Delete tag">
                <a-button
                  type="text"
                  size="small"
                  danger
                  @click="handleDelete(item.tag)"
                >
                  <template #icon><delete-outlined /></template>
                </a-button>
              </a-tooltip>
            </template>

            <a-list-item-meta>
              <template #title>
                <div v-if="editingTag === item.tag" class="edit-mode">
                  <a-input
                    v-model:value="newTagName"
                    size="small"
                    @pressEnter="handleSaveRename"
                  />
                  <a-button
                    type="primary"
                    size="small"
                    @click="handleSaveRename"
                  >
                    Save
                  </a-button>
                  <a-button
                    size="small"
                    @click="handleCancelRename"
                  >
                    Cancel
                  </a-button>
                </div>
                <div v-else class="tag-item">
                  <a-tag color="blue">
                    <tag-outlined />
                    {{ item.tag }}
                  </a-tag>
                  <span class="tag-count">{{ item.count }} bookmark{{ item.count !== 1 ? 's' : '' }}</span>
                </div>
              </template>
            </a-list-item-meta>
          </a-list-item>
        </template>
      </a-list>

      <a-divider />

      <div class="stats">
        <a-statistic
          title="Total Tags"
          :value="tagList.length"
          :value-style="{ fontSize: '24px' }"
        />
      </div>
    </div>
  </a-drawer>
</template>

<style scoped>
.tag-management-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tag-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tag-count {
  font-size: 12px;
  color: #8c8c8c;
}

.edit-mode {
  display: flex;
  gap: 8px;
  align-items: center;
}

.stats {
  padding: 16px;
  background: #f5f5f5;
  border-radius: 8px;
  text-align: center;
}
</style>
