package com.counseling.backend.intake;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

@Entity
@Table(name = "intake_forms", schema = "public")
public class IntakeForm {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "applicant_name", nullable = false, length = 100)
    private String applicantName;

    @Column(name = "applicant_contact", length = 50)
    private String applicantContact;

    @Column(name = "concern_category", nullable = false, length = 50)
    private String concernCategory;

    @Column(name = "concern_description", nullable = false, columnDefinition = "text")
    private String concernDescription;

    @Column(name = "has_prior_counseling")
    private Boolean hasPriorCounseling;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private IntakeStatus status = IntakeStatus.SUBMITTED;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected IntakeForm() {
    }

    public IntakeForm(String applicantName, String applicantContact,
                      String concernCategory, String concernDescription,
                      Boolean hasPriorCounseling) {
        if (applicantName == null || applicantName.isBlank()) {
            throw new IllegalArgumentException("Applicant name is required");
        }
        if (concernCategory == null || concernCategory.isBlank()) {
            throw new IllegalArgumentException("Concern category is required");
        }
        if (concernDescription == null || concernDescription.isBlank()) {
            throw new IllegalArgumentException("Concern description is required");
        }
        this.applicantName = applicantName;
        this.applicantContact = applicantContact;
        this.concernCategory = concernCategory;
        this.concernDescription = concernDescription;
        this.hasPriorCounseling = hasPriorCounseling;
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now(ZoneOffset.UTC);
        }
    }

    public void markProcessed() {
        status = IntakeStatus.PROCESSED;
    }

    public Long getId() { return id; }
    public String getApplicantName() { return applicantName; }
    public String getApplicantContact() { return applicantContact; }
    public String getConcernCategory() { return concernCategory; }
    public String getConcernDescription() { return concernDescription; }
    public Boolean getHasPriorCounseling() { return hasPriorCounseling; }
    public IntakeStatus getStatus() { return status; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
