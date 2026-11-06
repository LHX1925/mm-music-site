/**
 * 数据归一化：酷狗各接口返回结构差异较大，这里统一成前端可直接消费的模型
 */
import { songFlags } from '@/utils/songFlags';

const CDN = 'http://imge.kugou.com';

/** 图片尺寸占位符替换 */
export function img(url, size = 240) {
  if (!url) return '';
  let u = String(url).trim();
  if (!u) return '';
  if (u.startsWith('//')) u = `https:${u}`;
  u = u.replace(/\{size\}/g, String(size));
  return u;
}

function first(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)) return v;
  }
  return undefined;
}

/** 时长统一为秒 */
function toSeconds(v) {
  const n = Number(v) || 0;
  if (n > 100000) return Math.round(n / 1000);
  return Math.round(n);
}

/** 歌手字段可能是字符串、数组、author 列表 */
function singersOf(raw) {
  const direct = first(raw.SingerName, raw.singername, raw.author_name, raw.singer_name, raw.artist_name);
  if (direct) return String(direct).replace(/,/g, '、');
  const arr = first(raw.authors, raw.singerinfo, raw.singer_list);
  if (Array.isArray(arr)) {
    return arr
      .map((a) => first(a.author_name, a.singer_name, a.name, a.nickname))
      .filter(Boolean)
      .join('、');
  }
  if (raw.author) return String(raw.author);
  return '未知歌手';
}

/** 从文件名推断歌名 */
function nameFromFilename(filename) {
  if (!filename) return '';
  const idx = filename.indexOf(' - ');
  return idx > 0 ? filename.slice(idx + 3) : filename;
}

/**
 * 歌曲归一化
 * 兼容：搜索、每日推荐、歌单、榜单、专辑、FM、云盘等返回结构
 */
export function normalizeSong(raw = {}) {
  if (!raw) return null;
  const audio = raw.audio_info || raw.audioInfo || {};
  const tp = raw.trans_param || raw.transParam || {};
  const albumInfo = raw.album_info || raw.albuminfo || {};
  const flags = songFlags(raw);

  const hash =
    first(
      raw.FileHash,
      raw.hash,
      raw.file_hash,
      audio.hash_320,
      audio.hash_128,
      raw.hash_320,
      raw.hash_128,
      audio.hash_flac,
      raw.hash_flac,
      tp.ogg_320_hash,
      tp.ogg_128_hash,
      raw.HQFileHash,
      raw.SQFileHash,
      raw.ResFileHash
    ) || '';

  const singer = singersOf(raw);
  let name = first(
    raw.SongName,
    raw.songname,
    raw.name,
    raw.audio_name,
    raw.ori_audio_name,
    nameFromFilename(raw.filename || raw.FileName)
  );
  // 形如「歌手 - 歌名」的拼接名称，去掉歌手前缀
  if (name && singer && singer !== '未知歌手') {
    const prefix = `${singer} - `;
    if (String(name).startsWith(prefix)) name = String(name).slice(prefix.length);
  }

  const albumId = first(raw.AlbumID, raw.album_id, albumInfo.album_id, raw.albumid, 0);
  const albumAudioId = first(raw.MixSongID, raw.mixsongid, raw.add_mixsongid, raw.album_audio_id, raw.audio_id, raw.Audioid, 0);

  const qualities = [];
  if (first(raw.FileHash, raw.hash_128, audio.hash_128)) qualities.push({ key: '128', label: '标准', bitrate: 128 });
  if (first(raw.HQFileHash, raw.hash_320, audio.hash_320)) qualities.push({ key: '320', label: '高品', bitrate: 320 });
  if (first(raw.SQFileHash, raw.hash_flac, audio.hash_flac)) qualities.push({ key: 'flac', label: '无损', bitrate: 900 });
  if (first(raw.ResFileHash, audio.hash_super)) qualities.push({ key: 'high', label: 'Hi-Res', bitrate: 2000 });

  const cover = first(
    raw.Image,
    raw.album_cover,
    raw.author_cover,
    raw.imgurl,
    raw.image,
    raw.pic,
    raw.cover,
    raw.sizable_cover,
    albumInfo.sizable_cover,
    tp.union_cover,
    raw.album_image
  );

  return {
    id: `${albumAudioId || hash}`,
    hash: String(hash || '').toUpperCase(),
    name: name || '未知歌曲',
    singer,
    singerIds: first(raw.SingerId, raw.singer_id, (raw.singerinfo || []).map((s) => s.id), []) || [],
    album: first(raw.AlbumName, raw.album_name, albumInfo.album_name, albumInfo.name, raw.remark, '') || '',
    albumId: Number(albumId) || 0,
    albumAudioId: Number(albumAudioId) || 0,
    duration: toSeconds(first(raw.Duration, raw.timelength, raw.timelen, raw.time_length, raw.duration, audio.duration_128, 0)),
    cover: img(cover, 240),
    coverBig: img(cover, 480),
    privilege: flags.privilege,
    payType: flags.payType,
    isVip: flags.isVip,
    /** 1 = 原创；各接口的等价字段由 songFlags 统一汇总 */
    isOriginal: flags.isOriginal ? 1 : 0,
    hasMv: flags.hasMv,
    mvHash: flags.mvHash,
    videoId: flags.videoId ? String(flags.videoId) : '',
    mvType: first(raw.MvType, raw.mv_type, 0) || 0,
    qualities,
    source: raw.source || '',
    raw,
  };
}

