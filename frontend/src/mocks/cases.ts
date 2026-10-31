import type { CounselingCase } from '../types';

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

/** 가상 사례 데이터. 이름은 모두 가명이다. */
export const CASES: CounselingCase[] = [
  { id: 'case-001', clientAlias: '하늘(가명)', status: '진행', counselorId: 'c-01', sessionCount: 4, lastSessionAt: daysAgo(2), summaryState: 'draft', crisisFlag: false },
  { id: 'case-002', clientAlias: '이든(가명)', status: '진행', counselorId: 'c-01', sessionCount: 6, lastSessionAt: daysAgo(5), summaryState: 'confirmed', crisisFlag: false },
  { id: 'case-003', clientAlias: '나래(가명)', status: '접수', counselorId: 'c-01', sessionCount: 0, lastSessionAt: null, summaryState: 'none', crisisFlag: true },
  { id: 'case-004', clientAlias: '도윤(가명)', status: '진행', counselorId: 'c-01', sessionCount: 3, lastSessionAt: daysAgo(1), summaryState: 'draft', crisisFlag: false },
  { id: 'case-005', clientAlias: '서아(가명)', status: '종결', counselorId: 'c-01', sessionCount: 8, lastSessionAt: daysAgo(21), summaryState: 'confirmed', crisisFlag: false },
  { id: 'case-006', clientAlias: '지후(가명)', status: '진행', counselorId: 'c-01', sessionCount: 2, lastSessionAt: daysAgo(9), summaryState: 'draft', crisisFlag: false },
  { id: 'case-007', clientAlias: '유나(가명)', status: '접수', counselorId: 'c-01', sessionCount: 0, lastSessionAt: null, summaryState: 'none', crisisFlag: false },
  { id: 'case-008', clientAlias: '민서(가명)', status: '연계', counselorId: 'c-01', sessionCount: 5, lastSessionAt: daysAgo(14), summaryState: 'confirmed', crisisFlag: false },
  { id: 'case-009', clientAlias: '시우(가명)', status: '진행', counselorId: 'c-01', sessionCount: 5, lastSessionAt: daysAgo(3), summaryState: 'confirmed', crisisFlag: false },
  { id: 'case-010', clientAlias: '다은(가명)', status: '종결', counselorId: 'c-01', sessionCount: 10, lastSessionAt: daysAgo(30), summaryState: 'confirmed', crisisFlag: false },
  { id: 'case-011', clientAlias: '은우(가명)', status: '진행', counselorId: 'c-02', sessionCount: 2, lastSessionAt: daysAgo(4), summaryState: 'draft', crisisFlag: false },
  { id: 'case-012', clientAlias: '하린(가명)', status: '접수', counselorId: 'c-02', sessionCount: 0, lastSessionAt: null, summaryState: 'none', crisisFlag: false },
  { id: 'case-013', clientAlias: '준서(가명)', status: '진행', counselorId: 'c-03', sessionCount: 3, lastSessionAt: daysAgo(6), summaryState: 'confirmed', crisisFlag: false },
  { id: 'case-014', clientAlias: '소율(가명)', status: '진행', counselorId: 'c-03', sessionCount: 1, lastSessionAt: daysAgo(2), summaryState: 'draft', crisisFlag: false },
];
