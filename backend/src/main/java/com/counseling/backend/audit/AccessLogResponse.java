package com.counseling.backend.audit;

import java.time.OffsetDateTime;

public record AccessLogResponse(
        Long id,
        Long actorUserId,
        String resourceType,
        Long resourceId,
        String action,
        AccessResult result,
        OffsetDateTime createdAt
) {
    public static AccessLogResponse from(AccessLog log) {
        return new AccessLogResponse(log.getId(),
                log.getActor() == null ? null : log.getActor().getId(),
                log.getResourceType(), log.getResourceId(), log.getAction(),
                log.getResult(), log.getCreatedAt());
    }
}
