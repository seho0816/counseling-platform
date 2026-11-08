package com.counseling.backend.audit;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class AuditRequestFilterTest {
    @Test
    void recordsSuccessWithoutReadingBody() throws Exception {
        AuditLogWriter writer = mock(AuditLogWriter.class);
        AuditRequestFilter filter = new AuditRequestFilter(writer);
        FilterChain chain = (req, res) -> ((MockHttpServletResponse) res).setStatus(200);
        var auth = new UsernamePasswordAuthenticationToken("tester@example.invalid", "secret");
        SecurityContextHolder.getContext().setAuthentication(auth);
        try {
            MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/cases/43");
            request.setServletPath("/api/cases/43");
            filter.doFilter(request, new MockHttpServletResponse(), chain);
            verify(writer).record(eq(auth), eq(new AuditTarget("CASE", 43L, "READ")),
                    eq(AccessResult.SUCCESS));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void recordsDeniedResponse() throws Exception {
        AuditLogWriter writer = mock(AuditLogWriter.class);
        AuditRequestFilter filter = new AuditRequestFilter(writer);
        FilterChain chain = (req, res) -> ((MockHttpServletResponse) res).setStatus(403);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/admin/intakes/9");
        request.setServletPath("/api/admin/intakes/9");
        filter.doFilter(request, new MockHttpServletResponse(), chain);
        verify(writer).record(any(), eq(new AuditTarget("INTAKE", 9L, "READ")),
                eq(AccessResult.DENIED));
    }

    @Test
    void ignoresHealthRequests() throws Exception {
        AuditLogWriter writer = mock(AuditLogWriter.class);
        AuditRequestFilter filter = new AuditRequestFilter(writer);
        filter.doFilter(new MockHttpServletRequest("GET", "/api/health"),
                new MockHttpServletResponse(), (req, res) -> {});
        verifyNoInteractions(writer);
    }
}
