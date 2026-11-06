/**
 * 歌曲的三个角标：原创 / VIP / MV
 *
 * 酷狗不同接口返回的字段完全不一样：
 * - 搜索：IsOriginal / PayType / Privilege / MvHash
 * - 每日推荐、FM：is_original / pay_type / mv_hash / privilege
 * - 榜单、歌单、专辑：deprecated.pay_type_320 / trans_param / video_info.video_id / mvdata
 * 之前只认前两套，所以歌曲一进歌单 / 榜单角标就全丢了。
 * 这里把归一化后的 song 和原始 raw 一起看，保证同一首歌在任何页面角标一致。
 */

function pick(...vals) {
  for (const v of vals) {
    if (v === undefined || v === null || v === '' || v === 0 || v === '0') continue;
    return v;
  }
  return undefined;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function songFlags(song = {}) {
  const raw = song?.raw || song || {};
  const dep = raw.deprecated || {};
  const tp = raw.trans_param || raw.transParam || {};
  const vi = raw.video_info || raw.videoInfo || {};
  const mvData = raw.mvdata || raw.mv_data || [];
  const goods = raw.goods_info || raw.goodsInfo || {};

  const payType = num(
    pick(
      song?.payType,
      raw.PayType,
      raw.pay_type,
      raw.payType,
      dep.pay_type_320,
      dep.pay_type_128,
      dep.pay_type_flac,
      raw.pay_type_320,
      raw.pay_type_128,
      goods.pay_type
    )
  );
  const privilege = num(pick(song?.privilege, raw.Privilege, raw.privilege, dep.privilege));
  const isOriginal =
    num(
      pick(
        song?.isOriginal,
        raw.IsOriginal,
        raw.is_original,
        raw.isOriginal,
        raw.is_original_song,
        tp.is_original
      )
    ) > 0;
  // pay_type >= 3 是酷狗的付费/VIP 标记，privilege 高位同样代表需要会员
  const isVip =
    payType >= 3 || privilege >= 8 || Boolean(raw.needBuy) || Boolean(raw.is_vip) || Boolean(song?.needBuy);

  const videoId =
    pick(
      song?.videoId,
      raw.video_id,
      raw.MvVideoId,
      raw.mv_video_id,
      num(vi.video_id) > 0 ? vi.video_id : undefined,
      tp.video_id
    ) || '';
  const mvHash =
    pick(
      song?.mvHash,
      raw.MvHash,
      raw.mv_hash,
      raw.mvHash,
      vi.video_hash,
      Array.isArray(mvData) && mvData[0] ? mvData[0].hash || mvData[0].video_hash : undefined
    ) || '';
  const hasMv = Boolean(mvHash || videoId || (Array.isArray(mvData) && mvData.length));

  return { isOriginal, isVip, hasMv, mvHash, videoId, payType, privilege };
}

/** 列表渲染用：按歌曲对象缓存结果，避免每行每帧重复解析 raw */
const cache = new WeakMap();
export function songFlagsOf(song) {
  if (!song || typeof song !== 'object') return songFlags(song);
  let f = cache.get(song);
  if (!f) {
    f = songFlags(song);
    cache.set(song, f);
  }
  return f;
}
