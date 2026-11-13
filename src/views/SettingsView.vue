<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import Icon from '@/components/common/Icon.vue';
import VipBadge from '@/components/common/VipBadge.vue';
import lhxAvatar from '@/assets/authors/lhx.jpg';
import shuixianAvatar from '@/assets/authors/shuixian.jpg';
import SettingCard from '@/components/common/SettingCard.vue';
import SettingSelect from '@/components/common/SettingSelect.vue';
import SettingToggle from '@/components/common/SettingToggle.vue';
import { useAppStore } from '@/stores/app';
import { useUserStore } from '@/stores/user';
import { useVipStore } from '@/stores/vip';
import { useUiStore } from '@/stores/ui';
import { useUpdateStore } from '@/stores/update';
import { todayStr } from '@/stores/vip';
import { LYRIC_COLORS, readLyricCfg, readLyricFavs, removeLyricFav, saveLyricCfg } from '@/utils/desktopLyric';
import { GREETINGS, pickGreeting, playGreeting, stopGreeting } from '@/utils/greeting';
import { platformIcon } from '@/utils/brand';
import { ACCENT_THEMES, resolveAccent } from '@/utils/themeColors';

const app = useAppStore();
const user = useUserStore();
const vip = useVipStore();
const ui = useUiStore();
const update = useUpdateStore();
const router = useRouter();
const route = useRoute();

const DEFAULT_AVATAR = '/assets/profile.jpg';
const info = ref({});
const autoUpdate = ref(true);
const audioOutputs = ref([]);
const proxy = ref(app.settings.proxy || '');
const bodyEl = ref(null);
const activeSection = ref('appearance');

/** 桌面歌词配置（独立窗口通过 IPC 实时同步） */
const lyricCfg = ref(readLyricCfg());
const lyricFavs = ref(readLyricFavs());
const lyricColorOptions = [...LYRIC_COLORS, { label: '跟随主题', value: '' }];
const lyricDirectionOptions = [
  { label: '横排（横屏宽条）', value: 'horizontal' },
  { label: '竖排（竖屏竖条）', value: 'vertical' },
];

function setLyric(patch) {
  lyricCfg.value = saveLyricCfg(patch);
  window.kg?.lyric?.config?.(lyricCfg.value);
  if ('direction' in patch) {
    window.kg?.lyric?.resize?.({ mode: lyricCfg.value.direction === 'vertical' ? 'vertical' : 'horizontal' });
  }
}

function dropFav(i) {
  lyricFavs.value = removeLyricFav(i);
}

/** 自动检查更新开关（写进主进程配置，不需要重启） */
async function onAutoUpdate(v) {
  autoUpdate.value = Boolean(v);
  await window.kg?.setConfig?.({ updateAutoCheck: Boolean(v) });
  ElMessage.success(v ? '已开启自动检查更新' : '已关闭自动检查更新');
}

/** 试听一条启动问候语 */function tryGreeting() {
  stopGreeting();
  const item = pickGreeting();
  playGreeting(item, 0.6);
  ElMessage({ message: `${item.name}：${item.text}`, duration: 2600 });
}

/** 桌面歌词窗口里改了配置 / 收藏了歌词时，这里同步刷新 */
function onLyricStorage(e) {
  if (e?.key && !String(e.key).startsWith('kg-desktop-lyric') && e.key !== 'kg-lyric-favorites') return;
  lyricCfg.value = readLyricCfg();
  lyricFavs.value = readLyricFavs();
}

onMounted(() => window.addEventListener('storage', onLyricStorage));
onBeforeUnmount(() => window.removeEventListener('storage', onLyricStorage));

const greeting = computed(() => {
  const h = new Date().getHours();
  if (h < 6) return '夜深好';
  if (h < 11) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
});

const accountId = computed(() => user.session?.userid || '未登录');

const sections = [
  { key: 'appearance', label: '外观与主题', icon: 'sun', desc: '主题 / 玻璃 / 背景' },
  { key: 'playback', label: '播放', icon: 'headphones', desc: '音质与输出' },
  { key: 'lyric', label: '歌词', icon: 'note', desc: '桌面歌词与字号' },
  { key: 'content', label: '内容与搜索', icon: 'search', desc: '搜索与数据源' },
  { key: 'system', label: '系统与性能', icon: 'settings', desc: '启动 / 托盘 / 代理' },
  { key: 'storage', label: '文件与本地', icon: 'folder', desc: '本地音乐目录' },
  { key: 'vip', label: '会员', icon: 'vip', desc: '自动领取' },
  { key: 'about', label: '关于', icon: 'shield', desc: '版本与声明' },
];

const qualityOptions = [
  { label: '标准 128kbps', value: '128' },
  { label: '高品 320kbps', value: '320' },
  { label: '无损 FLAC', value: 'flac' },
  { label: 'Hi-Res 无损', value: 'high' },
  { label: '蝰蛇超清（需超级VIP）', value: 'viper_clear' },
  { label: '蝰蛇全景声（需超级VIP）', value: 'viper_atmos' },
  { label: '蝰蛇母带（需超级VIP）', value: 'viper_tape' },
];
const barPosOptions = [
  { label: '压在任务栏上', value: 'taskbar' },
  { label: '屏幕最底部（浮在任务栏上方）', value: 'screen' },
];

const appearanceOptions = [
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
  { label: '跟随系统', value: 'auto' },
];
const fontOptions = [
  { label: '默认字体', value: 'default' },
  { label: '宋体（衬线）', value: 'serif' },
  { label: '圆黑体', value: 'round' },
  { label: '等宽字体', value: 'mono' },
];
const navOptions = [
  { label: '左侧', value: 'left' },
  { label: '顶部（暂未开放）', value: 'top', disabled: true },
];
const layoutOptions = [
  { label: '底部通栏', value: 'bottom' },
  { label: '仅播放页（暂未开放）', value: 'mini', disabled: true },
];
const searchModeOptions = [
  { label: '推荐搜索', value: 'recommend' },
  { label: '歌词优先', value: 'lyric' },
];
const dataSourceOptions = [
  { label: '酷狗音乐 · 标准版', value: 'std' },
  { label: '酷狗音乐 · 概念版', value: 'lite' },
];
const logOptions = [
  { label: '操作日志', value: 'op' },
  { label: '错误日志', value: 'error' },
];
/** 当前生效的主题（兼容旧版本存的十六进制色值） */
const activeAccent = computed(() => resolveAccent(app.settings.accent));

