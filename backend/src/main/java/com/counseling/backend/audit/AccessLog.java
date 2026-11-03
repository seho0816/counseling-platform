package com.counseling.backend.audit;

import com.counseling.backend.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

@Entity
@Table(name = "access_logs", schema = "public")
public class AccessLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Nullable to record unauthenticated/unknown actors in future Service.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_user_id")
    private User actor;

    @Column(name = "resource_type", nullable = false, length = 40)
    private String resourceType;

    @Column(name = "resource_id")
    private Long resourceId;

    @Column(nullable = false, length = 40)
    private String action;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AccessResult result;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected AccessLog() {
    }

    public AccessLog(User actor, String resourceType, Long resourceId,
                     String action, AccessResult result) {
        if (resourceType == null || resourceType.isBlank()) {
            throw new IllegalArgumentException("Resource type is required");
        }
        if (action == null || action.isBlank()) {
            throw new IllegalArgumentException("Action is required");
        }
        if (result == null) {
            throw new IllegalArgumentException("Result is required");
        }
        this.actor = actor;
        this.resourceType = resourceType;
        this.resourceId = resourceId;
        this.action = action;
        this.result = result;
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now(ZoneOffset.UTC);
        }
    }

    public Long getId() { return id; }
    public User getActor() { return actor; }
    public String getResourceType() { return resourceType; }
    public Long getResourceId() { return resourceId; }
    public String getAction() { return action; }
    public AccessResult getResult() { return result; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
