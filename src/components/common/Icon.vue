<script setup>
import { computed } from 'vue';

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 20 },
  color: { type: String, default: 'currentColor' },
  filled: { type: Boolean, default: false },
  strokeWidth: { type: [Number, String], default: 1.8 },
});

const paths = {
  home: '<path d="M3.2 10.4 12 3.2l8.8 7.2V20a.9.9 0 0 1-.9.9h-5.1v-6.4H9.2v6.4H4.1a.9.9 0 0 1-.9-.9z"/>',
  compass: '<circle cx="12" cy="12" r="8.6"/><path d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1z"/>',
  radio: '<rect x="3.4" y="8.6" width="17.2" height="11.6" rx="2.2"/><path d="m7.6 8.6 8.4-4.6"/><circle cx="8.4" cy="14.4" r="2.1"/><path d="M13.6 12.6h4M13.6 16.2h4"/>',
  headphones: '<path d="M4.4 15.2v-3.1a7.6 7.6 0 0 1 15.2 0v3.1"/><rect x="2.8" y="13.6" width="4" height="6.4" rx="2"/><rect x="17.2" y="13.6" width="4" height="6.4" rx="2"/>',
  heart: '<path d="M12 20.4c-.4 0-.8-.15-1.1-.42C7.3 16.7 3.6 13.4 3.6 9.5A4.7 4.7 0 0 1 12 6.8a4.7 4.7 0 0 1 8.4 2.7c0 3.9-3.7 7.2-7.3 10.48-.3.27-.7.42-1.1.42z"/>',
  clock: '<circle cx="12" cy="12" r="8.7"/><path d="M12 7.3V12l3.3 2"/>',
  download: '<path d="M12 3.6v10.8m0 0 3.8-3.8M12 14.4l-3.8-3.8"/><path d="M4.4 16.4v2.8c0 .7.6 1.2 1.2 1.2h12.8c.6 0 1.2-.5 1.2-1.2v-2.8"/>',
  list: '<path d="M4 6.6h2.2M4 12h2.2M4 17.4h2.2"/><path d="M9.4 6.6h10.6M9.4 12h10.6M9.4 17.4h10.6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.9"/><path d="m16 16 4 4"/>',
  back: '<path d="M15 4.8 7.8 12l7.2 7.2"/>',
  forward: '<path d="M9 4.8 16.2 12 9 19.2"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.7-6"/><path d="M20 4.6V9h-4.4"/>',
  note: '<path d="M9.2 18.2V6.6l9.2-2v11.6"/><circle cx="6.6" cy="18.6" r="2.6"/><circle cx="15.8" cy="16.4" r="2.6"/>',
  shield: '<path d="M12 3.2 19 6v5.6c0 4.1-2.9 7.8-7 9.2-4.1-1.4-7-5.1-7-9.2V6z"/><path d="m9 12 2.1 2.1L15.4 10"/>',
  minimize: '<path d="M5 12h14"/>',
  maximize: '<rect x="5.2" y="5.2" width="13.6" height="13.6" rx="1.6"/>',
  restore: '<rect x="4.6" y="7.4" width="11" height="11" rx="1.4"/><path d="M8.4 7.4V5.6c0-.6.5-1.1 1.1-1.1h9.9c.6 0 1.1.5 1.1 1.1v9.9c0 .6-.5 1.1-1.1 1.1h-1.8"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  play: '<path d="M8.4 5.6v12.8L18.6 12z"/>',
  pause: '<path d="M7.6 5.4h3.2v13.2H7.6zM13.2 5.4h3.2v13.2h-3.2z"/>',
  prev: '<path d="M6.2 5.4v13.2"/><path d="M18.4 5.8v12.4L8.8 12z"/>',
  next: '<path d="M17.8 5.4v13.2"/><path d="M5.6 5.8v12.4L15.2 12z"/>',
  volume: '<path d="M4.2 9.4h3.2l4-3.4v12l-4-3.4H4.2z"/><path d="M15 9.2a4 4 0 0 1 0 5.6M17.6 6.8a7.4 7.4 0 0 1 0 10.4"/>',
  'volume-mute': '<path d="M4.2 9.4h3.2l4-3.4v12l-4-3.4H4.2z"/><path d="m15.4 9.6 4.4 4.4M19.8 9.6l-4.4 4.4"/>',
  queue: '<path d="M4 6.4h11M4 11.6h11M4 16.8h7"/><path d="M17.4 11.2v7.2l4-3.6z"/>',
  repeat: '<path d="M5 8.6a3.2 3.2 0 0 1 3.2-3.2h9.4"/><path d="m15.2 2.8 2.6 2.6-2.6 2.6"/><path d="M19 15.4a3.2 3.2 0 0 1-3.2 3.2H6.4"/><path d="m8.8 21.2-2.6-2.6 2.6-2.6"/>',
  'repeat-one': '<path d="M5 8.6a3.2 3.2 0 0 1 3.2-3.2h9.4"/><path d="m15.2 2.8 2.6 2.6-2.6 2.6"/><path d="M19 15.4a3.2 3.2 0 0 1-3.2 3.2H6.4"/><path d="m8.8 21.2-2.6-2.6 2.6-2.6"/><path d="M12 10.4v4.4"/>',
  shuffle: '<path d="M4 6.6h3.4l9 10.8H20"/><path d="M4 17.4h3.4l2.6-3.2"/><path d="M14.2 9.4l2.2-2.8H20"/><path d="m17.4 3.4 2.6 2.6-2.6 2.6"/><path d="m17.4 14.8 2.6 2.6-2.6 2.6"/>',
  more: '<circle cx="5.4" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18.6" cy="12" r="1.5"/>',
  folder: '<path d="M3.4 7.4c0-.9.7-1.6 1.6-1.6h4l2 2.2h7.9c.9 0 1.6.7 1.6 1.6v8.2c0 .9-.7 1.6-1.6 1.6H5c-.9 0-1.6-.7-1.6-1.6z"/>',
  cloud: '<path d="M7.4 18.4h9.8a3.6 3.6 0 0 0 .4-7.2 5.4 5.4 0 0 0-10.3-1.4 4.3 4.3 0 0 0 .1 8.6z"/>',
  singer: '<circle cx="12" cy="8.2" r="3.6"/><path d="M4.8 20.4a7.2 7.2 0 0 1 14.4 0"/>',
  album: '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="2.2"/>',
  rank: '<path d="M4.4 20.2V13M9.6 20.2V8.2M14.8 20.2v-5.4M20 20.2V4.2"/>',
  trash: '<path d="M5 7.4h14M9.6 7.4V5.6c0-.6.5-1.1 1.1-1.1h2.6c.6 0 1.1.5 1.1 1.1v1.8"/><path d="M7.4 7.4l.9 12c.05.7.6 1.2 1.3 1.2h4.8c.7 0 1.25-.5 1.3-1.2l.9-12"/>',
  edit: '<path d="M4.4 19.6h4l10-10a2.4 2.4 0 0 0-3.4-3.4l-10 10z"/><path d="m13.6 7.4 3.4 3.4"/>',
  check: '<path d="m5 12.6 4.4 4.4L19 7.4"/>',
  'arrow-right': '<path d="M9.4 5.6 15.8 12l-6.4 6.4"/>',
  fullscreen: '<path d="M9.4 4.4H4.4v5M14.6 4.4h5v5M9.4 19.6H4.4v-5M14.6 19.6h5v-5"/>',
  comment: '<path d="M20.2 11.8c0 4-3.7 7.2-8.2 7.2-1 0-2-.2-2.9-.5l-4 1.8 1-3.6c-1.3-1.3-2.1-3-2.1-4.9 0-4 3.7-7.2 8.2-7.2s8 3.2 8 7.2z"/>',
  share: '<circle cx="17.4" cy="5.8" r="2.6"/><circle cx="6.4" cy="12" r="2.6"/><circle cx="17.4" cy="18.2" r="2.6"/><path d="m8.7 10.7 6.4-3.6M8.7 13.3l6.4 3.6"/>',
  mv: '<rect x="3.4" y="5.4" width="17.2" height="13.2" rx="2.2"/><path d="M10.4 9.6v4.8l3.8-2.4z"/>',
  vip: '<path d="M4 8.4 7.2 15h9.6L20 8.4l-4.6 2L12 5.4 8.6 10.4z"/><path d="M7.2 18.4h9.6"/>',
  eq: '<path d="M5.4 20V10M10.4 20V4M15.4 20v-7M20.4 20V7"/>',
  star: '<path d="m12 3.8 2.6 5.4 5.8.8-4.2 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.6 10l5.8-.8z"/>',
  phone: '<rect x="6.6" y="3.4" width="10.8" height="17.2" rx="2.4"/><path d="M10.6 17.4h2.8"/>',
  qr: '<rect x="4" y="4" width="6.2" height="6.2" rx="1"/><rect x="13.8" y="4" width="6.2" height="6.2" rx="1"/><rect x="4" y="13.8" width="6.2" height="6.2" rx="1"/><path d="M13.8 13.8h2.6v2.6h-2.6zM17.4 17.4H20V20h-2.6z"/>',
  logout: '<path d="M14.6 4.4H6.2c-.7 0-1.2.5-1.2 1.2v12.8c0 .7.5 1.2 1.2 1.2h8.4"/><path d="M17.4 8.4 21 12l-3.6 3.6M11.6 12H21"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.2 14.4a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a1.9 1.9 0 1 1-3.8 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3.4a1.9 1.9 0 1 1 0-3.8h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3.4a1.9 1.9 0 1 1 3.8 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1h.2a1.9 1.9 0 1 1 0 3.8h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6"/>',
  moon: '<path d="M20 13.6A8.2 8.2 0 0 1 10.4 4 8.6 8.6 0 1 0 20 13.6z"/>',
  mic: '<rect x="9" y="3" width="6" height="10.4" rx="3"/><path d="M5.6 11.4a6.4 6.4 0 0 0 12.8 0M12 17.8V21M9 21h6"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3.2"/><circle cx="9" cy="9" r="1.3"/><circle cx="15" cy="15" r="1.3"/><circle cx="15" cy="9" r="1.3"/><circle cx="9" cy="15" r="1.3"/>',
  'chevron-down': '<path d="m6.4 9.4 5.6 5.6 5.6-5.6"/>',
  'chevron-up': '<path d="m6.4 14.6 5.6-5.6 5.6 5.6"/>',
  male: '<circle cx="10.4" cy="13.6" r="5"/><path d="m14.4 9.6 4.4-4.4M15.2 5.2h4v4"/>',
  female: '<circle cx="12" cy="9.2" r="5"/><path d="M12 14.2v6M9 17.4h6"/>',
  'volume-low': '<path d="M4.2 9.4h3.2l4-3.4v12l-4-3.4H4.2z"/><path d="M15 9.2a4 4 0 0 1 0 5.6"/>',
  'close-small': '<path d="M7 7l10 10M17 7 7 17"/>',
  wallpaper: '<rect x="3.6" y="5" width="16.8" height="14" rx="2.4"/><circle cx="8.8" cy="10" r="1.6"/><path d="m5 17 4.4-4.4 3 3 2.6-2.6L20 17"/>',
  lyricbar: '<rect x="3.4" y="6.2" width="17.2" height="11.6" rx="3"/><path d="M6.8 10.2h6.4M6.8 13.8h9.6"/><circle cx="17.4" cy="10.2" r="1.2"/>',
  game: '<rect x="3.2" y="8" width="17.6" height="9.6" rx="4.8"/><path d="M8 11v3.2M6.4 12.6h3.2"/><circle cx="16.4" cy="12.2" r="1"/><circle cx="18.2" cy="14" r="1"/>',
  bell: '<path d="M6.4 9.6a5.6 5.6 0 0 1 11.2 0c0 4 1.6 5.6 1.6 5.6H4.8s1.6-1.6 1.6-5.6z"/><path d="M10.2 18.4a2 2 0 0 0 3.6 0"/>',
  playcircle: '<circle cx="12" cy="12" r="8.6"/><path d="M10 8.8v6.4l5.2-3.2z"/>',
  pausecircle: '<circle cx="12" cy="12" r="8.6"/><path d="M10 9v6M14 9v6"/>',
  'arrow-down': '<path d="M12 4.6v14.8M6.4 13.8 12 19.4l5.6-5.6"/>',
  'arrow-up': '<path d="M12 19.4V4.6M6.4 10.2 12 4.6l5.6 5.6"/>',
  book: '<path d="M4.4 5.2c2.6-1 5-.6 7.6 1 2.6-1.6 5-2 7.6-1v13c-2.6-1-5-.6-7.6 1-2.6-1.6-5-2-7.6-1z"/><path d="M12 6.2v13"/>',
  fire: '<path d="M12 3.4c.6 3.4-2.6 4.4-2.6 7.2 0 1.2.8 2 1.8 2 .4-1 .4-2.2 1.4-3.2 1.8 1.8 3.4 3.6 3.4 6 0 2.6-2.2 4.6-4.8 4.6S6 18.2 6 15.4c0-4.6 4.4-6.6 6-12z"/>',
  user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.6 20.4a7.4 7.4 0 0 1 14.8 0"/>',
  lock: '<rect x="4.8" y="10.4" width="14.4" height="9.6" rx="2.2"/><path d="M8.2 10.4V7.6a3.8 3.8 0 0 1 7.6 0v2.8"/>',
  unlock: '<rect x="4.8" y="10.4" width="14.4" height="9.6" rx="2.2"/><path d="M8.2 10.4V7.6a3.8 3.8 0 0 1 7.2-1.4"/>',
  pin: '<path d="M12 3.6v9.2"/><path d="M8.4 8.4 12 12l3.6-3.6"/><path d="M4.8 16.4h14.4"/>',
  top: '<rect x="3.8" y="3.8" width="16.4" height="4.2" rx="1.4"/><path d="M12 9.4v6.2M8.6 12.4 12 9l3.4 3.4M7 20.2h10"/>',
  minus: '<path d="M5 12h14"/>',
  crown: '<path d="M3.4 7.6 7.2 14h9.6l3.8-6.4-4.8 2.2L12 4.6 8.2 9.8z"/><path d="M7.2 17.4h9.6"/>',
  power: '<path d="M12 3.6v7.2"/><path d="M7.4 6.2a7.4 7.4 0 1 0 9.2 0"/>',
  /* 搜索面板四个蓝色实心快捷图标（对齐酷狗搜索下拉） */
  'q-daily': '<path d="M7 2.6a1.4 1.4 0 0 1 1.4 1.4v1.4h7.2V4A1.4 1.4 0 1 1 17 2.6 1.4 1.4 0 0 1 18.4 4v1.5A2.6 2.6 0 0 1 21 8.1v10.3A2.6 2.6 0 0 1 18.4 21H5.6A2.6 2.6 0 0 1 3 18.4V8.1a2.6 2.6 0 0 1 2.6-2.6H5.6V4A1.4 1.4 0 0 1 7 2.6Z"/><path fill="#fff" d="M6.6 10.1h3.2v3.2H6.6zM14.2 10.1h3.2v3.2h-3.2zM6.6 15.3h3.2v2.4H6.6zM14.2 15.3h3.2v2.4h-3.2z"/>',
  'q-rank': '<rect x="3.2" y="12" width="4.4" height="8.4" rx="2.2"/><rect x="9.8" y="6.6" width="4.4" height="13.8" rx="2.2"/><rect x="16.4" y="3" width="4.4" height="17.4" rx="2.2"/>',
  'q-category': '<rect x="3.2" y="3.2" width="8" height="8" rx="3"/><rect x="12.8" y="3.2" width="8" height="8" rx="3"/><rect x="3.2" y="12.8" width="8" height="8" rx="3"/><rect x="12.8" y="12.8" width="8" height="8" rx="3"/>',
  'q-new': '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.2" fill="#fff"/>',
};

const html = computed(() => paths[props.name] || paths.note);
const px = computed(() => (typeof props.size === 'number' ? `${props.size}px` : props.size));
</script>

<template>
  <svg
    class="kg-icon"
    :width="px"
    :height="px"
    viewBox="0 0 24 24"
    :fill="filled ? color : 'none'"
    :stroke="filled ? 'none' : color"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="html"
  />
</template>

<style scoped>
.kg-icon {
  display: inline-block;
  flex: 0 0 auto;
  vertical-align: middle;
}
</style>
