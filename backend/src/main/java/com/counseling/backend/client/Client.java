package com.counseling.backend.client;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

@Entity
@Table(name = "clients", schema = "public")
public class Client {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 50)
    private String contact;

    // Frontend AgeGroup: 10대, 20대, 30대, 40대, 50대, 60대 이상.
    @Column(name = "age_group", length = 20)
    private String ageGroup;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected Client() {
        // Required by JPA.
    }

    public Client(String name, String contact) {
        this(name, contact, null);
    }

    public Client(String name, String contact, String ageGroup) {
        this.name = name;
        this.contact = contact;
        this.ageGroup = ageGroup;
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now(ZoneOffset.UTC);
        }
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getContact() { return contact; }
    public String getAgeGroup() { return ageGroup; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
