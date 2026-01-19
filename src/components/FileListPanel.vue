<script setup lang="ts">
import { ref, computed } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import { useUiStore } from '@/stores/uiStore'
import { DeleteOutlined, EyeOutlined } from '@ant-design/icons-vue'

const bookmarkStore = useBookmarkStore()
const uiStore = useUiStore()

const selectedFileIds = ref<string[]>([])

const fileList = computed(() => {
  return Array.from(bookmarkStore.files.values()).map(file => ({
    id: file.id,
    name: file.name,
    uploadDate: new Date(file.uploadDate).toLocaleString(),
    nodeCount: file.nodes.length,
  }))
})

const handleMerge = async () => {
  if (selectedFileIds.value.length < 2) {
    message.warning('请至少选择 2 个文件进行合并')
    return
  }

  try {
    await bookmarkStore.mergeFiles(selectedFileIds.value)
    message.success(`成功合并 ${selectedFileIds.value.length} 个文件`)

    // Show duplicate resolution modal if duplicates found
    if (bookmarkStore.duplicates.length > 0) {
      uiStore.showDuplicateModal = true
    }
  } catch (error) {
    message.error(`合并文件失败: ${error}`)
  }
}

const handleDelete = (fileId: string) => {
  Modal.confirm({
    title: '删除文件',
    content: '确定要删除此文件吗？',
    okText: '删除',
    okType: 'danger',
    onOk: () => {
      bookmarkStore.deleteFile(fileId)
      selectedFileIds.value = selectedFileIds.value.filter(id => id !== fileId)
      message.success('文件删除成功')
    },
  })
}

const handleView = (fileId: string) => {
  bookmarkStore.activeFileId = fileId
  bookmarkStore.clearMerged()
  message.info('正在查看文件')
}
</script>

<template>
  <div class="file-list-panel">
    <div class="header">
      <h3>已上传文件</h3>
      <a-button
        type="primary"
        size="small"
        :disabled="selectedFileIds.length < 2"
        @click="handleMerge"
      >
        合并选中
      </a-button>
    </div>

    <a-list
      v-if="fileList.length > 0"
      :data-source="fileList"
      size="small"
    >
      <template #renderItem="{ item }">
        <a-list-item>
          <template #actions>
            <a-tooltip title="查看">
              <a-button
                type="text"
                size="small"
                @click="handleView(item.id)"
              >
                <template #icon><eye-outlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="删除">
              <a-button
                type="text"
                size="small"
                danger
                @click="handleDelete(item.id)"
              >
                <template #icon><delete-outlined /></template>
              </a-button>
            </a-tooltip>
          </template>

          <a-list-item-meta>
            <template #title>
              <a-checkbox
                :checked="selectedFileIds.includes(item.id)"
                @change="(e: any) => {
                  if (e.target.checked) {
                    selectedFileIds.push(item.id)
                  } else {
                    selectedFileIds = selectedFileIds.filter(id => id !== item.id)
                  }
                }"
              >
                {{ item.name }}
              </a-checkbox>
            </template>
            <template #description>
              <div class="file-info">
                <span>{{ item.nodeCount }} 个节点</span>
                <span>{{ item.uploadDate }}</span>
              </div>
            </template>
          </a-list-item-meta>
        </a-list-item>
      </template>
    </a-list>

    <a-empty
      v-else
      description="未上传文件"
    />
  </div>
</template>

<style scoped>
.file-list-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.file-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #8c8c8c;
}
</style>
