package com.counseling.backend.counseling;

public record CreateCaseRequest(Long clientId, Long counselorId, String title) {}
