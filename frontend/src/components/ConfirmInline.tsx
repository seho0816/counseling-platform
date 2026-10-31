interface Props {
  message: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 되돌리기 어려운 동작 앞에서 그 자리에서 한 번 더 묻는다. */
export default function ConfirmInline({ message, confirmLabel, busy = false, onConfirm, onCancel }: Props) {
  return (
    <div className="confirm" role="group" aria-label="확인">
      <p>{message}</p>
      <div className="actions">
        <button type="button" className="btn btn--primary btn--sm" onClick={onConfirm} disabled={busy}>
          {busy ? '처리하는 중이에요' : confirmLabel}
        </button>
        <button type="button" className="btn btn--quiet btn--sm" onClick={onCancel} disabled={busy}>
          취소
        </button>
      </div>
    </div>
  );
}
