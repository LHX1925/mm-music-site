/**
 * KuGouMusicApi 接口封装
 * 路由规则：module/xxx_yyy.js -> /xxx/yyy
 */
import { ApiError, get, post, request } from './http';
import { normalizeAlbum, normalizeArtist, normalizePlaylist, normalizeRank, normalizeSong, normalizeSongs } from './normalize';

/** 在响应中寻找第一个数组字段 */
function pickArray(body, keys = []) {
  const data = body?.data ?? body;
  if (Array.isArray(data)) return data;
  for (const k of keys) {
    if (Array.isArray(data?.[k])) return data[k];
  }
  if (data && typeof data === 'object') {
    for (const v of Object.values(data)) {
      if (Array.isArray(v) && v.length) return v;
    }
  }
  return [];
}

/* ------------------------------- 搜索 ------------------------------- */
export async function searchSongs(keyword, page = 1, pagesize = 30) {
  const body = await get('/search', { keywords: keyword, type: 'song', page, pagesize });
  const data = body?.data || {};
  const lists = data.lists || data.list || [];
  return {
    total: Number(data.total || 0) || lists.length,
    songs: normalizeSongs(lists),
    correction: data.correctiontip || '',
  };
}

export async function searchComplex(keyword, page = 1, pagesize = 20, platform) {
  const body = await get('/search/complex', { keywords: keyword, page, pagesize }, { platform });
  const data = body?.data || {};
  return {
    songs: normalizeSongs(data.lists || data.songs || []),
    playlists: (data.lists?.length ? [] : []),
    raw: data,
  };
}

export async function searchByType(keyword, type, page = 1, pagesize = 20) {
  const body = await get('/search', { keywords: keyword, type, page, pagesize });
  const data = body?.data || {};
  const lists = data.lists || [];
  return { total: Number(data.total || lists.length), lists, raw: data };
}

/**
 * 热搜：/search/hot 返回的是「分组 + keywords」结构
 * data.list = [{ name:'热搜榜', keywords:[{ keyword, reason }...] }, { name:'DJ榜', ... }]
 * 旧实现只读了每组的 name，结果面板里全是「热搜榜 / 飙升榜 / DJ榜」这些榜单名。
 */
export async function searchHot() {
  const body = await get('/search/hot');
  const data = body?.data || {};
  const list = data.list || data.hotword || data.info || [];
  const groups = [];
  for (const g of list) {
    if (typeof g === 'string') {
      groups.push({ name: '', keywords: [g] });
      continue;
    }
    const items = g?.keywords || g?.list || g?.items || g?.hotword || [];
    const keywords = (Array.isArray(items) ? items : [])
      .map((x) => (typeof x === 'string' ? x : x.keyword || x.word || x.name || x.reason))
      .filter(Boolean)
      .map((x) => String(x).trim());
    if (keywords.length) groups.push({ name: String(g?.name || g?.title || ''), keywords });
  }
  return { groups, flat: groups.flatMap((g) => g.keywords) };
}

/** 搜索联想：返回 data[].RecordDatas[].HintInfo，旧实现读 data.list 一直是空 */
export async function searchSuggest(keyword) {
  const body = await get('/search/suggest', { keywords: keyword });
  const data = body?.data || {};
  const raw = Array.isArray(data) ? data : data.list || data.records || data.RecordDatas || [];
  const out = [];
  const push = (w) => {
    const v = String(w || '').trim();
    if (v && !out.includes(v)) out.push(v);
  };
  for (const group of raw) {
    if (typeof group === 'string') { push(group); continue; }
    const items = Array.isArray(group) ? group : group?.RecordDatas || group?.record_datas || group?.list || [];
    for (const it of items || []) {
      push(typeof it === 'string' ? it : it.HintInfo || it.hintinfo || it.keyword || it.word || it.name);
    }
    push(group?.keyword || group?.Keyword);
  }
  return out.slice(0, 10);
}

/** 歌词搜索：按关键词命中「歌词内容」，返回歌曲 + 歌词片段 */
export async function searchLyrics(keyword, page = 1, pagesize = 20) {
  const body = await get('/search', { keywords: keyword, type: 'lyric', page, pagesize });
  const data = body?.data || {};
  const lists = data.lists || data.list || [];
  return {
    total: Number(data.total || lists.length),
    items: lists.map((x) => ({
      ...normalizeSong(x),
      lyricSnippet: String(x.Lyric || '')
        .replace(/\s+/g, ' ')
        .trim(),
    })),
  };
}

export async function searchDefault() {
  const body = await post('/search/default', {});
  return body?.data?.keyword || body?.data?.data?.[0]?.keyword || '周杰伦';
}

