import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import {
  playlistAddTracks,
  playlistCreate,
  playlistDelete,
  playlistDelTracks,
  userCloud,
  userFollowSingers,
  userHistory,
  userListen,
  userPlaylists as fetchUserPlaylists,
} from '@/api';
import { useAppStore } from './app';
import { useUserStore } from './user';

const KEY = (p) => `kg-library-${p}`;

function load(p) {
  try {
    return JSON.parse(localStorage.getItem(KEY(p)) || '{}');
  } catch {
    return {};
  }
}

/**
 * 本地资料库：喜欢、最近播放、试听列表、下载、云盘、用户歌单
 */
export const useLibraryStore = defineStore('library', () => {
  const app = useAppStore();
  const user = useUserStore();

  const state = ref({
    std: normalizeState(load('std')),
    lite: normalizeState(load('lite')),
  });

  function normalizeState(s = {}) {
    return {
      favorites: s.favorites || [],
      recent: s.recent || [],
      preview: s.preview || [],
    };
  }

  const current = computed(() => state.value[app.platform] || normalizeState());
  const favorites = computed(() => current.value.favorites);
  const recent = computed(() => current.value.recent);
  const preview = computed(() => current.value.preview);

  const userPlaylists = ref([]);
  const cloudSongs = ref([]);
  const followSingers = ref([]);
  const listenHistory = ref([]);
  const downloads = ref([]);
  const localSongs = ref([]);
  const loading = ref(false);

  function persist() {
    localStorage.setItem(KEY(app.platform), JSON.stringify(state.value[app.platform]));
  }

  watch(state, persist, { deep: true });

  function keyOf(song) {
    return `${song.hash}_${song.albumAudioId || 0}`;
  }

  function isFavorite(song) {
    if (!song) return false;
    return favorites.value.some((s) => keyOf(s) === keyOf(song));
  }

  function toggleFavorite(song) {
    if (!song) return;
    const list = [...favorites.value];
    const i = list.findIndex((s) => keyOf(s) === keyOf(song));
    if (i >= 0) {
      list.splice(i, 1);
      ElMessage({ message: '已取消喜欢', type: 'info', grouping: true });
    } else {
      list.unshift({ ...song });
      ElMessage({ message: '已添加到我喜欢', type: 'success', grouping: true });
    }
    state.value[app.platform].favorites = list;
  }

  function pushRecent(song) {
    if (!song) return;
    const list = [ { ...song, playedAt: Date.now() }, ...recent.value.filter((s) => keyOf(s) !== keyOf(song)) ];
    state.value[app.platform].recent = list.slice(0, 200);
  }

  function clearRecent() {
    state.value[app.platform].recent = [];
  }

  function addPreview(songs) {
    const list = Array.isArray(songs) ? songs : [songs];
    const exists = new Set(preview.value.map(keyOf));
    const add = list.filter((s) => !exists.has(keyOf(s))).map((s) => ({ ...s }));
    state.value[app.platform].preview = [...preview.value, ...add];
    ElMessage({ message: `已添加 ${add.length} 首到试听列表`, type: 'success', grouping: true });
  }

  function removePreview(song) {
    state.value[app.platform].preview = preview.value.filter((s) => keyOf(s) !== keyOf(song));
  }

  function clearPreview() {
    state.value[app.platform].preview = [];
  }

  async function loadUserPlaylists() {
    if (!user.isLogin) {
      userPlaylists.value = [];
      return;
    }
    loading.value = true;
    try {
      userPlaylists.value = await fetchUserPlaylists(app.platform);
    } catch (e) {
      console.warn('[library] 获取用户歌单失败', e.message);
      userPlaylists.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function loadCloud() {
    if (!user.isLogin) return;
    try {
      const res = await userCloud(app.platform, 1, 100);
      cloudSongs.value = res.songs.map((s) => ({ ...s, isCloud: true }));
    } catch {
      cloudSongs.value = [];
    }
  }

  async function loadFollowSingers() {
    if (!user.isLogin) return;
    try {
      followSingers.value = await userFollowSingers(app.platform);
    } catch {
      followSingers.value = [];
    }
  }

  async function loadListenHistory() {
    if (!user.isLogin) return;
    try {
      const res = await userHistory(app.platform);
      listenHistory.value = res.songs;
    } catch {
      listenHistory.value = [];
    }
  }

  /** 云端听歌排行（本周 = type 1，全部 = type 0） */
  const listenRank = ref([]);
  const listenRankError = ref('');
  async function loadListenRank(type = 0) {
    listenRankError.value = '';
    if (!user.isLogin) {
      listenRank.value = [];
      return;
    }
    try {
      listenRank.value = await userListen(app.platform, type);
    } catch (e) {
      listenRank.value = [];
      listenRankError.value = e?.message || '云端排行拉取失败';
    }
  }

  async function loadDownloads() {
    if (!window.kg) return;
    downloads.value = await window.kg.downloadList();
  }

  async function loadLocal() {
    if (!window.kg) return;
    const dirs = app.settings.localDirs || [];
    if (!dirs.length) {
      localSongs.value = [];
      return;
    }
    loading.value = true;
    try {
      const files = await window.kg.scanLocal(dirs);
      localSongs.value = files.map((f) => ({
        id: `local_${f.path}`,
        hash: `local_${f.path}`,
        name: f.name,
        singer: '本地音乐',
        album: '',
        duration: 0,
        cover: '',
        localPath: f.path,
        size: f.size,
      }));
    } finally {
      loading.value = false;
    }
  }

  async function createPlaylist(name) {
    const res = await playlistCreate({ name, private: 0 });
    await loadUserPlaylists();
    ElMessage({ message: '歌单创建成功', type: 'success' });
    return res;
  }

  async function deletePlaylist(id) {
    await playlistDelete({ listid: id });
    await loadUserPlaylists();
    ElMessage({ message: '歌单已删除', type: 'success' });
  }

  async function addSongsToPlaylist(listid, songs) {
    const res = await playlistAddTracks({ listid, songs });
    await loadUserPlaylists();
    return res;
  }

  async function removeSongFromPlaylist(listid, song) {
    await playlistDelTracks({ listid, songs: [{ hash: song.hash, album_audio_id: song.albumAudioId }] });
    return true;
  }

  return {
    state,
    favorites,
    recent,
    preview,
    userPlaylists,
    cloudSongs,
    followSingers,
    listenHistory,
    listenRank,
    listenRankError,
    downloads,
    localSongs,
    loading,
    keyOf,
    isFavorite,
    toggleFavorite,
    pushRecent,
    clearRecent,
    addPreview,
    removePreview,
    clearPreview,
    loadUserPlaylists,
    loadCloud,
    loadFollowSingers,
    loadListenHistory,
    loadListenRank,
    loadDownloads,
    loadLocal,
    createPlaylist,
    deletePlaylist,
    addSongsToPlaylist,
    removeSongFromPlaylist,
  };
});
