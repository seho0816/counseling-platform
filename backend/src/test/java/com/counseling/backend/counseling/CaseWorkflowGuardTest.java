package com.counseling.backend.counseling;

import com.counseling.backend.client.Client;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CaseWorkflowGuardTest {

    private CounselingCase caseAt(CaseStatus status) {
        CounselingCase found = new CounselingCase(new Client("가상 내담자", null), null, "테스트 사례");
        ReflectionTestUtils.setField(found, "status", status);
        return found;
    }

    @Test
    void activeCaseAllowsWrite() {
        assertThatCode(() -> CaseWorkflowGuard.requireInProgress(caseAt(CaseStatus.IN_PROGRESS)))
            .doesNotThrowAnyException();
    }

    @Test
    void nonActiveCasesRejectWriteWithConflict() {
        for (CaseStatus status : new CaseStatus[]{CaseStatus.RECEIVED, CaseStatus.CLOSED, CaseStatus.REFERRED}) {
            assertThatThrownBy(() -> CaseWorkflowGuard.requireInProgress(caseAt(status)))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                    ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
        }
    }
}
