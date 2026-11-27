/**
 * Orchestrates the 3D School Model Editor Studio UI overlays (Toolbar, Inspector,
 * Prop Drawer, GPS Geo-Anchor modal), keyboard shortcuts, and API publish/beacon actions.
 */
import { useEffect } from 'react';
import type { Language } from '../../i18n';
import type { CampusBeacon, CampusGeoAnchor, CampusRoom, State } from '../../types';
import type { useCampusEditor } from './editorStore';
import { EditorGeoWindow } from './EditorGeoWindow';
import { EditorInspectorWindow } from './EditorInspectorWindow';
import { EditorPropDrawer } from './EditorPropDrawer';
import { EditorToolbar } from './EditorToolbar';
import { serializeLayoutToSar } from '../sar/sarSerializer';

interface CampusEditorHostProps {
  editor: ReturnType<typeof useCampusEditor>;
  data: State;
  lang: Language;
  busy: boolean;
  measureDims: { width: number; depth: number } | null;
  geoAnchor: CampusGeoAnchor | null;
  beacons: CampusBeacon[];
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
  onRefreshLayoutExtras: () => Promise<void>;
  onExit: () => void;
}

/** Full-featured interactive 3D School Model Editor UI host layered cleanly over Canvas. */
export function CampusEditorHost({
  editor,
  data,
  lang,
  busy,
  measureDims,
  geoAnchor,
  beacons,
  mutate,
  onRefreshLayoutExtras,
  onExit,
}: CampusEditorHostProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) editor.redo();
        else editor.undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        editor.redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        editor.duplicateSelected();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        editor.deleteSelected();
      } else if (e.key.toLowerCase() === 'r' && editor.tool === 'prop') {
        editor.setPropRotation((r) => (r + Math.PI / 2) % (Math.PI * 2));
      } else if (e.key.toLowerCase() === 'g' && editor.selected) {
        editor.setTransformMode('translate');
      } else if (e.key.toLowerCase() === 'r' && editor.selected) {
        editor.setTransformMode('rotate');
      } else if (e.key.toLowerCase() === 's' && editor.selected?.type === 'prop') {
        editor.setTransformMode('scale');
      } else if (e.key === 'Escape') {
        editor.setTool('select');
        editor.setSelected(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editor]);

  const handlePublish = async () => {
    const sar = serializeLayoutToSar(editor.draft);
    const ok = await mutate(
      '/campus-layout',
      { status: 'published', sar },
      lang === 'ar' ? 'تم نشر مجسم المدرسة التفاعلي لجميع المستخدمين' : '3D campus blueprint published',
    );
    if (ok) {
      editor.setDirty(false);
      await onRefreshLayoutExtras();
    }
  };

  const handleRegisterQr = async (room: CampusRoom) => {
    const fl = editor.draft.floors.find((f) => f.id === room.floorId);
    const ok = await mutate(
      '/campus-beacons',
      {
        room_id: room.id,
        floor_id: room.floorId,
        beacon_type: 'qr',
        identifier: `QR-${room.id}`,
        rssi_ref: -45,
        x: room.x,
        y: fl?.elevationY || 0,
        z: room.z,
      },
      lang === 'ar' ? 'تم ربط إشارة QR بالغرفة' : 'QR room beacon registered',
    );
    if (ok) await onRefreshLayoutExtras();
  };

  const handleDeleteBeacon = async (id: string) => {
    const ok = await mutate(`/campus-beacons/${id}/delete`, {}, lang === 'ar' ? 'تم حذف الإشارة' : 'Beacon deleted');
    if (ok) await onRefreshLayoutExtras();
  };

  const cycleSnap = () =>
    editor.setGridSnap((s) => (s === 0.5 ? 1 : s === 1 ? 0.25 : 0.5));

  return (
    <>
      <EditorToolbar
        draft={editor.draft}
        tool={editor.tool}
        selected={editor.selected}
        transformMode={editor.transformMode}
        activeFloorId={editor.activeFloorId}
        activeWingId={editor.activeWingId}
        gridSnap={editor.gridSnap}
        onionSkin={editor.onionSkin}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        dirty={editor.dirty}
        busy={busy}
        measureDims={measureDims}
        classes={data.classes}
        lang={lang}
        onSelectTool={editor.setTool}
        onSetTransformMode={editor.setTransformMode}
        onSelectFloor={editor.setActiveFloorId}
        onAddFloor={() => editor.addFloor()}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onCycleSnap={cycleSnap}
        onToggleOnion={() => editor.setOnionSkin((v) => !v)}
        onOpenGeo={() => editor.setGeoCalibratorOpen(true)}
        onLoadStarter={() => editor.loadStarter(data.classes)}
        onClearBlank={editor.clearBlank}
        onPublish={() => void handlePublish()}
        onExit={onExit}
      />

      <EditorInspectorWindow
        draft={editor.draft}
        selected={editor.selected}
        activeWingId={editor.activeWingId}
        beacons={beacons}
        data={data}
        lang={lang}
        onSelectWing={editor.setActiveWingId}
        onAddWing={(name) => editor.addWing(name)}
        onUpdateRoom={editor.updateRoom}
        onToggleSharedWall={editor.toggleSharedWallMerge}
        onUpdateProp={editor.updateProp}
        onUpdateAssignment={editor.updateAssignment}
        onDuplicate={editor.duplicateSelected}
        onDelete={editor.deleteSelected}
        onRegisterQrBeacon={(r) => void handleRegisterQr(r)}
        onDeleteBeacon={(id) => void handleDeleteBeacon(id)}
      />

      {editor.tool === 'prop' && (
        <EditorPropDrawer
          activePropId={editor.activePropId}
          activeModelUrl={editor.activeModelUrl}
          propRotation={editor.propRotation}
          lang={lang}
          onSelectProp={(id, modelUrl) => {
            editor.setActivePropId(id);
            editor.setActiveModelUrl(modelUrl);
          }}
          onRotate={() => editor.setPropRotation((r) => (r + Math.PI / 4) % (Math.PI * 2))}
        />
      )}

      {editor.geoCalibratorOpen && (
        <EditorGeoWindow
          initial={geoAnchor}
          lang={lang}
          busy={busy}
          onClose={() => editor.setGeoCalibratorOpen(false)}
          mutate={async (u, b, m) => {
            const ok = await mutate(u, b, m);
            if (ok) await onRefreshLayoutExtras();
            return ok;
          }}
        />
      )}
    </>
  );
}
