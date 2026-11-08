package com.counseling.backend.audit;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AuditTargetTest {
    @Test
    void recognizesSensitiveEndpoints() {
        assertThat(AuditTarget.from("GET", "/api/cases/43"))
                .isEqualTo(new AuditTarget("CASE", 43L, "READ"));
        assertThat(AuditTarget.from("PATCH", "/api/cases/43/status"))
                .isEqualTo(new AuditTarget("CASE", 43L, "UPDATE_STATUS"));
        assertThat(AuditTarget.from("POST", "/api/cases/43/sessions"))
                .isEqualTo(new AuditTarget("SESSION", 43L, "CREATE"));
        assertThat(AuditTarget.from("PATCH", "/api/cases/43/sessions/16"))
                .isEqualTo(new AuditTarget("SESSION", 16L, "UPDATE"));
        assertThat(AuditTarget.from("PUT", "/api/sessions/16/summary/confirm"))
                .isEqualTo(new AuditTarget("SUMMARY", 16L, "CONFIRM"));
        assertThat(AuditTarget.from("POST", "/api/admin/intakes/9/convert"))
                .isEqualTo(new AuditTarget("INTAKE", 9L, "CONVERT"));
        assertThat(AuditTarget.from("PATCH", "/api/admin/cases/43/assignment"))
                .isEqualTo(new AuditTarget("CASE", 43L, "ASSIGN"));
    }

    @Test
    void ignoresAuthenticationAndAuditEndpoints() {
        assertThat(AuditTarget.from("POST", "/api/auth/login")).isNull();
        assertThat(AuditTarget.from("GET", "/api/admin/logs")).isNull();
        assertThat(AuditTarget.from("GET", "/api/health")).isNull();
        assertThat(AuditTarget.from("GET", "/api/cases/not-a-number")).isNull();
        assertThat(AuditTarget.from("GET", "/api/cases/999999999999999999999999")).isNull();
    }
}
