<script setup>
import { computed, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import Icon from '@/components/common/Icon.vue';
import CoverImage from '@/components/common/CoverImage.vue';
import { useLibraryStore } from '@/stores/library';
import { useUiStore } from '@/stores/ui';

const library = useLibraryStore();
const ui = useUiStore();
const selected = ref('');
const creating = ref(false);

const songs = computed(() => ui.addToPlaylistSongs || []);
const title = computed(() => (songs.value.length > 1 ? `添加 ${songs.value.length} 首歌曲到歌单` : '添加到歌单'));

async function confirm() {
  if (!selected.value) return ElMessage.warning('请选择目标歌单');
  try {
    await library.addSongsToPlaylist(selected.value, songs.value.map((s) => ({
      name: s.name || s.raw?.SongName || s.raw?.songname || s.raw?.filename || s.raw?.FileName || '',
      hash: s.hash,
      albumId: s.albumId || s.raw?.AlbumID || s.raw?.album_id || 0,
      album_audio_id: s.albumAudioId || s.raw?.MixSongID || s.raw?.mixsongid || s.raw?.album_audio_id || 0,
    })));
    ElMessage.success('已添加到歌单');
    ui.showAddToPlaylist = false;
    selected.value = '';
  } catch (e) {
    ElMessage.error(e.message || '添加失败');
  }
}

async function create() {
  try {
    const { value } = await ElMessageBox.prompt('给你的新歌单起个名字', '新建歌单', {
      confirmButtonText: '创建',
      cancelButtonText: '取消',
      inputValue: `我的歌单 ${new Date().getMonth() + 1}/${new Date().getDate()}`,
    });
    if (!value) return;
    creating.value = true;
    await library.createPlaylist(value);
    const created = library.userPlaylists[0];
    if (created) selected.value = created.id;
  } catch (e) {
    if (e !== 'cancel' && e?.message) ElMessage.error(e.message);
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <el-dialog v-model="ui.showAddToPlaylist" :title="title" width="400" align-center append-to-body>
    <div class="songs-preview">
      <CoverImage :src="songs[0]?.cover" :size="38" :radius="6" />
      <div class="preview-text ellipsis">
        {{ songs[0]?.name }}<span v-if="songs.length > 1"> 等 {{ songs.length }} 首</span>
      </div>
    </div>

    <div class="pl-list">
      <button
        v-for="pl in library.userPlaylists"
        :key="pl.id"
        class="pl-item"
        :class="{ active: selected === pl.id }"
        @click="selected = pl.id"
      >
        <CoverImage :src="pl.cover" :size="36" :radius="5" />
        <div class="pl-meta">
          <div class="pl-name ellipsis">{{ pl.name }}</div>
          <div class="pl-sub">{{ pl.songCount || 0 }} 首</div>
        </div>
        <Icon v-if="selected === pl.id" name="check" :size="15" color="var(--kg-accent)" />
      </button>
      <div v-if="!library.userPlaylists.length" class="empty">还没有歌单，先创建一个吧</div>
    </div>

    <template #footer>
      <div class="footer">
        <button class="btn ghost" @click="create"><Icon name="plus" :size="13" /> 新建歌单</button>
        <div class="spacer" />
        <button class="btn ghost" @click="ui.showAddToPlaylist = false">取消</button>
        <button class="btn primary" @click="confirm">确定</button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.songs-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--kg-panel-2);
  border-radius: 9px;
  margin-bottom: 12px;
}
.preview-text {
  font-size: 12.5px;
  color: var(--kg-text-2);
}
.pl-list {
  max-height: 280px;
  overflow-y: auto;
  margin: 0 -4px;
}
.pl-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  border-radius: 8px;
  text-align: left;
}
.pl-item:hover {
  background: var(--kg-panel);
}
.pl-item.active {
  background: #f1fbf6;
}
.pl-meta {
  flex: 1;
  min-width: 0;
}
.pl-name {
  font-size: 12.5px;
}
.pl-sub {
  font-size: 10.5px;
  color: var(--kg-text-3);
  margin-top: 2px;
}
.empty {
  padding: 30px 0;
  text-align: center;
  font-size: 12px;
  color: var(--kg-text-3);
}
.footer {
  display: flex;
  align-items: center;
  gap: 8px;
}
.spacer {
  flex: 1;
}
.btn {
  height: 30px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.btn.ghost {
  border: 1px solid var(--kg-line);
  color: var(--kg-text-2);
  background: var(--kg-surface);
}
.btn.primary {
  background: var(--kg-accent);
  color: #fff;
  font-weight: 600;
}
</style>
