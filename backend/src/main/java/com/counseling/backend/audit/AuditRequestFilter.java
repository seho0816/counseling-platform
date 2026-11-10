package com.counseling.backend.audit;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/** Mounted inside Spring Security (not as a servlet @Component) to observe auth decisions. */
public class AuditRequestFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(AuditRequestFilter.class);
    private final AuditLogWriter writer;

    public AuditRequestFilter(AuditLogWriter writer) {
        this.writer = writer;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        AuditTarget target = AuditTarget.from(request.getMethod(), request.getServletPath());
        if (target == null) {
            chain.doFilter(request, response);
            return;
        }
        // Called after authentication, before ExceptionTranslationFilter handles 401/403.
        Authentication actor = SecurityContextHolder.getContext().getAuthentication();
        boolean completed = false;
        try {
            chain.doFilter(request, response);
            completed = true;
        } finally {
            AccessResult result = completed && response.getStatus() < 400
                    ? AccessResult.SUCCESS : AccessResult.DENIED;
            try {
                writer.record(actor, target, result);
            } catch (RuntimeException ex) {
                // Never expose request bodies or tokens in logs. Auditing is best effort at this stage.
                log.error("Unable to persist an access audit event", ex);
            }
        }
    }
}
