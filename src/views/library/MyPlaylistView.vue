<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import Icon from '@/components/common/Icon.vue';
import CoverImage from '@/components/common/CoverImage.vue';
import { useLibraryStore } from '@/stores/library';
import { useUserStore } from '@/stores/user';
import { useUiStore } from '@/stores/ui';

const library = useLibraryStore();
const user = useUserStore();
const ui = useUiStore();
const router = useRouter();
const loading = ref(false);

async function create() {
  if (!user.isLogin) return ui.openLogin();
  try {
    const { value } = await ElMessageBox.prompt('给你的新歌单起个名字', '新建歌单', {
      confirmButtonText: '创建',
      cancelButtonText: '取消',
      inputValue: `我的歌单 ${new Date().getMonth() + 1}/${new Date().getDate()}`,
    });
    if (value) await library.createPlaylist(value);
  } catch (e) {
    if (e !== 'cancel' && e?.message) ElMessage.error(e.message);
  }
}

async function remove(pl) {
  try {
    await ElMessageBox.confirm(`确定删除歌单「${pl.name}」吗？`, '删除歌单', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await library.deletePlaylist(pl.id);
  } catch {}
}

onMounted(async () => {
  loading.value = true;
  await library.loadUserPlaylists();
  loading.value = false;
});
</script>

<template>
  <div class="lib-page page-scroll">
    <div class="head">
      <h1>我的歌单</h1>
      <span class="sub">{{ library.userPlaylists.length }} 个歌单</span>
      <div class="spacer" />
      <button class="btn" @click="create"><Icon name="plus" :size="13" /> 新建歌单</button>
    </div>

    <div v-if="!user.isLogin" class="empty">
      <Icon name="note" :size="34" color="#c6cbd4" />
      <div class="empty-title">登录后查看你创建和收藏的歌单</div>
      <button class="btn primary" @click="ui.openLogin()">立即登录</button>
    </div>

    <div v-else v-loading="loading" class="grid">
      <div class="card create" @click="create">
        <div class="plus"><Icon name="plus" :size="22" color="#9aa0ab" /></div>
        <div class="name">新建歌单</div>
      </div>
      <div v-for="pl in library.userPlaylists" :key="pl.id" class="card" @click="router.push(`/playlist/${pl.id}`)">
        <div class="cover-box">
          <CoverImage :src="pl.cover" :size="'100%'" :radius="10" />
          <button class="del" @click.stop="remove(pl)"><Icon name="trash" :size="13" color="#fff" /></button>
        </div>
        <div class="name ellipsis">{{ pl.name }}</div>
        <div class="sub">{{ pl.songCount || 0 }} 首</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lib-page {
  height: 100%;
  overflow-y: auto;
  padding: 10px 26px 40px;
}
.head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 18px;
}
.head h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}
.sub {
  font-size: 11.5px;
  color: var(--kg-text-3);
}
.spacer {
  flex: 1;
}
.btn {
  height: 30px;
  padding: 0 14px;
  border-radius: 15px;
  background: var(--kg-accent);
  color: #fff;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.btn.primary {
  margin-top: 12px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 20px 16px;
}
.card {
  cursor: pointer;
  min-width: 0;
}
.card.create .plus {
  aspect-ratio: 1;
  border: 1px dashed var(--kg-line-2);
  border-radius: 10px;
  display: grid;
  place-items: center;
}
.card.create:hover .plus {
  background: var(--kg-panel);
}
.cover-box {
  position: relative;
  aspect-ratio: 1;
  border-radius: 10px;
  overflow: hidden;
}
.del {
  position: absolute;
  right: 6px;
  top: 6px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.45);
  display: grid;
  place-items: center;
  opacity: 0;
}
.card:hover .del {
  opacity: 1;
}
.name {
  margin-top: 8px;
  font-size: 12.5px;
}
.sub {
  font-size: 11px;
  color: var(--kg-text-3);
  margin-top: 3px;
}
.empty {
  padding: 70px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.empty-title {
  font-size: 13px;
  color: var(--kg-text-2);
  margin-top: 4px;
}
</style>
