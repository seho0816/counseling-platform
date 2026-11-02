package com.counseling.backend.counseling;

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
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

@Entity
@Table(name = "counseling_summaries", schema = "public")
public class CounselingSummary {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id", nullable = false, unique = true)
    private CounselingSession session;

    @Column(name = "ai_draft", nullable = false, columnDefinition = "text")
    private String aiDraft;

    @Column(name = "final_summary", columnDefinition = "text")
    private String finalSummary;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SummaryStatus status = SummaryStatus.DRAFT;

    @Column(name = "model_name", length = 100)
    private String modelName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "confirmed_by")
    private User confirmedBy;

    @Column(name = "confirmed_at")
    private OffsetDateTime confirmedAt;

    protected CounselingSummary() {
    }

    public CounselingSummary(CounselingSession session, String aiDraft, String modelName) {
        if (session == null) {
            throw new IllegalArgumentException("Session is required");
        }
        if (aiDraft == null || aiDraft.isBlank()) {
            throw new IllegalArgumentException("AI draft is required");
        }
        this.session = session;
        this.aiDraft = aiDraft;
        this.modelName = modelName;
    }

    // Final confirmation must later be guarded by a counselor-authorization Service.
    // This Entity method only enforces data consistency, NOT access control.
    public void confirm(User reviewer, String reviewedText) {
        if (status == SummaryStatus.CONFIRMED) {
            throw new IllegalStateException("Summary is already confirmed");
        }
        if (reviewer == null) {
            throw new IllegalArgumentException("Reviewer is required");
        }
        if (reviewedText == null || reviewedText.isBlank()) {
            throw new IllegalArgumentException("Final summary must not be blank");
        }
        this.finalSummary = reviewedText;
        this.confirmedBy = reviewer;
        this.confirmedAt = OffsetDateTime.now(ZoneOffset.UTC);
        this.status = SummaryStatus.CONFIRMED;
    }

    public Long getId() { return id; }
    public CounselingSession getSession() { return session; }
    public String getAiDraft() { return aiDraft; }
    public String getFinalSummary() { return finalSummary; }
    public SummaryStatus getStatus() { return status; }
    public String getModelName() { return modelName; }
    public User getConfirmedBy() { return confirmedBy; }
    public OffsetDateTime getConfirmedAt() { return confirmedAt; }
}
