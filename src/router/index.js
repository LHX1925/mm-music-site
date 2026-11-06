import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  { path: '/', name: 'home', component: () => import('@/views/HomeView.vue'), meta: { title: '首页' } },
  { path: '/discover', name: 'discover', component: () => import('@/views/DiscoverView.vue'), meta: { title: '发现' } },
  { path: '/rank', name: 'rank', component: () => import('@/views/RankView.vue'), meta: { title: '排行榜' } },
  { path: '/rank/:id', name: 'rank-detail', component: () => import('@/views/RankDetailView.vue'), meta: { title: '排行榜' } },
  { path: '/playlist/:id', name: 'playlist', component: () => import('@/views/PlaylistView.vue'), meta: { title: '歌单' } },
  { path: '/album/:id', name: 'album', component: () => import('@/views/AlbumView.vue'), meta: { title: '专辑' } },
  { path: '/artist/:id', name: 'artist', component: () => import('@/views/ArtistView.vue'), meta: { title: '歌手' } },
  { path: '/search', name: 'search', component: () => import('@/views/SearchView.vue'), meta: { title: '搜索' } },
  { path: '/mv/:hash', name: 'mv', component: () => import('@/views/MvView.vue'), meta: { title: 'MV' } },
  { path: '/fm', name: 'fm', component: () => import('@/views/FmView.vue'), meta: { title: '私人 FM' } },
  { path: '/book', name: 'book', component: () => import('@/views/BookView.vue'), meta: { title: '听书' } },
  { path: '/book/:id', name: 'book-detail', component: () => import('@/views/BookDetailView.vue'), meta: { title: '听书详情' } },
  { path: '/cloud', name: 'cloud', component: () => import('@/views/library/CloudView.vue'), meta: { title: '音乐云盘' } },
  { path: '/favorite', name: 'favorite', component: () => import('@/views/library/FavoriteView.vue'), meta: { title: '我喜欢' } },
  { path: '/recent', name: 'recent', component: () => import('@/views/library/RecentView.vue'), meta: { title: '最近播放' } },
  { path: '/local', name: 'local', component: () => import('@/views/library/LocalView.vue'), meta: { title: '本地和下载' } },
  { path: '/preview', name: 'preview', component: () => import('@/views/library/PreviewView.vue'), meta: { title: '试听列表' } },
  { path: '/my/playlists', name: 'my-playlists', component: () => import('@/views/library/MyPlaylistView.vue'), meta: { title: '我的歌单' } },
  { path: '/follow', name: 'follow', component: () => import('@/views/library/FollowView.vue'), meta: { title: '关注的歌手' } },
  { path: '/profile', name: 'profile', component: () => import('@/views/ProfileView.vue'), meta: { title: '个人中心' } },
  { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue'), meta: { title: '设置' } },
  { path: '/vip', name: 'vip', component: () => import('@/views/VipView.vue'), meta: { title: '会员中心' } },
  { path: '/desktop-lyric', name: 'desktop-lyric', component: () => import('@/views/DesktopLyric.vue'), meta: { title: '桌面歌词' } },
  { path: '/tray', name: 'tray', component: () => import('@/views/TrayPanel.vue'), meta: { title: '托盘控制面板' } },
  { path: '/taskbar', name: 'taskbar', component: () => import('@/views/TaskbarBar.vue'), meta: { title: '任务栏歌词' } },
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { title: '登录' } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
