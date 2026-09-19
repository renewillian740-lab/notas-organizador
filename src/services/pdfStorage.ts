const DB_NAME = 'OrganizadorNF_PDF_Storage_v1';
const STORE_NAME = 'original_pdfs';
const DB_VERSION = 1;

function openPdfDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB não suportado neste navegador.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

export const pdfStorage = {
  async saveOriginalPdf(id: string, fileOrBlob: Blob | File): Promise<void> {
    try {
      const db = await openPdfDatabase();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(fileOrBlob, id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('Erro ao salvar PDF original no IndexedDB:', e);
    }
  },

  async getOriginalPdf(id: string): Promise<Blob | null> {
    try {
      const db = await openPdfDatabase();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
          const result = request.result;
          if (result && result instanceof Blob) {
            resolve(result);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('Erro ao ler PDF original do IndexedDB:', e);
      return null;
    }
  },

  async deleteOriginalPdf(id: string): Promise<void> {
    try {
      const db = await openPdfDatabase();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('Erro ao deletar PDF do IndexedDB:', e);
    }
  },
};
