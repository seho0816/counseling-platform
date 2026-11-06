package com.counseling.backend.counseling;

/** MVP status workflow. CLOSED and REFERRED are terminal states. */
public enum CaseStatus {
    RECEIVED,
    IN_PROGRESS,
    CLOSED,
    REFERRED;

    public boolean canTransitionTo(CaseStatus next) {
        if (next == null) return false;
        return switch (this) {
            case RECEIVED -> next == IN_PROGRESS || next == REFERRED;
            case IN_PROGRESS -> next == CLOSED || next == REFERRED;
            case CLOSED, REFERRED -> false;
        };
    }
}
