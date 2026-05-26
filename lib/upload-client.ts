export type UploadProgress = {
  loaded: number;
  total: number;
  percent: number;
};

/**
 * PUT a file directly to a Supabase signed upload URL, with XHR progress events.
 * Fetch doesn't support `upload.onprogress`, so we use XHR.
 */
export function uploadFileWithProgress(
  signedUrl: string,
  file: File,
  onProgress?: (p: UploadProgress) => void,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("ההעלאה בוטלה"));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream"
    );
    xhr.setRequestHeader("x-upsert", "false");

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percent: Math.round((event.loaded / event.total) * 100),
        });
      }
    });

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (onProgress) {
          onProgress({ loaded: file.size, total: file.size, percent: 100 });
        }
        resolve();
      } else {
        reject(
          new Error(
            `שגיאת העלאה (HTTP ${xhr.status}): ${
              xhr.responseText?.slice(0, 200) || xhr.statusText
            }`
          )
        );
      }
    };

    xhr.onerror = () => reject(new Error("שגיאת רשת בזמן ההעלאה"));
    xhr.onabort = () => reject(new Error("ההעלאה בוטלה"));

    if (signal) {
      const onAbort = () => xhr.abort();
      signal.addEventListener("abort", onAbort, { once: true });
    }

    xhr.send(file);
  });
}
