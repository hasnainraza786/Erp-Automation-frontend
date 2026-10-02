'use client';

import {
  downloadDocument,
  getListDocumentsQueryKey,
  useArchiveDocument,
  useListDocuments,
  useUploadDocument,
  type ListDocumentsCategory,
  type ListDocumentsOwnerType,
  type UploadDocumentPhotoStage,
} from '@erp/api-client';
import { fmtDateTime, humanize } from '@erp/core';
import { Badge, Button, Card, CardHeader, EmptyState, Select } from '@erp/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, ImageIcon, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loading } from '@/components/page';
import { saveBlob } from '@/lib/files';

const CATEGORIES = ['SITE_PHOTO', 'SIGNED_QUOTATION', 'CNIC', 'DRAWING', 'FLOOR_PLAN', 'DATASHEET', 'PURCHASE_INVOICE', 'DELIVERY_CHALLAN', 'RECEIPT', 'HANDOVER', 'PRODUCT_IMAGE', 'OTHER'] as const;
const STAGES = ['BEFORE', 'DURING', 'AFTER', 'ISSUE', 'HANDOVER'] as const;

function Thumb({ id, alt }: { id: string; alt: string }) {
  const { data: blob } = useQuery({ queryKey: ['document-blob', id], queryFn: () => downloadDocument(id, { inline: 'true' }), staleTime: Infinity, meta: { silent: true } });
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  if (!src) return <div className="h-28 w-full animate-pulse rounded-md bg-muted" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="h-28 w-full rounded-md border border-border object-cover" />;
}

export function DocumentsPanel({
  ownerType,
  ownerId,
  categories = CATEGORIES as unknown as ListDocumentsCategory[],
  defaultCategory = 'OTHER',
  canUpload = true,
  title = 'Documents',
}: {
  ownerType: ListDocumentsOwnerType;
  ownerId: string;
  categories?: ListDocumentsCategory[];
  defaultCategory?: ListDocumentsCategory;
  canUpload?: boolean;
  title?: string;
}) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<ListDocumentsCategory>(defaultCategory);
  const [stage, setStage] = useState<string>('');
  const { data } = useListDocuments({ ownerType, ownerId });
  const refresh = () => qc.invalidateQueries({ queryKey: getListDocumentsQueryKey({ ownerType, ownerId }) });
  const upload = useUploadDocument({ mutation: { onSuccess: refresh } });
  const archive = useArchiveDocument({ mutation: { onSuccess: refresh } });

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      await upload
        .mutateAsync({
          data: { file },
          params: { ownerType, ownerId, category, photoStage: stage && file.type.startsWith('image/') ? (stage as UploadDocumentPhotoStage) : undefined },
        })
        .then(() => toast.success(`Uploaded ${file.name}`))
        .catch(() => undefined);
    }
    if (input.current) input.current.value = '';
  };

  const images = data?.filter((d) => d.mimeType.startsWith('image/')) ?? [];
  const files = data?.filter((d) => !d.mimeType.startsWith('image/')) ?? [];

  return (
    <Card>
      <CardHeader
        title={title}
        actions={
          canUpload && (
            <div className="flex flex-wrap items-center gap-2">
              <Select value={category} onChange={(e) => setCategory(e.target.value as ListDocumentsCategory)} className="h-8 w-44 text-xs">
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {humanize(c)}
                  </option>
                ))}
              </Select>
              {category === 'SITE_PHOTO' && (
                <Select value={stage} onChange={(e) => setStage(e.target.value)} className="h-8 w-32 text-xs">
                  <option value="">Any stage</option>
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {humanize(s)}
                    </option>
                  ))}
                </Select>
              )}
              <input ref={input} type="file" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.dwg,.dxf" />
              <Button size="sm" onClick={() => input.current?.click()} loading={upload.isPending}>
                <Upload /> Upload
              </Button>
            </div>
          )
        }
      />
      {!data ? (
        <Loading />
      ) : data.length === 0 ? (
        <EmptyState icon={<FileText className="size-5" />} title="No files yet" description="Upload drawings, signed quotations, receipts or site photos." />
      ) : (
        <div className="space-y-5 p-5">
          {images.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {images.map((d) => (
                <figure key={d.id} className="group relative">
                  <button className="block w-full" onClick={() => saveBlob(() => downloadDocument(d.id, { inline: 'true' }), d.fileName, 'open')}>
                    <Thumb id={d.id} alt={d.fileName} />
                  </button>
                  <figcaption className="mt-1 flex items-center justify-between gap-1 text-xs">
                    <span className="truncate text-muted-foreground">{d.photoStage ? humanize(d.photoStage) : humanize(d.category)}</span>
                    {canUpload && (
                      <button className="text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100" onClick={() => confirm(`Remove ${d.fileName}?`) && archive.mutate({ id: d.id })} aria-label="Remove">
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
          {files.length > 0 && (
            <ul className="divide-y divide-border rounded-md border border-border">
              {files.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-3 py-2">
                  {d.mimeType.startsWith('image/') ? <ImageIcon className="size-4 text-muted-foreground" /> : <FileText className="size-4 text-muted-foreground" />}
                  <button className="min-w-0 flex-1 text-left" onClick={() => saveBlob(() => downloadDocument(d.id, { inline: 'false' }), d.fileName, d.mimeType === 'application/pdf' ? 'open' : 'download')}>
                    <span className="block truncate text-sm hover:text-primary">{d.fileName}</span>
                    <span className="text-xs text-muted-foreground">
                      {(d.size / 1024).toFixed(0)} KB · {fmtDateTime(d.createdAt)}
                    </span>
                  </button>
                  <Badge>{humanize(d.category)}</Badge>
                  {canUpload && (
                    <Button variant="ghost" size="icon-sm" onClick={() => confirm(`Remove ${d.fileName}?`) && archive.mutate({ id: d.id })} aria-label="Remove">
                      <Trash2 />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
