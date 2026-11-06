import { ElMessage } from 'element-plus';
import { songUrl, songUrlAuth, songUrlNew } from '@/api';
import { useAppStore } from '@/stores/app';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { useUiStore } from '@/stores/ui';
import { useUserStore } from '@/stores/user';

/** 歌曲通用操作：播放、喜欢、下载、加入歌单、下一首播放 */
export function useSongActions() {
  const player = usePlayerStore();
  const library = useLibraryStore();
  const ui = useUiStore();
  const app = useAppStore();
  const user = useUserStore();

  function play(song, list) {
    player.play(song, list);
  }

  function playAll(list, startIndex = 0) {
    player.playAll(list, startIndex);
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

  /** 下载取流：普通 → 会员网关 → 风控验证 → 低音质，逐级兜底 */
  async function resolveForDownload(song) {
    const q = app.settings.quality || '320';
    let res = await songUrl(song, q, true, false).catch(() => ({}));
    if (!res.url) res = await songUrlNew(song, q, app.platform, false).catch(() => ({}));
    if (!res.url) res = await songUrlAuth(song, q).catch(() => ({}));
    if (!res.url) res = await songUrl(song, '128', true, false).catch(() => ({}));
    if (!res.url) res = await songUrl(song, '128', true, true).catch(() => ({}));
    return res;
  }

  async function download(song) {
    if (!window.kg) {
      ElMessage.warning('下载功能仅在桌面客户端可用');
      return;
    }
    if (!song) {
      ElMessage.warning('请先选择要下载的歌曲');
      return;
    }
    if (song.localPath) {
      ElMessage.info('这是本地文件，无需下载');
      return;
    }
    if (!app.settings.downloadDir) {
      ElMessage.warning('请先在设置 → 文件与下载中选择下载目录');
      return;
    }
    try {
      const res = await resolveForDownload(song);
      const urls = [res.url, ...(res.backupUrl || [])].filter(Boolean);
      if (!urls.length) {
        ElMessage.warning(`无法获取下载地址：${res.error || '该歌曲可能为 VIP 专享或已下架'}`);
        return;
      }
      const ext = (urls[0].match(/\.(mp3|flac|m4a|ogg|wav)(\?|$)/i)?.[1] || (app.settings.quality === 'flac' ? 'flac' : 'mp3')).toLowerCase();
      const filename = `${song.singer} - ${song.name}.${ext}`.replace(/[\\/:*?"<>|]/g, '_');
      ElMessage({ message: `开始下载：${song.name}`, type: 'success', grouping: true });
      const task = await window.kg.download({
        urls,
        filename,
        meta: {
          name: song.name,
          singer: song.singer,
          album: song.album,
          cover: song.cover,
          hash: song.hash,
          albumId: song.albumId,
          albumAudioId: song.albumAudioId,
          duration: song.duration,
          quality: app.settings.quality,
        },
      });
      await library.loadDownloads();
      if (task?.status === 'done') {
        ElMessage({ message: `已下载完成：${song.name}`, type: 'success', grouping: true });
      } else if (task?.status === 'error') {
        ElMessage.error(`下载失败：${task.error || '未知错误'}`);
      }
    } catch (e) {
      ElMessage.error(e.message || '下载失败');
    }
  }

  function copyName(song) {
    navigator.clipboard?.writeText(`${song.singer} - ${song.name}`);
    ElMessage({ message: '已复制歌曲名', type: 'success', grouping: true });
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
    download,
    copyName,
  };
}
