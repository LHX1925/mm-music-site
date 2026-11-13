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
      <span class="head-sub">{{ library.userPlaylists.length }} 个歌单</span>
      <div class="spacer" />
      <button class="btn" @click="create"><Icon name="plus" :size="13" /> 新建歌单</button>
    </div>

    <div v-if="!user.isLogin" class="empty">
      <Icon name="note" :size="34" color="#c6cbd4" />
      <div class="empty-title">登录后查看你创建和收藏的歌单</div>
      <button class="btn primary" @click="ui.openLogin()">立即登录</button>
    </div>

    <div v-else v-loading="loading" class="pl-grid">
      <div class="pl-card create" role="button" tabindex="0" @click="create" @keyup.enter="create">
        <div class="pl-cover create-cover">
          <Icon name="plus" :size="24" color="#9aa0ab" />
        </div>
        <div class="pl-name">新建歌单</div>
        <div class="pl-sub">创建一个自己的歌单</div>
      </div>

      <div
        v-for="pl in library.userPlaylists"
        :key="pl.id"
        class="pl-card"
        role="button"
        tabindex="0"
        @click="router.push(`/playlist/${pl.id}`)"
        @keyup.enter="router.push(`/playlist/${pl.id}`)"
      >
        <div class="pl-cover">
          <CoverImage
            :src="pl.cover"
            size="100%"
            :radius="0"
            :letter="pl.name ? pl.name.slice(0, 1) : ''"
            :seed="pl.id"
            class="pl-img"
          />
          <span class="pl-play"><Icon name="play" :size="15" color="#fff" filled /></span>
          <button class="del" title="删除歌单" @click.stop="remove(pl)">
            <Icon name="trash" :size="13" color="#fff" />
          </button>
        </div>
        <div class="pl-name" :title="pl.name">{{ pl.name }}</div>
        <div class="pl-sub">{{ pl.songCount || 0 }} 首</div>
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
.head-sub {
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
  align-self: center;
}

/* 自适应列宽：窗口窄也只会少几列，不会把某张卡片压成别的比例 */
.pl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 20px 16px;
  align-items: start;
}
.pl-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 0;
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
}
.pl-card:focus-visible {
  outline: 2px solid var(--kg-accent);
  outline-offset: 3px;
  border-radius: 12px;
}
/* 封面统一 1:1，和卡片同宽，绝不出现一张方一张长 */
.pl-cover {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 12px;
  overflow: hidden;
  background: var(--kg-panel);
  transition: transform 0.16s ease, box-shadow 0.16s ease;
}
.pl-card:hover .pl-cover {
  transform: translateY(-2px);
  box-shadow: 0 10px 22px rgba(15, 20, 30, 0.14);
}
.pl-cover :deep(.cover) {
  width: 100% !important;
  height: 100% !important;
  border-radius: 0 !important;
}
.create-cover {
  border: 1px dashed var(--kg-line-2);
  display: grid;
  place-items: center;
}
.pl-card:hover .create-cover {
  background: var(--kg-panel-2);
  border-color: var(--kg-accent);
}
.pl-play {
  position: absolute;
  right: 8px;
  bottom: 8px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(4px);
  display: grid;
  place-items: center;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 0.16s ease, transform 0.16s ease;
}
.pl-card:hover .pl-play {
  opacity: 1;
  transform: translateY(0);
}
.del {
  position: absolute;
  right: 8px;
  top: 8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.45);
  display: grid;
  place-items: center;
  opacity: 0;
  transition: opacity 0.16s ease;
}
.pl-card:hover .del {
  opacity: 1;
}
.del:hover {
  background: #e5484d;
}
/* 名字与首数固定两行，长名字只省略不换行，整行卡片永远对齐 */
.pl-name {
  font-size: 12.5px;
  color: var(--kg-text);
  line-height: 18px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pl-sub {
  font-size: 11px;
  color: var(--kg-text-3);
  line-height: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
