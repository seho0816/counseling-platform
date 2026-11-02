
package com.counseling.backend.counseling;

import com.counseling.backend.user.User;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(
    name = "counseling_sessions",
    uniqueConstraints = @UniqueConstraint(
        columnNames = {"case_id", "session_number"}
    )
)
public class CounselingSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "case_id", nullable = false)
    private CounselingCase counselingCase;

    @Column(name = "session_number", nullable = false)
    private Integer sessionNumber;

    @Column(name = "session_date", nullable = false)
    private LocalDate sessionDate;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_user_id", nullable = false)
    private User author;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    protected CounselingSession() {
    }

    public CounselingSession(
            CounselingCase counselingCase,
            Integer sessionNumber,
            LocalDate sessionDate,
            String content,
            User author) {
        this.counselingCase = counselingCase;
        this.sessionNumber = sessionNumber;
        this.sessionDate = sessionDate;
        this.content = content;
        this.author = author;
    }

    @PrePersist
    protected void onCreate() {
        createdAt = OffsetDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public CounselingCase getCounselingCase() {
        return counselingCase;
    }

    public Integer getSessionNumber() {
        return sessionNumber;
    }

    public LocalDate getSessionDate() {
        return sessionDate;
    }

    public String getContent() {
        return content;
    }

    public User getAuthor() {
        return author;
    }
}
