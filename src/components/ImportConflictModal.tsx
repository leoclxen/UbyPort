import React from 'react';
import { Check, CheckCircle2, X } from 'lucide-react';
import { ImportConflictItem } from '../lib/importConflict';
import { formatDateDDMMYYYY } from '../lib/ubyport';

export interface ImportConflictModalProps {
  conflict: ImportConflictItem;
  currentIndex: number;
  totalCount: number;
  selectedChoice: 'replace' | 'keep';
  onSelectChoice: (choice: 'replace' | 'keep') => void;
  onConfirmStep: () => void;
  onCancel: () => void;
}

export const ImportConflictModal: React.FC<ImportConflictModalProps> = ({
  conflict,
  currentIndex,
  totalCount,
  selectedChoice,
  onSelectChoice,
  onConfirmStep,
  onCancel
}) => {
  const isProperty = conflict.kind === 'property';
  const isLastStep = currentIndex + 1 >= totalCount;

  const existingTitle = isProperty
    ? conflict.existing.name
    : `${conflict.existing.lastName} ${conflict.existing.firstName}`.trim();

  const existingMeta = isProperty
    ? `IDUB: ${conflict.existing.idub || 'neuveden'} · ${conflict.existing.facilityCode || 'bez zkratky'}`
    : `${conflict.existing.nationality} · Doklad ${conflict.existing.idDocumentNumber || '—'} · ${
        conflict.existing.dateArrival ? formatDateDDMMYYYY(conflict.existing.dateArrival) : '—'
      }`;

  const incomingTitle = isProperty
    ? conflict.incoming.name
    : `${conflict.incoming.lastName} ${conflict.incoming.firstName}`.trim();

  const incomingMeta = isProperty
    ? `IDUB: ${conflict.incoming.idub || 'neuveden'} · ${conflict.incoming.facilityCode || 'bez zkratky'}`
    : `${conflict.incoming.nationality} · Doklad ${conflict.incoming.idDocumentNumber || '—'} · ${
        conflict.incoming.dateArrival ? formatDateDDMMYYYY(conflict.incoming.dateArrival) : '—'
      }`;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-4 sm:p-5 space-y-4 my-auto max-h-[92vh] overflow-y-auto no-scrollbar shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-3 gap-2">
          <div>
            <h3 className="font-bold text-white text-base">
              Kontrola shody při importu
            </h3>
            <p className="text-xs text-blue-400 tabular-nums">
              Konflikt {currentIndex + 1} z {totalCount}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Zrušit import"
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 tap-active cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Match card (identický styl jako při rozpoznání podobného ubytování u skenování) */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-blue-950/70 to-slate-900 border border-blue-500/40 space-y-3">
          <div className="flex items-center gap-2 text-blue-300 font-bold text-xs">
            <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              {isProperty
                ? 'Nalezena shoda se stávajícím ubytováním!'
                : 'Nalezena shoda se stávajícím hostem!'}
            </span>
          </div>

          <p className="text-[11px] text-slate-300 leading-snug">
            Importovaný záznam se shoduje v polích:{' '}
            <span className="font-semibold text-blue-300">
              {conflict.matchReasons.join(', ')}
            </span>
          </p>

          {/* Změněná pole */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 space-y-1.5 max-h-44 overflow-y-auto no-scrollbar">
            <div className="text-[11px] font-semibold text-slate-400">
              Zjištěné změny ({conflict.diffs.length})
            </div>
            {conflict.diffs.map(diff => (
              <div
                key={diff.key}
                className="text-[11px] border-t border-slate-800/70 pt-1.5 first:border-t-0 first:pt-0 space-y-0.5"
              >
                <div className="text-slate-400 font-semibold">{diff.label}</div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono">
                  <span className="text-slate-400 line-through break-all">{diff.existingValue}</span>
                  <span className="text-slate-500">→</span>
                  <span className="text-sky-300 font-semibold break-all">{diff.incomingValue}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Dvě karty volby: Nahradit vs Ponechat */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
            <button
              type="button"
              onClick={() => onSelectChoice('replace')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer min-h-[72px] ${
                selectedChoice === 'replace'
                  ? 'bg-blue-600/30 border-blue-400 text-white shadow-md shadow-blue-500/10 ring-1 ring-blue-500/30'
                  : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between font-bold text-white text-xs">
                <span>Nahradit stávající</span>
                {selectedChoice === 'replace' && (
                  <Check className="w-4 h-4 text-blue-400 shrink-0" />
                )}
              </div>
              <div className="font-bold text-blue-300 mt-1 truncate">
                {incomingTitle}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                {incomingMeta}
              </div>
            </button>

            <button
              type="button"
              onClick={() => onSelectChoice('keep')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer min-h-[72px] ${
                selectedChoice === 'keep'
                  ? 'bg-blue-600/30 border-blue-400 text-white shadow-md shadow-blue-500/10 ring-1 ring-blue-500/30'
                  : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between font-bold text-white text-xs">
                <span>Ponechat stávající</span>
                {selectedChoice === 'keep' && (
                  <Check className="w-4 h-4 text-blue-400 shrink-0" />
                )}
              </div>
              <div className="font-bold text-slate-200 mt-1 truncate">
                {existingTitle}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                {existingMeta}
              </div>
            </button>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 min-h-[44px] py-2.5 px-3 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl font-semibold tap-active cursor-pointer text-xs"
          >
            Zrušit import
          </button>
          <button
            type="button"
            onClick={onConfirmStep}
            className="flex-1 min-h-[44px] py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold tap-active cursor-pointer text-xs tabular-nums"
          >
            {isLastStep
              ? 'Potvrdit a dokončit'
              : `Potvrdit a další (${currentIndex + 1}/${totalCount})`}
          </button>
        </div>
      </div>
    </div>
  );
};
