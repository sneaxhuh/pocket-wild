const DATABASE = 'pocket-wild-local';
let opened;

function open() {
  if (!opened) opened = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('data');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return opened;
}

async function transact(mode, action) {
  const database = await open();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('data', mode);
    const request = action(transaction.objectStore('data'));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error || request.error);
    transaction.onabort = () => reject(transaction.error || new Error('Local storage was interrupted.'));
  });
}

export const localStore = {
  get: key => transact('readonly', store => store.get(key)),
  put: (key, value) => transact('readwrite', store => store.put(value, key)),
  delete: key => transact('readwrite', store => store.delete(key)),
};
