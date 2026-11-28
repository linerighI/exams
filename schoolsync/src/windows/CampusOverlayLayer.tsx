/**
 * Consolidated non-spatial overlay stack (AuthWindow, Blank Campus CTA banner,
 * parked FamilySummaryWindow, SchoolSync Blue Orb companion host, and toast alerts).
 */
import type { Dispatch, SetStateAction } from 'react';
import { Box } from 'lucide-react';
import type { Language } from '../i18n';
import type { OrbTone } from '../Orb';
import type { CampusLayout, DemoRole, State } from '../types';
import { AuthWindow } from './AuthWindow';
import type { FamilyPanelSection } from './FamilyDetailWindow';
import { FamilySummaryWindow } from './FamilySummaryWindow';
import type { OrbCompanionActions } from './OrbCommandGrid';
import { OrbOverlayHost } from './OrbOverlayHost';

interface CampusOverlayLayerProps {
  auth: boolean;
  setupRequired: boolean;
  demo: boolean;
  busy: boolean;
  error: string;
  toast: string;
  offline: boolean;
  schoolName: string;
  lang: Language;
  staff: boolean;
  manager: boolean;
  editorMode: boolean;
  activeLayout: CampusLayout;
  data: State | null;
  orbTone: OrbTone;
  connectionOpen: boolean;
  orbActions: OrbCompanionActions;
  familySection: FamilyPanelSection | null;
  setOrbTone: (t: OrbTone) => void;
  setConnectionOpen: (v: boolean) => void;
  setEditorMode: (v: boolean) => void;
  setFamilySection: Dispatch<SetStateAction<FamilyPanelSection | null>>;
  setSetupRequired: (v: boolean) => void;
  setBusy: (v: boolean) => void;
  setError: (e: string) => void;
  reloadConfig: () => Promise<void>;
  refresh: () => Promise<void>;
  signIn: (input: { portal: 'staff' | 'family'; email?: string; nationalId?: string; password: string }) => Promise<void>;
  switchDemoRole?: (role: DemoRole) => Promise<void>;
  loadStudentState: (id: string) => Promise<unknown>;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
}

/** Renders auth, parked family summary, blank-canvas prompt, orbs, and toast stack. */
export function CampusOverlayLayer(p: CampusOverlayLayerProps) {
  return (
    <>
      {(!p.auth || !p.data) && (
        <AuthWindow
          setupRequired={p.setupRequired}
          demo={p.demo}
          busy={p.busy}
          error={p.error}
          schoolName={p.schoolName}
          lang={p.lang}
          orbTone={p.orbTone}
          onOrbToneChange={p.setOrbTone}
          onOpenConnectionOrb={() => p.setConnectionOpen(true)}
          onReloadConfig={p.reloadConfig}
          onSignIn={p.signIn}
          onSwitchDemoRole={p.switchDemoRole}
          onSetupComplete={async () => {
            p.setSetupRequired(false);
            await p.refresh();
          }}
          onBusyChange={p.setBusy}
          onErrorChange={p.setError}
        />
      )}

      {p.auth && p.data && p.staff && !p.editorMode && p.manager && p.activeLayout.rooms.length === 0 && (
        <div className="sp-editor-empty-banner">
          <strong>{p.lang === 'ar' ? 'لا يوجد مجسم مدرسة منشور بعد' : 'Blank Campus Canvas'}</strong>
          <p>
            {p.lang === 'ar'
              ? 'افتح محرر المدرسة ثلاثي الأبعاد لتصميم القاعات، الممرات، الأثاث، والمساحات.'
              : 'Open the 3D School Editor to build classrooms, corridors, furniture, and zones.'}
          </p>
          <button type="button" className="sp-btn-primary" onClick={() => p.setEditorMode(true)}>
            <Box size={15} />
            <span>{p.lang === 'ar' ? 'تشغيل محرر SARE 3D' : 'Launch SARE 3D Editor'}</span>
          </button>
        </div>
      )}

      {p.auth && p.data && !p.staff && (
        <FamilySummaryWindow
          data={p.data}
          lang={p.lang}
          busy={p.busy}
          activeSection={p.familySection}
          onSelectSection={p.setFamilySection}
          onSelectChild={(id) => void p.loadStudentState(id)}
          mutate={p.mutate}
        />
      )}

      <OrbOverlayHost
        auth={p.auth}
        demo={p.demo}
        data={p.data}
        schoolName={p.schoolName}
        lang={p.lang}
        offline={p.offline}
        orbTone={p.orbTone}
        connectionOpen={p.connectionOpen}
        orbActions={p.orbActions}
        onOrbToneChange={p.setOrbTone}
        onCloseConnection={() => p.setConnectionOpen(false)}
        onOpenConnection={() => p.setConnectionOpen(true)}
        onReloadConfig={p.reloadConfig}
      />

      {(p.toast || p.error) && p.auth && (
        <div className="sp-toast-stack" aria-live="polite">
          {p.toast && <div className="sp-toast">{p.toast}</div>}
          {p.error && (
            <div className="sp-toast is-error" role="alert">
              <span>{p.error}</span>
              <button type="button" onClick={() => p.setError('')}>×</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