const sourceBusy = ref(false);

/** 切换数据源：会重启对应实例并重新拉账号数据，加个忙碌态避免连点 */
async function switchSource(value) {
  if (value === app.platform || sourceBusy.value) return;
  sourceBusy.value = true;
  try {
    await app.switchPlatform(value);
  } finally {
    sourceBusy.value = false;
  }
}

function set(patch) {
  return app.updateSettings(patch);
}

/** 立即查看当前页面的功能引导 */
function showGuideNow() {
  ui.openGuide(route.name);
}

/** 重新打开免责声明（只读查看，同意后仍写同一个标记） */
function reopenDisclaimer() {
  ui.needDisclaimer = true;
}

async function setAccent(v) {
  await app.updateSettings({ accent: v });
  app.applyAccent();
}

/**
 * 分区在滚动容器内的真实偏移。
 * 不能用 el.offsetTop：它是相对 offsetParent（这里是整个窗口）算的，
 * 会把标题栏、账号卡片的高度也算进去，于是点「外观与主题」会直接滚到下面几个分区，
 * 看起来就是「点了没打开对应功能」。这里改成相对滚动容器换算。
 */
function sectionTop(el) {
  if (!el || !bodyEl.value) return 0;
  const r = el.getBoundingClientRect();
  const box = bodyEl.value.getBoundingClientRect();
  return r.top - box.top + bodyEl.value.scrollTop;
}

function scrollTo(key) {
  activeSection.value = key;
  const el = document.getElementById(`sec-${key}`);
  if (el && bodyEl.value) {
    bodyEl.value.scrollTo({ top: Math.max(0, sectionTop(el) - 8), behavior: 'smooth' });
  }
}

function onScroll() {
  if (!bodyEl.value) return;
  const top = bodyEl.value.scrollTop + 70;
  let cur = sections[0].key;
  for (const s of sections) {
    const el = document.getElementById(`sec-${s.key}`);
    if (el && sectionTop(el) <= top) cur = s.key;
  }
  // 滚到最底时直接点亮最后一个分区，避免最后一段够不到高度
  if (bodyEl.value.scrollTop + bodyEl.value.clientHeight >= bodyEl.value.scrollHeight - 4) {
    cur = sections[sections.length - 1].key;
  }
  activeSection.value = cur;
}

function needRelaunch(label, apply) {
  ElMessageBox.confirm(`${label}需要重启应用后生效，是否立即重启？`, '需要重启', {
    confirmButtonText: '立即重启',
    cancelButtonText: '稍后',
    type: 'warning',
  })
    .then(async () => {
      await apply();
      window.kg?.relaunch();
    })
    .catch(async () => {
      await apply();
    });
}

async function onNativeFrame(v) {
  await set({ nativeFrame: v });
  needRelaunch('原生窗口装饰器', () => Promise.resolve());
}

async function onGpu(v) {
  await set({ gpuDisabled: v });
  needRelaunch('禁用 GPU 加速', () => Promise.resolve());
}

async function onHighDpi(v) {
  await set({ highDpi: v });
  needRelaunch('高 DPI 支持', () => Promise.resolve());
}

async function onThrottle(v) {
  await set({ blockThrottle: v, disableThrottle: !v });
  needRelaunch('后台节流设置', () => Promise.resolve());
}

async function onTray(v) {
  await set({ closeToTray: v });
  ElMessage.success(v ? '关闭窗口后将最小化到托盘' : '关闭窗口将直接退出');
}

async function saveProxy() {
  await set({ proxy: proxy.value.trim() });
  ElMessage.success('代理已保存，重启接口服务后生效');
}

async function chooseLocalDir() {
  const dir = await window.kg?.chooseFolder();
  if (!dir) return;
  await set({ localDirs: [...new Set([...(app.settings.localDirs || []), dir])] });
}

function removeLocalDir(dir) {
  set({ localDirs: (app.settings.localDirs || []).filter((d) => d !== dir) });
}

async function restartApi(platform) {
  ElMessage.info('正在重启接口服务…');
  await window.kg?.restartServer(platform);
  ElMessage.success('接口服务已重启');
}

async function pickBg() {
  const res = await app.pickBackground();
  if (res) ElMessage.success(`已应用${res.type === 'video' ? '视频' : '图片'}背景`);
}

function clearBg() {
  app.clearBackground();
  ElMessage.success('已恢复默认背景');
}

async function loadOutputs() {
  try {
    const list = await navigator.mediaDevices.enumerateDevices();
    audioOutputs.value = list
      .filter((d) => d.kind === 'audiooutput')
      .map((d, i) => ({ label: d.label || `输出设备 ${i + 1}`, value: d.deviceId }));
  } catch {
    audioOutputs.value = [];
  }
}

async function setOutput(id) {
  await set({ audioOutput: id });
  try {
    await window.__kgAudio?.setSinkId?.(id);
    ElMessage.success('已切换音频输出设备');
  } catch {
    ElMessage.warning('当前系统不支持切换输出设备');
  }
}

async function logout() {
  try {
    await ElMessageBox.confirm('确定退出当前平台账号？', '退出登录', {
      confirmButtonText: '退出登录',
      cancelButtonText: '取消',
      type: 'warning',
    });
    user.logout();
    ElMessage.success('已退出登录');
  } catch {}
}

async function claimVip() {
  if (app.platform !== 'lite') {
    ElMessage.warning('每日领取需切换到概念版');
    return app.switchPlatform('lite');
  }
  await vip.claim(todayStr());
}

