package com.counseling.backend.counseling;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CaseStatusTransitionTest {
    @Test
    void permittedWorkflow() {
        assertThat(CaseStatus.RECEIVED.canTransitionTo(CaseStatus.IN_PROGRESS)).isTrue();
        assertThat(CaseStatus.RECEIVED.canTransitionTo(CaseStatus.REFERRED)).isTrue();
        assertThat(CaseStatus.IN_PROGRESS.canTransitionTo(CaseStatus.CLOSED)).isTrue();
        assertThat(CaseStatus.IN_PROGRESS.canTransitionTo(CaseStatus.REFERRED)).isTrue();
    }

    @Test
    void rejectsBackwardOrTerminalTransitions() {
        assertThat(CaseStatus.RECEIVED.canTransitionTo(CaseStatus.CLOSED)).isFalse();
        assertThat(CaseStatus.IN_PROGRESS.canTransitionTo(CaseStatus.RECEIVED)).isFalse();
        assertThat(CaseStatus.CLOSED.canTransitionTo(CaseStatus.IN_PROGRESS)).isFalse();
        assertThat(CaseStatus.REFERRED.canTransitionTo(CaseStatus.RECEIVED)).isFalse();
        assertThat(CaseStatus.RECEIVED.canTransitionTo(null)).isFalse();
    }
}
