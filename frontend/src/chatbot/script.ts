import { COUNSELING_FIELDS, AGE_GROUPS } from '../constants/fields';
import type { IntakeAnswers } from '../types';

/** 챗봇이 안내하는 기관·프로그램(가상 정보). 사전에 등록한 내용만 안내한다. (F-04-1) */
export interface Program {
  id: string;
  name: string;
  target: string;
  method: string;
  hours: string;
  summary: string;
}

export const PROGRAMS: Program[] = [
  { id: 'personal', name: '개인 상담', target: '마음이 힘든 성인·청소년', method: '실시간 채팅, 음성 메시지', hours: '평일 10:00~20:00', summary: '상담사와 1:1로 고민을 나눠요. 비용은 무료예요.' },
  { id: 'youth', name: '청소년 상담', target: '청소년과 보호자', method: '실시간 채팅, 음성 메시지', hours: '평일 14:00~20:00, 토요일 10:00~12:00', summary: '학업·진로·친구 관계 고민을 편하게 이야기해요.' },
  { id: 'family', name: '가족·부부 상담', target: '가족 갈등이나 소통이 어려운 분', method: '실시간 채팅', hours: '평일 18:00~20:00, 토요일 10:00~12:00', summary: '가족 안의 갈등을 함께 정리하고 대화 방법을 찾아가요.' },
  { id: 'work', name: '직장인 마음건강 상담', target: '직장 스트레스나 번아웃을 겪는 분', method: '음성 메시지, 실시간 채팅', hours: '평일 19:00~20:00', summary: '퇴근 후에도 이용할 수 있어요.' },
  { id: 'senior', name: '노인·돌봄 상담', target: '어르신과 돌봄 가족', method: '음성 메시지, 실시간 채팅', hours: '평일 10:00~17:00', summary: '돌봄 부담과 외로움을 이야기하고 필요한 서비스를 연결해요.' },
  { id: 'welfare', name: '복지 서비스 연결', target: '생활이 막막한 분', method: '실시간 채팅', hours: '평일 10:00~12:00', summary: '받을 수 있는 지원 제도를 안내하고 신청을 도와요.' },
];

/** 상담 신청 절차 (F-04-2) */
export const PROCEDURE_STEPS = [
  '챗봇에서 초기 질문지를 작성해 제출해요.',
  '고른 상담 분야에 맞는 상담사에게 접수돼요.',
  '담당 상담사가 질문지를 확인하고 상담 시간을 안내해요.',
  '정해진 시간에 선택한 방식(실시간 채팅·음성 메시지)으로 상담을 시작해요.',
];

export interface IntakeQuestion {
  id: keyof IntakeAnswers;
  prompt: string;
  options?: string[];
  /** 자유롭게 글로 적는 질문. 위기 표현 감지도 이 입력에서 함께 이뤄진다. */
  freeText?: boolean;
  skippable?: boolean;
}

/** 초기 질문지 항목 (F-04-3). 선택지 위주로 구성해 부담을 줄인다. */
export const INTAKE_QUESTIONS: IntakeQuestion[] = [
  { id: 'field', prompt: '어떤 일로 상담을 받고 싶으세요? 가까운 것을 골라 주세요.', options: [...COUNSELING_FIELDS, '잘 모르겠어요'] },
  { id: 'ageGroup', prompt: '연령대를 알려 주세요.', options: [...AGE_GROUPS] },
  { id: 'method', prompt: '어떤 방식이 편하세요?', options: ['실시간 채팅', '음성 메시지', '상관없어요'] },
  { id: 'time', prompt: '상담하기 편한 시간대는 언제인가요?', options: ['평일 낮', '평일 저녁', '주말', '상관없어요'] },
  { id: 'concern', prompt: '지금 가장 힘든 점을 한두 문장으로 적어 주세요. 쓰고 싶지 않으면 건너뛰어도 돼요.', freeText: true, skippable: true },
];

export const ANSWER_LABEL: Record<keyof IntakeAnswers, string> = {
  field: '상담 분야',
  ageGroup: '연령대',
  method: '상담 방식',
  time: '편한 시간대',
  concern: '힘든 점',
};
