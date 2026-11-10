package com.counseling.backend.audit;

import com.counseling.backend.security.ActiveActorService;
import com.counseling.backend.user.UserRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminAccessLogService {
    private final AccessLogRepository logs;
    private final ActiveActorService actors;

    public AdminAccessLogService(AccessLogRepository logs, ActiveActorService actors) {
        this.logs = logs;
        this.actors = actors;
    }

    @Transactional(readOnly = true)
    @PreAuthorize("hasRole('ADMIN')")
    public AccessLogPageResponse list(int page, int size, Authentication authentication) {
        actors.require(authentication, UserRole.ADMIN);
        if (page < 0 || size < 1 || size > 50) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "page must be >= 0 and size between 1 and 50");
        }
        Page<AccessLog> found = logs.findAll(PageRequest.of(page, size,
                Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id"))));
        return new AccessLogPageResponse(found.getContent().stream().map(AccessLogResponse::from).toList(),
                found.getNumber(), found.getSize(), found.getTotalElements(), found.getTotalPages());
    }
}
