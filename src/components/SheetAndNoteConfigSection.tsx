import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardPaste,
  Copy,
  FileSpreadsheet,
  Link2,
  ShieldCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  buildSecretFreeNote,
  parseSecretFreeNote,
  SecretFreeConfigNote,
  SheetAuthMode
} from '../lib/configNote';
import { GeminiKeyCredentialForm } from './GeminiKeyCredentialForm';
import { isValidOAuthClientId } from '../lib/googleAuth';

export interface SheetAndNoteConfigSectionProps {
  idPrefix: string;
  sheetMode: SheetAuthMode;
  onSheetModeChange: (mode: SheetAuthMode) => void;
  sheetUrlInput: string;
  onSheetUrlInputChange: (val: string) => void;
  oauthClientIdInput: string;
  onOAuthClientIdInputChange: (val: string) => void;
  firebaseProjectIdInput: string;
  onFirebaseProjectIdInputChange: (val: string) => void;
  firebaseSeparateKey: boolean;
  onFirebaseSeparateKeyChange: (val: boolean) => void;
  apiAccountName: string;
  fbAccountName: string;
  onFbAccountNameChange: (val: string) => void;
  firebaseApiKeyInput: string;
  onFirebaseApiKeyInputChange: (val: string) => void;
  geminiApiKeyInRam: string;
  onUnlockFirebaseKey: (trimmedKey: string, trimmedAccount: string) => void | Promise<void>;
  onClearFirebaseKey: () => void;
  onRouteToGeminiKey: (accountName: string, secret: string) => void;
  activeModelName: string;
  onApplyParsedNote: (parsed: Partial<SecretFreeConfigNote>) => void;
  onLoadPublicSheet?: () => void;
  isLoadingPublicSheet?: boolean;
  onLoginOAuth?: () => void;
  onLoginFirebase?: () => void;
  onOpenSheetsModal?: () => void;
  isSignedIn?: boolean;
  signedInEmail?: string | null;
  connectedSheetTitle?: string | null;
  onToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const SheetAndNoteConfigSection: React.FC<SheetAndNoteConfigSectionProps> = ({
  idPrefix,
  sheetMode,
  onSheetModeChange,
  sheetUrlInput,
  onSheetUrlInputChange,
  oauthClientIdInput,
  onOAuthClientIdInputChange,
  firebaseProjectIdInput,
  onFirebaseProjectIdInputChange,
  firebaseSeparateKey,
  onFirebaseSeparateKeyChange,
  apiAccountName,
  fbAccountName,
  onFbAccountNameChange,
  firebaseApiKeyInput,
  onFirebaseApiKeyInputChange,
  geminiApiKeyInRam,
  onUnlockFirebaseKey,
  onClearFirebaseKey,
  onRouteToGeminiKey,
  activeModelName,
  onApplyParsedNote,
  onLoadPublicSheet,
  isLoadingPublicSheet = false,
  onLoginOAuth,
  onLoginFirebase,
  onOpenSheetsModal,
  isSignedIn = false,
  signedInEmail,
  connectedSheetTitle,
  onToast
}) => {
  const [showFbKey, setShowFbKey] = useState(false);
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [pasteNoteText, setPasteNoteText] = useState('');
  const [copiedNoteRecently, setCopiedNoteRecently] = useState(false);

  const generatedNote = useMemo(
    () =>
      buildSecretFreeNote({
        sheetMode,
        sheetUrl: sheetUrlInput,
        oauthClientId: oauthClientIdInput,
        firebaseProjectId: firebaseProjectIdInput,
        firebaseSeparateKey,
        apiAccount: apiAccountName,
        fbAccount: fbAccountName,
        model: activeModelName
      }),
    [
      sheetMode,
      sheetUrlInput,
      oauthClientIdInput,
      firebaseProjectIdInput,
      firebaseSeparateKey,
      apiAccountName,
      fbAccountName,
      activeModelName
    ]
  );

  const handleCopyNote = async () => {
    try {
      await navigator.clipboard.writeText(generatedNote);
      setCopiedNoteRecently(true);
      window.setTimeout(() => setCopiedNoteRecently(false), 2000);
      onToast('Konfigurace bez hesel zkopírována do schránky pro Poznámky v Klíčence / KeePassu.', 'success');
    } catch {
      setShowNoteEditor(true);
      onToast('Zkopírujte text poznámky níže ručně.', 'info');
    }
  };

  const applyImportedText = (raw: string) => {
    const res = parseSecretFreeNote(raw);
    if (res.parsedFieldsCount === 0) {
      onToast('V textu nebyly rozpoznány žádné konfigurační údaje UbyExport.', 'warning');
      return;
    }
    onApplyParsedNote(res.config);
    setPasteNoteText('');
    setShowNoteEditor(false);
    if (res.strippedSecretWarning) {
      onToast('Konfigurace načtena. Tajné klíče z poznámky byly z bezpečnostních důvodů odfiltrovány.', 'info');
    } else {
      onToast(`Konfigurace z poznámky načtena (${res.parsedFieldsCount} údajů).`, 'success');
    }
  };

  const handlePasteFromClipboard = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      try {
        const clip = await navigator.clipboard.readText();
        if (clip && clip.trim()) {
          applyImportedText(clip);
          return;
        }
      } catch {
        // iOS Safari nebo blokovaná schránka – otevřeme textové pole pro ruční Cmd+V / Vložit
      }
    }
    setShowNoteEditor(true);
    onToast('Vložte text poznámky do pole níže a potvrďte.', 'info');
  };

  const oauthIdTrimmed = oauthClientIdInput.trim();
  const oauthIdValid = !oauthIdTrimmed || isValidOAuthClientId(oauthIdTrimmed);

  return (
    <div className="space-y-3 text-left text-xs">
      {/* 1. JEDINÝ AKTIVNÍ TYP NAPOJENÍ NA GOOGLE SHEET */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-slate-200 flex items-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Napojení Google Sheetu (1 aktivní typ)</span>
          </span>
          {onOpenSheetsModal && (
            <button
              type="button"
              onClick={onOpenSheetsModal}
              className="text-[11px] text-sky-400 hover:underline font-semibold cursor-pointer whitespace-nowrap"
            >
              Export / náhled
            </button>
          )}
        </div>

        {/* 3polohový přepínač běžných konfigurací */}
        <div className="grid grid-cols-3 gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
          {[
            { id: 'pub' as SheetAuthMode, label: 'Veřejný odkaz' },
            { id: 'oauth' as SheetAuthMode, label: 'OAuth2' },
            { id: 'fb' as SheetAuthMode, label: 'Firebase' }
          ].map(opt => {
            const active = sheetMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSheetModeChange(opt.id)}
                className={`min-h-[38px] px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  active
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Společné ne-tajné pole: URL Google Sheetu */}
        <div>
          <label htmlFor={`${idPrefix}-sheet-url`} className="block text-[11px] text-slate-400 font-semibold mb-1">
            {sheetMode === 'pub'
              ? 'URL veřejného Google Sheetu (Sdílet → Kdokoliv s odkazem):'
              : 'URL nebo ID Google Sheetu (volitelné):'}
          </label>
          <div className="flex gap-2">
            <input
              id={`${idPrefix}-sheet-url`}
              type="url"
              value={sheetUrlInput}
              onChange={e => onSheetUrlInputChange(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="flex-1 min-w-0 min-h-[44px] bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2 text-base sm:text-xs font-mono outline-none focus:ring-1 focus:ring-sky-500"
            />
            {sheetMode === 'pub' && onLoadPublicSheet && (
              <button
                type="button"
                onClick={onLoadPublicSheet}
                disabled={isLoadingPublicSheet}
                className="min-h-[44px] px-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer disabled:opacity-60 flex items-center gap-1"
              >
                <Link2 className="w-3.5 h-3.5 shrink-0" />
                <span>{isLoadingPublicSheet ? 'Načítám...' : 'Načíst'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Pole pro OAuth2 */}
        {sheetMode === 'oauth' && (
          <div className="space-y-2 pt-1 border-t border-slate-800/80">
            <div>
              <label htmlFor={`${idPrefix}-oauth-id`} className="block text-[11px] text-slate-400 font-semibold mb-1">
                Google OAuth Client ID (ne-tajné ID):
              </label>
              <input
                id={`${idPrefix}-oauth-id`}
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={oauthClientIdInput}
                onChange={e => onOAuthClientIdInputChange(e.target.value)}
                placeholder="1234567890-xxxx.apps.googleusercontent.com"
                className={`w-full min-h-[44px] bg-slate-800 border ${
                  oauthIdValid ? 'border-slate-700' : 'border-rose-500/60'
                } text-slate-100 rounded-xl px-3 py-2 text-base sm:text-xs font-mono outline-none focus:ring-1 focus:ring-blue-500`}
              />
              {!oauthIdValid && (
                <p className="text-[10px] text-rose-400 mt-1">
                  Očekávaný tvar končí na .apps.googleusercontent.com
                </p>
              )}
            </div>
            {onLoginOAuth && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400 truncate">
                  {isSignedIn ? `Přihlášen: ${signedInEmail || connectedSheetTitle || 'Google účet'}` : 'Pro zápis do Sheetu se přihlaste'}
                </span>
                <button
                  type="button"
                  onClick={onLoginOAuth}
                  className="min-h-[38px] px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  {isSignedIn ? 'Připojit / Obnovit OAuth2' : 'Přihlásit OAuth2'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Pole pro Firebase */}
        {sheetMode === 'fb' && (
          <div className="space-y-3 pt-1 border-t border-slate-800/80">
            <div>
              <label htmlFor={`${idPrefix}-fb-project`} className="block text-[11px] text-slate-400 font-semibold mb-1">
                Firebase Project ID (ne-tajné ID projektu):
              </label>
              <input
                id={`${idPrefix}-fb-project`}
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={firebaseProjectIdInput}
                onChange={e => onFirebaseProjectIdInputChange(e.target.value)}
                placeholder="např. muj-ubyport-projekt"
                className="w-full min-h-[44px] bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2 text-base sm:text-xs font-mono outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Volba 1 společný klíč vs 2 oddělené záznamy v Klíčence */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 space-y-2">
              <span className="text-[11px] font-semibold text-slate-300 block">
                Web API klíč pro Firebase:
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => onFirebaseSeparateKeyChange(false)}
                  className={`min-h-[38px] px-2 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer border ${
                    !firebaseSeparateKey
                      ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-200'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Stejný jako Google API (1 záznam)
                </button>
                <button
                  type="button"
                  onClick={() => onFirebaseSeparateKeyChange(true)}
                  className={`min-h-[38px] px-2 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer border ${
                    firebaseSeparateKey
                      ? 'bg-amber-600/20 border-amber-500/50 text-amber-200'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Odlišný klíč (2. záznam)
                </button>
              </div>
              {!firebaseSeparateKey && (
                <p className="text-[10px] text-slate-400 leading-snug">
                  {geminiApiKeyInRam.trim()
                    ? 'Firebase automaticky používá aktivní Google API klíč z RAM.'
                    : 'Po odemknutí Google API klíče výše se automaticky použije i pro Firebase.'}
                </p>
              )}
            </div>

            {/* 2. samostatný formulář pro Firebase Web API klíč při různých klíčích */}
            {firebaseSeparateKey && (
              <div className="bg-slate-900/80 border border-amber-500/30 rounded-xl p-3">
                <GeminiKeyCredentialForm
                  idPrefix={`${idPrefix}-fb-cred`}
                  accountName={fbAccountName}
                  onAccountNameChange={onFbAccountNameChange}
                  apiKey={firebaseApiKeyInput}
                  onApiKeyChange={onFirebaseApiKeyInputChange}
                  showApiKey={showFbKey}
                  onToggleShowApiKey={() => setShowFbKey(prev => !prev)}
                  onHideApiKey={() => setShowFbKey(false)}
                  onClearFromRam={onClearFirebaseKey}
                  showStatusHeader={true}
                  showHelpLink={false}
                  headerTitle="Firebase Web API klíč (2. záznam)"
                  accountLabel="Účet Firebase v Klíčence / KeePassu (1 údaj):"
                  accountPlaceholder="UbyExport Firebase"
                  defaultAccountFallback="UbyExport Firebase"
                  fieldLabel="Firebase Web API klíč (heslo / secret):"
                  secretPlaceholder="Vyplňte z 2. záznamu v Klíčence..."
                  submitLabel="Uložit Firebase klíč / RAM"
                  iconAccentClass="text-amber-400"
                  isUnlocked={Boolean(firebaseApiKeyInput.trim())}
                  otherKnownAccountName={apiAccountName}
                  onCredentialRoutedToOther={onRouteToGeminiKey}
                  onToast={onToast}
                  onSubmitKey={onUnlockFirebaseKey}
                />
              </div>
            )}

            {onLoginFirebase && (
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="text-[11px] text-slate-400 truncate">
                  {isSignedIn ? `Přihlášen: ${signedInEmail || 'Firebase účet'}` : 'Vyžaduje Firebase Project ID a klíč'}
                </span>
                <button
                  type="button"
                  onClick={onLoginFirebase}
                  className="min-h-[38px] px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap"
                >
                  Přihlásit Firebase
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. POZNÁMKA BEZ HESEL A SECRETŮ PRO APPLE HESLA / KEEPASS */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-slate-200 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />
            <span>Poznámka pro Klíčenku / KeePass (bez hesel)</span>
          </span>
          <button
            type="button"
            onClick={() => setShowNoteEditor(prev => !prev)}
            className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
          >
            <span>{showNoteEditor ? 'Skrýt text' : 'Zobrazit / vložit'}</span>
            {showNoteEditor ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Zkopírujte celou konfiguraci (typ Sheetu, URL, Client/Project ID, model) <strong className="text-slate-200">bez jakýchkoliv tajných klíčů</strong> do pole <em>Poznámky</em> v Apple Heslech či KeePassu.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleCopyNote}
            className="min-h-[42px] px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer tap-active"
          >
            {copiedNoteRecently ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Zkopírováno</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>Kopírovat poznámku</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handlePasteFromClipboard}
            className="min-h-[42px] px-3 py-2 bg-blue-600/20 hover:bg-blue-600/35 border border-blue-500/40 text-blue-100 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer tap-active"
          >
            <ClipboardPaste className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>Načíst z poznámky</span>
          </button>
        </div>

        {showNoteEditor && (
          <div className="space-y-2 pt-1 border-t border-slate-800/80">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Aktuální poznámka k uložení (bez tajných klíčů):
              </span>
              <pre className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-[10px] font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap select-all">
                {generatedNote}
              </pre>
            </div>

            <div>
              <label htmlFor={`${idPrefix}-paste-note`} className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Obnovit konfiguraci vložením poznámky:
              </label>
              <textarea
                id={`${idPrefix}-paste-note`}
                rows={4}
                value={pasteNoteText}
                onChange={e => setPasteNoteText(e.target.value)}
                placeholder={'Sem vložte uloženou poznámku z Apple Hesel nebo KeePassu...'}
                className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 text-slate-100 rounded-xl p-2.5 text-xs font-mono outline-none"
              />
              <div className="flex justify-end mt-1.5">
                <button
                  type="button"
                  disabled={!pasteNoteText.trim()}
                  onClick={() => applyImportedText(pasteNoteText)}
                  className="min-h-[38px] px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Použít vloženou poznámku
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
