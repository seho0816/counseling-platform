package com.counseling.backend.counseling;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SummaryFieldsTest {
    @Test
    void trimsAndNormalizesMissingFields() {
        SummaryFields validated = new SummaryFields("  진로 고민  ", " ", null).validated();
        assertThat(validated.complaint()).isEqualTo("진로 고민");
        assertThat(validated.intervention()).isNull();
        assertThat(validated.nextPlan()).isNull();
    }

    @Test
    void rejectsCompletelyEmptyOrOversizedSummary() {
        assertThatThrownBy(() -> new SummaryFields(null, "", "  ").validated())
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new SummaryFields("x".repeat(5001), null, null).validated())
            .isInstanceOf(IllegalArgumentException.class);
    }
}
