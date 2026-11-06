import { defineStore } from 'pinia';
import { ref } from 'vue';

/** 界面级状态：弹层、搜索词、主题 */
export const useUiStore = defineStore('ui', () => {
  const showLogin = ref(false);
  const loginTab = ref('qr');
  const showPlayer = ref(false);
  const showQueue = ref(false);
  const showVerify = ref(false);
  const showTheme = ref(false);
  const showAddToPlaylist = ref(false);
  const addToPlaylistSongs = ref([]);
  const showComments = ref(false);
  const commentSong = ref(null);
  const showMv = ref(false);
  const mvSong = ref(null);
  const theme = ref(localStorage.getItem('kg-theme') || 'light');
  const searchKeyword = ref('');
  const toast = ref('');
  /** 刷新令牌：变化时重新挂载当前页面，触发重新拉取数据 */
  const refreshKey = ref(0);

  function refreshPage() {
    refreshKey.value += 1;
  }

  function setTheme(t) {
    theme.value = t;
    localStorage.setItem('kg-theme', t);
    document.documentElement.dataset.theme = t;
  }

  function openMv(song) {
    if (!song) return;
    mvSong.value = song;
    showMv.value = true;
  }

  function openLogin(tab = 'qr') {
    loginTab.value = tab;
    showLogin.value = true;
  }

  function notify(msg) {
    toast.value = msg;
    setTimeout(() => {
      if (toast.value === msg) toast.value = '';
    }, 2400);
  }

  return {
    showLogin,
    loginTab,
    showPlayer,
    showQueue,
    showVerify,
    showTheme,
    showAddToPlaylist,
    addToPlaylistSongs,
    showComments,
    commentSong,
    showMv,
    mvSong,
    theme,
    searchKeyword,
    toast,
    refreshKey,
    setTheme,
    openMv,
    openLogin,
    notify,
    refreshPage,
  };
});