/* ------------------------------- 歌曲 ------------------------------- */
export const songDetail = (hash) => get('/audio', { hash }, { nocache: true });

/** 获取播放地址（带 auth 兜底链） */
export async function songUrl(song, quality = '320', cookie = true, freePart = false) {
  const params = {
    hash: song.hash,
    album_id: song.albumId || 0,
    album_audio_id: song.albumAudioId || 0,
    quality,
  };
  if (freePart) params.free_part = 1;
  const body = await get('/song/url', params, { nocache: true, cookie });
  return parseUrlBody(body);
}

/** 歌曲高潮片段（副歌）区间，单位秒 */
export async function songClimax(hash, platform) {
  if (!hash) return null;
  try {
    const body = await get('/song/climax', { hash }, { platform, nocache: true });
    const d = (Array.isArray(body?.data) ? body.data[0] : body?.data) || {};
    const start = Number(d.start_time || 0) / 1000;
    const end = Number(d.end_time || 0) / 1000;
    if (!end || end <= start) return null;
    return { start, end };
  } catch {
    return null;
  }
}

/**
 * VIP 取流（/song/url/new，走 gateway v6/priv_url）
 * 带 vip_token 时能解锁普通 /song/url 拿不到的会员曲目
 */
export async function songUrlNew(song, quality = '320', platform, freePart = false) {
  const params = {
    hash: song.hash,
    album_audio_id: song.albumAudioId || 0,
    quality,
    free_part: freePart ? 1 : 0,
  };
  const body = await post('/song/url/new', {}, params, { platform });
  return parseUrlBody(body);
}

export async function songUrlAuth(song, quality = '320') {
  const params = {
    hash: song.hash,
    album_id: song.albumId || 0,
    album_audio_id: song.albumAudioId || 0,
    quality,
  };
  const body = await get('/song/url/auth', params, { nocache: true });
  return parseUrlBody(body);
}

export async function userVerify(platform) {
  const body = await get('/user/verify', {}, { platform });
  return body?.data?.auth || '';
}

/**
 * 解析取流响应
 * 酷狗 /song/url 成功时 url 可能是字符串或字符串数组，另有 backupUrl 备用地址
 */
