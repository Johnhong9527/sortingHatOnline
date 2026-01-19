<script setup lang="ts">
import { ref, computed } from 'vue'
import { message } from 'ant-design-vue'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import { useUiStore } from '@/stores/uiStore'
import type { DuplicateGroup } from '@/utils/wasmBridge'

const bookmarkStore = useBookmarkStore()
const uiStore = useUiStore()

const selectedNodes = ref<Map<string, string>>(new Map()) // url -> nodeId

const duplicateGroups = computed(() => bookmarkStore.duplicates)

const handleResolve = async (group: DuplicateGroup) => {
  const selectedNodeId = selectedNodes.value.get(group.url)
  if (!selectedNodeId) {
    message.warning('Please select a bookmark to keep')
    return
  }

  try {
    await bookmarkStore.resolveDuplicate(group, selectedNodeId)
    message.success('Duplicate resolved')
    selectedNodes.value.delete(group.url)
  } catch (error) {
    message.error(`Failed to resolve duplicate: ${error}`)
  }
}

const handleResolveAll = async () => {
  for (const group of duplicateGroups.value) {
    // Keep the newest bookmark by default
    const newestNode = group.nodes.reduce((prev, current) =>
      current.addDate > prev.addDate ? current : prev
    )
    await bookmarkStore.resolveDuplicate(group, newestNode.id)
  }
  message.success('All duplicates resolved')
  handleClose()
}

const handleClose = () => {
  uiStore.showDuplicateModal = false
  selectedNodes.value.clear()
}

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleString()
}
</script>

<template>
  <a-modal
    v-model:open="uiStore.showDuplicateModal"
    title="Resolve Duplicate Bookmarks"
    width="800px"
    @cancel="handleClose"
  >
    <template #footer>
      <a-button @click="handleClose">Close</a-button>
      <a-button
        type="primary"
        :disabled="duplicateGroups.length === 0"
        @click="handleResolveAll"
      >
        Resolve All (Keep Newest)
      </a-button>
    </template>

    <div class="duplicate-list">
      <a-alert
        v-if="duplicateGroups.length > 0"
        message="Duplicate bookmarks detected"
        :description="`Found ${duplicateGroups.length} duplicate URL(s). Select which bookmark to keep for each duplicate.`"
        type="warning"
        show-icon
        style="margin-bottom: 16px"
      />

      <a-empty
        v-if="duplicateGroups.length === 0"
        description="No duplicates found"
      />

      <a-card
        v-for="group in duplicateGroups"
        :key="group.url"
        :title="group.url"
        size="small"
        style="margin-bottom: 16px"
      >
        <a-radio-group
          :value="selectedNodes.get(group.url)"
          @update:value="(val: string) => selectedNodes.set(group.url, val)"
          style="width: 100%"
        >
          <a-space direction="vertical" style="width: 100%">
            <a-radio
              v-for="node in group.nodes"
              :key="node.id"
              :value="node.id"
              style="width: 100%"
            >
              <div class="bookmark-option">
                <div class="bookmark-title">{{ node.title }}</div>
                <div class="bookmark-meta">
                  <span>Added: {{ formatDate(node.addDate) }}</span>
                  <span v-if="node.tags.length > 0">
                    Tags: {{ node.tags.join(', ') }}
                  </span>
                </div>
              </div>
            </a-radio>
          </a-space>
        </a-radio-group>

        <template #extra>
          <a-button
            size="small"
            type="primary"
            @click="handleResolve(group)"
          >
            Resolve
          </a-button>
        </template>
      </a-card>
    </div>
  </a-modal>
</template>

<style scoped>
.duplicate-list {
  max-height: 600px;
  overflow-y: auto;
}

.bookmark-option {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bookmark-title {
  font-weight: 500;
  color: #262626;
}

.bookmark-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #8c8c8c;
}
</style>
