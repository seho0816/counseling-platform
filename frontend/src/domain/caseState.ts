import type { CaseStatus } from '../types';

/**
 * 사례 상태 전이 규칙 (State 패턴, F-03-2).
 * 상태마다 "다음에 바꿀 수 있는 상태"와 "할 수 있는 일"이 다르다.
 * 접수 → 진행 → 종결 또는 연계. 규칙이 바뀌면 이 파일의 상태 클래스만 고친다.
 */
export interface CaseState {
  readonly status: CaseStatus;
  /** 상태 설명(화면 안내용) */
  describe(): string;
  nextStatuses(): CaseStatus[];
  canAddSession(): boolean;
  /** 회기를 추가할 수 없을 때 이유와 다음 행동 안내 */
  sessionBlockedReason(): string | null;
  /** 상태를 바꾸기 전에 보여줄 확인 문구 */
  confirmMessage(next: CaseStatus): string;
}

class IntakeState implements CaseState {
  readonly status = '접수' as const;
  describe() {
    return '접수된 사례예요. 상담을 시작하면 진행으로 바꿔 주세요.';
  }
  nextStatuses(): CaseStatus[] {
    return ['진행'];
  }
  canAddSession() {
    return false;
  }
  sessionBlockedReason() {
    return '회기를 추가하려면 먼저 사례 상태를 \u2018진행\u2019으로 바꿔 상담을 시작해 주세요.';
  }
  confirmMessage() {
    return '상담을 시작하고 상태를 \u2018진행\u2019으로 바꿀까요?';
  }
}

class ActiveState implements CaseState {
  readonly status = '진행' as const;
  describe() {
    return '상담이 진행 중이에요. 회기를 추가하고 요약을 확정할 수 있어요.';
  }
  nextStatuses(): CaseStatus[] {
    return ['종결', '연계'];
  }
  canAddSession() {
    return true;
  }
  sessionBlockedReason() {
    return null;
  }
  confirmMessage(next: CaseStatus) {
    return next === '종결'
      ? '종결하면 더 이상 회기를 추가할 수 없어요. 종결로 바꿀까요?'
      : '다른 기관으로 연계하면 더 이상 회기를 추가할 수 없어요. 연계로 바꿀까요?';
  }
}

class ClosedState implements CaseState {
  readonly status = '종결' as const;
  describe() {
    return '상담이 끝난 사례예요. 기록과 요약은 볼 수만 있어요.';
  }
  nextStatuses(): CaseStatus[] {
    return [];
  }
  canAddSession() {
    return false;
  }
  sessionBlockedReason() {
    return '종결된 사례에는 회기를 추가할 수 없어요.';
  }
  confirmMessage() {
    return '';
  }
}

class ReferredState implements CaseState {
  readonly status = '연계' as const;
  describe() {
    return '다른 기관으로 연계한 사례예요. 기록과 요약은 볼 수만 있어요.';
  }
  nextStatuses(): CaseStatus[] {
    return [];
  }
  canAddSession() {
    return false;
  }
  sessionBlockedReason() {
    return '연계된 사례에는 회기를 추가할 수 없어요.';
  }
  confirmMessage() {
    return '';
  }
}

const STATES: Record<CaseStatus, CaseState> = {
  접수: new IntakeState(),
  진행: new ActiveState(),
  종결: new ClosedState(),
  연계: new ReferredState(),
};

export function stateOf(status: CaseStatus): CaseState {
  return STATES[status];
}

/** 조사까지 붙인 표현. 예: '진행으로', '종결로' (받침에 맞춰 으로/로를 고른다) */
export function toStatus(status: CaseStatus): string {
  return status === '진행' ? '진행으로' : `${status}로`;
}
