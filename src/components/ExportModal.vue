<script setup lang="ts">
import { ref, computed } from 'vue'
import { message } from 'ant-design-vue'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import { useUiStore } from '@/stores/uiStore'
import type { ExportFormat } from '@/utils/wasmBridge'

const bookmarkStore = useBookmarkStore()
const uiStore = useUiStore()

const selectedFormat = ref<ExportFormat>('html')
const preview = ref('')
const isGeneratingPreview = ref(false)

const formatOptions = [
  { label: 'HTML (Netscape Format)', value: 'html', description: 'Standard bookmark format compatible with all browsers' },
  { label: 'JSON', value: 'json', description: 'Structured data format for programmatic use' },
  { label: 'CSV', value: 'csv', description: 'Spreadsheet format with flat structure' },
  { label: 'Markdown', value: 'markdown', description: 'Human-readable documentation format' },
]

const generatePreview = async () => {
  try {
    isGeneratingPreview.value = true
    const content = await bookmarkStore.exportBookmarks(selectedFormat.value)

    // Show first 20 lines
    const lines = content.split('\n').slice(0, 20)
    preview.value = lines.join('\n')
    if (content.split('\n').length > 20) {
      preview.value += '\n... (truncated)'
    }
  } catch (error) {
    message.error(`Failed to generate preview: ${error}`)
  } finally {
    isGeneratingPreview.value = false
  }
}

const handleExport = async () => {
  try {
    const filename = `bookmarks_${Date.now()}.${selectedFormat.value}`
    await bookmarkStore.downloadExport(selectedFormat.value, filename)
    message.success('Bookmarks exported successfully')
    handleClose()
  } catch (error) {
    message.error(`Failed to export bookmarks: ${error}`)
  }
}

const handleClose = () => {
  uiStore.showExportModal = false
  preview.value = ''
}

const handleFormatChange = () => {
  preview.value = ''
}
</script>

<template>
  <a-modal
    v-model:open="uiStore.showExportModal"
    title="Export Bookmarks"
    width="700px"
    @cancel="handleClose"
  >
    <template #footer>
      <a-button @click="handleClose">Cancel</a-button>
      <a-button @click="generatePreview" :loading="isGeneratingPreview">
        Preview
      </a-button>
      <a-button type="primary" @click="handleExport">
        Export & Download
      </a-button>
    </template>

    <div class="export-content">
      <a-form layout="vertical">
        <a-form-item label="Export Format">
          <a-radio-group
            v-model:value="selectedFormat"
            @change="handleFormatChange"
          >
            <a-space direction="vertical" style="width: 100%">
              <a-radio
                v-for="option in formatOptions"
                :key="option.value"
                :value="option.value"
              >
                <div class="format-option">
                  <div class="format-label">{{ option.label }}</div>
                  <div class="format-description">{{ option.description }}</div>
                </div>
              </a-radio>
            </a-space>
          </a-radio-group>
        </a-form-item>

        <a-form-item v-if="preview" label="Preview (first 20 lines)">
          <a-textarea
            v-model:value="preview"
            :rows="10"
            readonly
            style="font-family: monospace; font-size: 12px"
          />
        </a-form-item>
      </a-form>
    </div>
  </a-modal>
</template>

<style scoped>
.export-content {
  padding: 16px 0;
}

.format-option {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.format-label {
  font-weight: 500;
  color: #262626;
}

.format-description {
  font-size: 12px;
  color: #8c8c8c;
}
</style>