function openDataDir() {
  const dir = info.value.userData;
  if (dir) window.kg?.openPath(dir);
}

function showApiInfo() {
  ElMessageBox.alert(
    `<div style="line-height:1.9;font-size:12.5px">
      标准版：http://127.0.0.1:${app.ports.std}<br/>
      概念版：http://127.0.0.1:${app.ports.lite}<br/>
      界面服务：http://127.0.0.1:${app.appInfo.localServerPort || '-'}<br/>
      接口目录：${app.appInfo.apiDir || '未找到'}
    </div>`,
    '本地接口信息',
    { dangerouslyUseHTMLString: true, confirmButtonText: '知道了' }
  );
}

onMounted(async () => {
  if (window.kg) info.value = await window.kg.info();
  autoUpdate.value = info.value?.updateAutoCheck !== false;
  update.init();
  loadOutputs();
  navigator.mediaDevices?.addEventListener?.('devicechange', () => {
    loadOutputs();
    if (app.settings.autoPauseDeviceChange) ElMessage.info('音频设备变化，已自动暂停');
  });
});
</script>

<template>
  <div class="settings">
    <!-- 账号卡 -->
    <header class="account-card">
      <div class="acc-ava">
        <div class="acc-avatar">
          <img :src="user.avatar || DEFAULT_AVATAR" alt="" />
        </div>
      </div>
      <div class="acc-meta">
        <div class="acc-line">
          <h2>{{ greeting }}，{{ user.isLogin ? user.nickname : '未登录' }}</h2>
          <span class="acc-id">账号 {{ accountId }}</span>
        </div>
        <div class="acc-tags">
          <!-- 两个放大的徽标横排在平台名左边，不再套黄色胶囊 -->
          <VipBadge v-if="user.isLogin && vip.badges.length" :size="18" class="acc-badges" />
          <span class="tag plain">{{ app.platformName }}</span>
          <button class="text-link" @click="router.push('/profile')">进入个人中心 →</button>
        </div>
      </div>
      <div class="acc-actions">
        <button class="acc-btn" @click="router.push('/vip')"><Icon name="vip" :size="15" /> 会员中心</button>
        <button v-if="!user.isLogin" class="acc-btn primary" @click="ui.openLogin()"><Icon name="user" :size="15" /> 登录</button>
        <button v-else class="acc-btn danger" @click="logout"><Icon name="logout" :size="15" /> 退出登录</button>
      </div>
    </header>

    <div class="set-main">
      <!-- 分类导航 -->
      <nav class="set-nav">
        <button
          v-for="s in sections"
          :key="s.key"
          class="nav-item"
          :class="{ active: activeSection === s.key }"
          @click="scrollTo(s.key)"
        >
          <Icon :name="s.icon" :size="16" />
          <span class="nav-text">
            <span class="nav-label">{{ s.label }}</span>
            <span class="nav-desc">{{ s.desc }}</span>
          </span>
        </button>
      </nav>

      <!-- 设置内容 -->
      <div ref="bodyEl" class="set-body page-scroll" @scroll="onScroll">
        <!-- 外观 -->
        <section id="sec-appearance" class="set-section">
          <header class="sec-head">
            <h3>外观与主题</h3>
            <span class="sec-desc">主题色、深色模式、液态玻璃与背景</span>
          </header>
          <div class="grid">
            <SettingCard icon="wallpaper" title="任务栏歌词" :span="true" help="默认常开：封面 + 歌词 + 上一首/播放/下一首；只有这里的开关能关掉它">
              <div class="bar-setting">
                <SettingToggle :model-value="app.settings.showTaskbarLyric" @change="set({ showTaskbarLyric: $event })" />
                <SettingSelect
                  :model-value="app.settings.barPos || 'taskbar'"
                  :options="barPosOptions"
                  icon="fullscreen"
                  @change="set({ barPos: $event })"
                />
              </div>
              <div class="set-hint">除按钮外整条鼠标穿透，不影响点开始菜单与任务栏图标</div>
            </SettingCard>
            <SettingCard icon="star" title="主色调" :span="true" :help="`当前：${activeAccent.label}`">
              <div class="theme-row">
                <button
                  v-for="t in ACCENT_THEMES"
                  :key="t.key"
                  class="theme-pill"
                  :class="{ active: activeAccent.key === t.key }"
                  :title="t.label"
                  @click="setAccent(t.key)"
                >
                  <span class="theme-dot" :style="{ background: `linear-gradient(135deg, ${t.from} 0%, ${t.to} 100%)` }" />
                  <span class="theme-label">{{ t.label }}</span>
                  <Icon v-if="activeAccent.key === t.key" name="check" :size="11" class="theme-check" />
                </button>
              </div>
              <div class="set-hint">单色与渐变主题都能选，切换立即生效，打卡卡片、按钮、强调色会一起变</div>
            </SettingCard>
            <SettingCard icon="moon" title="外观模式">
              <SettingSelect
                :model-value="app.settings.appearance"
                :options="appearanceOptions"
                icon="moon"
                @change="set({ appearance: $event })"
              />
            </SettingCard>
            <SettingCard icon="wallpaper" title="液态玻璃" help="面板半透明 + 背景模糊；关闭后恢复为纯色界面">
              <SettingToggle
                :model-value="app.settings.glass"
                on-label="已开启"
                off-label="已关闭"
                @change="set({ glass: $event })"
              />
              <div class="set-hint">开启后侧栏、播放条、卡片都会变成毛玻璃质感，可随时关闭</div>
            </SettingCard>
            <SettingCard icon="eq" title="玻璃模糊强度" :help="`当前 ${app.settings.glassBlur || 18}px`">
              <el-slider
                :model-value="app.settings.glassBlur || 18"
                :min="6"
                :max="40"
                :step="1"
                size="small"
                :disabled="!app.settings.glass"
                @update:model-value="set({ glassBlur: $event })"
              />
            </SettingCard>
            <SettingCard icon="edit" title="界面字体">
              <SettingSelect
                :model-value="app.settings.fontSetting"
                :options="fontOptions"
                icon="edit"
                @change="set({ fontSetting: $event })"
              />
            </SettingCard>
            <SettingCard icon="fullscreen" title="原生窗口装饰器" help="开启后使用系统标题栏，需要重启应用">
              <SettingToggle :model-value="app.settings.nativeFrame" @change="onNativeFrame" />
            </SettingCard>
            <SettingCard icon="wallpaper" title="自定义背景" :span="true" help="支持图片与视频，视频会自动循环播放">
              <div class="bg-row">
                <div class="bg-preview">
                  <video
                    v-if="app.settings.bgType === 'video' && app.backgroundUrl()"
                    :src="app.backgroundUrl()"
                    muted
                    loop
                    autoplay
                  />
                  <img v-else-if="app.settings.bgType === 'image' && app.backgroundUrl()" :src="app.backgroundUrl()" alt="" />
                  <span v-else>未设置背景</span>
                </div>
                <div class="bg-actions">
                  <div class="btn-row">
                    <button class="mini-btn" @click="pickBg">选择图片 / 视频</button>
                    <button class="mini-btn ghost" :disabled="app.settings.bgType === 'none'" @click="clearBg">清除背景</button>
                  </div>
                  <div class="slider-row">
                    <span class="slider-label">背景暗度 {{ Math.round((app.settings.bgDim || 0) * 100) }}%</span>
                    <el-slider
                      :model-value="Math.round((app.settings.bgDim || 0) * 100)"
                      :min="0"
                      :max="80"
                      size="small"
                      @update:model-value="set({ bgDim: $event / 100 })"
                    />
                  </div>
                </div>
              </div>
            </SettingCard>
          </div>
        </section>

        <!-- 播放 -->
        <section id="sec-playback" class="set-section">
          <header class="sec-head">
            <h3>播放</h3>
            <span class="sec-desc">音质、输出设备与播放行为</span>
          </header>
          <div class="grid">
            <SettingCard icon="headphones" title="音质选择" help="蝰蛇三档需要超级VIP，取不到音源会自动回落到有版权的那一档">
              <SettingSelect
                :model-value="app.settings.quality"
                :options="qualityOptions"
                icon="headphones"
                @change="set({ quality: $event })"
              />
            </SettingCard>
            <SettingCard icon="queue" title="播放栏布局">
              <SettingSelect :model-value="app.settings.playerLayout" :options="layoutOptions" icon="queue" />
            </SettingCard>
            <SettingCard icon="eq" title="平衡音频响度" help="不同歌曲响度差异较大时开启，可减少音量突变（实验性）">
              <SettingToggle :model-value="app.settings.balanceAudio" @change="set({ balanceAudio: $event })" />
            </SettingCard>
            <SettingCard icon="volume" title="音频输出设备" help="需要系统与设备支持 setSinkId">
              <SettingSelect
                :model-value="app.settings.audioOutput"
                :options="[{ label: '默认设备', value: '' }, ...audioOutputs]"
                icon="volume"
                @change="setOutput"
              />
            </SettingCard>
            <SettingCard icon="repeat" title="设备变化自动暂停" help="耳机拔出、蓝牙断开时自动暂停播放">
              <SettingToggle
                :model-value="app.settings.autoPauseDeviceChange"
                @change="set({ autoPauseDeviceChange: $event })"
              />
            </SettingCard>
          </div>
        </section>

        <!-- 歌词 -->
        <section id="sec-lyric" class="set-section">
          <header class="sec-head">
            <h3>歌词</h3>
            <span class="sec-desc">桌面歌词悬浮窗：动画 / 字号 / 颜色 / 方向 / 单行 / 延迟 / 收藏</span>
          </header>
          <div class="grid">
            <SettingCard icon="album" title="桌面歌词" help="独立置顶悬浮窗，锁定后鼠标穿透，Ctrl+Alt+L 解锁">
              <SettingToggle :model-value="app.settings.showDesktopLyric" @change="set({ showDesktopLyric: $event })" />
              <div class="set-hint">悬浮窗内可切歌、调字号、置顶与锁定</div>
            </SettingCard>
            <SettingCard icon="edit" title="桌面歌词字号" :help="`当前 ${lyricCfg.size}px（悬浮窗内也能用 A- / A+ 调节）`">
              <el-slider
                :model-value="lyricCfg.size"
                :min="16"
                :max="72"
                :step="1"
                size="small"
                @update:model-value="setLyric({ size: $event })"
              />
            </SettingCard>
            <SettingCard icon="star" title="歌词字体颜色">
              <div class="color-row">
                <button
                  v-for="c in lyricColorOptions"
                  :key="c.value || 'auto'"
                  class="color-dot"
                  :class="{ on: (lyricCfg.color || '') === c.value }"
                  :style="c.value ? { background: c.value } : {}"
                  :title="c.label"
                  @click="setLyric({ color: c.value })"
                >
                  <span v-if="!c.value" class="auto-text">自动</span>
                </button>
              </div>
            </SettingCard>
            <SettingCard icon="fullscreen" title="歌词方向" help="竖排适合竖屏副屏，横排适合主屏宽条">
              <SettingSelect
                :model-value="lyricCfg.direction"
                :options="lyricDirectionOptions"
                icon="fullscreen"
                @change="setLyric({ direction: $event })"
              />
            </SettingCard>
            <SettingCard icon="list" title="单行歌词" help="开启后只显示当前这一句，隐藏翻译与下一句">
              <SettingToggle :model-value="lyricCfg.single" @change="setLyric({ single: $event })" />
            </SettingCard>
            <SettingCard icon="clock" title="显示延迟" :help="`当前 ${lyricCfg.delay}ms（歌词出现得比声音更早/更晚都靠它微调）`">
              <el-slider
                :model-value="lyricCfg.delay"
                :min="-2000"
                :max="2000"
                :step="100"
                size="small"
                @update:model-value="setLyric({ delay: $event })"
              />
            </SettingCard>
            <SettingCard icon="fire" title="歌词跳跃动画" help="切句时旧句上移淡出、新句弹入">
              <SettingToggle :model-value="lyricCfg.animate" @change="setLyric({ animate: $event })" />
            </SettingCard>
            <SettingCard icon="heart" title="喜欢的歌词" :span="true" :help="`已收藏 ${lyricFavs.length} 句，在悬浮窗点 ♥ 收藏`">
              <div v-if="lyricFavs.length" class="fav-list">
                <div v-for="(f, i) in lyricFavs" :key="`${f.text}-${i}`" class="fav-row">
                  <div class="fav-text ellipsis" :title="f.text">{{ f.text }}</div>
                  <div class="fav-song ellipsis">{{ f.song || '未知歌曲' }}</div>
                  <button class="fav-del" title="删除" @click="dropFav(i)"><Icon name="trash" :size="13" /></button>
                </div>
              </div>
              <div v-else class="set-hint">还没有收藏的歌词，打开桌面歌词点击 ♥ 就能收藏</div>
            </SettingCard>
            <SettingCard icon="edit" title="歌词页字号" :help="`当前 ${app.settings.lyricSize}px（播放页滚动歌词）`">
              <el-slider
                :model-value="app.settings.lyricSize"
                :min="16"
                :max="44"
                :step="1"
                size="small"
                @update:model-value="set({ lyricSize: $event })"
              />
            </SettingCard>
            <SettingCard icon="edit" title="歌词字体">
              <SettingSelect
                :model-value="app.settings.lyricFont"
                :options="fontOptions"
                icon="edit"
                @change="set({ lyricFont: $event })"
              />
            </SettingCard>
            <SettingCard icon="note" title="歌词翻译">
              <SettingToggle :model-value="app.settings.showTranslation" @change="set({ showTranslation: $event })" />
            </SettingCard>
          </div>
        </section>

        <!-- 内容 -->
        <section id="sec-content" class="set-section">
          <header class="sec-head">
            <h3>内容与搜索</h3>
            <span class="sec-desc">搜索偏好与数据源</span>
          </header>
          <div class="grid">
            <SettingCard icon="search" title="搜索模式">
              <SettingSelect
                :model-value="app.settings.searchMode"
                :options="searchModeOptions"
                icon="search"
                @change="set({ searchMode: $event })"
              />
            </SettingCard>
            <SettingCard icon="cloud" title="数据源" :span="true" help="标准版与概念版为两套独立账号与曲库，切换后自动重连">
              <div class="source-row">
                <button
                  v-for="src in dataSourceOptions"
                  :key="src.value"
                  class="source-card"
                  :class="{ active: app.platform === src.value }"
                  :disabled="sourceBusy"
                  @click="switchSource(src.value)"
                >
                  <img class="source-logo" :src="platformIcon(src.value)" alt="" draggable="false" />
                  <span class="source-text">
                    <b>{{ src.label }}</b>
                    <i>{{ src.value === 'std' ? '完整曲库 · 会员权益齐全' : '年轻化曲库 · 每日可领会员' }}</i>
                  </span>
                  <span v-if="app.platform === src.value" class="source-check">
                    <Icon name="check" :size="12" color="#fff" />
                  </span>
                </button>
              </div>
            </SettingCard>
            <SettingCard icon="list" title="导航方式">
              <SettingSelect :model-value="app.settings.navMode" :options="navOptions" icon="list" />
            </SettingCard>
            <SettingCard icon="list" title="日志">
              <SettingSelect :model-value="'op'" :options="logOptions" icon="list" />
              <div class="set-hint">日志位于用户数据目录，可在「接口信息」查看路径</div>
            </SettingCard>
          </div>
        </section>

        <!-- 系统 -->
        <section id="sec-system" class="set-section">
          <header class="sec-head">
            <h3>系统与性能</h3>
            <span class="sec-desc">启动、托盘、快捷键与网络</span>
          </header>
          <div class="grid">
            <SettingCard icon="minimize" title="关闭窗口时到托盘">
              <SettingToggle :model-value="app.settings.closeToTray" @change="onTray" />
            </SettingCard>
            <SettingCard icon="refresh" title="开机自启动">
              <SettingToggle :model-value="app.settings.autoStart" @change="set({ autoStart: $event })" />
            </SettingCard>
            <SettingCard icon="fullscreen" title="启动时最小化">
              <SettingToggle :model-value="app.settings.startMinimized" @change="set({ startMinimized: $event })" />
            </SettingCard>
            <SettingCard
              icon="volume"
              title="启动问候语"
              help="每次启动随机播放一句语音问候（共 3 条），并在左下角弹出小气泡"
            >
              <div class="greet-row">
                <SettingToggle
                  :model-value="app.settings.greetOnStart !== false"
                  on-label="已开启"
                  off-label="已关闭"
                  @change="set({ greetOnStart: $event })"
                />
                <button class="mini-btn ghost" @click="tryGreeting">试听</button>
              </div>
              <div class="set-hint">共 {{ GREETINGS.length }} 条语音：{{ GREETINGS.map((g) => `${g.name}（${g.lang}）`).join('、') }}</div>
            </SettingCard>
            <SettingCard icon="refresh" title="自动检查更新" help="启动 15 秒后静默检查一次，有新版本会在软件内提示">
              <div class="greet-row">
                <SettingToggle
                  :model-value="autoUpdate"
                  on-label="已开启"
                  off-label="已关闭"
                  @change="onAutoUpdate"
                />
                <button class="mini-btn ghost" :disabled="update.checking" @click="update.check({ silent: false })">
                  {{ update.checking ? '检查中…' : '立即检查' }}
                </button>
              </div>
              <div class="set-hint">更新来自 {{ update.origin }}</div>
            </SettingCard>
            <SettingCard icon="clock" title="阻止系统休眠" help="播放时保持屏幕不睡眠">              <SettingToggle :model-value="app.settings.preventSleep" @change="set({ preventSleep: $event })" />
            </SettingCard>
            <SettingCard icon="queue" title="全局快捷键" help="Ctrl+Alt+Space 播放/暂停、Ctrl+Alt+←/→ 切歌；Ctrl+Alt+L 解除桌面歌词锁定">
              <SettingToggle :model-value="app.settings.globalShortcut" @change="set({ globalShortcut: $event })" />
            </SettingCard>
            <SettingCard icon="pause" title="禁用后台节流" help="最小化后保持定时任务与自动领取，需要重启">
              <SettingToggle :model-value="app.settings.blockThrottle" @change="onThrottle" />
            </SettingCard>
            <SettingCard icon="eq" title="禁用 GPU 加速" help="画面撕裂或黑屏时可尝试关闭，需要重启">
              <SettingToggle :model-value="app.settings.gpuDisabled" @change="onGpu" />
            </SettingCard>
            <SettingCard icon="fullscreen" title="启用高 DPI 支持" help="高分屏字体模糊时可尝试，需要重启">
              <SettingToggle :model-value="app.settings.highDpi" @change="onHighDpi" />
            </SettingCard>
            <SettingCard icon="shield" title="本地接口" help="接口服务随应用启动，始终可用">
              <div class="msg-pill">
                <span>标准版 :{{ app.ports.std }} · 概念版 :{{ app.ports.lite }}</span>
                <button class="mini-btn" @click="showApiInfo">详情</button>
              </div>
            </SettingCard>
            <SettingCard icon="share" title="网络代理" help="给接口服务设置 HTTP 代理，例如 http://127.0.0.1:7890">
              <div class="proxy-row">
                <el-input v-model="proxy" size="small" placeholder="http://127.0.0.1:7890" />
                <button class="mini-btn" @click="saveProxy">保存</button>
              </div>
              <div class="btn-row gap">
                <button class="mini-btn ghost" @click="restartApi('std')">重启标准版</button>
                <button class="mini-btn ghost" @click="restartApi('lite')">重启概念版</button>
              </div>
            </SettingCard>
          </div>
        </section>

        <!-- 文件 -->
        <section id="sec-storage" class="set-section">
          <header class="sec-head">
            <h3>文件与本地</h3>
            <span class="sec-desc">本地音乐文件夹与缓存</span>
          </header>
          <div class="grid">
            <SettingCard icon="folder" title="本地音乐文件夹" :span="true" help="只读取你添加的目录，不上传、不复制文件">
              <div class="dir-row">
                <span class="dir ellipsis">{{ (app.settings.localDirs || []).length ? `已添加 ${app.settings.localDirs.length} 个目录` : '未添加' }}</span>
                <button class="mini-btn" @click="chooseLocalDir">添加</button>
              </div>
              <div v-if="(app.settings.localDirs || []).length" class="dir-list">
                <div v-for="d in app.settings.localDirs" :key="d" class="dir-item">
                  <span class="ellipsis">{{ d }}</span>
                  <button class="x" title="移除" @click="removeLocalDir(d)"><Icon name="close-small" :size="11" /></button>
                </div>
              </div>
            </SettingCard>
          </div>
        </section>

        <!-- 会员 -->
        <section id="sec-vip" class="set-section">
          <header class="sec-head">
            <h3>会员</h3>
            <span class="sec-desc">概念版每日会员自动领取</span>
          </header>
          <div class="grid">
            <SettingCard icon="vip" title="会员自动领取" :span="true" help="每天到点自动领取概念版会员；启动时补领当天未领的会员">
              <div class="auto-row">
                <SettingToggle
                  :model-value="app.settings.autoVip?.enabled"
                  on-label="已开启"
                  off-label="未开启"
                  @change="set({ autoVip: { ...(app.settings.autoVip || {}), enabled: $event } })"
                />
                <el-time-select
                  :model-value="app.settings.autoVip?.time"
                  start="00:00"
                  step="00:30"
                  end="23:30"
                  size="small"
                  style="width: 118px"
                  @update:model-value="set({ autoVip: { ...(app.settings.autoVip || {}), time: $event } })"
                />
                <SettingToggle
                  :model-value="app.settings.autoVip?.upgrade"
                  on-label="领后自动升级"
                  off-label="仅领取"
                  @change="set({ autoVip: { ...(app.settings.autoVip || {}), upgrade: $event } })"
                />
                <button class="mini-btn" :disabled="vip.claimedToday || vip.claiming" @click="claimVip">
                  {{ vip.claimedToday ? '今日已领取' : vip.claiming ? '领取中…' : '立即领取' }}
                </button>
                <button class="mini-btn ghost" @click="router.push('/vip')">会员中心</button>
              </div>
            </SettingCard>
          </div>
        </section>

        <!-- 关于 -->
        <section id="sec-about" class="set-section">
          <header class="sec-head">
            <h3>关于</h3>
            <span class="sec-desc">版本信息与免责声明</span>
          </header>
          <section class="about-card">
            <div class="about-head">
              <img src="/icon.png" class="app-icon" alt="" />
              <div class="about-title">
                <h4>萌萌音乐</h4>
                <span>v{{ update.version || info.version || '1.2.0' }} · Vue 3 + Electron</span>
              </div>
              <button class="mini-btn" :disabled="update.checking" @click="update.check({ silent: false })">
                {{ update.checking ? '检查中…' : '检查更新' }}
              </button>
              <button class="mini-btn ghost" @click="openDataDir">打开数据目录</button>
            </div>
            <!-- 作者 -->
            <div class="about-authors">
              <div class="about-authors-label">作者</div>
              <div class="about-authors-list">
                <div class="author-item">
                  <img :src="lhxAvatar" alt="LHX" />
                  <div class="author-meta">
                    <b>LHX</b>
                    <span>客户端 · 交互</span>
                  </div>
                </div>
                <div class="author-item">
                  <img :src="shuixianAvatar" alt="宝藏水仙" />
                  <div class="author-meta">
                    <b>宝藏水仙</b>
                    <span>视觉 · 体验</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="about-rows">
              <div class="about-row"><span class="k">应用名称</span><span class="v">萌萌音乐 · MengMeng Music</span></div>
              <div class="about-row">
                <span class="k">当前版本</span>
                <span class="v">
                  v{{ update.version || '—' }}
                  <button class="row-link" @click="update.check({ silent: false })">检查更新</button>
                </span>
              </div>
              <div class="about-row">
                <span class="k">官方网站</span>
                <span class="v">
                  {{ update.origin }}
                  <button class="row-link" @click="update.openSite()">打开下载页</button>
                </span>
              </div>
              <div class="about-row"><span class="k">更新方式</span><span class="v">{{ update.portable ? '便携版 · 自动替换并重启' : '安装版 · 启动安装程序覆盖升级' }}</span></div>
              <div class="about-row"><span class="k">技术栈</span><span class="v">Vue 3 / Vite / Electron / Pinia / Element Plus</span></div>
              <div class="about-row"><span class="k">数据来源</span><span class="v">本地运行的 KuGouMusicApi（标准版 + 概念版双实例）</span></div>
              <div class="about-row"><span class="k">使用许可</span><span class="v">MML-1.0 · 仅供学习研究，禁止任何商业使用</span></div>
            </div>
            <div class="guide-row">
              <div class="guide-row-text">
                <b>页面引导</b>
                <span>进入一个没去过的页面时，用萌小萌的弹窗介绍这一页能做什么</span>
              </div>
              <SettingToggle
                :model-value="app.settings.guideOn !== false"
                on-label="已开启"
                off-label="已关闭"
                @change="set({ guideOn: $event })"
              />
              <button class="mini-btn" @click="showGuideNow">查看当前页引导</button>
              <button class="mini-btn ghost" @click="reopenDisclaimer">免责声明</button>
            </div>

            <div class="disclaimer">
              <strong>免责声明</strong>
              <p>
                本软件仅供个人学习、技术研究与交流使用，不得用于任何商业用途。
                软件内所有音乐、封面、歌词等内容版权均归酷狗音乐及相应版权方所有，本软件不存储、不提供任何音源文件。
                使用本软件产生的任何后果由使用者自行承担，开发者不对内容的合法性、准确性及可用性作任何担保。
                若你喜爱某首作品，请通过官方渠道购买会员或数字专辑支持创作者。
              </p>
            </div>
          </section>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.theme-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.theme-pill {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 13px 0 8px;
  border-radius: 17px;
  border: 1px solid var(--kg-line-2);
  background: var(--kg-panel-2);
  font-size: 12px;
  color: var(--kg-text-2);
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}
.theme-pill:hover {
  border-color: var(--kg-accent);
  color: var(--kg-text);
}
.theme-pill.active {
  border-color: var(--kg-accent);
  background: var(--kg-accent-soft);
  color: var(--kg-text);
  font-weight: 600;
}
.theme-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  flex: 0 0 20px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
}
.theme-check {
  color: var(--kg-accent-dark);
}
.auto-text {
  font-size: 9px;
  color: var(--kg-text-3);
}
.fav-list {
  max-height: 168px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.fav-row {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 30px;
  padding: 0 4px;
  border-radius: 7px;
}
.fav-row:hover {
  background: var(--kg-hover);
}
.fav-text {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  color: var(--kg-text);
}
.fav-song {
  font-size: 11px;
  color: var(--kg-text-3);
  max-width: 40%;
}
.fav-del {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--kg-text-3);
}
.fav-del:hover {
  background: rgba(229, 72, 77, 0.12);
  color: #e5484d;
}
.settings {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 18px 24px 0;
  min-height: 0;
}
.account-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  border-radius: 14px;
  background: var(--kg-surface);
  border: 1px solid var(--kg-line);
  flex: 0 0 auto;
}
.acc-ava {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
}
.acc-badges {
  margin-right: 2px;
}
.acc-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: var(--kg-panel);
  color: var(--kg-accent-dark);
  font-size: 20px;
  font-weight: 700;
  flex: 0 0 52px;
}
.acc-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.acc-meta {
  flex: 1;
  min-width: 0;
}
.acc-line {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.acc-line h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}
.acc-id {
  font-size: 11.5px;
  color: var(--kg-text-3);
}
.acc-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}
.tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 9px;
  background: var(--kg-panel);
  color: var(--kg-text-2);
  border: 1px solid var(--kg-line);
}
.tag.on {
  color: #7a4d00;
  background: linear-gradient(135deg, #ffe6b0, #f6c678);
  border-color: transparent;
  font-weight: 600;
}
.tag.plain {
  color: var(--kg-text-3);
}
.text-link {
  font-size: 11.5px;
  color: var(--kg-accent-dark);
}
.acc-actions {
  display: flex;
  gap: 8px;
  flex: 0 0 auto;
}
.acc-btn {
  height: 32px;
  padding: 0 13px;
  border-radius: 8px;
  font-size: 12.5px;
  background: var(--kg-panel);
  border: 1px solid var(--kg-line);
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--kg-text);
}
.acc-btn:hover {
  background: var(--kg-hover);
}
.acc-btn.primary {
  background: var(--kg-accent);
  border-color: transparent;
  color: #fff;
  font-weight: 600;
}
.acc-btn.danger {
  color: #e5484d;
  border-color: rgba(229, 72, 77, 0.4);
  background: rgba(229, 72, 77, 0.08);
  font-weight: 600;
}
.acc-btn.danger:hover {
  background: rgba(229, 72, 77, 0.16);
}

