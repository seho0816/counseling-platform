package com.counseling.backend.admin;

import com.counseling.backend.user.User;

public record CounselorResponse(Long id, String email, String name, String role, boolean active) {
    public static CounselorResponse from(User user) {
        return new CounselorResponse(user.getId(), user.getEmail(), user.getName(), user.getRole().name(), user.isActive());
    }
}
