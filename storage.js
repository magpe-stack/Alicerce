/* Alicerce — storage.js
 * Camada de persistência sobre IndexedDB (nativo do Chrome).
 * Stores:
 *   projects : { id, name, viewport, screens[], activeScreenId, createdAt, updatedAt, version }
 *   history  : { projectId, stack[], idx }          (Desfazer/Refazer)
 *   meta     : { key, value }                       (ex.: FileSystemFileHandle por projeto)
 */
(function (global) {
  'use strict';

  var DB_NAME = 'alicerce-db';
  var DB_VERSION = 1;
  var dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('history')) db.createObjectStore('history', { keyPath: 'projectId' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      };
      req.onsuccess = function () {
        var db = req.result;
        db.onversionchange = function () { db.close(); dbPromise = null; };
        resolve(db);
      };
      req.onerror = function () { dbPromise = null; reject(req.error); };
      req.onblocked = function () { dbPromise = null; reject(new Error('Banco de dados bloqueado por outra aba.')); };
    });
    return dbPromise;
  }

  /* Executa `work(transaction)` e resolve com o resultado da request retornada (se houver). */
  function run(stores, mode, work) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(stores, mode);
        var out;
        tx.oncomplete = function () { resolve(out); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error || new Error('Transação abortada.')); };
        var req = work(tx);
        if (req && typeof req === 'object' && 'onsuccess' in req) {
          req.onsuccess = function () { out = req.result; };
        }
      });
    });
  }

  var AlicerceStorage = {
    open: openDB,

    getAllProjects: function () {
      return run('projects', 'readonly', function (t) { return t.objectStore('projects').getAll(); })
        .then(function (r) { return r || []; });
    },
    getProject: function (id) {
      return run('projects', 'readonly', function (t) { return t.objectStore('projects').get(id); });
    },
    putProject: function (project) {
      return run('projects', 'readwrite', function (t) { return t.objectStore('projects').put(project); });
    },
    putProjects: function (list) {
      return run('projects', 'readwrite', function (t) {
        var s = t.objectStore('projects');
        list.forEach(function (p) { s.put(p); });
      });
    },
    countProjects: function () {
      return run('projects', 'readonly', function (t) { return t.objectStore('projects').count(); })
        .then(function (n) { return n || 0; });
    },
    deleteProject: function (id) {
      return run(['projects', 'history', 'meta'], 'readwrite', function (t) {
        t.objectStore('projects').delete(id);
        t.objectStore('history').delete(id);
        t.objectStore('meta').delete('handle:' + id);
      });
    },

    getHistory: function (projectId) {
      return run('history', 'readonly', function (t) { return t.objectStore('history').get(projectId); });
    },
    putHistory: function (record) {
      return run('history', 'readwrite', function (t) { return t.objectStore('history').put(record); });
    },
    deleteHistory: function (projectId) {
      return run('history', 'readwrite', function (t) { return t.objectStore('history').delete(projectId); });
    },

    getMeta: function (key) {
      return run('meta', 'readonly', function (t) { return t.objectStore('meta').get(key); })
        .then(function (r) { return r ? r.value : undefined; });
    },
    setMeta: function (key, value) {
      return run('meta', 'readwrite', function (t) { return t.objectStore('meta').put({ key: key, value: value }); });
    },
    deleteMeta: function (key) {
      return run('meta', 'readwrite', function (t) { return t.objectStore('meta').delete(key); });
    }
  };

  global.AlicerceStorage = AlicerceStorage;
})(window);