.set-main {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 18px;
  margin-top: 14px;
}
.set-nav {
  width: 190px;
  flex: 0 0 190px;
  padding-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  overflow-y: auto;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 10px;
  border-radius: 9px;
  color: var(--kg-text-2);
  text-align: left;
  transition: background 0.15s ease, color 0.15s ease;
}
.nav-item:hover {
  background: var(--kg-hover);
}
.nav-item.active {
  background: var(--kg-accent-soft);
  color: var(--kg-accent-dark);
}
.nav-item.active .nav-label {
  font-weight: 600;
}
.nav-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.nav-label {
  font-size: 12.5px;
}
.nav-desc {
  font-size: 10px;
  color: var(--kg-text-3);
}
.nav-item.active .nav-desc {
  color: var(--kg-accent-dark);
  opacity: 0.8;
}

.set-body {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 0 4px 40px 0;
}
.set-section {
  margin-bottom: 22px;
}
.sec-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--kg-line);
}
.sec-head h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
}
.sec-desc {
  font-size: 11.5px;
  color: var(--kg-text-3);
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.grid :deep(.set-card.span) {
  grid-column: span 2;
}

.bg-row {
  display: flex;
  gap: 12px;
}
.bg-preview {
  width: 132px;
  height: 84px;
  border-radius: 9px;
  overflow: hidden;
  background: var(--kg-panel);
  display: grid;
  place-items: center;
  font-size: 11px;
  color: var(--kg-text-3);
  flex: 0 0 132px;
}
.bg-preview img,
.bg-preview video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.bg-actions {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.btn-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.btn-row.gap {
  margin-top: 8px;
}
.slider-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.slider-label {
  font-size: 11px;
  color: var(--kg-text-3);
  flex: 0 0 auto;
}
.mini-btn {
  height: 28px;
  padding: 0 11px;
  border-radius: 7px;
  font-size: 11.5px;
  background: var(--kg-accent);
  color: #fff;
  font-weight: 600;
}
.mini-btn:hover {
  filter: brightness(1.05);
}
.mini-btn.ghost {
  background: var(--kg-panel);
  color: var(--kg-text-2);
  border: 1px solid var(--kg-line);
  font-weight: 500;
}
.mini-btn.ghost:hover {
  background: var(--kg-hover);
}
.mini-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.row-link {
  margin-left: 8px;
  padding: 0;
  border: 0;
  background: none;
  font-size: 11.5px;
  color: var(--kg-accent);
  cursor: pointer;
}
.row-link:hover {
  text-decoration: underline;
}
.dim-label {
  font-size: 11px;
  color: var(--kg-text-3);
}
.auto-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.auto-row :deep(.set-switch) {
  width: auto;
  min-width: 116px;
  gap: 10px;
}
.proxy-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.msg-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 34px;
  padding: 0 6px 0 12px;
  border-radius: 9px;
  background: var(--kg-panel);
  font-size: 11.5px;
  color: var(--kg-text-2);
}
.msg-pill span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dir-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dir {
  flex: 1;
  min-width: 0;
  font-size: 11.5px;
  color: var(--kg-text-2);
}
.dir-list {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dir-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--kg-text-3);
}
.dir-item span {
  flex: 1;
  min-width: 0;
}
.dir-item .x {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  display: grid;
  place-items: center;
  color: var(--kg-text-3);
}
.dir-item .x:hover {
  background: var(--kg-hover);
  color: #e5484d;
}