/** 批量归一化并去重 */
export function normalizeSongs(list = []) {
  const seen = new Set();
  const out = [];
  for (const item of list || []) {
    const s = normalizeSong(item);
    if (!s || !s.hash) continue;
    const key = `${s.hash}_${s.albumAudioId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/** 歌单归一化 */
export function normalizePlaylist(raw = {}) {
  const id = first(raw.global_collection_id, raw.specialid, raw.special_id, raw.listid, raw.id, raw.sheet_id, raw.collection_id);
  const cover = first(raw.imgurl, raw.img, raw.pic, raw.cover, raw.flexible_cover, raw.image, raw.list_pic, raw.sizable_cover);
  const creator = first(raw.nickname, raw.username, raw.singername, raw.user_name, raw.create_user_name, '');
  const tags = Array.isArray(raw.tags) ? raw.tags.map((t) => (typeof t === 'string' ? t : t.tag_name)).filter(Boolean) : [];
  return {
    id: String(id || ''),
    name: first(raw.specialname, raw.name, raw.listname, raw.sheet_name, raw.title, '未命名歌单'),
    cover: img(cover, 300),
    creator,
    playCount: Number(first(raw.play_count, raw.playcount, raw.play_times, raw.visits, 0)) || 0,
    songCount: Number(first(raw.songcount, raw.song_count, raw.percount, raw.count, raw.total, 0)) || 0,
    intro: first(raw.intro, raw.description, raw.desc, '') || '',
    tags,
    collectCount: Number(first(raw.collectcount, raw.collect_count, 0)) || 0,
    updateTime: first(raw.update_time, raw.publishtime, raw.create_time, '') || '',
    raw,
  };
}

/** 排行榜归一化 */
export function normalizeRank(raw = {}) {
  const cover = first(raw.img_9, raw.album_img_9, raw.imgurl, raw.img, raw.banner_9, raw.img_cover, raw.bannerurl);
  return {
    id: String(first(raw.rankid, raw.id, raw.rank_id, '') || ''),
    name: first(raw.rankname, raw.name, raw.rank_name, '排行榜'),
    cover: img(cover, 300),
    banner: img(first(raw.banner_9, raw.banner7url, raw.bannerurl, raw.img_9), 750),
    intro: first(raw.intro, raw.description, '') || '',
    playCount: Number(first(raw.play_times, raw.play_count, 0)) || 0,
    updateFrequency: first(raw.update_frequency, raw.update_frequency_type, '') || '',
    songs: Array.isArray(raw.songinfo) ? raw.songinfo.map(normalizeSong).filter(Boolean) : [],
    children: Array.isArray(raw.children) ? raw.children.map(normalizeRank) : [],
    raw,
  };
}

/** 歌手归一化 */
export function normalizeArtist(raw = {}) {
  const cover = first(raw.sizable_avatar, raw.avatar, raw.imgurl, raw.img, raw.pic, raw.image, raw.avatar_url);
  return {
    id: String(first(raw.author_id, raw.singerid, raw.id, raw.artist_id, '') || ''),
    name: first(raw.author_name, raw.singername, raw.name, raw.artist_name, '未知歌手'),
    cover: img(cover, 300),
    fans: Number(first(raw.fanscount, raw.fans_count, raw.fans, 0)) || 0,
    songs: Number(first(raw.songcount, raw.song_count, 0)) || 0,
    albums: Number(first(raw.albumcount, raw.album_count, 0)) || 0,
    intro: first(raw.intro, raw.profile, raw.description, '') || '',
    raw,
  };
}

/** 专辑归一化 */
export function normalizeAlbum(raw = {}) {
  // 搜索结果里的专辑封面字段叫 img，专辑详情才叫 sizable_cover / imgurl
  const cover = first(raw.sizable_cover, raw.cover, raw.img, raw.imgurl, raw.pic, raw.album_cover);
  return {
    id: String(first(raw.album_id, raw.albumid, raw.id, '') || ''),
    name: first(raw.album_name, raw.albumname, raw.name, '未知专辑'),
    cover: img(cover, 300),
    singer: first(raw.author_name, raw.singername, raw.singer_name, '') || '',
    singerId: first(raw.author_id, raw.singerid, 0) || 0,
    publishDate: first(raw.publish_date, raw.publish_time, raw.publishtime, '') || '',
    intro: first(raw.intro, raw.description, '') || '',
    songCount: Number(first(raw.songcount, raw.song_count, raw.total, 0)) || 0,
    raw,
  };
}
