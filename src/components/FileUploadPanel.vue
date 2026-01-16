<script setup lang="ts">
import { ref } from 'vue'
import { message } from 'ant-design-vue'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import { InboxOutlined } from '@ant-design/icons-vue'

const bookmarkStore = useBookmarkStore()
const uploading = ref(false)

const handleUpload = async (file: File) => {
  try {
    uploading.value = true
    await bookmarkStore.uploadFile(file)
    message.success(`${file.name} uploaded successfully`)
  } catch (error) {
    message.error(`Failed to upload ${file.name}: ${error}`)
  } finally {
    uploading.value = false
  }
  return false // Prevent default upload behavior
}

const customRequest = (options: any) => {
  handleUpload(options.file)
}
</script>

<template>
  <div class="file-upload-panel">
    <h3>Upload Bookmarks</h3>
    <a-upload-dragger
      name="file"
      accept=".html,.htm"
      :multiple="true"
      :custom-request="customRequest"
      :show-upload-list="false"
    >
      <p class="ant-upload-drag-icon">
        <inbox-outlined />
      </p>
      <p class="ant-upload-text">Click or drag bookmark files to upload</p>
      <p class="ant-upload-hint">
        Support for Netscape HTML bookmark format (.html, .htm)
      </p>
    </a-upload-dragger>
  </div>
</template>

<style scoped>
.file-upload-panel h3 {
  margin-bottom: 16px;
  font-size: 16px;
  font-weight: 600;
}
</style>
