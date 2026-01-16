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
    message.warning('Please select at least 2 files to merge')
    return
  }

  try {
    await bookmarkStore.mergeFiles(selectedFileIds.value)
    message.success(`Merged ${selectedFileIds.value.length} files successfully`)

    // Show duplicate resolution modal if duplicates found
    if (bookmarkStore.duplicates.length > 0) {
      uiStore.showDuplicateModal = true
    }
  } catch (error) {
    message.error(`Failed to merge files: ${error}`)
  }
}

const handleDelete = (fileId: string) => {
  Modal.confirm({
    title: 'Delete File',
    content: 'Are you sure you want to delete this file?',
    okText: 'Delete',
    okType: 'danger',
    onOk: () => {
      bookmarkStore.deleteFile(fileId)
      selectedFileIds.value = selectedFileIds.value.filter(id => id !== fileId)
      message.success('File deleted successfully')
    },
  })
}

const handleView = (fileId: string) => {
  bookmarkStore.activeFileId = fileId
  bookmarkStore.clearMerged()
  message.info('Viewing file')
}
</script>

<template>
  <div class="file-list-panel">
    <div class="header">
      <h3>Uploaded Files</h3>
      <a-button
        type="primary"
        size="small"
        :disabled="selectedFileIds.length < 2"
        @click="handleMerge"
      >
        Merge Selected
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
            <a-tooltip title="View">
              <a-button
                type="text"
                size="small"
                @click="handleView(item.id)"
              >
                <template #icon><eye-outlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="Delete">
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
                @change="(e) => {
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
                <span>{{ item.nodeCount }} nodes</span>
                <span>{{ item.uploadDate }}</span>
              </div>
            </template>
          </a-list-item-meta>
        </a-list-item>
      </template>
    </a-list>

    <a-empty
      v-else
      description="No files uploaded"
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