function parseUrlBody(body) {
  const d = (Array.isArray(body) ? body[0] : body?.data || body) || {};
  const rawUrl = d.url || d.play_url;
  const list = Array.isArray(rawUrl) ? rawUrl : rawUrl ? [rawUrl] : [];
  const backup = Array.isArray(d.backupUrl) ? d.backupUrl : [];
  const urls = [...list, ...backup].map((u) => String(u).replace(/\\\//g, '/')).filter(Boolean);
  const fail = Array.isArray(d.fail_process) ? d.fail_process : [];
  return {
    url: urls[0] || '',
    urls,
    bitrate: d.bitRate || d.bitrate || 0,
    ext: d.extName || d.extname || d.ext || '',
    size: d.fileSize || d.filesize || 0,
    time: d.timeLength || d.time || 0,
    needBuy: fail.includes('buy') || fail.includes('pkg') || d.priv_status === 1,
    errcode: d.errcode || body?.errcode,
    error: d.error || body?.error || body?.errmsg || '',
    backupUrl: backup,
  };
}

export async function lyric(song) {
  const byHash = async (hash, albumAudioId) => {
    if (!hash) return [];
    const body = await get(
      '/search/lyric',
      { hash, album_audio_id: albumAudioId || 0, man: 'yes' },
      { nocache: true }
    );
    return body?.data?.candidates || body?.candidates || [];
  };

  let candidates = await byHash(song.hash, song.albumAudioId);

  // 兜底：部分歌曲按 hash 查不到歌词，用「歌名 歌手」做歌词搜索再取
  if (!candidates.length && song.name) {
    try {
      const found = await searchLyrics(`${song.name} ${song.singer || ''}`.trim(), 1, 5);
      const hit = found.items.find((x) => x.hash === song.hash) || found.items[0];
      if (hit?.hash && hit.hash !== song.hash) {
        candidates = await byHash(hit.hash, hit.albumAudioId);
      }
    } catch {}
  }

  const item = candidates[0];
  if (!item) return { lyric: '', krc: '' };
  const res = await get(
    '/lyric',
    { id: item.id, accesskey: item.accesskey, fmt: 'krc', decode: true, charset: 'utf8' },
    { nocache: true }
  );
  // 接口直接返回歌词对象（{status, content, decodeContent...}），部分封装会包一层 body/data
  const content = res && (res.decodeContent !== undefined || res.content !== undefined) ? res : res?.body || res?.data || {};
  let text = content.decodeContent || '';
  if (!text && content.content) {
    // contenttype=0 时 content 是 base64 的纯文本歌词
    try {
      text = decodeURIComponent(escape(atob(content.content)));
    } catch {
      text = '';
    }
  }
  return { lyric: text, krc: content.content || '', raw: content };
}

export async function songClimaxRaw(hash, platform) {
  const body = await get('/song/climax', { hash }, { platform, nocache: true });
  return body?.data || [];
}

export async function songRanking(albumAudioId) {
  const body = await get('/song/ranking', { album_audio_id: albumAudioId });
  return body?.data || {};
}

export async function songBarrageCount(hash) {
  const body = await get('/song/barrage', { hash });
  return Number(body?.data?.count || 0);
}

/**
 * 听歌识曲：body 为 8kHz 单声道 16bit PCM（application/octet-stream）
 * 接口要求见 KuGouMusicApi `module/audio_match.js`
 */
export async function audioMatch(arrayBuffer) {
  const { baseUrl } = await import('./http');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let res;
  try {
    res = await fetch(`${baseUrl()}/audio/match?t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: arrayBuffer,
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new ApiError('识别超时了，检查一下网络再试', null);
    throw new ApiError('连不上本地识别服务，请确认 API 服务已启动', null);
  }
  clearTimeout(timer);

  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (res.status >= 500) {
    throw new ApiError(body?.error || `识别服务异常（${res.status}）`, body);
  }
  if (!body) throw new ApiError('识别服务没有返回结果，请重试', null);
  return body;
}

/* ------------------------------- 歌词/评论 ------------------------------- */
export async function commentMusic(mixsongid, page = 1, pagesize = 20) {
  const body = await post('/comment/music', {}, { mixsongid, page, pagesize });
  const d = body?.data || body || {};
  const list = (d.list || []).map(mapComment);
  const hot = (d.hot_list || []).map(mapComment);
  return {
    total: Number(d.count || d.total || 0),
    hot: hot.length ? hot : list.slice(0, 5),
    list,
    hotwords: (d.hotword_list || []).map((h) => (typeof h === 'string' ? h : h.keyword || h.name)),
    classify: d.classify_list || [],
  };
}

export async function commentCount(hash) {
  const body = await get('/comment/count', { hash });
  return Number(body?.data?.count || body?.count || body?.data?.total || 0);
}

export async function commentSend(payload) {
  return post('/comment/music/send', payload);
}

export async function commentFloor(threadId, page = 1, pagesize = 20) {
  const body = await post('/comment/floor', {}, { thread_id: threadId, page, pagesize });
  const d = body?.data || body || {};
  return { list: (d.list || []).map(mapComment), total: d.count || d.total || 0 };
}

function mapComment(c = {}) {
  const addtime = c.addtime || c.time || c.create_time || '';
  let timeText = '';
  if (addtime) {
    const n = Number(addtime);
    if (Number.isFinite(n) && n > 1e9) {
      const d = new Date(n * 1000);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      timeText = `${mm}月${dd}日`;
    } else {
      timeText = String(addtime).slice(0, 10);
    }
  }
  const pics = String(c.image || c.pic || c.images || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  let city = c.location || c.ip_location || '';
  if (!city && c.extdata) {
    try {
      city = JSON.parse(c.extdata)?.city || '';
    } catch {}
  }
  return {
    id: c.id || c.comment_id || c.tid,
    text: c.content || c.text || '',
    user: c.user_name || c.nickname || c.username || '酷狗用户',
    avatar: c.user_pic || c.avatar || c.user_avatar || '',
    time: timeText,
    likes: Number(c.like?.count || c.like_count || c.likes || 0),
    replies: Number(c.reply_num || c.replies || 0),
    location: city,
    pics,
    vip: Number(c.vip_type || c.vip || 0) > 0,
    raw: c,
  };
}

/* ------------------------------- 歌单 ------------------------------- */
export async function playlistTags() {
  const body = await post('/playlist/tags', {});
  return pickArray(body, ['0']).length ? body.data : body?.data || [];
}

export async function topPlaylists({ categoryId = 0, page = 1, pagesize = 30, withtag = 1 } = {}) {
  const body = await post(
    '/top/playlist',
    {},
    { category_id: categoryId, page, pagesize, withtag, withsong: 1, sort: 1 }
  );
  const data = body?.data || {};
  const list = data.special_list || data.list || [];
  return { playlists: list.map(normalizePlaylist), hasNext: Boolean(data.has_next), raw: data };
}

export async function playlistDetail(ids) {
  const body = await post('/playlist/detail', {}, { ids: Array.isArray(ids) ? ids.join(',') : ids });
  const data = body?.data || {};
  if (Array.isArray(data)) return data[0] ? normalizePlaylist(normalizeListInfo(data[0])) : null;
  const list = data.list || data.info || data.data || [];
  const item = Array.isArray(list) ? list[0] : list;
  return item ? normalizePlaylist(normalizeListInfo(item)) : null;
}

function normalizeListInfo(item = {}) {
  return {
    global_collection_id: item.global_collection_id || item.listid || item.specialid,
    specialname: item.name || item.specialname || item.listname,
    imgurl: item.pic || item.imgurl || item.cover,
    nickname: item.nickname || item.username || item.list_create_username,
    play_count: item.play_count || item.visits,
    songcount: item.count || item.songcount || item.total,
    intro: item.intro || item.description,
    tags: item.tags,
    ...item,
  };
}

export async function playlistTracks(id, page = 1, pagesize = 100) {
  const body = await get('/playlist/track/all', { id, page, pagesize }, { nocache: true });
  const data = body?.data || {};
  const list = data.songs || data.list || data.audios || data.info || [];
  return {
    songs: normalizeSongs(list),
    total: Number(data.count || data.total || list.length),
    info: data.list_info ? normalizePlaylist(normalizeListInfo(data.list_info)) : null,
  };
}

export async function playlistSimilar(id) {
  const body = await get('/playlist/similar', { id });
  return pickArray(body, ['list', 'similar']).map(normalizePlaylist);
}

export async function themePlaylists() {
  const body = await post('/theme/playlist', {});
  return pickArray(body, ['list']).map(normalizePlaylist);
}

export async function effectPlaylists() {
  const body = await post('/playlist/effect', {});
  return pickArray(body, ['list']).map(normalizePlaylist);
}

export const playlistCreate = (data) => post('/playlist/add', data);
export const playlistDelete = (data) => post('/playlist/del', data);

/**
 * 添加歌曲到自建歌单。
 *
 * KuGouMusicApi 的模块从 query 读取 listid / data，而不是从 POST body 的
 * songs 数组读取。data 的每一项必须是「歌名|hash|专辑ID|mixsongid」，
 * 否则模块会把空字符串转换成一条空歌曲，官方网关最终返回 502。
 */
export function playlistCloudId(playlist = {}) {
  const raw = playlist.raw || {};
  return String(raw.listid || raw.list_create_listid || playlist.cloudListid || playlist.listid || '').trim();
}

export function playlistAddTracks({ listid, songs }) {
  const list = Array.isArray(songs) ? songs : [];
  if (!listid) throw new ApiError('目标歌单 ID 无效，请重新获取歌单后重试', null);
  if (list.some((song) => String(song?.hash || '').startsWith('local_'))) {
    throw new ApiError('本地音乐无法添加到酷狗云端歌单', null);
  }
  const valid = list.filter((song) => String(song?.hash || '').trim());
  if (!valid.length) throw new ApiError('所选歌曲缺少有效的歌曲 hash，无法添加到云端歌单', null);

  const data = valid.map((song) => {
    const name = String(song.name || '未知歌曲').replace(/[|,]/g, ' ').trim() || '未知歌曲';
    const hash = String(song.hash).trim().toUpperCase();
    const albumId = Number(song.albumId || song.album_id || 0) || 0;
    const albumAudioId = Number(song.album_audio_id || song.albumAudioId || 0) || 0;
    return [name, hash, albumId, albumAudioId].join('|');
  });

  return post('/playlist/tracks/add', {}, { listid: String(listid), data: data.join(',') }, { nocache: true });
}

export const playlistDelTracks = ({ listid, fileids }) => post('/playlist/tracks/del', {}, { listid, fileids });
export const playlistSort = (data) => post('/playlist/sort', data);
export const playlistUpdate = (data) => post('/playlist/update', data);

/* ------------------------------- 榜单 ------------------------------- */
export async function rankList() {
  const body = await get('/rank/list', { withsong: 1 });
  const data = body?.data || {};
  return (data.info || []).map(normalizeRank);
}

export async function rankInfo(rankid) {
  const body = await get('/rank/info', { rankid });
  const data = body?.data || {};
  return data.info ? normalizeRank(data.info) : normalizeRank(data);
}

export async function rankAudios(rankid, page = 1, pagesize = 100) {
  const body = await post('/rank/audio', { page, pagesize }, { rankid });
  const data = body?.data || {};
  const list = data.songlist || data.songs || data.list || [];
  return { songs: normalizeSongs(list), total: Number(data.total || list.length) };
}

export async function rankTop() {
  const body = await get('/rank/top');
  return body?.data || [];
}

/* ------------------------------- 歌手 ------------------------------- */
export async function artistDetail(id) {
  const body = await post('/artist/detail', { id });
  const data = body?.data || {};
  const info = data.info || data.author || data;
  return normalizeArtist({ ...info, author_id: info.author_id || id });
}

export async function artistAudios(id, page = 1, pagesize = 50, sort = 'hot') {
  const body = await post('/artist/audios', { id, page, pagesize, sort });
  const data = body?.data || {};
  const list = Array.isArray(data) ? data : data.audios || data.list || data.songs || [];
  return { songs: normalizeSongs(list), total: Number(body?.total || data.total || list.length) };
}

export async function artistAlbums(id, page = 1, pagesize = 30) {
  const body = await get('/artist/albums', { id, page, pagesize });
  const list = pickArray(body, ['albums', 'list']);
  return list.map(normalizeAlbum);
}

export async function artistVideos(id, page = 1, pagesize = 30) {
  const body = await get('/artist/videos', { id, page, pagesize });
  const data = body?.data || {};
  return Array.isArray(data) ? data : pickArray(body, ['videos', 'list']);
}

export async function artistLists(page = 1, pagesize = 60, type = 1) {
  const body = await get('/artist/lists', { page, pagesize, type });
  return pickArray(body, ['authors', 'list', 'info']).map(normalizeArtist);
}

export async function artistFollow(id, type = 1) {
  return get(type === 1 ? '/artist/follow' : '/artist/unfollow', { id });
}

export async function artistFollowNewsongs(page = 1, pagesize = 30) {
  const body = get('/artist/follow/newsongs', { page, pagesize });
  return body;
}

export async function artistHonour(id) {
  const body = await get('/artist/honour', { id });
  return body?.data || {};
}

/* ------------------------------- 专辑 ------------------------------- */
export async function albumDetail(id) {
  const body = await post('/album/detail', { id }, { id });
  const data = body?.data || {};
  const item = Array.isArray(data) ? data[0] : data.info?.[0] || data;
  return normalizeAlbum(item);
}

export async function albumSongs(id, page = 1, pagesize = 50) {
  // 注意：该接口 pagesize 上限为 50，超过会返回 invalid param
  const body = await post('/album/songs', { id: String(id), page, pagesize: Math.min(pagesize, 50) });
  const list = pickArray(body, ['songs', 'audios', 'list']);
  return { songs: normalizeSongs(list), total: Number(body?.data?.total || body?.total || list.length) };
}

export async function albumNew(page = 1, pagesize = 20) {
  const body = await get('/album', { page, pagesize });
  return pickArray(body, ['albums', 'list']).map(normalizeAlbum);
}

/* ------------------------------- 用户 ------------------------------- */
export async function userDetail(platform) {
  const body = await post('/user/detail', {}, {}, { platform, nocache: true });
  const d = body?.data || {};
  const info = d.info || d.data || d;
  return {
    userid: info.userid || info.user_id || '',
    nickname: info.nickname || info.username || '酷狗用户',
    avatar: info.pic || info.user_pic || info.avatar || '',
    vipType: info.vip_type || 0,
    vipEndTime: info.vip_end_time || '',
    vipToken: info.vip_token || '',
    listenCount: info.total_listen_count || info.listen_count || 0,
    fans: info.fans_count || 0,
    follows: info.follow_count || 0,
    gender: info.gender || 0,
    raw: info,
  };
}

export async function userVip(platform) {
  const body = await get('/user/vip/detail', {}, { platform, nocache: true });
  return body?.data || {};
}

export async function userPlaylists(platform, page = 1, pagesize = 100) {
  const body = await post('/user/playlist', {}, { page, pagesize }, { platform, nocache: true });
  const data = body?.data || {};
  const list = data.info || data.list || data.special_list || [];
  return list.map((x) => {
    const item = normalizePlaylist({
      ...x,
      global_collection_id: x.global_collection_id || x.list_create_listid || x.listid || x.specialid,
      specialname: x.name || x.specialname,
      imgurl: x.pic || x.imgurl,
      songcount: x.count || x.songcount,
      username: x.list_create_username,
    });
    item.ownerId = String(x.list_create_userid || '');
    // type: 1 = 收藏，其余为自建（酷狗接口约定）
    item.collected = Number(x.type) === 1;
    return item;
  });
}

export async function userFollowSingers(platform, page = 1, pagesize = 60) {
  const body = await get('/user/follow', { page, pagesize }, { platform });
  return pickArray(body, ['list', 'authors', 'info']).map((x) =>
    normalizeArtist({ author_id: x.singerid || x.author_id, author_name: x.singername || x.author_name, sizable_avatar: x.pic || x.avatar })
  );
}

export async function userHistory(platform, bp = '') {
  const body = await post('/user/history', bp ? { bp } : {}, {}, { platform, nocache: true });
  const data = body?.data || {};
  const list = data.songs || data.list || data.info || [];
  return { songs: normalizeSongs(list), bp: data.bp || '' };
}

export async function userListen(platform, type = 0) {
  const body = await post('/user/listen', { type }, {}, { platform, nocache: true });
  const list = pickArray(body, ['list', 'songs', 'info']);
  return normalizeSongs(list);
}

export async function userCloud(platform, page = 1, pagesize = 50) {
  const body = await post('/user/cloud', { page, pagesize }, {}, { platform, nocache: true });
  const list = pickArray(body, ['list', 'songs', 'info']);
  return { songs: normalizeSongs(list), total: Number(body?.data?.total || list.length) };
}

export async function userCloudUrl(song, platform) {
  const body = await get(
    '/user/cloud/url',
    { hash: song.hash, album_audio_id: song.albumAudioId, name: song.name, audio_id: song.albumAudioId },
    { platform, nocache: true }
  );
  return parseUrlBody(body);
}

export async function userCloudDel(song, platform) {
  return post('/user/cloud/del', { hash: song.hash, album_audio_id: song.albumAudioId }, {}, { platform });
}

export async function userPurchasedSongs(platform, page = 1) {
  const body = await get('/user/purchased/songs', { page, pagesize: 50 }, { platform });
  return normalizeSongs(pickArray(body, ['songs', 'list']));
}

export async function userPurchasedAlbums(platform, page = 1) {
  const body = await get('/user/purchased/albums', { page, pagesize: 50 }, { platform });
  return pickArray(body, ['albums', 'list']).map(normalizeAlbum);
}

export async function userVisitors(platform) {
  const body = await get('/user/visitors', {}, { platform });
  return pickArray(body, ['list', 'visitors']);
}

export async function userGrade(platform) {
  const body = await get('/user/grade/info', {}, { platform });
  return body?.data || {};
}

export async function userUpdate(data) {
  return post('/user/update', data);
}

export async function userUpdateAvatar(data) {
  return post('/user/update/avatar', data);
}

export async function userPreference(platform) {
  const body = await get('/user/preference', {}, { platform });
  return pickArray(body, ['list', 'info']);
}

export async function userPreferenceUpdate(data) {
  return post('/user/preference/update', data);
}

export async function playhistoryUpload(data) {
  return post('/playhistory/upload', data);
}

/* ------------------------------- 登录 ------------------------------- */
export async function qrKey() {
  const body = await get('/login/qr/key', { type: 'web' }, { nocache: true });
  return body?.data?.qrcode || body?.data?.key || body?.data || '';
}

export async function qrCreate(key) {
  const body = await get('/login/qr/create', { key, qrimg: 1 }, { nocache: true });
  return body?.data || {};
}

export async function qrCheck(key, platform) {
  const body = await get('/login/qr/check', { key }, { platform, nocache: true });
  return body?.data || {};
}

export async function captchaSent(mobile, platform) {
  return post('/captcha/sent', { mobile }, {}, { platform });
}

export async function loginCellphone(mobile, code, platform) {
  const body = await post('/login/cellphone', { mobile, code }, {}, { platform, timeout: 30000 });
  return body?.data || {};
}

export async function loginToken(token, userid, platform) {
  const body = await post('/login/token', { token, userid }, {}, { platform });
  return body?.data || {};
}

/** 账号密码登录 */
export async function loginByPassword(username, password, platform) {
  const body = await post('/login', { username, password }, {}, { platform, timeout: 30000 });
  return body?.data || body || {};
}

/* ------------------------------ 概念版会员 ------------------------------ */
/** 概念版 VIP 状态（含 busi_vip 产品明细） */
export async function unionVip(platform) {
  const body = await get('/youth/union/vip', {}, { platform, nocache: true });
  return body?.data || {};
}

/** 领取指定日期的一天 VIP（概念版） */
export async function receiveDayVip(day, platform) {
  const body = await post('/youth/day/vip', {}, { receive_day: day }, { platform, timeout: 30000 });
  return body || {};
}

/** 升级为畅听 VIP（需先领取一天 VIP） */
export async function upgradeDayVip(platform) {
  const body = await post('/youth/day/vip/upgrade', {}, {}, { platform, timeout: 30000 });
  return body || {};
}

/** 当月领取记录 */
export async function monthVipRecord(platform) {
  const body = await get('/youth/month/vip/record', {}, { platform, nocache: true });
  const data = body?.data || {};
  return Array.isArray(data.list) ? data.list : [];
}

/** 听歌领 VIP（观看广告奖励） */
export async function listenSongVip(mixsongid, platform) {
  return post('/youth/listen/song', { mixsongid }, {}, { platform });
}

export async function registerDev(platform) {
  const body = await post('/register/dev', {}, {}, { platform, timeout: 30000 });
  return body?.data || {};
}

export async function loginDevice(platform) {
  const body = await post('/login/device', {}, {}, { platform });
  return body?.data || {};
}

export async function verifyInfo(eventid) {
  const body = await get('/get/verify/info', { eventid });
  return body?.data || {};
}

export async function verifySubmit(params) {
  const body = await get('/verify/user/info', params);
  return body?.data || {};
}

/* ------------------------------- 推荐 ------------------------------- */
export async function everydayRecommend(platform) {
  const body = await post('/everyday/recommend', { platform: 'ios' }, {}, { platform, nocache: true });
  const data = body?.data || {};
  return {
    songs: normalizeSongs(data.song_list || []),
    cover: data.cover_img_url || '',
    date: data.creation_date || '',
    subTitle: data.sub_title || '',
  };
}

export async function recommendSongs(platform) {
  const body = await post('/recommend/songs', {}, {}, { platform, nocache: true });
  return normalizeSongs(pickArray(body, ['song_list', 'songs', 'list']));
}

export async function homeDiscover(platform, pagesize = 6) {
  const body = await post('/home/discover', { pagesize }, {}, { platform, nocache: true });
  return pickArray(body, ['song_list', 'songs', 'list']);
}

export async function yueku(platform) {
  const body = await get('/yueku', {}, { platform });
  return body?.data || {};
}

export async function yuekuBanner(platform) {
  const body = await get('/yueku/banner', {}, { platform });
  return pickArray(body, ['banner', 'list']);
}

export async function yuekuFm(platform) {
  const body = await get('/yueku/fm', {}, { platform });
  return pickArray(body, ['list', 'info']);
}

export async function brush(platform) {
  const body = await post('/brush', {}, {}, { platform }).catch(() => null);
  const list = body ? pickArray(body, ['list', 'songs']) : [];
  // /brush 每项形如 { song: {...} }，把内层 song 提出来
  const songs = list.map((x) => x?.song || x).filter(Boolean);
  // 部分刷歌数据只有 audio_id、没有 hash，无法取流播放 → 退回私人 FM 流
  const playable = songs.filter((s) => s.hash || s.FileHash);
  if (playable.length) return playable;
  return personalFm(platform, { action: 'play' }).catch(() => []);
}

export async function aiRecommend(platform, data = {}) {
  const body = await post('/ai/recommend', data, {}, { platform });
  return body?.data || {};
}

/* ------------------------------- FM ------------------------------- */
export async function personalFm(platform, { action = 'play', hash = '', songid = '', playtime = 0, mode = 'normal' } = {}) {
  const body = await post('/personal/fm', { action, hash, songid, playtime, mode }, {}, { platform, nocache: true });
  const list = pickArray(body, ['song_list', 'songs', 'list']);
  return normalizeSongs(list);
}

export async function fmRecommend(platform) {
  const body = await get('/fm/recommend', {}, { platform });
  return body?.data || {};
}

export async function fmClass(platform) {
  const body = await get('/fm/class', {}, { platform });
  return pickArray(body, ['list', 'info']);
}

export async function fmSongs(platform, fmid, offset = 0, size = 30) {
  const body = await post('/fm/songs', { fmid, offset, size }, {}, { platform });
  return normalizeSongs(pickArray(body, ['song_list', 'songs', 'list']));
}

/* ------------------------------- 听书 ------------------------------- */
export async function longaudioDaily(platform) {
  const body = await get('/longaudio/daily/recommend', {}, { platform });
  return pickArray(body, ['list', 'album_list', 'info']);
}
export async function longaudioWeek(platform) {
  const body = await get('/longaudio/week/recommend', {}, { platform });
  return pickArray(body, ['list', 'album_list', 'info']);
}
export async function longaudioVip(platform) {
  const body = await get('/longaudio/vip/recommend', {}, { platform });
  return pickArray(body, ['list', 'album_list', 'info']);
}
export async function longaudioRank(platform) {
  const body = await get('/longaudio/rank/recommend', {}, { platform });
  return pickArray(body, ['list', 'album_list', 'info']);
}
export async function longaudioSearch(keyword, platform) {
  const body = await get('/longaudio/search', { keywords: keyword }, { platform });
  return pickArray(body, ['list', 'album_list']);
}
export async function longaudioAlbums(tagid = 0, page = 1, pagesize = 20, platform) {
  const body = await get('/longaudio/album/list', { tagid, page, pagesize }, { platform });
  return pickArray(body, ['list', 'album_list']);
}
export async function longaudioAlbumDetail(id, platform) {
  const body = await get('/longaudio/album/detail', { album_id: id }, { platform });
  const data = body?.data || {};
  return data.info || data;
}
export async function longaudioAlbumAudios(id, page = 1, pagesize = 100, platform) {
  const body = await get('/longaudio/album/audios', { album_id: id, page, pagesize }, { platform });
  return { songs: normalizeSongs(pickArray(body, ['audios', 'songs', 'list'])), raw: body?.data };
}

/* ------------------------------- MV / 视频 ------------------------------- */
export async function videoUrl(hash, platform) {
  const body = await get('/video/url', { hash }, { platform, nocache: true });
  return body?.data || {};
}
export async function videoDetail(id, platform) {
  const body = await post('/video/detail', { id: String(id) }, {}, { platform });
  return body?.data || {};
}
export async function mvOfSong(albumAudioId, platform) {
  // 注意：该接口内部会对 album_audio_id 调 .split()，必须是字符串，传数字会 500
  const body = await post('/kmr/audio/mv', { album_audio_id: String(albumAudioId) }, {}, { platform });
  // data 是 [[mv, mv, ...]] 这种嵌套数组，拍平后过滤掉无效项
  const raw = body?.data ?? [];
  const flat = Array.isArray(raw) ? raw.flat(3) : [];
  return flat.filter((x) => x && typeof x === 'object' && (x.video_id || x.mv_name));
}
export async function mvCollect(id, platform) {
  return post('/mv/collect', { id }, {}, { platform });
}

/**
 * 按 MV 的 video_id 取播放地址
 * 流程：/video/detail(拿各清晰度 hash) → /video/url(拿 mp4 地址)
 */
export async function mvStream(videoId, platform) {
  if (!videoId) return { url: '', info: null };
  let info = null;
  try {
    const raw = await videoDetail(videoId, platform);
    info = Array.isArray(raw) ? raw[0] : raw?.info?.[0] || raw;
  } catch {
    return { url: '', info: null };
  }
  const hashes = [info?.hd_hash, info?.fhd_hash, info?.qhd_hash, info?.sd_hash, info?.ld_hash].filter(Boolean);
  for (const h of hashes) {
    try {
      const data = await videoUrl(h, platform);
      const item = data?.[String(h).toLowerCase()] || Object.values(data || {})[0] || {};
      const u = item.downurl || (Array.isArray(item.backupdownurl) ? item.backupdownurl[0] : '');
      if (u) return { url: u, info };
    } catch {
      /* 试下一个清晰度 */
    }
  }
  return { url: '', info };
}

/* ------------------------------- 曲谱 ------------------------------- */
export async function sheetRank(instruments = 1, level = 0, page = 1, pagesize = 20, platform) {
  const body = await post('/sheet/rank', {}, { instruments, level, page, pagesize }, { platform });
  return pickArray(body, ['list', 'info']);
}
export async function sheetDetail(id, platform) {
  const body = await get('/sheet/detail', { id }, { platform });
  return body?.data || {};
}
export async function sheetSong(id, platform) {
  const body = await get('/sheet/song', { id }, { platform });
  return body?.data || {};
}

/* ------------------------------- 杂项 ------------------------------- */
export async function serverNow(platform) {
  const body = await get('/server/now', {}, { platform });
  return body?.data || {};
}

export async function ipZone(platform) {
  const body = await get('/ip/zone', {}, { platform });
  return body?.data || {};
}

export async function privilegeLite(hash, platform) {
  const body = await get('/privilege/lite', { hash }, { platform });
  return body?.data || {};
}

export async function sceneLists(platform) {
  const body = await get('/scene/lists', {}, { platform });
  return pickArray(body, ['list', 'info']);
}

export async function youthChannels(platform) {
  const body = await get('/youth/channel/all', {}, { platform });
  return pickArray(body, ['list', 'info']);
}

export { request };
