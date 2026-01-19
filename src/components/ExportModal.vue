<script setup lang="ts">
import { ref } from 'vue'
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
  { label: 'HTML (Netscape 格式)', value: 'html', description: '标准书签格式，兼容所有浏览器' },
  { label: 'JSON', value: 'json', description: '结构化数据格式，适用于程序化使用' },
  { label: 'CSV', value: 'csv', description: '电子表格格式，扁平结构' },
  { label: 'Markdown', value: 'markdown', description: '人类可读的文档格式' },
]

const generatePreview = async () => {
  try {
    isGeneratingPreview.value = true
    const content = await bookmarkStore.exportBookmarks(selectedFormat.value)

    // Show first 20 lines
    const lines = content.split('\n').slice(0, 20)
    preview.value = lines.join('\n')
    if (content.split('\n').length > 20) {
      preview.value += '\n... (已截断)'
    }
  } catch (error) {
    message.error(`生成预览失败: ${error}`)
  } finally {
    isGeneratingPreview.value = false
  }
}

const handleExport = async () => {
  try {
    const filename = `bookmarks_${Date.now()}.${selectedFormat.value}`
    await bookmarkStore.downloadExport(selectedFormat.value, filename)
    message.success('书签导出成功')
    handleClose()
  } catch (error) {
    message.error(`导出书签失败: ${error}`)
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
    title="导出书签"
    width="700px"
    @cancel="handleClose"
  >
    <template #footer>
      <a-button @click="handleClose">取消</a-button>
      <a-button @click="generatePreview" :loading="isGeneratingPreview">
        预览
      </a-button>
      <a-button type="primary" @click="handleExport">
        导出并下载
      </a-button>
    </template>

    <div class="export-content">
      <a-form layout="vertical">
        <a-form-item label="导出格式">
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

        <a-form-item v-if="preview" label="预览（前 20 行）">
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
