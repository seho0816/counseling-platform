package com.counseling.backend.audit;

import com.counseling.backend.user.User;
import com.counseling.backend.user.UserRepository;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditLogWriter {
    private final AccessLogRepository logs;
    private final UserRepository users;

    public AuditLogWriter(AccessLogRepository logs, UserRepository users) {
        this.logs = logs;
        this.users = users;
    }

    /** Independent transaction: a denied/rolled-back request must still leave an audit event. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(Authentication auth, AuditTarget target, AccessResult result) {
        User actor = null;
        if (auth != null && auth.isAuthenticated() && !(auth instanceof AnonymousAuthenticationToken)) {
            actor = users.findByEmail(auth.getName()).orElse(null);
        }
        logs.save(new AccessLog(actor, target.resourceType(), target.resourceId(), target.action(), result));
    }
}
