import { ref } from 'vue'

const STORAGE_KEY = 'knowledge_my_uploads'

/** 判断是否是有效 ID（非空字符串） */
function isValidId(id: unknown): id is string {
  return typeof id === 'string' && id.trim().length > 0
}

function loadFromStorage(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // ★ 清理历史遗留的 null / undefined / 空字符串
    const valid = parsed.filter(isValidId)
    if (valid.length !== parsed.length) {
      console.warn(
        `[useMyUploads] 清理了 ${parsed.length - valid.length} 个无效 ID`,
        parsed.filter((x) => !isValidId(x)),
      )
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(valid))
    }
    return valid
  } catch (err) {
    console.error('[useMyUploads] 解析 sessionStorage 失败', err)
    return []
  }
}

const uploadIds = ref<string[]>(loadFromStorage())

function saveToStorage() {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(uploadIds.value))
}

export function useMyUploads() {
  function add(id: unknown) {
    // ★ 防御：只接受非空字符串
    if (!isValidId(id)) {
      console.warn('[useMyUploads] add() 拒绝无效 ID:', id)
      return
    }
    if (!uploadIds.value.includes(id)) {
      uploadIds.value.push(id)
      saveToStorage()
    }
  }

  function remove(id: string) {
    uploadIds.value = uploadIds.value.filter((x) => x !== id)
    saveToStorage()
  }

  function clear() {
    uploadIds.value = []
    saveToStorage()
  }

  return { uploadIds, add, remove, clear }
}