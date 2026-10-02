import { toast } from 'sonner';

/** Fetches a binary endpoint through the generated client (auth + refresh) and saves or opens it. */
export async function saveBlob(load: () => Promise<Blob>, fileName: string, mode: 'download' | 'open' = 'download') {
  const id = toast.loading(mode === 'open' ? 'Preparing document…' : 'Preparing download…');
  try {
    const blob = await load();
    const url = URL.createObjectURL(blob);
    if (mode === 'open') {
      window.open(url, '_blank', 'noopener');
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    toast.dismiss(id);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Download failed', { id });
  }
}
