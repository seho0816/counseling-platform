package com.counseling.backend.counseling;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

class NameMaskerTest {

    @Test
    void masksTheFullNameEverywhere() {
        assertEquals("[이름] 내담자는 불안하다고 함. [이름]의 가족 이야기도 함.",
            NameMasker.maskClientName("김하늘 내담자는 불안하다고 함. 김하늘의 가족 이야기도 함.", "김하늘"));
    }

    @Test
    void alsoMasksTheGivenNameOfAThreeSyllableName() {
        assertEquals("[이름] 님은 직무를 조사하기로 함.",
            NameMasker.maskClientName("하늘 님은 직무를 조사하기로 함.", "김하늘"));
    }

    @Test
    void masksTheLongerFormFirstSoNothingOfTheNameIsLeftBehind() {
        assertEquals("[이름] 와 [이름]", NameMasker.maskClientName("김하늘 와 하늘", "김하늘"));
    }

    @Test
    void leavesTheNoteAloneWhenTheNameIsAbsentOrUnknown() {
        assertEquals("내담자가 진로 불안을 표현함.", NameMasker.maskClientName("내담자가 진로 불안을 표현함.", "김하늘"));
        assertEquals("내담자가 진로 불안을 표현함.", NameMasker.maskClientName("내담자가 진로 불안을 표현함.", null));
        assertEquals("내담자가 진로 불안을 표현함.", NameMasker.maskClientName("내담자가 진로 불안을 표현함.", " "));
        assertNull(NameMasker.maskClientName(null, "김하늘"));
    }

    @Test
    void doesNotMaskTheGenericWordForAClient() {
        assertEquals("내담자가 진로 불안을 표현함.", NameMasker.maskClientName("내담자가 진로 불안을 표현함.", "가상 내담자"));
    }

    @Test
    void masksTwoSyllableNamesOnlyAsAWhole() {
        assertEquals("[이름] 님이 오셨다.", NameMasker.maskClientName("이안 님이 오셨다.", "이안"));
        assertEquals("이 안건을 논의함.", NameMasker.maskClientName("이 안건을 논의함.", "이안"));
    }
}
