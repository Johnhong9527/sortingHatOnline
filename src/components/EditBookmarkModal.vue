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
    message.warning('Please enter a title')
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
      message.success('Bookmark updated successfully')
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
      message.success('Bookmark added successfully')
    }
    handleClose()
  } catch (error) {
    message.error(`Failed to save bookmark: ${error}`)
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
    :title="isEditing ? 'Edit Bookmark' : 'Add Bookmark'"
    @ok="handleSave"
    @cancel="handleClose"
  >
    <a-form
      :model="formState"
      layout="vertical"
      style="margin-top: 16px"
    >
      <a-form-item
        label="Title"
        required
      >
        <a-input
          v-model:value="formState.title"
          placeholder="Enter bookmark title"
        />
      </a-form-item>

      <a-form-item label="URL">
        <a-input
          v-model:value="formState.url"
          placeholder="https://example.com"
        />
      </a-form-item>

      <a-form-item label="Tags">
        <a-select
          v-model:value="formState.tags"
          mode="tags"
          placeholder="Add tags"
          :options="allTags.map(tag => ({ value: tag, label: tag }))"
          style="width: 100%"
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<style scoped>
</style>
