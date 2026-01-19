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
    message.success(`${file.name} 上传成功`)
  } catch (error) {
    message.error(`上传 ${file.name} 失败: ${error}`)
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
    <h3>上传书签</h3>
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
      <p class="ant-upload-text">点击或拖拽书签文件到此处上传</p>
      <p class="ant-upload-hint">
        支持 Netscape HTML 书签格式 (.html, .htm)
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
