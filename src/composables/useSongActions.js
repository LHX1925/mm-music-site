import { ElMessage } from 'element-plus';
import { copyText } from '@/utils/clipboard';
import { useAppStore } from '@/stores/app';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { useUiStore } from '@/stores/ui';
import { useUserStore } from '@/stores/user';

/** 歌曲通用操作：播放、喜欢、加入歌单、下一首播放 */
export function useSongActions() {
  const player = usePlayerStore();
  const library = useLibraryStore();
  const ui = useUiStore();
  const app = useAppStore();
  const user = useUserStore();

  function play(song, list) {
    player.play(song, list);
  }

  function playAll(list, startIndex = 0, name = '') {
    player.playAll(list, startIndex, name);
  }

  function toggleFav(song) {
    if (!song) return;
    library.toggleFavorite(song);
  }

  function playNext(song) {
    player.playNext(song);
    ElMessage({ message: '已设为下一首播放', type: 'success', grouping: true });
  }

  function addToQueue(song) {
    player.addToQueue([song]);
  }

  function openAddToPlaylist(songs) {
    if (!user.isLogin) {
      ui.openLogin();
      return;
    }
    ui.addToPlaylistSongs = Array.isArray(songs) ? songs : [songs];
    ui.showAddToPlaylist = true;
  }

  async function copyName(song) {
    const ok = await copyText(`${song.singer} - ${song.name}`);
    ElMessage({
      message: ok ? '已复制歌曲名' : '复制失败，请手动选择文本',
      type: ok ? 'success' : 'warning',
      grouping: true,
    });
  }

  return {
    player,
    library,
    ui,
    app,
    user,
    play,
    playAll,
    toggleFav,
    playNext,
    addToQueue,
    openAddToPlaylist,
    copyName,
  };
}
