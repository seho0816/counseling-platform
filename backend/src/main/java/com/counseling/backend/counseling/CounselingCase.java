package com.counseling.backend.counseling;

import com.counseling.backend.client.Client;
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
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

@Entity
@Table(name = "counseling_cases", schema = "public")
public class CounselingCase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "client_id", nullable = false)
    private Client client;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "counselor_id")
    private User counselor;

    // IntakeForm entity will be implemented later; its FK already exists in PostgreSQL.
    @Column(name = "intake_form_id", unique = true)
    private Long intakeFormId;

    @Column(nullable = false, length = 200)
    private String title;

    // Free text describing the client's concern; distinct from the short case title.
    @Column(name = "concern", columnDefinition = "text")
    private String concern;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CaseStatus status = CaseStatus.RECEIVED;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    protected CounselingCase() {
        // JPA requires a no-argument constructor.
    }

    public CounselingCase(Client client, User counselor, String title) {
        this(client, counselor, title, null);
    }

    public CounselingCase(Client client, User counselor, String title, String concern) {
        if (client == null) {
            throw new IllegalArgumentException("Client must not be null");
        }
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("Title must not be blank");
        }
        this.client = client;
        this.counselor = counselor; // Can be null while assignment is pending.
        this.title = title;
        this.concern = concern;
    }

    /** Admin-only assignment is controlled by AdminCaseWriteService. */
    public void assignCounselor(User counselor) {
        this.counselor = counselor;
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now(ZoneOffset.UTC);
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = OffsetDateTime.now(ZoneOffset.UTC);
    }

    public Long getId() { return id; }
    public Client getClient() { return client; }
    public User getCounselor() { return counselor; }
    public Long getIntakeFormId() { return intakeFormId; }
    public String getTitle() { return title; }
    public String getConcern() { return concern; }
    public CaseStatus getStatus() { return status; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
