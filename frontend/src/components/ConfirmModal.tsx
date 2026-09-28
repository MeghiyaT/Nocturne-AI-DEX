import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, X, Info } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message?: React.ReactNode;
  itemName?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  confirmIcon?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title = 'Are you sure?',
  message,
  itemName,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  confirmIcon,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const isDanger = variant === 'danger';
  const isWarning = variant === 'warning';

  const badgeBg = isDanger
    ? 'rgba(248, 113, 113, 0.1)'
    : isWarning
    ? 'rgba(229, 169, 80, 0.1)'
    : 'rgba(255, 255, 255, 0.08)';

  const badgeColor = isDanger
    ? 'var(--accent-rose, #f87171)'
    : isWarning
    ? 'var(--accent-amber, #e5a950)'
    : 'var(--text-main, #ffffff)';

  const badgeBorder = isDanger
    ? '1px solid rgba(248, 113, 113, 0.25)'
    : isWarning
    ? '1px solid rgba(229, 169, 80, 0.25)'
    : '1px solid rgba(255, 255, 255, 0.15)';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1200,
        padding: '1.5rem',
      }}
      onClick={onCancel}
    >
      <div
        className="card"
        style={{
          maxWidth: 440,
          width: '100%',
          padding: '1.75rem',
          background: 'var(--bg-modal, #0d0f17)',
          border: isDanger ? '1px solid rgba(248, 113, 113, 0.25)' : '1px solid var(--border-glass)',
          boxShadow: 'var(--shadow-modal, 0 24px 60px rgba(0, 0, 0, 0.9))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 'var(--radius-sm, 8px)',
                background: badgeBg,
                border: badgeBorder,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: badgeColor,
                flexShrink: 0,
              }}
            >
              {confirmIcon ? (
                confirmIcon
              ) : isDanger ? (
                <Trash2 size={18} />
              ) : isWarning ? (
                <AlertTriangle size={18} />
              ) : (
                <Info size={18} />
              )}
            </div>
            <div>
              <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: 600 }}>{title}</h3>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onCancel}
            style={{ padding: '0.35rem', color: 'var(--text-subtle)' }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ marginBottom: '1.5rem', color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: '1.5' }}>
          {message ? (
            message
          ) : itemName ? (
            <div>
              Are you sure you want to remove <strong style={{ color: 'var(--text-main)' }}>"{itemName}"</strong>?
              <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: 'var(--text-subtle)' }}>
                This action will permanently remove this dataset listing.
              </div>
            </div>
          ) : (
            'Are you sure you want to proceed with this action?'
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn btn-sm ${isDanger ? 'btn-danger' : isWarning ? 'btn-amber' : 'btn-primary'}`}
            onClick={onConfirm}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            {confirmIcon ? confirmIcon : isDanger ? <Trash2 size={13} /> : null}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
