// 揽星册 service worker —— 离线打开 + 后台自动同步（断网改、联网自动推云端）
const CACHE = 'lanxingce-v12';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icon.png'
];
const SB_URL = 'https://ccntwmojiqwyipcgzfgp.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjbnR3bW9qaXF3eWlwY2d6ZmdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMjM2OTAsImV4cCI6MjEwMTU5OTY5MH0.-mcDmD6jJMimjYMdU1Hf92EEC-DSAC6TgeZVCHl-pNQ';
const SB_BUCKET = 'fragment-images';
const DB = 'lanxingce-sync';

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(CORE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // 页面导航：network-first，失败回退缓存首页（保证总能打开）
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('./index.html').then(function (r) { return r || caches.match('./'); });
      })
    );
    return;
  }

  // 同源静态资源：cache-first
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(function (r) {
        if (r) return r;
        return fetch(req).then(function (res) {
          if (res && res.ok) {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) { c.put(req, copy); });
          }
          return res;
        });
      })
    );
    return;
  }

  // 跨域（Supabase / CDN）：stale-while-revalidate，离线也能用已缓存的脚本
  e.respondWith(
    caches.match(req).then(function (cached) {
      var network = fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});

// ===== 后台同步：即使页面关闭，联网后自动把离线改动推上云端 =====
function idbOpen() {
  return new Promise(function (res, rej) {
    var r = indexedDB.open(DB, 1);
    r.onupgradeneeded = function () {
      var db = r.result;
      if (!db.objectStoreNames.contains('session')) db.createObjectStore('session', { keyPath: 'k' });
      if (!db.objectStoreNames.contains('pending')) db.createObjectStore('pending', { keyPath: 'id' });
    };
    r.onsuccess = function () { res(r.result); };
    r.onerror = function () { rej(r.error); };
  });
}
function idbGetAll(store) {
  return idbOpen().then(function (db) {
    return new Promise(function (res, rej) {
      var tx = db.transaction(store, 'readonly');
      var r = tx.objectStore(store).getAll();
      r.onsuccess = function () { res(r.result || []); };
      r.onerror = function () { rej(r.error); };
    });
  });
}
function idbDel(store, k) {
  return idbOpen().then(function (db) {
    return new Promise(function (res, rej) {
      var tx = db.transaction(store, 'readwrite');
      var r = tx.objectStore(store).delete(k);
      r.onsuccess = function () { res(); };
      r.onerror = function () { rej(r.error); };
    });
  });
}
function idbGet(store, k) {
  return idbOpen().then(function (db) {
    return new Promise(function (res, rej) {
      var tx = db.transaction(store, 'readonly');
      var r = tx.objectStore(store).get(k);
      r.onsuccess = function () { res(r.result || null); };
      r.onerror = function () { rej(r.error); };
    });
  });
}

async function uploadImageSW(dataUrl, token, uid, itemId, idx) {
  try {
    var arr = dataUrl.split(','), mime = (arr[0].match(/:(.*?);/) || [])[1] || 'image/jpeg';
    var bstr = atob(arr[1]), n = bstr.length, buf = new Uint8Array(n);
    for (var i = 0; i < n; i++) buf[i] = bstr.charCodeAt(i);
    var path = uid + '/' + itemId + '/' + idx + '.jpg';
    var resp = await fetch(SB_URL + '/storage/v1/object/' + SB_BUCKET + '/' + path, {
      method: 'POST',
      headers: { 'apikey': SB_ANON, 'Authorization': 'Bearer ' + token, 'Content-Type': mime, 'x-upsert': 'true', 'cache-control': '3600' },
      body: buf
    });
    if (!resp.ok) throw new Error('upload ' + resp.status);
    return path;
  } catch (e) { console.error('SW 图片上传失败', e); return dataUrl; }
}

async function pushRowSW(entry, token, uid) {
  var it = entry.item || {};
  var imgs = it.images || [];
  imgs = await Promise.all(imgs.map(function (img, i) {
    if (typeof img === 'string' && img.indexOf('data:') === 0) return uploadImageSW(img, token, uid, it.id, i);
    return img;
  }));
  var row = {
    id: it.id, user_id: uid, content: it.content || '',
    primary_tags: it.primaryTags || [], secondary_tags: it.secondaryTags || [],
    images: imgs, created_at: it.createdAt, updated_at: it.updatedAt || new Date().toISOString()
  };
  var resp = await fetch(SB_URL + '/rest/v1/fragments', {
    method: 'POST',
    headers: { 'apikey': SB_ANON, 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify(row)
  });
  if (!resp.ok) { var t = await resp.text(); throw new Error('upsert ' + resp.status + ' ' + t); }
}

async function pushDeleteSW(id, token, uid) {
  var d = await fetch(SB_URL + '/rest/v1/fragments?id=eq.' + encodeURIComponent(id) + '&user_id=eq.' + encodeURIComponent(uid), {
    method: 'DELETE', headers: { 'apikey': SB_ANON, 'Authorization': 'Bearer ' + token }
  });
  if (!d.ok) throw new Error('delete ' + d.status);
  var u = await fetch(SB_URL + '/rest/v1/fragment_deletions', {
    method: 'POST',
    headers: { 'apikey': SB_ANON, 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify({ id: id, user_id: uid, deleted_at: new Date().toISOString() })
  });
  if (!u.ok) throw new Error('del-upsert ' + u.status);
}

async function doBackgroundSync() {
  var auth = await idbGet('session', 'auth');
  if (!auth || !auth.access_token) return;
  var entries = await idbGetAll('pending');
  if (!entries.length) return;
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    try {
      if (entry.kind === 'delete') await pushDeleteSW(entry.id, auth.access_token, auth.uid);
      else await pushRowSW(entry, auth.access_token, auth.uid);
      await idbDel('pending', entry.id);
    } catch (e) { console.error('SW 后台同步失败', entry.id, e); }
  }
  // 通知打开的页面刷新本地数据
  var cs = await self.clients.matchAll({ includeUncontrolled: true });
  cs.forEach(function (c) { c.postMessage({ type: 'LANX_SYNC_DONE' }); });
}

self.addEventListener('sync', function (e) {
  if (e.tag === 'lanxingce-sync') { e.waitUntil(doBackgroundSync()); }
});