.about-card {
  border-radius: 14px;
  background: var(--kg-surface);
  border: 1px solid var(--kg-line);
  padding: 16px 18px;
}
.about-head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.app-icon {
  width: 46px;
  height: 46px;
  border-radius: 12px;
}
.about-title {
  flex: 1;
  min-width: 0;
}
.about-title h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
}
.about-title span {
  font-size: 11.5px;
  color: var(--kg-text-3);
}
.bar-setting {
  display: flex;
  align-items: center;
  gap: 10px;
}
.greet-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.about-authors {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--kg-line);
}
.about-authors-label {
  font-size: 11px;
  color: var(--kg-text-3);
  letter-spacing: 1px;
  flex: 0 0 auto;
}
.about-authors-list {
  display: flex;
  align-items: center;
  gap: 10px;
}
.author-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 6px 12px 6px 6px;
  border-radius: 12px;
  background: var(--kg-panel-2);
  border: 1px solid var(--kg-line);
}
.author-item img {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
  border: 1px solid var(--kg-line-2);
}
.author-meta {
  display: flex;
  flex-direction: column;
  line-height: 1.35;
}
.author-meta b {
  font-size: 12.5px;
  font-weight: 600;
}
.author-meta span {
  font-size: 10.5px;
  color: var(--kg-text-3);
}
.about-rows {
  margin-top: 14px;
  border-top: 1px solid var(--kg-line);
}
.about-row {
  display: flex;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px dashed var(--kg-line);
  font-size: 12px;
}
.about-row .k {
  width: 86px;
  flex: 0 0 86px;
  color: var(--kg-text-3);
}
.about-row .v {
  flex: 1;
  min-width: 0;
  color: var(--kg-text);
}
.source-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.source-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 11px;
  border: 1px solid var(--kg-line-2);
  background: var(--kg-panel-2);
  text-align: left;
  min-width: 0;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.source-card:hover {
  border-color: var(--kg-accent);
  background: var(--kg-panel);
}
.source-card.active {
  border-color: var(--kg-accent);
  background: var(--kg-accent-soft);
}
.source-card:disabled {
  opacity: 0.6;
  cursor: default;
}
.source-logo {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  object-fit: cover;
  flex: 0 0 34px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.05);
}
.source-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}
.source-text b {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--kg-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.source-text i {
  font-style: normal;
  font-size: 10.5px;
  color: var(--kg-text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.source-check {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--kg-accent);
  display: grid;
  place-items: center;
  flex: 0 0 18px;
}
.guide-row {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--kg-panel-2);
  border: 1px solid var(--kg-line);
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.guide-row-text {
  flex: 1 1 240px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.guide-row-text b {
  font-size: 12.5px;
  color: var(--kg-text);
}
.guide-row-text span {
  font-size: 11.5px;
  color: var(--kg-text-3);
  line-height: 1.6;
}
.disclaimer {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--kg-panel-2);
  border: 1px dashed var(--kg-line-2);
}
.disclaimer strong {
  font-size: 12px;
  color: var(--kg-text);
}
.disclaimer p {
  margin: 6px 0 0;
  font-size: 11.5px;
  line-height: 1.85;
  color: var(--kg-text-2);
}
</style>
