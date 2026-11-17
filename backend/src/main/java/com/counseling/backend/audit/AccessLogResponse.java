
package com.counseling.backend.audit;

import com.counseling.backend.user.User;
import java.time.OffsetDateTime;

public record AccessLogResponse(
        Long id,
        Long actorUserId,
        String actorName,
        String resourceType,
        Long resourceId,
        String action,
        AccessResult result,
        OffsetDateTime createdAt
) {
    public static AccessLogResponse from(AccessLog log) {
        User actor = log.getActor();

        return new AccessLogResponse(
                log.getId(),
                actor == null ? null : actor.getId(),
                actor == null ? null : actor.getName(),
                log.getResourceType(),
                log.getResourceId(),
                log.getAction(),
                log.getResult(),
                log.getCreatedAt()
        );
    }
}
