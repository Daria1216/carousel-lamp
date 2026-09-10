'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  Plus,
  Wind,
  Sun,
  Moon,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CirclePlay,
  Pause,
  ImagePlus,
  Crop as CropIcon,
  Trash2,
  X,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createCarousel, type CarouselAPI } from '@/lib/carousel-scene';
import {
  PHOTO_COUNT,
  initialCrop,
  loadPhoto,
  drawCrop,
  type Crop,
} from '@/lib/photos';
import { ChimeAudio } from '@/lib/sounds';
import { readSavedPhotos, savePhotosLocally, type SavedPhoto } from '@/lib/photo-storage';

import { convertHeic, isHeicFile } from '@/lib/heic';
import { readSavedView } from '@/lib/view-storage';

type Memory = {
  source: string;
  preview: string;
  crop: Crop;
  custom: boolean;
  empty: boolean;
};
type Draft = { source: string; image: HTMLImageElement; crop: Crop };
export default function Home() {
  const conversion = useRef<AbortController | null>(null);
  const [processingHeic, setProcessingHeic] = useState(false);
  const swapHandler = useRef<(from: number, to: number) => Promise<void>>(async () => {});
  const exchanging = useRef(false);
  const pendingSave = useRef(false);
  const [photoSave, setPhotoSave] = useState<'saved' | 'saving' | 'error'>('saved');
  const [viewSaved, setViewSaved] = useState(true);
  const host = useRef<HTMLDivElement>(null),
    api = useRef<CarouselAPI | null>(null),
    audio = useRef<ChimeAudio | null>(null),
    fileInput = useRef<HTMLInputElement>(null),
    preview = useRef<HTMLCanvasElement>(null),
    urls = useRef(new Set<string>()),
    fileRequest = useRef(0);
  const [night, setNight] = useState(false),
    [selected, setSelected] = useState(-1),
    [spinning, setSpinning] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [choosing, setChoosing] = useState(false),
    [editor, setEditor] = useState(false),
    [draft, setDraft] = useState<Draft | null>(null),
    [busy, setBusy] = useState(false),
    [editorError, setEditorError] = useState('');
  const [memories, setMemories] = useState<Memory[]>(() =>
    Array.from({ length: PHOTO_COUNT }, () => ({
      source: '',
      preview: '',
      crop: { ...initialCrop },
      custom: false,
      empty: true,
    })),
  );
  const play = (kind: Parameters<ChimeAudio['play']>[0]) =>
    audio.current?.play(kind);
  useEffect(() => {
    if (!host.current) return;
    audio.current = new ChimeAudio();
    const savedView = readSavedView();
    if (savedView) { setNight(savedView.night); setSpinning(savedView.spinning); }
    let mounted = true;
    try {
      api.current = createCarousel(
        host.current,
        (index) => {
          setSelected(index);
        },
        setNotice,
        (from, to) => swapHandler.current(from, to),
        setViewSaved,
      );
      const carousel = api.current;
      carousel.ready.then(async () => {
        try {
          const stored = await readSavedPhotos();
          if (!mounted) return;
          const restored = new Map<number, Memory>();
          for (const photo of stored) {
            if (!Number.isInteger(photo.slot) || photo.slot < 0 || photo.slot >= PHOTO_COUNT) continue;
            if (!photo.empty && !(photo.source instanceof Blob)) continue;
            const source = photo.source ? URL.createObjectURL(photo.source) : '';
            if (source) urls.current.add(source);
            restored.set(photo.slot, { source, preview: photo.preview, crop: photo.crop,
              custom: !photo.empty, empty: photo.empty });
          }
          await Promise.all([...restored].map(([slot, photo]) => carousel.setPhoto(slot, photo.empty ? null : photo.preview)));
          if (mounted) setMemories(list => list.map((photo, slot) => restored.get(slot) ?? photo));
        } catch (err) {
          if (mounted) { setNotice((err as Error).message); setPhotoSave('error'); }
        }
        if (mounted) setReady(true);
      }).catch(() => {
        if (mounted) setError('画面暂时没加载成功，请刷新重试。');
      });
    } catch {
      queueMicrotask(() => {
        if (mounted)
          setError(
            '这个浏览器暂时无法显示 3D 场景，请开启硬件加速或换一个浏览器。',
          );
      });
    }
    const held = urls.current;
    return () => {
      mounted = false;
      conversion.current?.abort();
      api.current?.dispose();
      api.current = null;
      audio.current?.dispose();
      held.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  useEffect(() => {
    api.current?.selectMode(choosing);
  }, [choosing]);
  useEffect(() => {
    const used = new Set(memories.map((m) => m.source));
    if (draft) used.add(draft.source);
    for (const url of urls.current) {
      if (!used.has(url)) {
        URL.revokeObjectURL(url);
        urls.current.delete(url);
      }
    }
  }, [memories, draft]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4800);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (draft && preview.current)
      drawCrop(preview.current, draft.image, draft.crop);
  }, [draft, editor]);
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => unknown;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const life = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'set_chime_view',
            description:
              'Select one of sixteen memory photos, or return to the whole carousel lamp.',
            inputSchema: {
              type: 'object',
              properties: {
                photo: { type: 'integer', minimum: -1, maximum: 15 },
              },
              required: ['photo'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false },
            execute: async (input: unknown) => {
              const n = (input as { photo: number })?.photo;
              if (!Number.isInteger(n) || n < -1 || n >= PHOTO_COUNT)
                throw new Error('photo must be -1 through 15');
              if (!api.current) throw new Error('Scene is loading');
              if (n === -1) api.current.reset();
              else api.current.focus(n);
              return { selectedPhoto: n };
            },
          },
          { signal: life.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => life.abort();
  }, []);
  useEffect(() => {
    const protectSave = (event: BeforeUnloadEvent) => {
      if (pendingSave.current) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', protectSave);
    return () => window.removeEventListener('beforeunload', protectSave);
  }, []);
  async function commitPhotos(prepare: () => Promise<SavedPhoto[]>) {
    if (pendingSave.current) throw new Error('正在保存，请稍候。');
    pendingSave.current = true;
    setPhotoSave('saving');
    try {
      await savePhotosLocally(await prepare());
      setPhotoSave('saved');
    } catch (error) {
      setPhotoSave('error');
      throw error;
    } finally { pendingSave.current = false; }
  }
  function choose(index: number) {
    api.current?.focus(index);
    play('select');
  }
  function closeEditor() {
    fileRequest.current++;
    conversion.current?.abort();
    setProcessingHeic(false);
    setEditor(false);
    setDraft(null);
    setEditorError('');
    setBusy(false);
  }
  async function openEditor() {
    if (selected < 0) return;
    setEditorError('');
    setDraft(null);
    setEditor(true);
    const memory = memories[selected];
    if (memory.empty) return;
    const token = ++fileRequest.current;
    setBusy(true);
    try {
      const image = await loadPhoto(memory.source);
      if (token === fileRequest.current)
        setDraft({ source: memory.source, image, crop: { ...memory.crop } });
    } catch (err) {
      if (token === fileRequest.current) setEditorError((err as Error).message);
    } finally {
      if (token === fileRequest.current) setBusy(false);
    }
  }
  async function readFile(file?: File) {
    if (!file) return;
    setEditorError('');
    const heic = isHeicFile(file);
    // Some file providers omit MIME metadata; the browser still verifies decoding below.
    const supportedType = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type.toLowerCase());
    const supportedName = /\.(jpe?g|png|webp)$/i.test(file.name);
    if (!heic && !supportedType && !supportedName) {
      setEditorError('请选择 JPG、PNG、WebP 或 HEIC/HEIF 格式的相片。');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setEditorError('请选择 50 MB 以内的相片。');
      return;
    }
    conversion.current?.abort();
    const controller = new AbortController();
    conversion.current = controller;
    let source = '';
    setProcessingHeic(heic);
    const token = ++fileRequest.current;
    setBusy(true);
    try {
      const blob = heic ? await convertHeic(file, controller.signal) : file;
      if (token !== fileRequest.current) return;
      source = URL.createObjectURL(blob);
      urls.current.add(source);
      const image = await loadPhoto(source);
      if (token === fileRequest.current)
        setDraft({ source, image, crop: { ...initialCrop } });
      else { URL.revokeObjectURL(source); urls.current.delete(source); }
    } catch (err) {
      if (token === fileRequest.current) setEditorError((err as Error).message);
      URL.revokeObjectURL(source);
      urls.current.delete(source);
    } finally {
      if (token === fileRequest.current) { setBusy(false); setProcessingHeic(false); }
    }
  }
  async function save() {
    if (!draft || selected < 0 || !api.current || pendingSave.current) return;
    setBusy(true);
    setEditorError('');
    try {
      const canvas = document.createElement('canvas');
      drawCrop(canvas, draft.image, draft.crop);
      const cropped = canvas.toDataURL('image/jpeg', 0.92);
      await commitPhotos(async () => {
        const response = await fetch(draft.source);
        if (!response.ok) throw new Error('原相片无法读取，请重新选择。');
        const original = await response.blob();
        return [{ slot: selected, source: original, preview: cropped, crop: { ...draft.crop }, empty: false }];
      });
      await api.current.setPhoto(selected, cropped);
      setMemories((list) =>
        list.map((m, i) =>
          i === selected
            ? {
                source: draft.source,
                preview: cropped,
                crop: { ...draft.crop },
                custom: true,
                empty: false,
              }
            : m,
        ),
      );
      play('hang');
      setNotice(`相片已挂在 ${String(selected + 1).padStart(2, '0')} 号位置，已自动保存到本机。`);
      closeEditor();
      setChoosing(false);
    } catch (err) {
      setEditorError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function exchangePhotos(from: number, to: number) {
    if (!ready || busy || pendingSave.current || exchanging.current || selected >= 0 || !api.current)
      throw new Error('请稍后再交换相片。');
    const carousel = api.current;
    const first = memories[from], second = memories[to];
    if (from === to || first.empty) return;
    exchanging.current = true;
    try {
      await commitPhotos(() => Promise.all([second, first].map(async (photo, i) => {
        let source: Blob | null = null;
        if (!photo.empty) {
          const response = await fetch(photo.source);
          if (!response.ok) throw new Error('相片读取失败，位置没有改变。');
          source = await response.blob();
        }
        return { slot: i === 0 ? from : to, source, preview: photo.preview,
          crop: { ...photo.crop }, empty: photo.empty };
      })));
      if (api.current !== carousel) return;
      carousel.swapPhotos(from, to);
      setMemories(list => list.map((photo, i) => i === from ? second : i === to ? first : photo));
      play('hang');
      setNotice(`${String(from + 1).padStart(2, '0')} 与 ${String(to + 1).padStart(2, '0')} 号相片已交换，已自动保存。`);
    } finally { exchanging.current = false; }
  }
  useEffect(() => { swapHandler.current = exchangePhotos; });
  async function remove() {
    if (selected < 0 || !api.current || pendingSave.current) return;
    try {
      await commitPhotos(async () => [{ slot: selected, source: null, preview: '', crop: { ...initialCrop }, empty: true }]);
      await api.current.setPhoto(selected, null);
    } catch (err) {
      setNotice((err as Error).message);
      return;
    }
    setMemories((list) =>
      list.map((m, i) =>
        i === selected
          ? {
              source: '',
              preview: '',
              crop: { ...initialCrop },
              custom: false,
              empty: true,
            }
          : m,
      ),
    );
    play('hang');
    setNotice('相片已取下，这个位置可以重新挂相片。');
  }
  return (
    <main
      className={`workshop ${night ? 'night' : ''} ${selected >= 0 ? 'focused' : ''}`}
    >
      <h1 className="ribbon-title" aria-label="Carousel Lamp">
        <img src="/carousel-lamp-title-clean.png" alt="" width="900" height="780" draggable={false} />
        <span className="title-sparkles" aria-hidden="true">
          <i /><i /><i /><i /><i /><i /><i /><i />
        </span>
      </h1>
      <div
        ref={host}
        className="scene"
        aria-label="可拖动旋转的三维相片旋转木马灯；也可使用下方按钮选择相片"
      />
      {!ready && (
        <output className="loading">
          {error || '正在点亮你的旋转木马…'}
        </output>
      )}
      {selected >= 0 && (
        <div className="focus-bar">
          <Button
            variant="ghost"
            aria-label="上一张相片"
            onClick={() => choose((selected + PHOTO_COUNT - 1) % PHOTO_COUNT)}
          >
            <ChevronLeft />
          </Button>
          <span>
            相片 {String(selected + 1).padStart(2, '0')} / {PHOTO_COUNT}
          </span>
          <Button
            variant="ghost"
            aria-label="下一张相片"
            onClick={() => choose((selected + 1) % PHOTO_COUNT)}
          >
            <ChevronRight />
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              api.current?.reset();
              play('select');
            }}
          >
            <ArrowLeft />
            整盏灯
          </Button>
        </div>
      )}
      {selected >= 0 && !choosing && (
        <div className="photo-actions">
          <Button onClick={() => void openEditor()}>
            <CropIcon />
            {memories[selected].empty ? '放入相片' : '更换 / 调整'}
          </Button>
          <Button
            variant="ghost"
            disabled={memories[selected].empty}
            onClick={() => void remove()}
          >
            <Trash2 />
            取下相片
          </Button>
        </div>
      )}
      <footer className="bottom">
        <div className="toolbar">
          <Button
            disabled={!ready}
            className="upload"
            onClick={() => {
              if (selected >= 0) {
                void openEditor();
              } else {
                setChoosing(true);
                play('select');
              }
            }}
          >
            <Plus />
            {selected >= 0 ? '挂在这个位置' : '挂相片'}
          </Button>
          <Button
            disabled={!ready}
            className="wind"
            onClick={() => {
              api.current?.wind();
              play('wind');
            }}
          >
            <Wind />
            起风
          </Button>
          <Button
            disabled={!ready}
            className="spin"
            aria-pressed={spinning}
            onClick={() => {
              api.current?.rotate(!spinning);
              setSpinning(!spinning);
              play('select');
              if (!spinning && selected >= 0)
                setNotice('回到整盏灯后，木马会继续旋转。');
            }}
          >
            {spinning ? <Pause /> : <CirclePlay />}
            {spinning ? '暂停' : '旋转'}
          </Button>
          <Button
            disabled={!ready}
            className="lamp"
            aria-pressed={night}
            onClick={() => {
              api.current?.light(!night);
              setNight(!night);
              play('light');
            }}
          >
            {night ? <Moon /> : <Sun />}
            {night ? '关灯' : '开灯'}
          </Button>
          <Button
            disabled={!ready}
            variant="ghost"
            className="reset"
            aria-label="重置视角"
            onClick={() => {
              api.current?.reset();
              play('select');
            }}
          >
            <RotateCcw />
          </Button>
        </div>
        {(photoSave === 'saving' || photoSave === 'error' || !viewSaved) && (
          <p className="save-status" aria-live="polite" data-state={photoSave === 'saving' ? 'saving' : 'error'}>
            {photoSave === 'saving' ? '正在保存…' : '保存未完成，请重试'}
          </p>
        )}
        <p className="creator-credit" lang="en">
          <span>Created by <a href="https://xhslink.cn/o/3XhXTvcOoYl" target="_blank" rel="noopener noreferrer" aria-label="@咕噜蛋Daria的小红书主页（在新标签页打开）">@咕噜蛋Daria</a></span>
          <span>For personal, non-commercial use only.</span>
        </p>
      </footer>
      {choosing && (
        <aside className="position-picker" aria-label="选择相片位置">
          <div className="picker-heading">
            <div>
              <small>第一步</small>
              <h2>给相片选个位置</h2>
            </div>
            <Button
              variant="ghost"
              aria-label="关闭位置选择"
              onClick={() => setChoosing(false)}
            >
              <X />
            </Button>
          </div>
          <p>点击下面的相片，看看它挂在哪里。</p>
          <div className="slots">
            {memories.map((memory, i) => (
              <button
                type="button"
                key={i}
                className={`slot ${selected === i ? 'chosen' : ''}`}
                aria-label={`选择 ${i + 1} 号相片位置${memory.custom ? '，已有你的相片' : memory.empty ? '，空位置' : ''}`}
                aria-pressed={selected === i}
                onClick={() => choose(i)}
              >
                {memory.preview ? (
                  <Image
                    src={memory.preview}
                    alt=""
                    width={88}
                    height={104}
                    unoptimized
                  />
                ) : (
                  <span className="empty-slot">
                    <Plus />
                  </span>
                )}
                <span>
                  {String(i + 1).padStart(2, '0')}
                  {memory.custom ? ' · 已挂' : ''}
                </span>
              </button>
            ))}
          </div>
          <Button
            className="choose-confirm"
            disabled={selected < 0}
            onClick={() => void openEditor()}
          >
            <ImagePlus />
            {selected >= 0
              ? `挂在 ${String(selected + 1).padStart(2, '0')} 号位置`
              : '先选一个位置'}
          </Button>
        </aside>
      )}
      <Dialog
        open={editor}
        onOpenChange={(open) => {
          if (!open && (!busy || processingHeic)) closeEditor();
        }}
      >
        <DialogContent className="photo-editor" showCloseButton={!busy || processingHeic}>
          <DialogHeader>
            <DialogTitle>
              挂在 {String(selected + 1).padStart(2, '0')} 号位置
            </DialogTitle>
            <DialogDescription>
              选择相片，调整画面，再把这一刻挂起来。相片仅保存在此浏览器，不会上传到服务器。
            </DialogDescription>
          </DialogHeader>
          <div className="editor-layout">
            <div className="crop-stage">
              {draft ? (
                <canvas ref={preview} aria-label="裁剪后的相片预览" />
              ) : (
                <div className="empty-preview">
                  <ImagePlus />
                  <p>{processingHeic ? '正在转换 HEIC 相片…' : busy ? '正在读取相片…' : '选一张喜欢的相片'}</p>
                </div>
              )}
            </div>
            <div className="crop-controls">
              <Button
                disabled={busy}
                variant="outline"
                onClick={() => fileInput.current?.click()}
              >
                <ImagePlus />
                {draft ? '选择另一张相片' : '选择相片'}
              </Button>
              <p>JPG、PNG、WebP、HEIC/HEIF · 最大 50 MB</p>
              {processingHeic && <p role="status">正在转换 HEIC 相片，较大的照片可能需要一些时间…</p>}
              {(['zoom', 'x', 'y'] as const).map((key) => (
                <label key={key}>
                  <span>
                    {key === 'zoom'
                      ? '放大画面'
                      : key === 'x'
                        ? '左右位置'
                        : '上下位置'}
                  </span>
                  <input
                    type="range"
                    min={key === 'zoom' ? 1 : -1}
                    max={key === 'zoom' ? 3 : 1}
                    step="0.01"
                    value={draft?.crop[key] ?? initialCrop[key]}
                    disabled={!draft || busy}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setDraft((d) =>
                        d ? { ...d, crop: { ...d.crop, [key]: value } } : d,
                      );
                    }}
                  />
                </label>
              ))}
              <Button
                variant="ghost"
                disabled={!draft || busy}
                onClick={() =>
                  setDraft((d) => (d ? { ...d, crop: { ...initialCrop } } : d))
                }
              >
                <RotateCcw />
                重置裁剪
              </Button>
            </div>
          </div>
          {editorError && (
            <p className="editor-error" role="alert">
              {editorError}
            </p>
          )}
          <div className="editor-footer">
            <Button disabled={busy && !processingHeic} variant="ghost" onClick={closeEditor}>
              取消
            </Button>
            <Button disabled={!draft || busy} onClick={() => void save()}>
              <Check />
              {busy ? '正在准备…' : '确认挂上'}
            </Button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
            hidden
            onChange={(e) => {
              void readFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </DialogContent>
      </Dialog>
      <output aria-live="polite" className={`toast ${notice ? 'show' : ''}`}>
        {notice}
      </output>
    </main>
  );
}
