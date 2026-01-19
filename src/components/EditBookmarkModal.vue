<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { message } from 'ant-design-vue'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import { useUiStore } from '@/stores/uiStore'
import type { BookmarkNode } from '@/utils/wasmBridge'

const bookmarkStore = useBookmarkStore()
const uiStore = useUiStore()

const formState = ref({
  title: '',
  url: '',
  tags: [] as string[],
})

const isEditing = computed(() => uiStore.editingNode !== null)

watch(() => uiStore.editingNode, (node) => {
  if (node) {
    formState.value = {
      title: node.title,
      url: node.url || '',
      tags: [...node.tags],
    }
  } else {
    formState.value = {
      title: '',
      url: '',
      tags: [],
    }
  }
})

const handleSave = async () => {
  if (!formState.value.title.trim()) {
    message.warning('请输入标题')
    return
  }

  try {
    if (isEditing.value && uiStore.editingNode) {
      // Update existing bookmark
      await bookmarkStore.updateBookmark(uiStore.editingNode.id, {
        title: formState.value.title,
        url: formState.value.url || null,
        tags: formState.value.tags,
      })
      message.success('书签更新成功')
    } else {
      // Add new bookmark
      const newBookmark: Omit<BookmarkNode, 'id'> = {
        title: formState.value.title,
        url: formState.value.url || null,
        addDate: Date.now(),
        lastModified: Date.now(),
        tags: formState.value.tags,
        isDuplicate: false,
        children: [],
      }
      await bookmarkStore.addBookmark('root', newBookmark)
      message.success('书签添加成功')
    }
    handleClose()
  } catch (error) {
    message.error(`保存书签失败: ${error}`)
  }
}

const handleClose = () => {
  uiStore.showEditModal = false
  uiStore.editingNode = null
  formState.value = {
    title: '',
    url: '',
    tags: [],
  }
}

const allTags = computed(() => Array.from(bookmarkStore.allTags))
</script>

<template>
  <a-modal
    v-model:open="uiStore.showEditModal"
    :title="isEditing ? '编辑书签' : '添加书签'"
    @ok="handleSave"
    @cancel="handleClose"
  >
    <a-form
      :model="formState"
      layout="vertical"
      style="margin-top: 16px"
    >
      <a-form-item
        label="标题"
        required
      >
        <a-input
          v-model:value="formState.title"
          placeholder="请输入书签标题"
        />
      </a-form-item>

      <a-form-item label="URL">
        <a-input
          v-model:value="formState.url"
          placeholder="https://example.com"
        />
      </a-form-item>

      <a-form-item label="标签">
        <a-select
          v-model:value="formState.tags"
          mode="tags"
          placeholder="添加标签"
          :options="allTags.map(tag => ({ value: tag, label: tag }))"
          style="width: 100%"
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<style scoped>
</style>
