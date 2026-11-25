import React, { useRef, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';

export async function triggerBrowserCredentialSave(
  formEl: HTMLFormElement | null,
  username: string,
  secret: string
): Promise<void> {
  if (typeof window === 'undefined') return;

  // 1. Chromium / Edge / Android Chrome: Credential Management API
  try {
    const winAny = window as any;
    const navAny = navigator as any;
    if ('PasswordCredential' in winAny && navAny.credentials?.store) {
      let cred: any = null;
      try {
        cred = new winAny.PasswordCredential({
          id: username,
          password: secret,
          name: username
        });
      } catch {
        if (formEl) {
          cred = new winAny.PasswordCredential(formEl);
        }
      }
      if (cred) {
        await navAny.credentials.store(cred);
      }
    }
  } catch {
    // Browser blocked or dismissed credential store
  }

  // 2. iOS / macOS Safari Keychain & KeePassXC-Browser SPA heuristic:
  // Push a temporary URL history boundary while the <form method="post"> remains mounted
  // briefly in the DOM, then restore cleanly without reloading static GitHub Pages.
  try {
    const origUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const savedHash = '#keychain-unlocked';
    if (window.location.hash !== savedHash) {
      window.history.pushState(
        { ...(window.history.state || {}), keychainSavedAt: Date.now() },
        '',
        `${window.location.pathname}${window.location.search}${savedHash}`
      );
      window.setTimeout(() => {
        try {
          window.history.replaceState(window.history.state, '', origUrl);
        } catch {
          // ignore
        }
      }, 700);
    }
  } catch {
    // ignore history errors in restricted sandboxes
  }
}

export interface GeminiKeyCredentialFormProps {
  idPrefix: string;
  accountName: string;
  onAccountNameChange: (val: string) => void;
  apiKey: string;
  onApiKeyChange: (val: string) => void;
  showApiKey: boolean;
  onToggleShowApiKey: () => void;
  onHideApiKey: () => void;
  onClearFromRam: () => void;
  onSubmitKey: (trimmedKey: string, trimmedAccount: string) => void | Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  showHelpLink?: boolean;
  showStatusHeader?: boolean;
  headerTitle?: string;
  accountLabel?: string;
  accountPlaceholder?: string;
  fieldLabel?: string;
  secretPlaceholder?: string;
  defaultAccountFallback?: string;
  iconAccentClass?: string;
  isUnlocked?: boolean;
  otherKnownAccountName?: string;
  onCredentialRoutedToOther?: (otherAccount: string, secret: string) => void;
  formRef?: React.RefObject<HTMLFormElement | null>;
  onToast?: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const GeminiKeyCredentialForm: React.FC<GeminiKeyCredentialFormProps> = ({
  idPrefix,
  accountName,
  onAccountNameChange,
  apiKey,
  onApiKeyChange,
  showApiKey,
  onToggleShowApiKey,
  onHideApiKey,
  onClearFromRam,
  onSubmitKey,
  onCancel,
  submitLabel = 'Odemknout do RAM',
  cancelLabel = 'Zrušit',
  showHelpLink = true,
  showStatusHeader = false,
  headerTitle = 'Google / Gemini API klíč (pouze RAM)',
  accountLabel = 'Účet v Klíčence / KeePassu (1 údaj):',
  accountPlaceholder = 'UbyExport Google API',
  fieldLabel = 'Google Gemini API klíč (heslo / secret):',
  secretPlaceholder = 'Klepněte pro Klíčenku / KeePass nebo vložte...',
  defaultAccountFallback = 'UbyExport Google API',
  iconAccentClass = 'text-sky-400',
  isUnlocked,
  otherKnownAccountName,
  onCredentialRoutedToOther,
  formRef,
  onToast
}) => {
  const internalFormRef = useRef<HTMLFormElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const [isProcessingSubmit, setIsProcessingSubmit] = useState(false);

  const resolvedUnlocked = typeof isUnlocked === 'boolean' ? isUnlocked : Boolean(apiKey.trim());

  const formActionUrl =
    typeof window !== 'undefined'
      ? `${window.location.pathname || './'}${window.location.search || ''}`
      : './';

  const canUseCredentialGet =
    typeof window !== 'undefined' &&
    'PasswordCredential' in window &&
    typeof navigator !== 'undefined' &&
    Boolean((navigator as any).credentials?.get);

  const isEmbeddedIframe =
    typeof window !== 'undefined' && (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();

  const isMatchingOtherAccount = (pickedId: string): boolean => {
    const cleanPicked = pickedId.trim().toLowerCase();
    const cleanOther = (otherKnownAccountName || '').trim().toLowerCase();
    const cleanSelf = (accountName.trim() || defaultAccountFallback).toLowerCase();
    if (!cleanPicked || !cleanOther || cleanPicked === cleanSelf) return false;
    return cleanPicked === cleanOther;
  };

  const handleLoadFromBrowserManager = async () => {
    try {
      const cred = await (navigator as any).credentials.get({
        password: true,
        mediation: 'optional'
      });
      if (cred && 'password' in cred && cred.password) {
        const pickedId = cred.id ? String(cred.id).trim() : '';
        const pickedPass = String(cred.password).trim();

        if (pickedId && isMatchingOtherAccount(pickedId) && onCredentialRoutedToOther) {
          onCredentialRoutedToOther(pickedId, pickedPass);
          onToast?.(`Načtený záznam „${pickedId}“ byl automaticky přiřazen do správného pole.`, 'success');
          return;
        }

        if (pickedId) {
          onAccountNameChange(pickedId);
        }
        onApiKeyChange(pickedPass);
        onToast?.('Klíč načten ze správce hesel prohlížeče do RAM.', 'success');
      } else {
        onToast?.('Pro tento web zatím není ve správci hesel uložený žádný klíč.', 'info');
      }
    } catch {
      onToast?.('Vyberte uložený klíč přímo v poli přes Klíčenku nebo KeePass.', 'info');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isProcessingSubmit) return;

    const trimmedKey = apiKey.trim();
    const trimmedAccount = accountName.trim() || defaultAccountFallback;

    if (!trimmedKey) {
      onToast?.('Zadejte nebo vložte z Klíčenky / KeePassu svůj API klíč.', 'warning');
      return;
    }

    // Pokud prohlížeč automaticky vyplnil účet patřící druhému klíči, bezpečně přesměrujeme do správného stavu
    if (isMatchingOtherAccount(trimmedAccount) && onCredentialRoutedToOther) {
      onCredentialRoutedToOther(trimmedAccount, trimmedKey);
      onToast?.(`Záznam „${trimmedAccount}“ byl rozpoznán a uložen do správného klíče v RAM.`, 'info');
      return;
    }

    // Zajistíme synchronně type="password", aby Safari / KeePassXC / Chrome spolehlivě rozpoznaly secret při odeslání
    if (passwordInputRef.current) {
      passwordInputRef.current.type = 'password';
    }
    onHideApiKey();

    if (!accountName.trim()) {
      onAccountNameChange(trimmedAccount);
    }

    setIsProcessingSubmit(true);
    const activeForm = formRef?.current || internalFormRef.current || e.currentTarget;

    await triggerBrowserCredentialSave(activeForm, trimmedAccount, trimmedKey);

    // Krátká pauza udrží <form> v DOM po pushState, aby Safari i KeePassXC stihly zachytit odeslání a nabídnout Uložit heslo
    window.setTimeout(async () => {
      try {
        await onSubmitKey(trimmedKey, trimmedAccount);
      } finally {
        setIsProcessingSubmit(false);
      }
    }, 450);
  };

  return (
    <form
      ref={el => {
        internalFormRef.current = el;
        if (formRef) {
          formRef.current = el;
        }
      }}
      method="post"
      action={formActionUrl}
      autoComplete="on"
      onSubmit={handleSubmit}
      className="space-y-3 text-left"
    >
      {showStatusHeader && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-200 font-bold flex items-center gap-1.5 text-xs min-w-0">
            <KeyRound className={`w-4 h-4 ${iconAccentClass} shrink-0`} />
            <span className="truncate">{headerTitle}</span>
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {resolvedUnlocked ? (
              <>
                <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 whitespace-nowrap">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>V RAM</span>
                </span>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={onClearFromRam}
                  className="text-[11px] text-rose-400 hover:underline font-semibold cursor-pointer whitespace-nowrap"
                >
                  Vymazat
                </button>
              </>
            ) : (
              <span className="text-[11px] text-amber-400 font-semibold whitespace-nowrap">Uzamčeno</span>
            )}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <label htmlFor={`${idPrefix}-username`} className="text-[11px] text-slate-400 font-semibold block">
            {accountLabel}
          </label>
          {canUseCredentialGet && (
            <button
              type="button"
              tabIndex={-1}
              onClick={handleLoadFromBrowserManager}
              className="text-[11px] text-sky-400 hover:underline font-semibold cursor-pointer whitespace-nowrap"
            >
              Načíst z hesel
            </button>
          )}
        </div>
        <input
          id={`${idPrefix}-username`}
          type="text"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          value={accountName}
          onChange={e => onAccountNameChange(e.target.value)}
          placeholder={accountPlaceholder}
          className="w-full min-h-[44px] bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-base sm:text-xs focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor={`${idPrefix}-password`} className="text-[11px] text-slate-300 font-semibold">
            {fieldLabel}
          </label>
          {!showStatusHeader && apiKey.trim() && (
            <button
              type="button"
              tabIndex={-1}
              onClick={onClearFromRam}
              className="text-[11px] text-rose-400 hover:underline font-semibold cursor-pointer"
            >
              Vymazat z RAM
            </button>
          )}
        </div>
        <div className="relative flex items-center">
          <input
            ref={passwordInputRef}
            id={`${idPrefix}-password`}
            type={showApiKey ? 'text' : 'password'}
            name="password"
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={apiKey}
            onChange={e => onApiKeyChange(e.target.value)}
            placeholder={secretPlaceholder}
            className="w-full min-h-[44px] bg-slate-800 border border-slate-700 text-white font-mono rounded-xl pl-3 pr-11 py-2 text-base sm:text-xs focus:ring-1 focus:ring-blue-500 outline-none"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={onToggleShowApiKey}
            className="absolute right-1 min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg cursor-pointer"
            title={showApiKey ? 'Skrýt klíč' : 'Zobrazit klíč'}
          >
            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {showHelpLink && (
          <p className="text-[11px] text-slate-400 mt-1.5">
            Bezplatný klíč získáte na{' '}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 underline font-semibold"
            >
              aistudio.google.com/apikey
            </a>
          </p>
        )}
      </div>

      {isEmbeddedIframe && (
        <p className="text-[10px] text-amber-300/90 leading-snug">
          Upozornění: v náhledovém okně může prohlížeč blokovat Klíčenku – na přímé adrese (GitHub Pages) funguje ukládání i načítání hesel naplno.
        </p>
      )}

      <div className="flex gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessingSubmit}
            className="flex-1 min-h-[44px] py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-semibold tap-active cursor-pointer disabled:opacity-60"
          >
            {cancelLabel}
          </button>
        )}
        <button
          type="submit"
          disabled={isProcessingSubmit}
          className="flex-1 min-h-[44px] py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold tap-active cursor-pointer shadow-lg shadow-blue-600/30 whitespace-nowrap flex items-center justify-center gap-1.5 disabled:opacity-80"
        >
          {isProcessingSubmit ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>Aktivuji klíč...</span>
            </>
          ) : (
            <span>{submitLabel}</span>
          )}
        </button>
      </div>
    </form>
  );
};
