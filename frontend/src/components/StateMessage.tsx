import type { ReactNode } from 'react';

interface Props {
  message: string;
  /** 오류·빈 화면에서 다음 행동을 안내하는 버튼 */
  action?: ReactNode;
  role?: 'status' | 'alert';
}

/** 불러오는 중·비어 있음·오류 상태를 같은 모양으로 보여준다. */
export default function StateMessage({ message, action, role = 'status' }: Props) {
  return (
    <div className="state" role={role}>
      <p>{message}</p>
      {action}
    </div>
  );
}
