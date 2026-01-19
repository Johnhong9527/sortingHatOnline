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
    message.warning('请输入有效的标签名称')
    return
  }

  if (newTagName.value === editingTag.value) {
    editingTag.value = null
    return
  }

  try {
    await bookmarkStore.renameTag(editingTag.value, newTagName.value.trim())
    message.success(`标签已从 "${editingTag.value}" 重命名为 "${newTagName.value}"`)
    editingTag.value = null
    newTagName.value = ''
  } catch (error) {
    message.error(`重命名标签失败: ${error}`)
  }
}

const handleCancelRename = () => {
  editingTag.value = null
  newTagName.value = ''
}

const handleDelete = (tag: string) => {
  Modal.confirm({
    title: '删除标签',
    content: `确定要删除标签 "${tag}" 吗？这将从所有书签中移除该标签。`,
    okText: '删除',
    okType: 'danger',
    onOk: async () => {
      try {
        await bookmarkStore.deleteTag(tag)
        message.success(`标签 "${tag}" 删除成功`)
      } catch (error) {
        message.error(`删除标签失败: ${error}`)
      }
    },
  })
}

const handleFilter = (tag: string) => {
  bookmarkStore.filterByTag(tag)
  message.info(`正在按标签筛选: ${tag}`)
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
    title="标签管理"
    placement="right"
    width="400"
    @close="handleClose"
  >
    <div class="tag-management-panel">
      <a-alert
        v-if="tagList.length === 0"
        message="未找到标签"
        description="将标签添加到书签后，它们会显示在这里。"
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
              <a-tooltip title="按标签筛选">
                <a-button
                  type="text"
                  size="small"
                  @click="handleFilter(item.tag)"
                >
                  <template #icon><filter-outlined /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="重命名标签">
                <a-button
                  type="text"
                  size="small"
                  @click="handleRename(item.tag)"
                >
                  <template #icon><edit-outlined /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="删除标签">
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
                    保存
                  </a-button>
                  <a-button
                    size="small"
                    @click="handleCancelRename"
                  >
                    取消
                  </a-button>
                </div>
                <div v-else class="tag-item">
                  <a-tag color="blue">
                    <tag-outlined />
                    {{ item.tag }}
                  </a-tag>
                  <span class="tag-count">{{ item.count }} 个书签</span>
                </div>
              </template>
            </a-list-item-meta>
          </a-list-item>
        </template>
      </a-list>

      <a-divider />

      <div class="stats">
        <a-statistic
          title="标签总数"
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
